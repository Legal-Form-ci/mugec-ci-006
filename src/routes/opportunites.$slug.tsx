import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, CalendarClock } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { getPublicContentBySlug } from "@/lib/public-content.functions";

export const Route = createFileRoute("/opportunites/$slug")({
  component: OpportunitePage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Opportunité introuvable</h1>
        <Button asChild className="mt-4"><Link to="/opportunites">Voir toutes les opportunités</Link></Button>
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

function OpportunitePage() {
  const { slug } = Route.useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const getContent = useServerFn(getPublicContentBySlug);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getContent({ data: { kind: "opportunites", slug } });
      if (!alive) return;
      if (!data) setNotFound(true);
      else setItem(data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [getContent, slug]);

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
          <h1 className="text-3xl font-bold">Opportunité introuvable</h1>
          <Button asChild className="mt-6"><Link to="/opportunites"><ArrowLeft className="mr-2 h-4 w-4"/>Toutes les opportunités</Link></Button>
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
        <Link to="/opportunites" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4"/> Retour aux opportunités
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {item.type && <Badge variant="secondary">{item.type}</Badge>}
          {item.category && item.category !== item.type && <Badge variant="outline">{item.category}</Badge>}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{item.title}</h1>
        {item.summary && <p className="mt-3 text-lg text-muted-foreground">{item.summary}</p>}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {item.lieu && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4"/>{item.lieu}</span>}
          {item.date_limite && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-4 w-4"/>
              Date limite : <strong className="text-foreground">{new Date(item.date_limite).toLocaleDateString("fr-FR")}</strong>
            </span>
          )}
        </div>
        {item.cover_url && (
          <img src={item.cover_url} alt={item.title} className="mt-6 w-full rounded-lg border object-cover" />
        )}
        <div
          className="prose prose-neutral dark:prose-invert mt-8 max-w-none prose-headings:font-semibold prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.body || item.description || "") }}
        />
        {illus.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {illus.map((u, i) => <img key={i} src={u} alt="" className="w-full rounded-lg border object-cover" />)}
          </div>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}
