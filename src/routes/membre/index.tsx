import { MemberAvatarImage } from "@/components/MemberAvatar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  Wallet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  CalendarDays,
  TrendingUp,
  CreditCard,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCFA } from "@/lib/format";

export const Route = createFileRoute("/membre/")({ component: Page });

type Member = {
  id?: string;
  nom?: string;
  prenoms?: string;
  email?: string;
  collectivite?: string;
  region?: string;
  fonction?: string;
  statut?: string;
  matricule?: string;
  photo_url?: string | null;
  telephone?: string | null;
  date_inscription?: string | null;
  droits_ouverts_le?: string | null;
};

type Subscription = {
  id: string;
  type: string;
  montant_total: number;
  statut_paiement: string;
  paid_at: string | null;
  created_at: string;
  periode: string | null;
};

function Page() {
  const { user, loading: authLoading } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [cotis, setCotis] = useState<{ id: string; montant: number; statut: string; periode: string | null; paye_le: string | null; created_at: string }[]>([]);

  useEffect(() => {
    let alive = true;
    if (authLoading || !user?.id || !isSupabaseConfigured) return;
    (async () => {
      const { data: m } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      if (m) setMember(m as Member);
      if (m?.id) {
        const [{ data: s }, { data: c }] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("id, type, montant_total, statut_paiement, paid_at, created_at, periode")
            .eq("member_id", m.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("cotisations")
            .select("id, montant, statut, periode, paye_le, created_at")
            .eq("member_id", m.id)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);
        if (!alive) return;
        setSubs((s as Subscription[]) ?? []);
        setCotis((c as any[]) ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, authLoading]);

  const m: Member = member ?? {};
  const initials = `${m.prenoms?.[0] ?? ""}${m.nom?.[0] ?? ""}`.toUpperCase() || "M";

  const stats = useMemo(() => {
    const paidSubs = subs.filter((s) => s.statut_paiement === "paye");
    const paidCotis = cotis.filter((c) => c.statut === "paye");
    // Dédupe : si un même paiement remonte côté subs et côté cotisations,
    // on prend le max pour éviter le double comptage.
    const subsTotal = paidSubs.reduce((sum, s) => sum + (s.montant_total ?? 0), 0);
    const cotiTotal = paidCotis.reduce((sum, c) => sum + (c.montant ?? 0), 0);
    const total = Math.max(subsTotal, cotiTotal);
    const paidCount = Math.max(paidSubs.length, paidCotis.length);
    const pending =
      subs.filter((s) => s.statut_paiement !== "paye").length +
      cotis.filter((c) => c.statut !== "paye").length;
    const lastPaid =
      paidSubs[0]?.paid_at ??
      paidSubs[0]?.created_at ??
      paidCotis[0]?.paye_le ??
      paidCotis[0]?.created_at ??
      null;
    return { total, pending, paidCount, lastPaid };
  }, [subs, cotis]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toLocaleDateString("fr-FR", { month: "short" });
      map.set(k, 0);
    }
    subs
      .filter((s) => s.statut_paiement === "paye" && s.paid_at)
      .forEach((s) => {
        const d = new Date(s.paid_at as string);
        const k = d.toLocaleDateString("fr-FR", { month: "short" });
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + (s.montant_total ?? 0));
      });
    return Array.from(map.entries()).map(([mois, montant]) => ({ mois, montant }));
  }, [subs]);

  const droitsOuverts = !!m.droits_ouverts_le && new Date(m.droits_ouverts_le) <= new Date();
  const daysSinceInscription = m.date_inscription
    ? Math.max(0, Math.floor((Date.now() - new Date(m.date_inscription).getTime()) / 86400000))
    : 0;
  const droitsProgress = droitsOuverts
    ? 100
    : Math.min(100, Math.round((daysSinceInscription / 90) * 100));

  return (
    <MembreLayout
      title={`Bonjour, ${m.prenoms ?? "Membre"} 👋`}
      subtitle="Voici l'état de votre adhésion à la MUGEC-CI"
      actions={
        <Button asChild size="sm">
          <Link to="/membre/cotisations">
            <Wallet className="mr-2 h-4 w-4" /> Payer
          </Link>
        </Button>
      }
    >
      {/* Hero member card */}
      <Card className="overflow-hidden border-0 shadow-[var(--shadow-elegant)]">
        <div className="relative h-28" style={{ background: "var(--gradient-primary)" }}>
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:24px_24px]" />
        </div>
        <CardContent className="-mt-14 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                <MemberAvatarImage src={m.photo_url} alt={`${m.prenoms} ${m.nom}`} />
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                  {m.prenoms} {m.nom}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.fonction ?? "—"} · {m.collectivite ?? m.region ?? "—"}
                </p>
                <p className="mt-1 text-xs font-mono text-muted-foreground">
                  {m.matricule ?? "Matricule en attente"}
                </p>
              </div>
            </div>
            <Badge
              variant={m.statut === "actif" ? "default" : "secondary"}
              className="uppercase tracking-wider"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {m.statut ?? "en attente"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Total cotisé"
          value={formatCFA(stats.total)}
          hint={`${stats.paidCount} paiement${stats.paidCount > 1 ? "s" : ""}`}
          tone="primary"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Paiements validés"
          value={String(stats.paidCount)}
          hint={
            stats.lastPaid
              ? `Dernier : ${new Date(stats.lastPaid).toLocaleDateString("fr-FR")}`
              : "Aucun"
          }
          tone="success"
        />
        <KpiCard
          icon={Clock}
          label="En attente"
          value={String(stats.pending)}
          hint={stats.pending > 0 ? "À régulariser" : "À jour"}
          tone="warning"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Droits aux prestations"
          value={droitsOuverts ? "Ouverts" : "En délai"}
          hint={droitsOuverts ? "Vous pouvez déposer une demande" : `${droitsProgress}% des 90 jours`}
          tone={droitsOuverts ? "success" : "muted"}
        />
      </div>

      {/* Chart + side panel */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-[var(--shadow-soft)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Cotisations des 6 derniers mois</CardTitle>
              <p className="text-xs text-muted-foreground">Vue d'ensemble de vos paiements</p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMontant" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="mois" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatCFA(v), "Montant"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="montant"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#colorMontant)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ma progression</CardTitle>
            <p className="text-xs text-muted-foreground">Ouverture des droits après 90 jours</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Délai 90 jours</span>
                <span className="font-semibold">{droitsProgress}%</span>
              </div>
              <Progress value={droitsProgress} className="h-2" />
            </div>

            <div className="space-y-2 border-t pt-4">
              <QuickLink to="/membre/cotisations" icon={CreditCard} label="Payer ma cotisation" tone="primary" />
              <QuickLink to="/membre/carte" icon={CreditCard} label="Ma carte de membre" tone="accent" />
              <QuickLink to="/membre/documents" icon={FileText} label="Mes documents" tone="muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="mt-6 shadow-[var(--shadow-soft)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Activité récente</CardTitle>
            <p className="text-xs text-muted-foreground">Vos derniers mouvements</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/membre/cotisations">
              Tout voir <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {subs.length === 0 && (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aucune activité pour le moment
            </div>
          )}
          {subs.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border p-3 transition hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    s.statut_paiement === "paye"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {s.statut_paiement === "paye" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium capitalize">
                    {s.type} {s.periode ? `— ${s.periode}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.paid_at ?? s.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {formatCFA(s.montant_total)}
                </div>
                <Badge
                  variant={s.statut_paiement === "paye" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {s.statut_paiement}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </MembreLayout>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  tone,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "primary" | "accent" | "muted";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    muted: "bg-secondary text-secondary-foreground",
  };
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-lg border p-3 transition hover:border-primary hover:bg-primary/5"
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const tones: Record<typeof tone, string> = {
    primary: "from-primary/10 to-primary/5 text-primary",
    success: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    warning: "from-amber-500/15 to-amber-500/5 text-amber-600",
    muted: "from-muted to-muted/30 text-muted-foreground",
  };
  return (
    <Card className="relative overflow-hidden border shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elegant)]">
      <div className={`absolute right-0 top-0 h-24 w-24 rounded-full bg-gradient-to-br opacity-50 blur-2xl ${tones[tone]}`} />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className={`rounded-lg bg-gradient-to-br p-2 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
