import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/opportunites")({
  component: Page,
});

function Page() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (supabase as any).from("opportunites").select("id, title, summary, description, type, lieu, date_limite, cover_url")
      .eq("published", true).order("created_at", { ascending: false }).limit(50)
      .then(({ data }: any) => { setItems(data ?? []); setLoading(false); });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Opportunités</h1>
        <p className="mt-3 text-muted-foreground">
          Formations, emplois et marchés publics relayés par la mutuelle.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {loading ? <div className="text-muted-foreground">Chargement…</div> :
           items.length === 0 ? <div className="text-muted-foreground">Aucune opportunité publiée.</div> :
           items.map((i) => (
            <Card key={i.id}>
              {i.cover_url && <img src={i.cover_url} alt={i.title} className="h-40 w-full object-cover rounded-t-lg" />}
              <CardContent className="p-6">
                {i.type && <Badge variant="secondary">{i.type}</Badge>}
                <h2 className="mt-3 text-lg font-semibold">{i.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{i.summary || i.description?.slice(0, 200)}</p>
                {i.date_limite && <p className="mt-2 text-xs">Date limite : <strong>{new Date(i.date_limite).toLocaleDateString("fr-FR")}</strong></p>}
                {i.lieu && <p className="text-xs text-muted-foreground">Lieu : {i.lieu}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
