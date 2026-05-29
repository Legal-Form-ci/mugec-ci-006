import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

const adminRoles = [
  "super_admin", "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section",
];

const memberStatusSchema = z.enum(["actif", "en_attente", "suspendu", "decede", "marie", "licencie", "assiste", "retraite"]);

async function assertRole(userId: string, roles: string[]) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", roles)
    .limit(1);
  if (error || !data?.length) throw new Error("Accès refusé");
}

async function countRows(table: string, filters?: (query: any) => any) {
  let query = db.from(table).select("id", { count: "exact", head: true });
  if (filters) query = filters(query);
  const { count } = await query;
  return count ?? 0;
}

async function sumRows(table: string, column: string, filters?: (query: any) => any) {
  let query = db.from(table).select(column).limit(10000);
  if (filters) query = filters(query);
  const { data } = await query;
  return ((data as any[]) ?? []).reduce((sum, row) => sum + (Number(row[column]) || 0), 0);
}

export const getAdminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRole(context.userId, adminRoles);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [members_total, members_actifs, members_en_attente, members_suspendus, cotisations_total, cotisations_mois, droits_adhesion_total, droits_adhesion_mois, prestations_en_cours, prestations_validees_mois, prestations_rejetees_mois] = await Promise.all([
      countRows("members"),
      countRows("members", (q) => q.eq("statut", "actif")),
      countRows("members", (q) => q.eq("statut", "en_attente")),
      countRows("members", (q) => q.eq("statut", "suspendu")),
      sumRows("subscriptions", "montant_total", (q) => q.eq("type", "cotisation").eq("statut_paiement", "paye")),
      sumRows("subscriptions", "montant_total", (q) => q.eq("type", "cotisation").eq("statut_paiement", "paye").gte("created_at", monthStart)),
      sumRows("subscriptions", "montant_total", (q) => q.eq("type", "inscription").eq("statut_paiement", "paye")),
      sumRows("subscriptions", "montant_total", (q) => q.eq("type", "inscription").eq("statut_paiement", "paye").gte("created_at", monthStart)),
      countRows("prestation_requests", (q) => q.in("statut_global", ["en_attente", "en_cours"])),
      countRows("prestation_requests", (q) => q.eq("statut_global", "valide").gte("created_at", monthStart)),
      countRows("prestation_requests", (q) => q.eq("statut_global", "rejete").gte("created_at", monthStart)),
    ]);
    return { members_total, members_actifs, members_en_attente, members_suspendus, cotisations_total, cotisations_mois, droits_adhesion_total, droits_adhesion_mois, revenus_total: cotisations_total + droits_adhesion_total, revenus_mois: cotisations_mois + droits_adhesion_mois, prestations_en_cours, prestations_validees_mois, prestations_rejetees_mois };
  });

export const setMemberStatusSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), statut: memberStatusSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, adminRoles);
    const { error } = await db.from("members").update({ statut: data.statut }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMemberSafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).passthrough().parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, adminRoles);
    const allowed = ["nom", "prenoms", "email", "telephone", "cni", "adresse", "photo_url", "collectivite", "region", "direction", "fonction", "matricule_pro", "sexe", "lieu_naissance", "date_naissance", "date_embauche", "ayants_droit", "type_membre", "suspended_reason"];
    const patch = Object.fromEntries(allowed.filter((key) => key in data).map((key) => [key, data[key] === "" ? null : data[key]]));
    const { error } = await db.from("members").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markCotisationPaidSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, adminRoles);
    const { error } = await db.from("cotisations").update({ statut: "paye", paye_le: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveNotificationTemplateSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ event: z.string().trim().min(1).max(120), channel: z.enum(["email", "sms", "whatsapp", "in_app"]), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(4000), active: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { error } = await db.from("notification_templates").insert({ ...data, active: data.active ?? true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleNotificationTemplateSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const { error } = await db.from("notification_templates").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const validatePrestationStepSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ requestId: z.string().uuid(), action: z.enum(["valide", "rejete"]), motif: z.string().max(1000).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: req, error: reqErr } = await db.from("prestation_requests").select("*").eq("id", data.requestId).single();
    if (reqErr || !req) throw new Error("Demande introuvable");
    const required = ["delegue_section", "secretaire_regional", "secretaire_general", "tresorier_national"][Math.max(0, Number(req.step_validation) - 1)] ?? "system";
    await assertRole(context.userId, required === "system" ? ["super_admin"] : ["super_admin", required]);
    const now = new Date().toISOString();
    const { error: valErr } = await db.from("prestation_validations").insert({ request_id: data.requestId, niveau: req.step_validation, validateur_id: context.userId, role_requis: required, action: data.action, motif: data.motif ?? null, validated_at: now });
    if (valErr) throw new Error(valErr.message);
    const patch = data.action === "rejete" ? { statut_global: "rejete", motif_rejet: data.motif ?? null, closed_at: now, updated_at: now } : Number(req.step_validation) >= 4 ? { step_validation: 5, statut_global: "valide", closed_at: now, updated_at: now } : { step_validation: Number(req.step_validation) + 1, statut_global: "en_cours", updated_at: now };
    const { error } = await db.from("prestation_requests").update(patch).eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMiprojetDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ page: z.number().int().min(0).default(0) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertRole(context.userId, ["super_admin"]);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ data: tx }, { data: allTx }, parts_miprojet_mois, parts_mutuelle_mois, transactions_total, transactions_paye, transactions_attente] = await Promise.all([
      db.from("transactions_miprojet").select("id, montant, statut, reference, created_at, date_virement").order("created_at", { ascending: false }).range(data.page * 50, data.page * 50 + 49),
      db.from("transactions_miprojet").select("id, montant, statut, reference, created_at, date_virement").order("created_at", { ascending: false }).limit(1000),
      sumRows("subscriptions", "part_miprojet", (q) => q.eq("statut_paiement", "paye").gte("created_at", monthStart)),
      sumRows("subscriptions", "part_mutuelle", (q) => q.eq("statut_paiement", "paye").gte("created_at", monthStart)),
      sumRows("transactions_miprojet", "montant"),
      sumRows("transactions_miprojet", "montant", (q) => q.in("statut", ["vire", "confirme", "paye"])),
      sumRows("transactions_miprojet", "montant", (q) => q.eq("statut", "en_attente")),
    ]);
    return { tx: tx ?? [], allTx: allTx ?? [], stats: { transactions_total, transactions_paye, transactions_attente, parts_miprojet_mois, parts_mutuelle_mois, sessions_paiement: (allTx ?? []).length } };
  });

export const getMemberPublicInfoSecure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ matricule: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { data: member, error } = await db.from("members").select("matricule, nom, prenoms, photo_url, collectivite, region, fonction, statut, type_membre, date_inscription").eq("matricule", data.matricule).maybeSingle();
    if (error) throw new Error(error.message);
    return member;
  });

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ nom: z.string().trim().min(2).max(120), email: z.string().trim().email().max(255), telephone: z.string().trim().max(32).optional(), sujet: z.string().trim().max(200).optional(), message: z.string().trim().min(5).max(4000) }).parse(input))
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db.from("contact_messages").select("id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", since);
    if ((count ?? 0) >= 3) throw new Error("Trop de messages envoyés. Réessayez plus tard.");
    const { error } = await db.from("contact_messages").insert({ ...data, telephone: data.telephone || null, sujet: data.sujet || null, user_id: null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });