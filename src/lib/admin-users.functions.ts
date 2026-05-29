import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Réservé au super administrateur");
}

const MUGEC_ROLES = [
  "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section",
] as const;

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at");
    const adminSet = new Set(["super_admin", "miprojet_admin", "miprojet_viewer", ...MUGEC_ROLES]);
    const map = new Map<string, { user_id: string; roles: string[]; created_at: string }>();
    for (const r of roles ?? []) {
      if (!adminSet.has(String(r.role))) continue;
      const cur = map.get(r.user_id) ?? { user_id: r.user_id, roles: [], created_at: r.created_at };
      cur.roles.push(String(r.role));
      map.set(r.user_id, cur);
    }
    const userIds = Array.from(map.keys());
    const users: any[] = [];
    for (const id of userIds) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        if (data?.user) {
          const entry = map.get(id)!;
          users.push({
            id,
            email: data.user.email,
            phone: data.user.phone,
            created_at: data.user.created_at,
            last_sign_in_at: data.user.last_sign_in_at,
            roles: entry.roles,
          });
        }
      } catch { /* ignore */ }
    }
    return { users };
  });

const createSchema = z.object({
  email: z.string().email().max(255),
  phone: z.string().trim().max(20).optional().nullable(),
  full_name: z.string().trim().min(2).max(150),
  portal: z.enum(["mugec", "miprojet"]),
  // MUGEC: choisir un rôle métier ; MIPROJET: choisir 'admin' (full) ou 'viewer' (lecture seule)
  role: z.string().min(2).max(80),
  send_via: z.enum(["email", "whatsapp"]).default("email"),
  password: z.string().min(6).max(60).optional(),
});

function generateStrongPassword() {
  // 18 base64url chars (~108 bits of entropy)
  return randomBytes(14).toString("base64url");
}


export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const password = data.password || generateStrongPassword();
    const isGenerated = !data.password;


    // valider le rôle demandé
    let roleToInsert: string;
    if (data.portal === "mugec") {
      if (!(MUGEC_ROLES as readonly string[]).includes(data.role)) {
        throw new Error("Rôle MUGEC-CI invalide");
      }
      roleToInsert = data.role;
    } else {
      // miprojet
      if (!["super_admin", "miprojet_admin", "miprojet_viewer"].includes(data.role)) {
        throw new Error("Rôle MIPROJET invalide");
      }
      roleToInsert = data.role;
    }

    // créer ou récupérer le user
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      phone: data.phone || undefined,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, created_by_super_admin: true },
    });
    if (createErr) {
      // peut-être déjà existant : on tente de retrouver
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!existing) throw new Error(createErr.message);
      userId = existing.id;
    } else {
      userId = created.user?.id ?? null;
    }
    if (!userId) throw new Error("Impossible de créer l'utilisateur");
    // rôle (un seul rôle administrable par cette fonction, on ajoute sans écraser membre)
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: roleToInsert as any },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    // Forcer le changement de mot de passe à la 1ère connexion
    await supabaseAdmin.from("user_security").upsert({
      user_id: userId,
      must_change_password: true,
      password_changed_at: null,
      updated_at: new Date().toISOString(),
    });

    // journal invitation
    await (supabaseAdmin as any).from("admin_invitations").insert({
      target_user_id: userId,
      target_email: data.email,
      target_phone: data.phone || null,
      portal: data.portal,
      role: roleToInsert,
      invited_by: context.userId,
      channel: data.send_via,
      status: "created",
    });

    // Construction du message
    const portalLabel = data.portal === "miprojet" ? "MIPROJET" : "MUGEC-CI";
    const portalUrl = data.portal === "miprojet" ? "/miprojet" : "/admin";
    const baseUrl = process.env.PUBLIC_APP_URL ?? "https://mugec-ci.ivoireprojet.com";
    const loginUrl = `${baseUrl}/login`;
    const subject = `Vos accès ${portalLabel} — MUGEC-CI`;
    const text = `Bonjour ${data.full_name},\n\nVotre compte ${portalLabel} (rôle : ${roleToInsert}) a été créé.\n\nIdentifiant : ${data.email}\nMot de passe provisoire : ${password}\n\nConnectez-vous : ${loginUrl}${portalUrl}\nÀ votre première connexion, vous serez invité à définir un nouveau mot de passe.\n\n— MUGEC-CI`;

    let delivered: "email" | "whatsapp" | "manual" = "manual";
    try {
      if (data.send_via === "email") {
        const brevoKey = process.env.BREVO_API_KEY;
        if (brevoKey) {
          const r = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "accept": "application/json", "api-key": brevoKey, "content-type": "application/json" },
            body: JSON.stringify({
              sender: {
                name: process.env.BREVO_SENDER_NAME ?? "MUGEC-CI",
                email: process.env.BREVO_SENDER_EMAIL ?? "no-reply@mugec-ci.ci",
              },
              to: [{ email: data.email, name: data.full_name }],
              subject,
              htmlContent: `<pre style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6">${text.replace(/[<>&]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;"} as any)[c])}</pre>`,
              textContent: text,
            }),
          });
          if (r.ok) delivered = "email";
        }
      } else if (data.send_via === "whatsapp" && data.phone) {
        const url = process.env.WHATSAPP_API_URL;
        const token = process.env.WHATSAPP_API_TOKEN;
        if (url && token) {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ messaging_product: "whatsapp", to: data.phone, text: { body: text } }),
          });
          if (r.ok) delivered = "whatsapp";
        }
      }
    } catch (e) {
      console.error("createAdminUser: notification send failed", e);
    }

    return { ok: true, user_id: userId, password_delivered: delivered };
  });



export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      new_role: z.string().min(2).max(80).optional(),
      reset_password: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.new_role) {
      // remplace les rôles admin (conserve membre)
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .neq("role", "membre");
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.new_role as any });
    }
    if (data.reset_password) {
      const newPwd = generateStrongPassword();
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: newPwd });
      if (error) throw new Error(error.message);
      // Renvoyé une seule fois au super-admin pour transmission hors-bande.
      return { ok: true, password: newPwd };
    }
    return { ok: true };
  });


export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Renvoie true si l'utilisateur connecté est super_admin (pour afficher le bouton bascule). */
export const isSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    return { isSuperAdmin: !!data };
  });