import { MemberAvatarImage } from "@/components/MemberAvatar";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Users, Search, MoreHorizontal, Filter } from "lucide-react";

export const Route = createFileRoute("/admin/membres")({ component: MembresPage });

type Row = {
  id: string; matricule: string | null; nom: string; prenoms: string;
  telephone: string | null; email: string | null; statut: string;
  created_at: string; photo_url: string | null; region: string | null; collectivite: string | null;
};

const PAGE = 50;
const STATUTS = ["actif","en_attente","suspendu","decede","marie","licencie","assiste","retraite"];

function StatutBadge({ s }: { s: string }) {
  const v: any = { actif: "default", en_attente: "secondary", suspendu: "destructive" }[s] || "outline";
  return <Badge variant={v}>{s.replace("_"," ")}</Badge>;
}

function MembresPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState("all");

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("members")
      .select("id, matricule, nom, prenoms, telephone, email, statut, created_at, photo_url, region, collectivite")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (statut !== "all") qb = qb.eq("statut", statut);
    if (q.trim()) {
      // Escape PostgREST-special characters to prevent filter injection via .or()
      const safe = q.trim().replace(/[(),*\\]/g, " ").slice(0, 100);
      const s = `%${safe}%`;
      qb = qb.or(`nom.ilike.${s},prenoms.ilike.${s},telephone.ilike.${s},matricule.ilike.${s},email.ilike.${s}`);
    }
    const { data, error } = await qb;
    if (error) {
      console.error("admin members load failed", error);
      toast.error("Impossible de charger la liste des membres.");
    } else setRows((data as Row[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, statut]);

  async function setStatus(id: string, s: string) {
    const { error } = await supabase.from("members").update({ statut: s }).eq("id", id);
    if (error) {
      console.error("admin members setStatus failed", error);
      toast.error("Impossible de mettre à jour le statut.");
    } else { toast.success(`Statut → ${s}`); load(); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Membres MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Gestion des membres</CardTitle>
              <CardDescription>Recherche, filtres et actions sur les membres</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Nom, matricule, téléphone…" value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (setPage(0), load())} className="pl-9 w-72" />
              </div>
              <Select value={statut} onValueChange={(v) => { setStatut(v); setPage(0); }}>
                <SelectTrigger className="w-40"><Filter className="mr-2 h-4 w-4"/><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => { setPage(0); load(); }}>Filtrer</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun membre</TableCell></TableRow>
                ) : rows.map((m) => (
                  <TableRow key={m.id} className="group">
                    <TableCell>
                      <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
                        <MemberAvatarImage src={m.photo_url} />
                        <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
                          {(m.prenoms?.[0] ?? "") + (m.nom?.[0] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.matricule || "—"}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{m.nom} {m.prenoms}</TableCell>
                    <TableCell className="text-muted-foreground">{m.telephone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{m.region || m.collectivite || "—"}</TableCell>
                    <TableCell><StatutBadge s={m.statut}/></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Changer le statut</DropdownMenuLabel>
                          <DropdownMenuSeparator/>
                          {STATUTS.map((s) => (
                            <DropdownMenuItem key={s} disabled={m.statut === s} onClick={() => setStatus(m.id, s)}>
                              {s}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
    </div>
  );
}
