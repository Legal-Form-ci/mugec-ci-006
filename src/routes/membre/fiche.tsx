import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { generateFicheAdhesionPDF, type DraftData } from "@/lib/pdf-documents";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/membre/fiche")({
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [member, setMember] = useState<DraftData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    (async () => {
      if (!user || !isSupabaseConfigured) return;
      const { data } = await supabase.from("members").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setMember({
          nom: data.nom,
          prenoms: data.prenoms,
          dateNaissance: data.date_naissance ?? "",
          lieuNaissance: data.lieu_naissance ?? "",
          sexe: (data.sexe as "M" | "F" | undefined) ?? undefined,
          email: data.email ?? "",
          telephone: data.telephone ?? "",
          cni: data.cni ?? "",
          adresse: data.adresse ?? "",
          collectivite: data.collectivite ?? "",
          region: data.region ?? "",
          direction: data.direction ?? "",
          fonction: data.fonction ?? "",
          matriculePro: data.matricule_pro ?? data.matricule ?? "",
          dateEmbauche: data.date_embauche ?? "",
          ayantsDroit: data.ayants_droit ?? "",
          photoIdentite: data.photo_url ?? undefined,
          reference: data.matricule ?? user.id,
        });
      }
    })();
  }, [user]);

  async function download() {
    if (!member) return;
    setBusy(true);
    try {
      const blob = await generateFicheAdhesionPDF(member);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiche-adhesion-${member.matriculePro ?? "mugec"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Fiche d'adhésion téléchargée");
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MembreLayout title="Fiche d'adhésion" subtitle="Document administratif officiel — distinct de la carte de membre">
      <section className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Fiche d'adhésion MUGEC-CI</h2>
                <p className="text-sm text-muted-foreground">
                  Document A4 PDF reprenant l'ensemble de vos informations administratives, vos ayants-droit, votre photo et le cachet officiel.
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>• Identification complète (nom, prénoms, naissance, sexe, CNI, matricule)</li>
              <li>• Situation professionnelle (collectivité, direction)</li>
              <li>• Coordonnées (téléphone, e-mail, adresse)</li>
              <li>• Tableau des ayants-droit</li>
              <li>• Engagement, signature et cachet numérique + QR de vérification</li>
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={download} disabled={busy || !member}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {busy ? "Génération…" : "Télécharger la fiche (PDF)"}
              </Button>
              <Button asChild variant="outline">
                <a href="/membre/carte">Voir ma carte de membre →</a>
              </Button>
            </div>

            {!member && !loading && (
              <p className="mt-4 text-xs text-muted-foreground">Chargement de vos informations…</p>
            )}
          </CardContent>
        </Card>
      </section>
    </MembreLayout>
  );
}
