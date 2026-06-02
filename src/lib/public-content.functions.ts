import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const newsColumns = "id, title, slug, summary, body, cover_url, illustrations, category, tags, meta_title, meta_description, created_at";
const opportuniteColumns = "id, title, slug, summary, description, body, cover_url, illustrations, category, tags, type, lieu, date_limite, meta_title, meta_description, created_at";

export const listPublicContent = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ kind: z.enum(["news", "opportunites"]), limit: z.number().int().min(1).max(100).default(50) }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const columns = data.kind === "news" ? newsColumns : opportuniteColumns;
    const { data: rows, error } = await db
      .from(data.kind)
      .select(columns)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPublicContentBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ kind: z.enum(["news", "opportunites"]), slug: z.string().trim().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const columns = data.kind === "news" ? newsColumns : opportuniteColumns;
    const { data: rows, error } = await db
      .from(data.kind)
      .select(columns)
      .eq("slug", data.slug)
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });