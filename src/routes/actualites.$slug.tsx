import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/actualites/$slug")({
  component: ArticlePage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Actualité introuvable</h1>
        <p className="mt-2 text-muted-foreground">L'article demandé n'existe pas ou a été retiré.</p>
        <Button asChild className="mt-4"><Link to="/actualites">Voir toutes les actualités</Link></Button>
      </div>
    </div>
  ),
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Erreur de chargement</h1>
          <Button className="mt-4" onClick={() => { router.invalidate(); reset(); }}>Réessayer</Button>
        </div>
      </div>
    );
  },
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("news")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (!alive) return;
      if (!data) setNotFound(true);
      else setItem(data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Chargement…</div>
        <SiteFooter />
      </div>
    );
  }
  if (notFound || !item) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <section className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Actualité introuvable</h1>
          <p className="mt-2 text-muted-foreground">Cet article n'est pas disponible.</p>
          <Button asChild className="mt-6"><Link to="/actualites"><ArrowLeft className="mr-2 h-4 w-4"/>Toutes les actualités</Link></Button>
        </section>
        <SiteFooter />
      </div>
    );
  }
  const illus: string[] = Array.isArray(item.illustrations) ? item.illustrations : [];
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="container mx-auto max-w-3xl px-4 py-12">
        <Link to="/actualites" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4"/> Retour aux actualités
        </Link>
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="font-medium uppercase text-accent">
            {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          {item.category && <Badge variant="outline">{item.category}</Badge>}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{item.title}</h1>
        {item.summary && <p className="mt-3 text-lg text-muted-foreground">{item.summary}</p>}
        {item.cover_url && (
          <img src={item.cover_url} alt={item.title} className="mt-6 w-full rounded-lg border object-cover" />
        )}
        <div
          className="prose prose-neutral dark:prose-invert mt-8 max-w-none prose-headings:font-semibold prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: item.body || "" }}
        />
        {illus.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {illus.map((u, i) => <img key={i} src={u} alt="" className="w-full rounded-lg border object-cover" />)}
          </div>
        )}
        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {item.tags.map((t: string) => <Badge key={t} variant="secondary">#{t}</Badge>)}
          </div>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}
