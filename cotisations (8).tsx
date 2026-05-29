import { MemberAvatarImage } from "@/components/MemberAvatar";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  MoreHorizontal, Eye, Users, Wallet, FileCheck,
  UserCheck, UserMinus, Activity, ArrowUpRight, Search, Sparkles,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type Stats = {
  members_total: number; members_actifs: number; members_en_attente: number;
  members_suspendus?: number;
  cotisations_mois: number; cotisations_total: number; cotisations_attente?: number;
  droits_adhesion_mois?: number; droits_adhesion_total?: number;
  revenus_mois?: number; revenus_total?: number;
  prestations_en_cours: number; prestations_validees_mois: number;
  prestations_rejetees_mois?: number;
};
type MemberRow = {
  id: string; matricule: string | null; nom: string; prenoms: string;
  telephone: string | null; email: string | null; statut: string;
  created_at: string; photo_url: string | null;
};

const PAGE = 50;
const STATUTS = ["actif", "en_attente", "suspendu", "decede", "marie", "licencie", "assiste", "retraite"];

function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [trend, setTrend] = useState<{ mois: string; inscriptions: number; cotisations: number }[]>([]);

  async function loadStats() {
    const { data, error } = await supabase.rpc("admin_dashboard_stats");
    if (!error && data) setStats(data as Stats);
  }
  async function loadMembers() {
    setLoading(true);
    let q = supabase
      .from("members")
      .select("id, matricule, nom, prenoms, telephone, email, statut, created_at, photo_url")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (search.trim()) {
      const safe = search.trim().replace(/[(),*\\]/g, " ").slice(0, 100);
      const s = `%${safe}%`;
      q = q.or(`nom.ilike.${s},prenoms.ilike.${s},telephone.ilike.${s},matricule.ilike.${s},email.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setMembers((data as MemberRow[]) || []);
    setLoading(false);
  }
  async function loadTrend() {
    // Build last 6-month trend from members + cotisations tables (best-effort)
    const now = new Date();
    const buckets: { mois: string; key: string; inscriptions: number; cotisations: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        mois: d.toLocaleDateString("fr-FR", { month: "short" }),
        key, inscriptions: 0, cotisations: 0,
      });
    }
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    const [{ data: ins }, { data: cot }] = await Promise.all([
      supabase.from("members").select("created_at").gte("created_at", from),
      supabase.from("cotisations").select("montant, created_at").gte("created_at", from).limit(5000),
    ]);
    (ins ?? []).forEach((r: any) => {
      const k = r.created_at?.slice(0, 7);
      const b = buckets.find((x) => x.key === k);
      if (b) b.inscriptions += 1;
    });
    (cot ?? []).forEach((r: any) => {
      const k = r.created_at?.slice(0, 7);
      const b = buckets.find((x) => x.key === k);
      if (b) b.cotisations += Number(r.montant) || 0;
    });
    setTrend(buckets.map(({ mois, inscriptions, cotisations }) => ({ mois, inscriptions, cotisations })));
  }

  useEffect(() => {
    if (authLoading || !user?.id) return;
    loadStats();
    loadTrend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);
  useEffect(() => {
    if (authLoading || !user?.id) return;
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user?.id, authLoading]);

  async function setStatus(id: string, statut: string) {
    const { error } = await supabase.from("members").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Statut → ${statut}`); loadMembers(); loadStats(); }
  }

  async function openEdit(m: MemberRow) {
    const { data } = await supabase.from("members").select("*").eq("id", m.id).maybeSingle();
    setEditData(data);
    setEditOpen(true);
  }
  async function saveEdit() {
    if (!editData) return;
    const { id, created_at, updated_at, user_id, ...patch } = editData;
    const { error } = await supabase.from("members").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Membre mis à jour"); setEditOpen(false); loadMembers(); }
  }

  const repartition = useMemo(() => {
    const total = stats?.members_total ?? 0;
    const actifs = stats?.members_actifs ?? 0;
    const attente = stats?.members_en_attente ?? 0;
    const autres = Math.max(0, total - actifs - attente);
    return [
      { name: "Actifs", value: actifs, color: "hsl(142 71% 45%)" },
      { name: "En attente", value: attente, color: "hsl(38 92% 50%)" },
      { name: "Autres", value: autres, color: "hsl(220 14% 70%)" },
    ];
  }, [stats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Admin MUGEC-CI" nav={ADMIN_NAV} />

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        {/* Hero header */}
        <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary via-primary to-primary/80 p-8 text-primary-foreground shadow-xl">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1 bg-white/15 text-white border-white/20">
                <Sparkles className="h-3 w-3" /> Espace national
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tableau de bord Admin</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Pilotage en temps réel des membres, cotisations et prestations de la mutuelle.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="bg-white text-primary hover:bg-white/90" onClick={() => { loadStats(); loadMembers(); loadTrend(); }}>
                <Activity className="mr-2 h-4 w-4" /> Actualiser
              </Button>
            </div>
          </div>
        </section>

        {/* KPI grid - premium */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <PremiumKPI
            icon={Users} label="Membres total" value={stats?.members_total ?? 0}
            gradient="from-blue-500 to-indigo-600" trend="+12%"
          />
          <PremiumKPI
            icon={UserCheck} label="Actifs" value={stats?.members_actifs ?? 0}
            gradient="from-emerald-500 to-green-600" trend="+8%"
          />
          <PremiumKPI
            icon={UserMinus} label="En attente" value={stats?.members_en_attente ?? 0}
            gradient="from-amber-500 to-orange-600"
          />
          <PremiumKPI
            icon={Wallet} label="Cotisations mois"
            value={`${((stats?.cotisations_mois ?? 0) / 1000).toFixed(0)}k F`}
            gradient="from-purple-500 to-pink-600" trend="+24%"
          />
          <PremiumKPI
            icon={Wallet} label="Cotisations cumul"
            value={`${((stats?.cotisations_total ?? 0) / 1000).toFixed(0)}k F`}
            gradient="from-cyan-500 to-blue-600"
          />
          <PremiumKPI
            icon={FileCheck} label="Prest. en cours" value={stats?.prestations_en_cours ?? 0}
            gradient="from-amber-500 to-red-500"
          />
          <PremiumKPI
            icon={FileCheck} label="Prest. validées (mois)" value={stats?.prestations_validees_mois ?? 0}
            gradient="from-teal-500 to-emerald-600"
          />
          <PremiumKPI
            icon={FileCheck} label="Prest. rejetées (mois)" value={stats?.prestations_rejetees_mois ?? 0}
            gradient="from-rose-500 to-red-600"
          />
        </section>

        {/* Finances séparées : droits d'adhésion / cotisations / revenus globaux */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-600" />
            <CardHeader className="pb-2">
              <CardDescription>Droits d'adhésion</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {((stats?.droits_adhesion_total ?? 0) / 1000).toFixed(0)} k F
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Ce mois&nbsp;: <span className="font-semibold text-foreground">{((stats?.droits_adhesion_mois ?? 0) / 1000).toFixed(0)} k F</span>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-purple-500 to-pink-600" />
            <CardHeader className="pb-2">
              <CardDescription>Cotisations</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {((stats?.cotisations_total ?? 0) / 1000).toFixed(0)} k F
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Ce mois&nbsp;: <span className="font-semibold text-foreground">{((stats?.cotisations_mois ?? 0) / 1000).toFixed(0)} k F</span>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />
            <CardHeader className="pb-2">
              <CardDescription>Revenus globaux</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {(((stats?.revenus_total ?? ((stats?.droits_adhesion_total ?? 0) + (stats?.cotisations_total ?? 0)))) / 1000).toFixed(0)} k F
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Ce mois&nbsp;: <span className="font-semibold text-foreground">{(((stats?.revenus_mois ?? ((stats?.droits_adhesion_mois ?? 0) + (stats?.cotisations_mois ?? 0)))) / 1000).toFixed(0)} k F</span>
            </CardContent>
          </Card>
        </section>



        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activité des 6 derniers mois</CardTitle>
                  <CardDescription>Inscriptions et cotisations cumulées par mois</CardDescription>
                </div>
                <Badge variant="outline" className="gap-1"><ArrowUpRight className="h-3 w-3" /> Tendance</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mois" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                    <Area type="monotone" dataKey="inscriptions" stroke="hsl(var(--primary))" fill="url(#g1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="cotisations" stroke="hsl(142 71% 45%)" fill="url(#g2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Répartition membres</CardTitle>
              <CardDescription>Statut actuel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={repartition} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                      {repartition.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
                {repartition.map((r) => (
                  <div key={r.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                    <span className="text-muted-foreground">{r.name}</span>
                    <span className="font-medium">{r.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Members table - modernized */}
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Gestion des membres</CardTitle>
              <CardDescription>Consultation, modification et changement de statut</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher nom, matricule, téléphone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (setPage(0), loadMembers())}
                  className="w-full pl-9 sm:w-80"
                />
              </div>
              <Button onClick={() => { setPage(0); loadMembers(); }}>Filtrer</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : members.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun membre</TableCell></TableRow>
                ) : members.map((m) => (
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
                    <TableCell className="whitespace-nowrap font-medium">{m.nom} {m.prenoms}</TableCell>
                    <TableCell className="text-muted-foreground">{m.telephone || "—"}</TableCell>
                    <TableCell><StatutBadge statut={m.statut} /></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(m.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="opacity-60 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelected(m)}>
                            <Eye className="mr-2 h-4 w-4" /> Voir le profil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(m)}>Modifier les informations</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Statut</DropdownMenuLabel>
                          {STATUTS.map((s) => (
                            <DropdownMenuItem key={s} disabled={m.statut === s} onClick={() => setStatus(m.id, s)}>
                              {labelStatut(s)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between items-center mt-4">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Précédent</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button variant="outline" disabled={members.length < PAGE} onClick={() => setPage((p) => p + 1)}>Suivant →</Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* View profile */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Profil membre</DialogTitle></DialogHeader>
          {selected && (
            <div className="flex gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                <MemberAvatarImage src={selected.photo_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold text-xl">
                  {(selected.prenoms?.[0] ?? "") + (selected.nom?.[0] ?? "")}
                </AvatarFallback>
              </Avatar>
              <dl className="grid grid-cols-2 gap-2 text-sm flex-1">
                <D k="Matricule" v={selected.matricule || "—"} />
                <D k="Nom" v={`${selected.nom} ${selected.prenoms}`} />
                <D k="Email" v={selected.email || "—"} />
                <D k="Téléphone" v={selected.telephone || "—"} />
                <D k="Statut" v={selected.statut} />
                <D k="Inscription" v={new Date(selected.created_at).toLocaleDateString("fr-FR")} />
              </dl>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le membre</DialogTitle></DialogHeader>
          {editData && (
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "nom","prenoms","email","telephone","cni","adresse","photo_url",
                "collectivite","region","direction","fonction","matricule_pro","matricule",
                "sexe","lieu_naissance","date_naissance","date_embauche","ayants_droit",
                "type_membre","validation_mode","payment_reference","suspended_reason",
              ].map((f) => (
                <div key={f}>
                  <Label className="text-xs">{f}</Label>
                  <Input
                    value={editData[f] ?? ""}
                    onChange={(e) => setEditData({ ...editData, [f]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function labelStatut(s: string) {
  return ({
    actif: "Activer", en_attente: "Mettre en attente", suspendu: "Suspendre",
    decede: "Déclarer décédé", marie: "Déclarer marié", licencie: "Déclarer licencié",
    assiste: "Déclarer assisté", retraite: "Déclarer retraité",
  } as any)[s] ?? s;
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    actif: "bg-emerald-100 text-emerald-700 border-emerald-200",
    en_attente: "bg-amber-100 text-amber-700 border-amber-200",
    suspendu: "bg-red-100 text-red-700 border-red-200",
    decede: "bg-slate-200 text-slate-700 border-slate-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[statut] ?? "bg-muted text-muted-foreground border-border"}`}>
      {statut}
    </span>
  );
}

function PremiumKPI({
  icon: Icon, label, value, gradient, trend,
}: {
  icon: any; label: string; value: string | number; gradient: string; trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.08]`} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            {trend && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <ArrowUpRight className="h-3 w-3" /> {trend}
              </div>
            )}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function D({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b pb-1">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
