import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/OptimizedImage";
import { CardListSkeleton } from "@/components/ui/skeletons";

export const Route = createFileRoute("/actualites")({
  component: Page,
});

function Page() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (supabase as any).from("news").select("id, title, summary, body, cover_url, category, slug, created_at")
      .eq("published", true).order("created_at", { ascending: false }).limit(50)
      .then(({ data }: any) => { setItems(data ?? []); setLoading(false); });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Actualités & Annonces</h1>
        <p className="mt-3 text-muted-foreground">Informations officielles publiées par la MUGEC-CI.</p>
        <div className="mt-10">
          {loading ? <CardListSkeleton count={4} /> :
           items.length === 0 ? <div className="text-muted-foreground">Aucune actualité publiée.</div> :
           <div className="space-y-4">{items.map((n, idx) => (
            <Card key={n.id} className="overflow-hidden">
              {n.cover_url && (
                <OptimizedImage
                  src={n.cover_url}
                  alt={n.title}
                  aspect="16/6"
                  priority={idx === 0}
                  containerClassName="rounded-t-lg"
                />
              )}
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium uppercase text-accent">{new Date(n.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                  {n.category && <Badge variant="outline">{n.category}</Badge>}
                </div>
                <h2 className="mt-1 text-xl font-semibold">{n.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{n.summary || (n.body ? n.body.replace(/<[^>]+>/g, "").slice(0, 200) + "…" : "")}</p>
              </CardContent>
            </Card>
          ))}</div>}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
