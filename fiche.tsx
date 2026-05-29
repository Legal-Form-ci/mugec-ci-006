import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, MIPROJET_NAV } from "@/components/DashboardHeader";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  PieChart as PieIcon,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/admin/miprojet")({ component: MiProjetDashboard });

type Stats = {
  transactions_total: number;
  transactions_paye: number;
  transactions_attente: number;
  parts_miprojet_mois: number;
  parts_mutuelle_mois: number;
  sessions_paiement: number;
};

type Tx = {
  id: string;
  montant: number;
  statut: string;
  reference: string | null;
  created_at: string;
  date_virement: string | null;
};

const PAGE = 50;
const COLORS = {
  primary: "#1e5ba8",
  teal: "#2baa8a",
  green: "#7cb342",
  amber: "#f59e0b",
  rose: "#e11d48",
};

function fmtFCFA(n: number | undefined | null) {
  return `${(n ?? 0).toLocaleString("fr-FR")} F`;
}

export function MiProjetDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tx, setTx] = useState<Tx[]>([]);
  const [allTx, setAllTx] = useState<Tx[]>([]);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Garde d'accès : seul super_admin peut accéder à ce back-office.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) { navigate({ to: "/login" }); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!active) return;
      if (!data) { navigate({ to: "/admin" }); return; }
      setAuthorized(true);
    })();
    return () => { active = false; };
  }, [user?.id, authLoading, navigate]);

  useEffect(() => {
    if (!authorized) return;
    supabase.rpc("miprojet_dashboard_stats").then(({ data }) => {
      if (data) setStats(data as Stats);
    });
    // Pour les graphiques 12 derniers mois
    supabase
      .from("transactions_miprojet")
      .select("id, montant, statut, reference, created_at, date_virement")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => setAllTx((data || []) as Tx[]));
  }, [authorized]);

  useEffect(() => {
    supabase
      .from("transactions_miprojet")
      .select("id, montant, statut, reference, created_at, date_virement")
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .then(({ data }) => setTx((data || []) as Tx[]));
  }, [page]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tx.filter((t) => {
      if (statusFilter !== "all" && t.statut !== statusFilter) return false;
      if (!q) return true;
      return (t.reference || "").toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    });
  }, [tx, query, statusFilter]);

  // Series 12 derniers mois
  const monthly = useMemo(() => {
    const months: { key: string; label: string; paye: number; attente: number; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        paye: 0,
        attente: 0,
        count: 0,
      });
    }
    for (const t of allTx) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === key);
      if (!m) continue;
      m.count++;
      if (t.statut === "paye") m.paye += t.montant;
      else m.attente += t.montant;
    }
    return months;
  }, [allTx]);

  const splitData = useMemo(
    () => [
      { name: "Part MiProjet", value: stats?.parts_miprojet_mois ?? 0, color: COLORS.primary },
      { name: "Part Mutuelle", value: stats?.parts_mutuelle_mois ?? 0, color: COLORS.teal },
    ],
    [stats],
  );

  const totalMois = (stats?.parts_miprojet_mois ?? 0) + (stats?.parts_mutuelle_mois ?? 0);
  const tauxConversion =
    (stats?.transactions_total ?? 0) > 0
      ? Math.round(((stats?.transactions_paye ?? 0) / (stats?.transactions_total ?? 1)) * 100)
      : 0;

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Vérification des droits…
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-surface)" }}>
      <DashboardHeader title="Back-office Super Admin" nav={MIPROJET_NAV} />
      <main className="container mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6">
        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl md:p-8"
          style={{
            background:
              "linear-gradient(135deg,#0e2f6b 0%,#1e5ba8 45%,#2580c4 75%,#2baa8a 100%)",
          }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-[#7cb342]/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Back-office MiProjet · Super Admin
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Tableau de bord revenus
              </h1>
              <p className="mt-2 text-sm text-white/80 md:text-base">
                Supervision globale des revenus, splits automatiques et transactions MiProjet.
                Confidentiel — non visible côté MUGEC-CI.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" className="bg-white text-[#1e5ba8] hover:bg-white/90">
                <Download className="mr-2 h-4 w-4" /> Exporter CSV
              </Button>
              <Link to="/admin">
                <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  Admin MUGEC-CI <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Mini stats inline */}
          <div className="relative mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <HeroStat
              label="Total cumulé"
              value={fmtFCFA(stats?.transactions_total)}
              icon={<Wallet className="h-4 w-4" />}
            />
            <HeroStat
              label="Payé"
              value={fmtFCFA(stats?.transactions_paye)}
              icon={<CheckCircle2 className="h-4 w-4" />}
              trend="up"
            />
            <HeroStat
              label="En attente"
              value={fmtFCFA(stats?.transactions_attente)}
              icon={<Clock className="h-4 w-4" />}
              trend="down"
            />
            <HeroStat
              label="Taux conversion"
              value={`${tauxConversion}%`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* KPI Cards premium */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label="Part MiProjet (mois)"
            value={fmtFCFA(stats?.parts_miprojet_mois)}
            sub="20% des cotisations · split serveur"
            icon={<Banknote className="h-5 w-5" />}
            accent={COLORS.primary}
          />
          <KPICard
            label="Part Mutuelle (mois)"
            value={fmtFCFA(stats?.parts_mutuelle_mois)}
            sub="80% reversés à MUGEC-CI"
            icon={<Wallet className="h-5 w-5" />}
            accent={COLORS.teal}
          />
          <KPICard
            label="Sessions paiement OK"
            value={String(stats?.sessions_paiement ?? "—")}
            sub="Webhooks confirmés"
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent={COLORS.green}
          />
          <KPICard
            label="Volume du mois"
            value={fmtFCFA(totalMois)}
            sub="MiProjet + Mutuelle"
            icon={<TrendingUp className="h-5 w-5" />}
            accent={COLORS.amber}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Évolution des revenus</CardTitle>
                <CardDescription>12 derniers mois — payé vs en attente</CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono">
                {monthly.reduce((s, m) => s + m.count, 0)} tx
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPaye" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAttente" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.amber} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLORS.amber} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtFCFA(v)}
                      contentStyle={{
                        background: "white",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="paye"
                      name="Payé"
                      stroke={COLORS.primary}
                      strokeWidth={2.5}
                      fill="url(#gPaye)"
                    />
                    <Area
                      type="monotone"
                      dataKey="attente"
                      name="En attente"
                      stroke={COLORS.amber}
                      strokeWidth={2}
                      fill="url(#gAttente)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieIcon className="h-4 w-4" /> Répartition du mois
              </CardTitle>
              <CardDescription>Split MiProjet / Mutuelle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={splitData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {splitData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtFCFA(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {splitData.map((d) => {
                  const pct = totalMois > 0 ? Math.round((d.value / totalMois) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: d.color }}
                        />
                        {d.name}
                      </span>
                      <span className="font-mono font-semibold">
                        {fmtFCFA(d.value)} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bar chart count */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Volume de transactions / mois</CardTitle>
            <CardDescription>Nombre brut de transactions enregistrées</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" name="Transactions" fill={COLORS.teal} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Table avec filtres */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Transactions MiProjet</CardTitle>
                <CardDescription>{PAGE} par page · ordre antéchronologique</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher référence ou ID…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-64 pl-8"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="paye">Payé</SelectItem>
                    <SelectItem value="en_attente">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="table">
              <TabsList>
                <TabsTrigger value="table">Tableau</TabsTrigger>
                <TabsTrigger value="cards">Cartes</TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="mt-4">
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Créée</TableHead>
                        <TableHead>Virée</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            Aucune transaction
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((t) => (
                          <TableRow key={t.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs">
                              {t.reference || t.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {fmtFCFA(t.montant)}
                            </TableCell>
                            <TableCell>
                              <StatutBadge statut={t.statut} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.date_virement
                                ? new Date(t.date_virement).toLocaleDateString("fr-FR")
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="cards" className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.length === 0 && (
                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      Aucune transaction
                    </p>
                  )}
                  {filtered.map((t) => (
                    <Card key={t.id} className="border-l-4" style={{ borderLeftColor: t.statut === "paye" ? COLORS.green : COLORS.amber }}>
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-mono text-xs text-muted-foreground truncate">
                            {t.reference || t.id.slice(0, 8)}
                          </div>
                          <StatutBadge statut={t.statut} />
                        </div>
                        <div className="text-2xl font-bold">{fmtFCFA(t.montant)}</div>
                        <div className="text-xs text-muted-foreground">
                          Créée {new Date(t.created_at).toLocaleDateString("fr-FR")}
                          {t.date_virement
                            ? ` · Virée ${new Date(t.date_virement).toLocaleDateString("fr-FR")}`
                            : ""}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Précédent
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button variant="outline" disabled={tx.length < PAGE} onClick={() => setPage((p) => p + 1)}>
                Suivant →
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function HeroStat({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur">
      <div className="flex items-center justify-between text-white/80">
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-bold text-white md:text-xl">{value}</span>
        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-300" />}
        {trend === "down" && <ArrowDownRight className="h-4 w-4 text-amber-300" />}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow"
            style={{ background: accent }}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  if (statut === "paye")
    return (
      <Badge className="border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Payé
      </Badge>
    );
  if (statut === "en_attente")
    return (
      <Badge className="border-0 bg-amber-100 text-amber-700 hover:bg-amber-100">
        <Clock className="mr-1 h-3 w-3" /> En attente
      </Badge>
    );
  return <Badge variant="secondary">{statut}</Badge>;
}
