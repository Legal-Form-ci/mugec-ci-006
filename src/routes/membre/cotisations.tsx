import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Wallet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Plus,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/membre/cotisations")({ component: Page });

type Sub = {
  id: string;
  type: string;
  montant_total: number;
  statut_paiement: string;
  operateur: string | null;
  reference_transaction: string | null;
  paid_at: string | null;
  created_at: string;
  periode: string | null;
};

function Page() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"tous" | "paye" | "en_attente">("tous");

  useEffect(() => {
    (async () => {
      if (!user) return;
      setBusy(true);
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) {
        setBusy(false);
        return;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });
      setRows((data as Sub[]) ?? []);
      setBusy(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.statut_paiement === "paye");
    const pending = rows.filter((r) => r.statut_paiement !== "paye");
    return {
      total: paid.reduce((s, r) => s + (r.montant_total ?? 0), 0),
      paid: paid.length,
      pending: pending.length,
      pendingAmount: pending.reduce((s, r) => s + (r.montant_total ?? 0), 0),
    };
  }, [rows]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = d.toLocaleDateString("fr-FR", { month: "short" });
      map.set(k, 0);
    }
    rows
      .filter((r) => r.statut_paiement === "paye" && r.paid_at)
      .forEach((r) => {
        const d = new Date(r.paid_at as string);
        const k = d.toLocaleDateString("fr-FR", { month: "short" });
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + (r.montant_total ?? 0));
      });
    return Array.from(map.entries()).map(([mois, montant]) => ({ mois, montant }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "tous" && r.statut_paiement !== filter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.type.toLowerCase().includes(s) ||
        (r.periode ?? "").toLowerCase().includes(s) ||
        (r.reference_transaction ?? "").toLowerCase().includes(s) ||
        (r.operateur ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, filter]);

  return (
    <MembreLayout
      title="Mes cotisations"
      subtitle="Historique de vos paiements et adhésions"
      actions={
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Nouveau paiement
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total cotisé"
          value={`${stats.total.toLocaleString("fr-FR")} F`}
          icon={Wallet}
          tone="primary"
        />
        <StatCard label="Paiements validés" value={String(stats.paid)} icon={CheckCircle2} tone="success" />
        <StatCard label="En attente" value={String(stats.pending)} icon={Clock} tone="warning" />
        <StatCard
          label="Montant en attente"
          value={`${stats.pendingAmount.toLocaleString("fr-FR")} F`}
          icon={TrendingUp}
          tone="muted"
        />
      </div>

      {/* Chart */}
      <Card className="mt-6 shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Évolution sur 12 mois</CardTitle>
          <p className="text-xs text-muted-foreground">Montant cotisé par mois</p>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="mois" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v.toLocaleString("fr-FR")} F`, "Montant"]}
                />
                <Bar dataKey="montant" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filters + table */}
      <Card className="mt-6 shadow-[var(--shadow-soft)]">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Historique</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
                className="h-9 w-full pl-9 sm:w-56"
              />
            </div>
            <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
              {(["tous", "paye", "en_attente"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`rounded px-3 py-1 text-xs font-medium capitalize transition ${
                    filter === k
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "tous" ? "Tous" : k === "paye" ? "Payés" : "En attente"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {busy ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Wallet className="mx-auto mb-2 h-10 w-10 opacity-30" />
              Aucune cotisation
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Période</th>
                      <th className="px-4 py-3 font-medium">Montant</th>
                      <th className="px-4 py-3 font-medium">Opérateur</th>
                      <th className="px-4 py-3 font-medium">Référence</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b transition hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium capitalize">{r.type}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.periode ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums">
                          {(r.montant_total ?? 0).toLocaleString("fr-FR")} F
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.operateur ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {r.reference_transaction ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(r.paid_at ?? r.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={r.statut_paiement === "paye" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {r.statut_paiement.replace("_", " ")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y md:hidden">
                {filtered.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold capitalize">{r.type}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.periode ?? "—"} ·{" "}
                          {new Date(r.paid_at ?? r.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <Badge
                        variant={r.statut_paiement === "paye" ? "default" : "secondary"}
                        className="shrink-0 text-[10px] capitalize"
                      >
                        {r.statut_paiement.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div className="text-xs text-muted-foreground">
                        <div>{r.operateur ?? "—"}</div>
                        <div className="font-mono">{r.reference_transaction ?? "—"}</div>
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {(r.montant_total ?? 0).toLocaleString("fr-FR")} F
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </MembreLayout>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const tones: Record<typeof tone, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    warning: "from-amber-500/15 to-amber-500/5 text-amber-600",
    muted: "from-muted to-muted/30 text-muted-foreground",
  };
  return (
    <Card className="relative overflow-hidden shadow-[var(--shadow-soft)]">
      <div
        className={`absolute right-0 top-0 h-20 w-20 rounded-full bg-gradient-to-br opacity-50 blur-2xl ${tones[tone]}`}
      />
      <CardContent className="relative p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className={`rounded-lg bg-gradient-to-br p-2 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
