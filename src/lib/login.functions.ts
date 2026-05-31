import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const inputSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(200),
  portal: z.enum(["member", "admin", "miprojet"]),
});

/**
 * Server-side login by identifier (phone, admin login, or email).
 *
 * N'utilise que la clé publishable + des fonctions SQL (SECURITY DEFINER)
 * pour rester opérationnel y compris quand la SERVICE_ROLE_KEY n'est pas
 * exposée au runtime (preview restreint ou Vercel mal configuré).
 */
export const loginWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const generic = { ok: false as const, error: "invalid_credentials" };
    const identifier = data.identifier.trim().toLowerCase();

    const SUPABASE_URL =
      process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error("[login] Missing Supabase server env vars");
      return generic;
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    const { data: resolvedEmail, error: resolveError } = await authClient.rpc(
      "resolve_login_email",
      { p_identifier: identifier },
    );
    if (resolveError || typeof resolvedEmail !== "string" || resolvedEmail.length === 0) {
      return generic;
    }


    const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
      email: resolvedEmail,
      password: data.password,
    });
    if (signInErr || !signIn.session || !signIn.user) return generic;

    // Recrée un client porteur du JWT pour que current_user_dashboard_path()
    // évalue auth.uid() correctement (sinon il retombe sur /membre).
    const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: rawPath, error: pathError } = await userClient.rpc("current_user_dashboard_path");
    if (pathError || typeof rawPath !== "string" || rawPath.length === 0) {
      return generic;
    }

    const dashboard_path = rawPath === "/admin/miprojet" ? "/miprojet" : rawPath;

    // Portal guidance (non bloquant) :
    // on accepte la connexion si les identifiants sont bons, et on laisse
    // le client rediriger vers le bon dashboard (évite les blocages quand
    // un compte cumule plusieurs rôles).
    const portal_match =
      (data.portal === "member" && dashboard_path === "/membre") ||
      (data.portal === "admin" && dashboard_path === "/admin") ||
      (data.portal === "miprojet" && dashboard_path === "/miprojet");

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      dashboard_path,
      portal_match,
    };
  });
