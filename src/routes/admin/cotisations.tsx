import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { dispatchNotification } from "@/lib/notifications.functions";
import { Wallet, Search, Send, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/skeletons";

export const Route = createFileRoute("/admin/cotisations")({ component: CotisationsPage });

type Row = {
  id: string; member_id: string; periode: string | null;
  montant_total: number; part_mutuelle: number; part_miprojet: number;
  statut_paiement: string; operateur: string | null; reference_transaction: string | null;
  paid_at: string | null; created_at: string;
  members?: { nom: string; prenoms: string; telephone: string | null; matricule: string | null; user_id: string } | null;
};

const PAGE = 50;

function fmt(n: number) { return `${(n ?? 0).toLocaleString("fr-FR")} F`; }

function CotisationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [statut, setStatut] = useState<"all"|"paye"|"en_attente"|"en_retard">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const dispatch = useServerFn(dispatchNotification);

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("subscriptions")
      .select("id, member_id, periode, montant_total, part_mutuelle, part_miprojet, statut_paiement, operateur, reference_transaction, paid_at, created_at, members:member_id (nom, prenoms, telephone, matricule, user_id)")
      .eq("type", "cotisation")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (statut === "paye") qb = qb.eq("statut_paiement", "paye");
    else if (statut === "en_attente") qb = qb.eq("statut_paiement", "en_attente");
    const { data, error } = await qb;
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, statut]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = rows;
    if (statut === "en_retard") {
      const lim = new Date(); lim.setDate(lim.getDate() - 30);
      r = r.filter((x) => x.statut_paiement !== "paye" && new Date(x.created_at) < lim);
    }
    if (!s) return r;
    return r.filter((x) =>
      (x.reference_transaction ?? "").toLowerCase().includes(s) ||
      (x.periode ?? "").toLowerCase().includes(s) ||
      (x.members?.nom ?? "").toLowerCase().includes(s) ||
      (x.members?.matricule ?? "").toLowerCase().includes(s),
    );
  }, [rows, q, statut]);

  async function markPaid(id: string) {
    const { error } = await supabase.from("subscriptions").update({ statut_paiement: "paye", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marqué payé"); load(); }
  }

  async function relancer(r: Row, channels: ("sms"|"whatsapp"|"email")[]) {
    if (!r.members) { toast.error("Membre introuvable"); return; }
    try {
      await dispatch({
        data: {
          event: "cotisation_relance",
          memberId: r.member_id,
          userId: r.members.user_id,
          to: { phone: r.members.telephone ?? undefined, whatsapp: r.members.telephone ?? undefined },
          channels,
          context: {
            nom: r.members.nom,
            prenoms: r.members.prenoms,
            periode: r.periode ?? "",
            montant: r.part_mutuelle,
            matricule: r.members.matricule ?? "",
          },
        },
      });
      toast.success(`Relance envoyée (${channels.join(", ")})`);
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de la relance");
    }
  }

  async function relanceMass(channels: ("sms"|"whatsapp"|"email")[]) {
    const cibles = filtered.filter((r) => r.statut_paiement !== "paye");
    if (cibles.length === 0) { toast.info("Aucune cotisation à relancer"); return; }
    toast.message(`Envoi de ${cibles.length} relance(s)…`);
    let ok = 0;
    for (const r of cibles) {
      try { await relancer(r, channels); ok++; } catch { /* ignore */ }
    }
    toast.success(`${ok}/${cibles.length} relance(s) traitée(s)`);
  }

  const stats = useMemo(() => {
    const paye = filtered.filter((r) => r.statut_paiement === "paye").reduce((a, b) => a + (b.part_mutuelle || 0), 0);
    const attente = filtered.filter((r) => r.statut_paiement !== "paye").reduce((a, b) => a + (b.part_mutuelle || 0), 0);
    const retard = filtered.filter((r) => {
      const lim = new Date(); lim.setDate(lim.getDate() - 30);
      return r.statut_paiement !== "paye" && new Date(r.created_at) < lim;
    }).length;
    return { paye, attente, retard, total: filtered.length };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Cotisations MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <MiniStat icon={<CheckCircle2 className="h-4 w-4"/>} label="Payées (vue)" value={fmt(stats.paye)} accent="from-emerald-500 to-green-600"/>
          <MiniStat icon={<Wallet className="h-4 w-4"/>} label="En attente" value={fmt(stats.attente)} accent="from-amber-500 to-orange-600"/>
          <MiniStat icon={<AlertTriangle className="h-4 w-4"/>} label="En retard (>30j)" value={String(stats.retard)} accent="from-rose-500 to-red-600"/>
          <MiniStat icon={<Send className="h-4 w-4"/>} label="Lignes affichées" value={String(stats.total)} accent="from-blue-500 to-indigo-600"/>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary"/> Suivi des cotisations</CardTitle>
              <CardDescription>
                2 000 F par membre · 1 800 F mutuelle + 200 F MIPROJET · Marquage des paiements, relances SMS / WhatsApp / Email
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                <Input placeholder="Référence, période, nom…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72"/>
              </div>
              <Select value={statut} onValueChange={(v: any) => { setStatut(v); setPage(0); }}>
                <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="paye">Payées</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="en_retard">En retard (&gt;30j)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="table">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <TabsList>
                  <TabsTrigger value="table">Tableau</TabsTrigger>
                  <TabsTrigger value="mass">Relance de masse</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="table" className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Membre</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead className="text-right">Part MUGEC-CI</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                    {loading ? (
                      <TableRowsSkeleton rows={8} cols={6} />
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucune cotisation</TableCell></TableRow>
                    ) : filtered.map((r) => (
                    ) : filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.members ? `${r.members.nom} ${r.members.prenoms}` : "—"}
                          {r.members?.matricule && <div className="font-mono text-xs text-muted-foreground">{r.members.matricule}</div>}
                        </TableCell>
                        <TableCell>{r.periode ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.part_mutuelle)}</TableCell>
                        <TableCell>
                          {r.statut_paiement === "paye"
                            ? <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Payée</Badge>
                            : <Badge variant="secondary">{r.statut_paiement.replace("_"," ")}</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {r.statut_paiement !== "paye" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => relancer(r, ["sms"])}><Send className="h-3.5 w-3.5 mr-1"/>SMS</Button>
                                <Button size="sm" variant="outline" onClick={() => relancer(r, ["whatsapp"])}><MessageSquare className="h-3.5 w-3.5 mr-1"/>WA</Button>
                                <Button size="sm" onClick={() => markPaid(r.id)}>Marquer payée</Button>
                              </>
                            )}
                          </div>
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
              </TabsContent>

              <TabsContent value="mass" className="mt-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">Relancer les impayés affichés</CardTitle>
                    <CardDescription>Envoie une relance à chaque ligne non payée du filtre actuel.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button onClick={() => relanceMass(["sms"])}><Send className="mr-2 h-4 w-4"/>Relance SMS</Button>
                    <Button variant="secondary" onClick={() => relanceMass(["whatsapp"])}><MessageSquare className="mr-2 h-4 w-4"/>Relance WhatsApp</Button>
                    <Button variant="outline" onClick={() => relanceMass(["sms","whatsapp","email"])}>Tous les canaux</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function MiniStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
