import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

export async function getCurrentSupabaseUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const storedUser = readStoredSession()?.user ?? null;
  const freshUser = supabase.auth
    .getUser()
    .then(({ data, error }) => (!error && data.user ? data.user : storedUser))
    .catch(() => storedUser);
  const timeout = new Promise<User | null>((resolve) => {
    window.setTimeout(() => resolve(storedUser), 800);
  });
  return Promise.race([freshUser, timeout]);
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
    const key = `sb-${ref}-auth-token`;
    const raw = window.localStorage.getItem(key) ?? Object.entries(window.localStorage).find(([k]) => k.startsWith("sb-") && k.endsWith("-auth-token"))?.[1];
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.access_token && parsed?.user ? parsed : null;
  } catch {
    return null;
  }
}

const AuthCtx = createContext<Ctx>({ user: null, session: null, loading: false, signOut: async () => {} });

export const ADMIN_ROLES = [
  "super_admin", "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section"
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setSession(readStoredSession());
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? readStoredSession());
      if (data.session) {
        await supabase.auth.getUser().catch(() => null);
      }
      setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          try {
            await supabase.auth.signOut();
          } catch {}
          try {
            if (typeof window !== "undefined") {
              Object.keys(window.localStorage)
                .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
                .forEach((k) => window.localStorage.removeItem(k));
            }
          } catch {}
          setSession(null);
          if (typeof window !== "undefined") {
            window.location.assign("/login");
          }
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
