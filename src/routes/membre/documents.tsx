import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Download,
  FileText,
  Loader2,
  QrCode,
  CreditCard,
  Search,
  ExternalLink,
  FolderOpen,
} from "lucide-react";

export const Route = createFileRoute("/membre/documents")({ component: Page });

type Doc = {
  id: string;
  type: string;
  title: string | null;
  file_name: string | null;
  url: string;
  mime_type: string | null;
  created_at: string;
};

function Page() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");

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
        .from("documents")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });
      setDocs((data as Doc[]) ?? []);
      setBusy(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (!q) return docs;
    const s = q.toLowerCase();
    return docs.filter(
      (d) =>
        d.type.toLowerCase().includes(s) ||
        (d.title ?? "").toLowerCase().includes(s) ||
        (d.file_name ?? "").toLowerCase().includes(s),
    );
  }, [docs, q]);

  return (
    <MembreLayout
      title="Mes documents"
      subtitle="Téléchargez votre carte, votre fiche officielle et vos pièces justificatives"
    >
      {/* Featured documents */}
      <div className="grid gap-4 md:grid-cols-2">
        <FeatureCard
          icon={FileText}
          title="Fiche officielle"
          description="Téléchargez votre fiche d'inscription avec QR Code et filigrane MUGEC-CI."
          to="/membre/carte"
          gradient="primary"
        />
        <FeatureCard
          icon={CreditCard}
          title="Carte de membre"
          description="Carte format CR80 imprimable recto/verso avec QR code de vérification."
          to="/membre/carte"
          gradient="accent"
        />
      </div>

      {/* Other documents */}
      <Card className="mt-6 shadow-[var(--shadow-soft)]">
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Autres documents</CardTitle>
            <p className="text-xs text-muted-foreground">
              Justificatifs, attestations et pièces téléversées
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un document…"
              className="h-9 w-full pl-9 sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {busy ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <FolderOpen className="mx-auto mb-2 h-10 w-10 opacity-30" />
              {q ? "Aucun résultat" : "Aucun document"}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Document</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id} className="border-b transition hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {d.title ?? d.file_name ?? "Document"}
                              </div>
                              {d.file_name && d.title && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {d.file_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize">
                            {d.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild size="sm" variant="ghost">
                            <a href={d.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Ouvrir
                            </a>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y md:hidden">
                {filtered.map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-4 transition hover:bg-muted/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {d.title ?? d.file_name ?? "Document"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{d.type}</span>
                        <span>·</span>
                        <span>{new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </MembreLayout>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  to,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  gradient: "primary" | "accent";
}) {
  return (
    <Card className="group relative overflow-hidden border-0 shadow-[var(--shadow-elegant)] transition hover:-translate-y-1 hover:shadow-2xl">
      <div
        className="absolute inset-0 opacity-10 transition group-hover:opacity-20"
        style={{
          background:
            gradient === "primary" ? "var(--gradient-primary)" : "var(--gradient-accent)",
        }}
      />
      <div
        className="absolute right-0 top-0 h-32 w-32 rounded-full opacity-20 blur-3xl"
        style={{
          background: gradient === "primary" ? "var(--color-primary)" : "var(--color-accent)",
        }}
      />
      <CardContent className="relative p-6">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg"
          style={{
            background:
              gradient === "primary" ? "var(--gradient-primary)" : "var(--gradient-accent)",
          }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <Button asChild className="mt-5" variant="outline">
          <Link to={to}>
            <Download className="mr-2 h-4 w-4" /> Télécharger
          </Link>
        </Button>
      </CardContent>
      <QrCode className="absolute bottom-4 right-4 h-16 w-16 text-foreground/5" />
    </Card>
  );
}
