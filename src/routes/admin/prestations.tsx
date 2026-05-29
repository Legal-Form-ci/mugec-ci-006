import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FileCheck, Search, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/prestations")({ component: PrestationsPage });

const PAGE = 30;
const STEP_LABELS = [
  "1 — Délégué de section",
  "2 — Secrétaire régional",
  "3 — Secrétaire général",
  "4 — Trésorier national",
  "5 — Clôturé",
];

const STEP_ROLES = ["delegue_section","secretaire_regional","secretaire_general","tresorier_national","system"];

type Row = {
  id: string; member_id: string; type_evenement: string;
  statut_global: string; step_validation: number;
  montant_applicable: number; motif_rejet: string | null;
  created_at: string; submitted_at: string; closed_at: string | null;
  members?: { nom: string; prenoms: string; matricule: string | null; telephone: string | null } | null;
};

type Validation = {
  id: string; niveau: number; action: string; motif: string | null;
  validated_at: string; role_requis: string; validateur_id: string;
};

function fmt(n: number | null | undefined) { return `${(n ?? 0).toLocaleString("fr-FR")} F`; }

function PrestationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [statut, setStatut] = useState<"all"|"en_attente"|"en_cours"|"valide"|"rejete">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Row | null>(null);
  const [history, setHistory] = useState<Validation[]>([]);
  const [motif, setMotif] = useState("");
  const [myRoles, setMyRoles] = useState<string[]>([]);

  async function loadRoles() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setMyRoles((data ?? []).map((r: any) => r.role));
  }

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("prestation_requests")
      .select("id, member_id, type_evenement, statut_global, step_validation, montant_applicable, motif_rejet, created_at, submitted_at, closed_at, members:member_id (nom, prenoms, matricule, telephone)")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (statut !== "all") qb = qb.eq("statut_global", statut);
    const { data, error } = await qb;
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { loadRoles(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, statut]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((x) =>
      (x.type_evenement ?? "").toLowerCase().includes(s) ||
      (x.members?.nom ?? "").toLowerCase().includes(s) ||
      (x.members?.matricule ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  async function openDetail(r: Row) {
    setCurrent(r); setMotif(""); setOpen(true);
    const { data } = await supabase
      .from("prestation_validations")
      .select("id, niveau, action, motif, validated_at, role_requis, validateur_id")
      .eq("request_id", r.id)
      .order("validated_at", { ascending: true });
    setHistory((data as any) || []);
  }

  const isSuperAdmin = myRoles.includes("super_admin");
  function canValidate(step: number) {
    if (isSuperAdmin) return true;
    const req = STEP_ROLES[step - 1];
    return req === "system" || myRoles.includes(req);
  }

  async function doAction(action: "valide"|"rejete") {
    if (!current) return;
    if (action === "rejete" && motif.trim().length < 3) {
      toast.error("Motif requis pour un rejet"); return;
    }
    const { error } = await supabase.rpc("validate_prestation_step", {
      _request_id: current.id, _action: action, _motif: motif || undefined,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(action === "valide" ? "Validation enregistrée" : "Demande rejetée");
    setOpen(false);
    await load();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Prestations MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary"/> Validation des prestations</CardTitle>
              <CardDescription>Workflow 4 niveaux : Délégué → Secrétaire régional → Secrétaire général → Trésorier national</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                <Input placeholder="Type, nom, matricule…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72"/>
              </div>
              <Select value={statut} onValueChange={(v: any) => { setStatut(v); setPage(0); }}>
                <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="valide">Validées</SelectItem>
                  <SelectItem value="rejete">Rejetées</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucune demande</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.members ? `${r.members.nom} ${r.members.prenoms}` : "—"}
                      {r.members?.matricule && <div className="font-mono text-xs text-muted-foreground">{r.members.matricule}</div>}
                    </TableCell>
                    <TableCell className="capitalize">{r.type_evenement.replace(/_/g," ")}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.montant_applicable)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{STEP_LABELS[Math.max(0, r.step_validation - 1)]}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.statut_global === "valide" && <Badge className="bg-emerald-500/15 text-emerald-700">Validée</Badge>}
                      {r.statut_global === "rejete" && <Badge variant="destructive">Rejetée</Badge>}
                      {r.statut_global === "en_cours" && <Badge variant="secondary">En cours</Badge>}
                      {r.statut_global === "en_attente" && <Badge variant="outline">En attente</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1"/>Détail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Précédent</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button variant="outline" disabled={rows.length < PAGE} onClick={() => setPage((p) => p + 1)}>Suivant →</Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demande de prestation</DialogTitle>
            <DialogDescription>
              {current?.members ? `${current.members.nom} ${current.members.prenoms}` : ""}
              {" · "}{current?.type_evenement?.replace(/_/g," ")}
            </DialogDescription>
          </DialogHeader>

          {current && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Montant applicable :</span> <span className="font-mono font-semibold">{fmt(current.montant_applicable)}</span></div>
                <div><span className="text-muted-foreground">Étape actuelle :</span> <Badge variant="outline">{STEP_LABELS[Math.max(0, current.step_validation - 1)]}</Badge></div>
                <div><span className="text-muted-foreground">Statut global :</span> {current.statut_global}</div>
                <div><span className="text-muted-foreground">Soumise le :</span> {new Date(current.submitted_at).toLocaleString("fr-FR")}</div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Historique de validation</div>
                <div className="space-y-1 max-h-48 overflow-y-auto rounded border bg-muted/30 p-2 text-xs">
                  {history.length === 0 ? (
                    <div className="text-muted-foreground">Aucune validation enregistrée</div>
                  ) : history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between">
                      <span>Niveau {h.niveau} ({h.role_requis}) — <b>{h.action}</b>{h.motif ? ` · ${h.motif}` : ""}</span>
                      <span className="text-muted-foreground">{new Date(h.validated_at).toLocaleString("fr-FR")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {current.statut_global !== "valide" && current.statut_global !== "rejete" && (
                <div className="space-y-2">
                  <Textarea placeholder="Motif (obligatoire pour rejet)" value={motif} onChange={(e) => setMotif(e.target.value)} />
                  {!canValidate(current.step_validation) && (
                    <div className="text-xs text-amber-600">
                      Rôle requis pour cette étape : <b>{STEP_ROLES[current.step_validation - 1]}</b>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
            {current && current.statut_global !== "valide" && current.statut_global !== "rejete" && canValidate(current.step_validation) && (
              <>
                <Button variant="destructive" onClick={() => doAction("rejete")}>
                  <XCircle className="h-4 w-4 mr-1"/>Rejeter
                </Button>
                <Button onClick={() => doAction("valide")}>
                  <CheckCircle2 className="h-4 w-4 mr-1"/>Valider l'étape
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
