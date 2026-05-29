import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useResumableUpload } from "@/hooks/use-resumable-upload";
import { toast } from "sonner";
import { CardListSkeleton } from "@/components/ui/skeletons";
import {
  HeartHandshake,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
  AlertCircle,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/membre/prestations")({ component: PrestationsMembrePage });

// ────────────────────────────────────────────────────────────────────────────
// Types & barème Art. 71 RI (calcul côté UI à titre informatif uniquement —
// le montant définitif est ensuite recalculé côté DB par le trigger).
// ────────────────────────────────────────────────────────────────────────────
type EventType =
  | "mariage_membre" | "mariage_deux_membres"
  | "naissance" | "naissance_deux_membres"
  | "deces_membre" | "deces_conjoint" | "deces_ascendant" | "deces_enfant"
  | "retraite";

const EVENT_LABELS: Record<EventType, string> = {
  mariage_membre: "Mariage du membre",
  mariage_deux_membres: "Mariage de deux membres",
  naissance: "Naissance",
  naissance_deux_membres: "Naissance (deux membres)",
  deces_membre: "Décès du membre",
  deces_conjoint: "Décès du conjoint",
  deces_ascendant: "Décès d'un ascendant",
  deces_enfant: "Décès d'un enfant",
  retraite: "Départ à la retraite",
};

const FIXED_AMOUNTS: Partial<Record<EventType, number>> = {
  mariage_membre: 100_000,
  mariage_deux_membres: 200_000,
  naissance: 50_000,
  naissance_deux_membres: 100_000,
  deces_membre: 300_000,
  deces_conjoint: 200_000,
  deces_ascendant: 200_000,
  deces_enfant: 150_000,
};

function retraiteAmount(yearsSinceJoined: number): number {
  if (yearsSinceJoined <= 10) return 200_000;
  if (yearsSinceJoined <= 15) return 250_000;
  if (yearsSinceJoined <= 20) return 300_000;
  if (yearsSinceJoined <= 25) return 400_000;
  return 500_000;
}

function fmtFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

const STEP_LABELS = [
  "Délégué de section",
  "Secrétaire régional",
  "Secrétaire général",
  "Trésorier national",
  "Clôturé",
];

type Member = {
  id: string;
  date_inscription: string | null;
  droits_ouverts_le: string | null;
  statut: string;
};

type Request = {
  id: string;
  type_evenement: string;
  statut_global: string;
  step_validation: number;
  montant_applicable: number;
  motif_rejet: string | null;
  created_at: string;
  submitted_at: string;
  closed_at: string | null;
  pj_urls: string[] | null;
};

function PrestationsMembrePage() {
  const { user } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [reqs, setReqs] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [open, setOpen] = useState(false);
  const [evType, setEvType] = useState<EventType | "">("");
  const [comment, setComment] = useState("");
  const [pjUrls, setPjUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useResumableUpload("documents");

  async function reload() {
    if (!user) return;
    setLoading(true);
    const { data: m } = await supabase
      .from("members")
      .select("id, date_inscription, droits_ouverts_le, statut")
      .eq("user_id", user.id)
      .maybeSingle();
    setMember(m as Member | null);

    if (m) {
      const { data } = await supabase
        .from("prestation_requests")
        .select("id, type_evenement, statut_global, step_validation, montant_applicable, motif_rejet, created_at, submitted_at, closed_at, pj_urls")
        .eq("member_id", m.id)
        .order("created_at", { ascending: false });
      setReqs((data as Request[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user]);

  const droitsOuverts = useMemo(() => {
    if (!member?.droits_ouverts_le) return false;
    return new Date(member.droits_ouverts_le) <= new Date();
  }, [member]);

  const yearsJoined = useMemo(() => {
    if (!member?.date_inscription) return 0;
    return Math.max(0, (new Date().getTime() - new Date(member.date_inscription).getTime()) / (365.25 * 24 * 3600 * 1000));
  }, [member]);

  const estimatedAmount = useMemo(() => {
    if (!evType) return 0;
    if (evType === "retraite") return retraiteAmount(yearsJoined);
    return FIXED_AMOUNTS[evType] ?? 0;
  }, [evType, yearsJoined]);

  async function handleFile(file: File) {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (10 Mo max)"); return; }
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/prestations/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const res = await upload.upload(file, path);
    if (!res?.url) return;
    setPjUrls((u) => [...u, res.url!]);
    upload.reset();
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Pièce jointe ajoutée");
  }

  async function submit() {
    if (!member) return;
    if (!evType) { toast.error("Sélectionnez le type d'événement"); return; }
    if (pjUrls.length === 0) { toast.error("Joignez au moins une pièce justificative"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("prestation_requests").insert({
      member_id: member.id,
      type_evenement: evType,
      pj_urls: pjUrls,
      statut_global: "en_attente",
      step_validation: 1,
      montant_applicable: 0, // recalculé par trigger
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Demande soumise — validation par le délégué de section");
    setOpen(false);
    setEvType("");
    setComment("");
    setPjUrls([]);
    void reload();
  }

  return (
    <MembreLayout
      title="Mes prestations sociales"
      subtitle="Déclarez un événement (mariage, naissance, décès, retraite) et suivez votre dossier"
    >
      {/* Bandeau éligibilité */}
      {!loading && member && !droitsOuverts && (
        <Card className="mb-6 border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="font-medium text-amber-900 dark:text-amber-100">Droits aux prestations non encore ouverts</div>
              <p className="mt-0.5 text-amber-800 dark:text-amber-200">
                Conformément à l'article 71 du Règlement Intérieur, vos droits s'ouvrent automatiquement <b>90 jours après votre premier paiement de cotisation</b>. Vous pourrez alors déclarer un événement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" /> Demandes de prestation
          </h2>
          <p className="text-xs text-muted-foreground">Workflow : Délégué → Régional → Général → Trésorier</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!droitsOuverts}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle demande
        </Button>
      </div>

      {/* Liste des demandes */}
      {loading ? (
        <CardListSkeleton count={2} />
      ) : reqs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            <HeartHandshake className="mx-auto mb-2 h-10 w-10 opacity-30" />
            Aucune demande à ce jour
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reqs.map((r) => <RequestCard key={r.id} r={r} />)}
        </div>
      )}

      {/* Dialog nouvelle demande */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle demande de prestation</DialogTitle>
            <DialogDescription>
              Conformément à l'article 71 du RI. Le montant est calculé automatiquement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Type d'événement</Label>
              <Select value={evType} onValueChange={(v: EventType) => setEvType(v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionnez…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {evType && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Montant estimé (Art. 71)</div>
                <div className="text-2xl font-bold text-primary font-mono">{fmtFCFA(estimatedAmount)}</div>
                {evType === "retraite" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Calculé selon votre ancienneté MUGEC-CI ({Math.floor(yearsJoined)} an{Math.floor(yearsJoined) > 1 ? "s" : ""})
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Pièces justificatives (extrait, acte, certificat…)</Label>
              <div className="mt-1.5 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/*"
                  disabled={upload.state.status === "uploading"}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground hover:file:bg-primary/90"
                />
                {upload.state.status === "uploading" && (
                  <div className="text-xs text-muted-foreground">Envoi… {upload.state.progress}%</div>
                )}
                {upload.state.status === "error" && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> {upload.state.error}
                  </div>
                )}
                {pjUrls.length > 0 && (
                  <ul className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
                    {pjUrls.map((u, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate flex items-center gap-1.5"><Upload className="h-3 w-3 text-emerald-600" /> Pièce #{i + 1}</span>
                        <button onClick={() => setPjUrls((arr) => arr.filter((_, j) => j !== i))} className="text-destructive hover:underline">retirer</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <Label>Commentaire (optionnel)</Label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Précisions sur l'événement…" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={submitting || !evType || pjUrls.length === 0}>
              {submitting ? "Envoi…" : "Soumettre la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MembreLayout>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Carte d'une demande avec stepper cascade visuel
// ────────────────────────────────────────────────────────────────────────────
function RequestCard({ r }: { r: Request }) {
  const isClosed = r.statut_global === "valide" || r.statut_global === "rejete";
  const StatusBadge =
    r.statut_global === "valide" ? <Badge className="bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Validée</Badge> :
    r.statut_global === "rejete" ? <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejetée</Badge> :
    r.statut_global === "en_cours" ? <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />En cours</Badge> :
    <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />En attente</Badge>;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base capitalize">
            {EVENT_LABELS[r.type_evenement as EventType] ?? r.type_evenement.replace(/_/g, " ")}
          </CardTitle>
          <CardDescription className="text-xs">
            Soumise le {new Date(r.submitted_at).toLocaleDateString("fr-FR")}
          </CardDescription>
        </div>
        <div className="text-right">
          {StatusBadge}
          <div className="mt-1 font-mono text-sm font-semibold text-primary">{fmtFCFA(r.montant_applicable)}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Stepper cascade */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEP_LABELS.map((label, idx) => {
            const step = idx + 1;
            const done = r.step_validation > step || r.statut_global === "valide";
            const current = r.step_validation === step && !isClosed;
            const rejected = r.statut_global === "rejete" && r.step_validation === step;
            return (
              <div key={step} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${
                  rejected ? "bg-destructive/15 text-destructive ring-destructive/30" :
                  done ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30" :
                  current ? "bg-primary/15 text-primary ring-primary/30 animate-pulse" :
                  "bg-muted text-muted-foreground ring-border"
                }`}>
                  <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${
                    rejected ? "bg-destructive text-destructive-foreground" :
                    done ? "bg-emerald-600 text-white" :
                    current ? "bg-primary text-primary-foreground" :
                    "bg-background text-muted-foreground"
                  }`}>
                    {done ? "✓" : rejected ? "✕" : step}
                  </span>
                  <span className="whitespace-nowrap">{label}</span>
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-3 ${done ? "bg-emerald-500" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {r.motif_rejet && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <b>Motif du rejet :</b> {r.motif_rejet}
          </div>
        )}

        {r.pj_urls && r.pj_urls.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {r.pj_urls.length} pièce{r.pj_urls.length > 1 ? "s" : ""} jointe{r.pj_urls.length > 1 ? "s" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
