import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { loginWithIdentifier } from "@/lib/login.functions";
import logo from "@/assets/mugec-logo.png";

export const Route = createFileRoute("/login")({
  component: Page,
});

function Page() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doLogin = useServerFn(loginWithIdentifier);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!isSupabaseConfigured) {
      setErrorMsg("Lovable Cloud / Supabase n'est pas encore connecté.");
      return;
    }
    setLoading(true);
    try {
      const res = await doLogin({ data: { identifier, password, portal: "member" } });
      if (!res?.ok) {
        setErrorMsg("Identifiant ou mot de passe incorrect, veuillez réessayer.");
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (setErr) {
        console.error("login setSession failed", setErr);
        setErrorMsg("Identifiant ou mot de passe incorrect, veuillez réessayer.");
        return;
      }
      // dashboard_path is computed server-side inside loginWithIdentifier
      // from this user's roles — no race condition possible.
      const target = res.dashboard_path;
      const { data: verified } = await supabase.auth.getUser();
      if (!verified.user) {
        setErrorMsg("Session non reconnue, veuillez réessayer.");
        return;
      }
      toast.success("Bienvenue !");
      await navigate({ to: target, replace: true });
    } catch (err) {
      console.error("login failed", err);
      setErrorMsg("Identifiant ou mot de passe incorrect, veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-md px-4 py-16">
        <Card>
          <CardContent className="p-8">
            <img src={logo} alt="MUGEC-CI" className="mx-auto h-16" />
            <h1 className="mt-4 text-center text-2xl font-bold">Espace membre</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Connectez-vous à votre compte MUGEC-CI
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {errorMsg && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                >
                  {errorMsg}
                </div>
              )}
              <div>
                <Label htmlFor="identifier">Numéro de téléphone</Label>
                <Input
                  id="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ex: 0759566087"
                  inputMode="tel"
                  pattern="[0-9]{6,}"
                  autoComplete="tel"
                  aria-invalid={errorMsg ? true : undefined}
                  className={
                    errorMsg ? "border-destructive focus-visible:ring-destructive" : undefined
                  }
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className={`pr-10 ${errorMsg ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    aria-invalid={errorMsg ? true : undefined}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Pas encore membre ?{" "}
              <Link to="/inscription" className="text-primary underline">
                S'inscrire
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}
