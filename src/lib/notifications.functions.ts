import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Remplace {{var}} dans un template par le contexte. */
function render(template: string, ctx: Record<string, string | number | undefined>) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, k) => String(ctx[k] ?? ""));
}

type Channel = "email" | "sms" | "whatsapp" | "in_app";

async function sendSms(to: string, body: string) {
  const url = process.env.SMS_API_URL;
  const key = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER ?? "MUGEC-CI";
  if (!url || !key) return { ok: false, error: "SMS provider not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to, from: sender, text: body }),
    });
    return { ok: res.ok, reference: res.headers.get("x-request-id") ?? null, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const BRAND_LOGO_URL = process.env.BRAND_LOGO_URL ?? "https://mugec-ci.ivoireprojet.com/mugec-logo.png";
const BRAND_NAME = "MUGEC-CI";
const BRAND_FOOTER = "MUGEC-CI · Mutuelle Générale des Collectivités de Côte d'Ivoire";

async function sendWhatsapp(to: string, title: string, body: string) {
  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  const from = process.env.WHATSAPP_SENDER_ID;
  if (!url || !token) return { ok: false, error: "WhatsApp provider not configured" };
  // Format texte structuré + media header (logo) si supporté par le provider.
  const text = `*${title}*\n\n${body}\n\n— ${BRAND_NAME}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        from,
        type: "image",
        image: { link: BRAND_LOGO_URL, caption: text },
        // Compat fallback : certains providers ignorent `image` et ne lisent que `text`.
        text: { body: text },
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(to: string, subject: string, body: string) {
  const url = process.env.EMAIL_API_URL;
  const key = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM ?? "no-reply@mugec-ci.ci";
  if (!url || !key) return { ok: false, error: "Email provider not configured" };
  const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
          <tr><td style="background:linear-gradient(135deg,#0b5cad,#1f8a8b);padding:20px 28px" align="left">
            <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="48" style="display:block;height:48px;border:0"/>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0b5cad">${escapeHtml(subject)}</h1>
            <div style="font-size:15px;line-height:1.6;color:#0f172a">${safeBody}</div>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px" align="center">
            © ${new Date().getFullYear()} ${BRAND_FOOTER}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
        html,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Déclenche l’envoi multi-canal d’un événement basé sur les templates. */
export const dispatchNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        event: z.string().min(2).max(64),
        memberId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        to: z
          .object({
            email: z.string().email().optional(),
            phone: z.string().min(6).max(20).optional(),
            whatsapp: z.string().min(6).max(20).optional(),
          })
          .default({}),
        channels: z.array(z.enum(["email", "sms", "whatsapp", "in_app"])).default(["email", "sms", "whatsapp"]),
        context: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context: ctx }) => {
    let { event, memberId, userId, to, channels, context } = data;
    // Authorization: caller must be admin OR be sending to their own user/member record
    const callerId = ctx.userId;
    const isSelfUser = userId && userId === callerId;
    let memberRow: { user_id: string; email: string | null; telephone: string | null } | null = null;
    if (memberId) {
      const { data: m } = await supabaseAdmin
        .from("members")
        .select("user_id,email,telephone")
        .eq("id", memberId)
        .maybeSingle();
      memberRow = m ?? null;
    }
    const isSelfMember = !!memberRow && memberRow.user_id === callerId;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const adminRoles = new Set([
      "super_admin","admin_national","admin_regional","admin_local","agent_saisie",
      "president","secretaire_general","tresorier_national","commissaire_comptes",
      "directeur_executif","comite_controle","conseil_sages","secretaire_regional",
      "tresorier_regional","delegue_section",
    ]);
    const isAdmin = (roles ?? []).some((r) => adminRoles.has(String(r.role)));

    if (!isAdmin) {
      if (!isSelfUser && !isSelfMember) {
        throw new Error("Forbidden: admin role required");
      }
      // Non-admin: lock down to a safe event whitelist and verified recipients only.
      const SELF_ALLOWED_EVENTS = new Set([
        "registration_completed",
        "payment_confirmed",
        "prestation_submitted",
      ]);
      if (!SELF_ALLOWED_EVENTS.has(event)) {
        throw new Error("Forbidden: event not allowed for non-admin caller");
      }
      // Force userId to the caller and ignore client-supplied recipient addresses.
      userId = callerId;
      to = {
        email: memberRow?.email ?? undefined,
        phone: memberRow?.telephone ?? undefined,
        whatsapp: memberRow?.telephone ?? undefined,
      };
      // Strip user-controlled free-text context fields that templates may inline.
      const safeContext: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(context)) {
        if (k === "message" || k === "html" || k === "body") continue;
        safeContext[k] = v;
      }
      context = safeContext;
    }


    const { data: templates, error } = await supabaseAdmin
      .from("notification_templates")
      .select("*")
      .eq("event", event)
      .eq("active", true);
    if (error) {
      console.error("dispatchNotification: template query failed", error);
      throw new Error("Erreur lors de l'envoi de la notification.");
    }

    const results: Array<{ channel: Channel; ok: boolean; error?: string }> = [];

    for (const t of templates ?? []) {
      if (!channels.includes(t.channel as Channel)) continue;
      const title = render(t.title, context);
      const body = render(t.body, context);
      let outcome: { ok: boolean; error?: string; status?: number } = { ok: false, error: "no_target" };

      if (t.channel === "email" && to.email) outcome = await sendEmail(to.email, title, body);
      else if (t.channel === "sms" && to.phone) outcome = await sendSms(to.phone, body);
      else if (t.channel === "whatsapp" && (to.whatsapp || to.phone)) outcome = await sendWhatsapp((to.whatsapp ?? to.phone)!, title, body);
      else if (t.channel === "in_app" && userId) outcome = { ok: true };

      await supabaseAdmin.from("notifications_log").insert({
        member_id: memberId ?? null,
        user_id: userId ?? null,
        canal: t.channel,
        event,
        contenu: `${title}\n\n${body}`,
        statut: outcome.ok ? "envoye" : "echoue",
        error_message: outcome.error ?? null,
        sent_at: outcome.ok ? new Date().toISOString() : null,
      });

      // Notification in-app (table existante)
      if (t.channel === "in_app" && userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          channel: "in_app",
          title,
          body,
        });
      }

      results.push({ channel: t.channel as Channel, ok: outcome.ok, error: outcome.error });
    }

    return { results };
  });
