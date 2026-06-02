import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const ADMIN_ROLES = new Set([
  "super_admin", "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section",
]);

async function assertAdmin(userId: string) {
  const db = await getDb();
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(`Diagnostic rôle admin: ${error.message}`);
  const ok = (data ?? []).some((r: { role: string }) => ADMIN_ROLES.has(String(r.role)));
  if (!ok) throw new Error("Accès refusé");
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function callGateway(messages: any[], model = "google/gemini-3-flash-preview") {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurée");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Limite IA atteinte, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Rechargez votre espace.");
    throw new Error(`Erreur IA: ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Génère un article complet à partir d'un sujet libre. */
export const generateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      topic: z.string().trim().min(2).max(500),
      kind: z.enum(["actualite", "opportunite"]).default("actualite"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const kindLabel = data.kind === "actualite" ? "actualité" : "opportunité";
    const system = `Tu es l'éditeur officiel de MUGEC-CI (Mutuelle Générale des Collectivités de Côte d'Ivoire). Rédige une ${kindLabel} professionnelle, claire, en français, ton institutionnel sobre, structurée en HTML (h2, h3, p, ul/li, blockquote, strong). Réponds STRICTEMENT en JSON valide.`;
    const user = `Sujet / brief : "${data.topic}"

Produis un JSON avec EXACTEMENT ces champs :
{
  "title": "titre clair, max 80 caractères",
  "summary": "résumé editorial, 2-3 phrases, max 280 caractères",
  "body": "<contenu HTML complet, riche, 500-900 mots, h2/h3/p/ul/strong/blockquote, SANS balises html/body>",
  "category": "Annonces | Vie de la mutuelle | Partenariats | Formation | Emploi | Marché public",
  "tags": ["3 à 6 mots-clés courts"],
  "meta_title": "titre SEO max 60 caractères",
  "meta_description": "meta description SEO max 155 caractères",
  "image_prompt": "description courte (anglais) pour générer une image illustrant l'article, style photo éditoriale, sans texte"
}
Aucune autre clé, aucun commentaire, JSON pur.`;
    const raw = await callGateway([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse IA invalide");
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { throw new Error("Réponse IA non parsable"); }
    return {
      title: String(parsed.title ?? "").slice(0, 200),
      summary: String(parsed.summary ?? "").slice(0, 500),
      body: String(parsed.body ?? ""),
      category: String(parsed.category ?? ""),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [],
      meta_title: String(parsed.meta_title ?? "").slice(0, 70),
      meta_description: String(parsed.meta_description ?? "").slice(0, 180),
      image_prompt: String(parsed.image_prompt ?? data.topic),
      slug: slugify(parsed.title ?? data.topic),
    };
  });

async function generateImageDataUrl(prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY non configurée");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      prompt: `Editorial photography, professional, clean. ${prompt}. No text, no watermark.`,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: `Editorial professional photo: ${prompt}. No text.` }],
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Limite IA atteinte.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    throw new Error(`Erreur image: ${res.status}`);
  }
  const data = await res.json();
  // try multiple response shapes
  const b64 = data?.data?.[0]?.b64_json
    ?? data?.choices?.[0]?.message?.images?.[0]?.image_url?.url?.replace(/^data:image\/[^;]+;base64,/, "")
    ?? data?.choices?.[0]?.message?.content?.match?.(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/)?.[1];
  if (!b64) throw new Error("Image non générée");
  return `data:image/png;base64,${b64}`;
}

async function uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
  const db = await getDb();
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) throw new Error("Image invalide");
  const ext = m[1].split("/")[1] || "png";
  const buf = Buffer.from(m[2], "base64");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage.from("content").upload(path, buf, {
    contentType: m[1], upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = db.storage.from("content").getPublicUrl(path);
  return data.publicUrl;
}

/** Génère 1 image cover ou N illustrations et retourne les URLs publiques. */
export const generateArticleImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      prompt: z.string().trim().min(2).max(1000),
      mode: z.enum(["cover", "illustrations"]),
      count: z.number().int().min(1).max(3).default(1),
      folder: z.enum(["actualites", "opportunites"]).default("actualites"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const n = data.mode === "cover" ? 1 : Math.min(3, data.count);
    const urls: string[] = [];
    for (let i = 0; i < n; i++) {
      const dataUrl = await generateImageDataUrl(
        n === 1 ? data.prompt : `${data.prompt} — vue ${i + 1}, angle différent`,
      );
      const url = await uploadDataUrl(dataUrl, data.folder);
      urls.push(url);
    }
    return { urls };
  });

const newsSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(120).optional().nullable(),
  summary: z.string().max(500).optional().nullable(),
  body: z.string().min(2),
  cover_url: z.string().max(500).optional().nullable(),
  illustrations: z.array(z.string()).optional().default([]),
  category: z.string().max(80).optional().nullable(),
  tags: z.array(z.string().max(40)).max(10).optional().default([]),
  meta_title: z.string().max(120).optional().nullable(),
  meta_description: z.string().max(300).optional().nullable(),
  published: z.boolean().default(true),
});

export const upsertNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => newsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const db = await getDb();
    const payload: any = {
      title: data.title,
      slug: data.slug || slugify(data.title),
      summary: data.summary || null,
      body: data.body,
      cover_url: data.cover_url || null,
      illustrations: data.illustrations ?? [],
      category: data.category || null,
      tags: data.tags ?? [],
      meta_title: data.meta_title || null,
      meta_description: data.meta_description || null,
      published: data.published,
      author_id: context.userId,
    };
    if (data.id) {
      const { error } = await db.from("news").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await db.from("news").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

const oppSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(120).optional().nullable(),
  summary: z.string().max(500).optional().nullable(),
  description: z.string().min(2),
  body: z.string().optional().nullable(),
  cover_url: z.string().max(500).optional().nullable(),
  illustrations: z.array(z.string()).optional().default([]),
  type: z.string().max(80).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  tags: z.array(z.string().max(40)).max(10).optional().default([]),
  lieu: z.string().max(150).optional().nullable(),
  date_limite: z.string().optional().nullable(),
  meta_title: z.string().max(120).optional().nullable(),
  meta_description: z.string().max(300).optional().nullable(),
  published: z.boolean().default(true),
});

export const upsertOpportunite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => oppSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const db = await getDb();
    const payload: any = {
      title: data.title,
      slug: data.slug || slugify(data.title),
      summary: data.summary || null,
      description: data.description,
      body: data.body || data.description,
      cover_url: data.cover_url || null,
      illustrations: data.illustrations ?? [],
      type: data.type || data.category || null,
      category: data.category || null,
      tags: data.tags ?? [],
      lieu: data.lieu || null,
      date_limite: data.date_limite || null,
      meta_title: data.meta_title || null,
      meta_description: data.meta_description || null,
      published: data.published,
    };
    if (data.id) {
      const { error } = await db.from("opportunites").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await db.from("opportunites").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["news", "opportunites"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const db = await getDb();
    const { error } = await db.from(data.kind).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Upload une image locale (max 20MB) envoyée en base64 par l'éditeur. */
export const uploadContentImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dataUrl: z.string().min(20).max(28_000_000), // ~20MB base64
      folder: z.enum(["actualites", "opportunites"]).default("actualites"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const url = await uploadDataUrl(data.dataUrl, data.folder);
    return { url };
  });