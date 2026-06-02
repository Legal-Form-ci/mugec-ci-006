import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FileCheck, Search, Wallet, CheckCircle2 } from "lucide-react";
import { formatCFA } from "@/lib/format";

export const Route = createFileRoute("/admin/droits-adhesion")({ component: DroitsAdhesionPage });

type Row = {
  id: string; member_id: string;
  montant_total: number; part_mutuelle: number; part_miprojet: number;
  statut_paiement: string; reference_transaction: string | null; paid_at: string | null; created_at: string;
  members?: { nom: string; prenoms: string; telephone: string | null; matricule: string | null; email: string | null } | null;
};

const PAGE = 50;

function DroitsAdhesionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [statut, setStatut] = useState<"all"|"paye"|"en_attente">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("subscriptions")
      .select("id, member_id, montant_total, part_mutuelle, part_miprojet, statut_paiement, reference_transaction, paid_at, created_at, members:member_id (nom, prenoms, telephone, matricule, email)")
      .eq("type", "inscription")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (statut !== "all") qb = qb.eq("statut_paiement", statut);
    const { data, error } = await qb;
    if (error) toast.error(error.message);
    else setRows((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, statut]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((x) =>
      (x.reference_transaction ?? "").toLowerCase().includes(s) ||
      (x.members?.nom ?? "").toLowerCase().includes(s) ||
      (x.members?.prenoms ?? "").toLowerCase().includes(s) ||
      (x.members?.matricule ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const paye = filtered.filter(r => r.statut_paiement === "paye");
    const totalMutuelle = paye.reduce((a, b) => a + (b.part_mutuelle || 0), 0);
    const totalMiprojet = paye.reduce((a, b) => a + (b.part_miprojet || 0), 0);
    return { count: paye.length, mut: totalMutuelle, mip: totalMiprojet, total: totalMutuelle + totalMiprojet };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Droits d'adhésion MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <MiniStat icon={<FileCheck className="h-4 w-4"/>} label="Adhésions payées" value={String(stats.count)} accent="from-emerald-500 to-green-600"/>
          <MiniStat icon={<Wallet className="h-4 w-4"/>} label="Part MUGEC-CI (4 000 F)" value={formatCFA(stats.mut)} accent="from-blue-500 to-indigo-600"/>
          <MiniStat icon={<Wallet className="h-4 w-4"/>} label="Part MIPROJET (1 000 F)" value={formatCFA(stats.mip)} accent="from-purple-500 to-pink-600"/>
          <MiniStat icon={<CheckCircle2 className="h-4 w-4"/>} label="Total perçu" value={formatCFA(stats.total)} accent="from-amber-500 to-orange-600"/>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary"/> Droits d'adhésion</CardTitle>
              <CardDescription>5 000 F par membre · 4 000 F mutuelle + 1 000 F MIPROJET</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                <Input placeholder="Référence, nom, matricule…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72"/>
              </div>
              <Select value={statut} onValueChange={(v: any) => { setStatut(v); setPage(0); }}>
                <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="paye">Payées</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Part MUGEC-CI</TableHead>
                  <TableHead className="text-right">Part MIPROJET</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun droit d'adhésion</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.members ? `${r.members.nom} ${r.members.prenoms}` : "—"}
                      {r.members?.matricule && <div className="font-mono text-xs text-muted-foreground">{r.members.matricule}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.reference_transaction ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCFA(r.part_mutuelle)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatCFA(r.part_miprojet)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatCFA(r.montant_total)}</TableCell>
                    <TableCell>
                      {r.statut_paiement === "paye"
                        ? <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Payé</Badge>
                        : <Badge variant="secondary">{r.statut_paiement.replace("_"," ")}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
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
