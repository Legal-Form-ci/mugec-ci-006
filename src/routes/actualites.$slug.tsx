import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Calendar, Clock, Share2, Tag } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { getPublicContentBySlug } from "@/lib/public-content.functions";

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

function readingTimeMin(html: string | null | undefined): number {
  const text = (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 220));
}

function ArticlePage() {
  const { slug } = Route.useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [readerMode, setReaderMode] = useState(false);
  const getContent = useServerFn(getPublicContentBySlug);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getContent({ data: { kind: "news", slug } });
      if (!alive) return;
      if (!data) setNotFound(true);
      else setItem(data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [getContent, slug]);

  const minutes = useMemo(() => readingTimeMin(item?.body), [item?.body]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container mx-auto max-w-4xl px-4 py-16 text-muted-foreground">Chargement…</div>
        <SiteFooter />
      </div>
    );
  }
  if (notFound || !item) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <section className="container mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Actualité introuvable</h1>
          <p className="mt-2 text-muted-foreground">Cet article n'est pas disponible.</p>
          <Button asChild className="mt-6"><Link to="/actualites"><ArrowLeft className="mr-2 h-4 w-4"/>Toutes les actualités</Link></Button>
        </section>
        <SiteFooter />
      </div>
    );
  }

  const illus: string[] = Array.isArray(item.illustrations) ? item.illustrations : [];
  const dateStr = new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const author = "Rédaction MUGEC-CI";
  const authorInitials = author.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: item.title, text: item.summary ?? "", url });
      else await navigator.clipboard.writeText(url);
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="container mx-auto max-w-4xl px-4 pt-8">
        <Link to="/actualites" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4"/> Retour aux actualités
        </Link>
      </div>

      {/* Hero cover */}
      {item.cover_url && (
        <div className="container mx-auto max-w-5xl px-4 pt-6">
          <div className="overflow-hidden rounded-2xl border bg-muted shadow-sm">
            <img src={item.cover_url} alt={item.title} className="w-full h-auto object-cover" />
          </div>
        </div>
      )}

      {/* Title block */}
      <section className="container mx-auto max-w-4xl px-4 pt-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          <Tag className="mr-1 h-3.5 w-3.5"/> Article
        </Badge>
        <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight uppercase leading-tight">
          {item.title}
        </h1>
        {item.summary && (
          <p className="mt-5 text-lg md:text-xl italic text-muted-foreground leading-relaxed">
            {item.summary}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y py-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {authorInitials}
            </div>
            <span className="font-medium">{author}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4"/> {dateStr}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4"/> {minutes} min de lecture
          </div>
          {item.category && (
            <Badge variant="outline" className="rounded-full border-primary/30 text-primary">{item.category}</Badge>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Vues", value: 0 },
            { label: "Lectures complètes", value: 0 },
            { label: "Partages", value: 0 },
            { label: "Réactions", value: 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-3xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4"/> Partager
          </Button>
          <Button size="sm" onClick={() => setReaderMode((v) => !v)}>
            <BookOpen className="mr-2 h-4 w-4"/> {readerMode ? "Quitter le mode lecture" : "Mode lecture"}
          </Button>
        </div>
      </section>

      {/* Article body */}
      <article className={`container mx-auto px-4 py-12 ${readerMode ? "max-w-2xl text-lg" : "max-w-4xl"}`}>
        <div
          className="article-content prose prose-neutral dark:prose-invert max-w-none
                     prose-headings:font-bold prose-headings:tracking-tight
                     prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
                     prose-h2:pl-4 prose-h2:border-l-4 prose-h2:border-primary
                     prose-h2:pb-2 prose-h2:border-b prose-h2:border-b-border
                     prose-h3:text-xl prose-h3:mt-8
                     prose-p:leading-relaxed prose-p:text-justify
                     prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                     prose-strong:text-foreground
                     prose-img:rounded-xl prose-img:border"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.body || "") }}
        />

        {illus.length > 0 && (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {illus.map((u, i) => (
              <img key={i} src={u} alt="" className="w-full rounded-xl border object-cover" />
            ))}
          </div>
        )}

        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t pt-6">
            {item.tags.map((t: string) => (
              <Badge key={t} variant="secondary" className="rounded-full">#{t}</Badge>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Button asChild variant="outline">
            <Link to="/actualites"><ArrowLeft className="mr-2 h-4 w-4"/> Toutes les actualités</Link>
          </Button>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
