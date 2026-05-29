// Single source of truth — re-export the generated integration client.
// The env var is VITE_SUPABASE_PUBLISHABLE_KEY (NOT VITE_SUPABASE_ANON_KEY).
export { supabase } from "@/integrations/supabase/client";

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
