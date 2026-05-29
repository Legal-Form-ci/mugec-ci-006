import { MemberAvatarImg } from "@/components/MemberAvatar";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldCheck, ShieldAlert, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/verifier/$matricule")({
  component: Page,
});

type Info = {
  matricule?: string;
  nom?: string;
  prenoms?: string;
  photo_url?: string;
  collectivite?: string;
  region?: string;
  fonction?: string;
  statut?: string;
  type_membre?: string;
  date_inscription?: string;
};

function Page() {
  const { matricule } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login", search: { redirect: `/verifier/${matricule}` } as never });
      return;
    }
    (async () => {
      setBusy(true);
      setErr(null);
      const { data, error } = await supabase.rpc("member_public_info", { p_matricule: matricule });
      if (error) setErr("Impossible de vérifier ce matricule.");
      else if (!data) setErr("Matricule introuvable.");
      else setInfo(data as Info);
      setBusy(false);
    })();
  }, [user, loading, matricule, nav]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-2xl px-4 py-12">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/scanner" className="underline">← Nouveau scan</Link>
        </div>

        {busy || loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : err ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <ShieldAlert className="h-10 w-10 text-destructive" />
              <p className="font-medium">{err}</p>
              <p className="text-sm text-muted-foreground">Matricule : <span className="font-mono">{matricule}</span></p>
              <Button asChild variant="outline"><Link to="/scanner">Réessayer</Link></Button>
            </CardContent>
          </Card>
        ) : info ? (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-accent p-4 text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Carte vérifiée</span>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="flex items-start gap-5">
                <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  <MemberAvatarImg
                    src={info.photo_url}
                    alt={`${info.prenoms} ${info.nom}`}
                    className="h-full w-full object-cover"
                  />
                  {!info.photo_url && (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <UserCircle2 className="h-10 w-10" />
                    </div>
                  )}

                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-bold">{`${info.prenoms ?? ""} ${info.nom ?? ""}`.trim() || "—"}</h1>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{info.matricule}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={info.statut === "actif" ? "default" : "secondary"}>
                      {(info.statut ?? "—").toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{(info.type_membre ?? "office").toUpperCase()}</Badge>
                  </div>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-1 gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                <Field label="Fonction" value={info.fonction} />
                <Field label="Collectivité" value={info.collectivite} />
                <Field label="Région" value={info.region} />
                <Field
                  label="Inscrit le"
                  value={info.date_inscription ? new Date(info.date_inscription).toLocaleDateString("fr-FR") : "—"}
                />
              </dl>

              <p className="mt-6 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Les informations financières (cotisations, prestations) ne sont jamais affichées via ce service de vérification.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>
      <SiteFooter />
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}
