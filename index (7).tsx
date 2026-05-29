import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";
import { loginWithIdentifier } from "@/lib/login.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminGate,
});

const MUGEC_ADMIN_ROLES = new Set([
  "admin_national",
  "admin_regional",
  "admin_local",
  "agent_saisie",
  "president",
  "secretaire_general",
  "tresorier_national",
  "commissaire_comptes",
  "directeur_executif",
  "comite_controle",
  "conseil_sages",
  "secretaire_regional",
  "tresorier_regional",
  "delegue_section",
]);

function AdminGate() {
  const [state, setState] = useState<"checking" | "login" | "ready">("checking");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const doLogin = useServerFn(loginWithIdentifier);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setState("login");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roleList = (roles ?? []).map((r) => String(r.role));
      if (roleList.includes("super_admin")) {
        navigate({ to: "/miprojet", replace: true });
        return;
      }
      setState(roleList.some((role) => MUGEC_ADMIN_ROLES.has(role)) ? "ready" : "login");
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await doLogin({ data: { identifier, password, portal: "admin" } });
      if (!res?.ok) throw new Error("bad_login");
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (sessionError) throw sessionError;
      setState("ready");
      navigate({ to: res.dashboard_path, replace: true });
    } catch {
      setError("Identifiant ou mot de passe admin MUGEC-CI incorrect.");
    } finally {
      setLoading(false);
    }
  }

  if (state === "checking")
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Vérification admin…
      </div>
    );
  if (state === "ready") return <Outlet />;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <h1 className="text-center text-2xl font-bold">Admin MUGEC-CI</h1>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="admin-id">Identifiant</Label>
              <Input
                id="admin-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="admin-pass">Mot de passe</Label>
              <PasswordInput
                id="admin-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
