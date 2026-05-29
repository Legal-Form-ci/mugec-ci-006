import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(200),
  portal: z.enum(["member", "admin", "miprojet"]),
});

/**
 * Server-side login by identifier (phone, admin login, or email).
 *
 * Uses only the publishable key + SQL helpers so it also works when the
 * preview runtime does not expose the service-role key.
 */
export const loginWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const generic = { ok: false as const, error: "invalid_credentials" };
    const identifier = data.identifier.trim().toLowerCase();

    // Fallback to VITE_* (inlined by Vite at build time) so the login works
    // even when the hosting platform (Vercel, etc.) does not expose the
    // unprefixed SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY at runtime.
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

    // Use service-role admin client so unauthenticated browsers cannot call
    // resolve_login_email directly as an email-enumeration oracle.
    const { data: resolvedEmail, error: resolveError } = await supabaseAdmin.rpc(
      "resolve_login_email",
      {
        p_identifier: identifier,
      },
    );
    if (resolveError || typeof resolvedEmail !== "string" || resolvedEmail.length === 0) {
      return generic;
    }

    const { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
      email: resolvedEmail,
      password: data.password,
    });
    if (signInErr || !signIn.session || !signIn.user) return generic;

    const { data: rawPath, error: pathError } = await authClient.rpc("current_user_dashboard_path");
    if (pathError || typeof rawPath !== "string" || rawPath.length === 0) {
      return generic;
    }

    if (data.portal === "member" && rawPath !== "/membre") return generic;
    if (data.portal === "admin" && rawPath !== "/admin") return generic;
    if (data.portal === "miprojet" && rawPath !== "/admin/miprojet") return generic;

    const dashboard_path = rawPath === "/admin/miprojet" ? "/miprojet" : rawPath;

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      dashboard_path,
    };
  });
