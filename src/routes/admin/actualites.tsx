import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RichEditor } from "@/components/RichEditor";
import { generateArticle, generateArticleImages, upsertNews, deleteContent } from "@/lib/ai-editor.functions";
import { AlertCircle, Sparkles, Plus, Edit, Trash2, Wand2, Eye, Image as ImageIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/actualites")({ component: ActualitesPage });

type Article = {
  id: string; title: string; slug: string | null; summary: string | null;
  body: string; cover_url: string | null; illustrations: string[] | null;
  category: string | null; tags: string[] | null;
  meta_title: string | null; meta_description: string | null;
  published: boolean; created_at: string;
};

const EMPTY: Article = {
  id: "", title: "", slug: "", summary: "", body: "", cover_url: "",
  illustrations: [], category: "", tags: [], meta_title: "", meta_description: "",
  published: true, created_at: "",
};

function ActualitesPage() {
  const [rows, setRows] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [current, setCurrent] = useState<Article>(EMPTY);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState("");
  const [imageMode, setImageMode] = useState<"none"|"cover"|"both">("cover");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const genArticle = useServerFn(generateArticle);
  const genImages = useServerFn(generateArticleImages);
  const save = useServerFn(upsertNews);
  const del = useServerFn(deleteContent);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("news")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows((data as Article[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setCurrent(EMPTY); setEditorOpen(true); }
  function openEdit(a: Article) {
    setCurrent({
      ...a,
      illustrations: a.illustrations ?? [],
      tags: a.tags ?? [],
    });
    setEditorOpen(true);
  }

  async function handleGenerate() {
    if (!topic.trim()) { toast.error("Donnez un sujet"); return; }
    setGenerating(true);
    setDiagnostic(null);
    try {
      toast.message("Génération du texte IA…");
      const article = await genArticle({ data: { topic: topic.trim(), kind: "actualite" } });
      let cover = "";
      let illus: string[] = [];
      const draft: Article = {
        ...EMPTY,
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body: article.body,
        cover_url: cover,
        illustrations: illus,
        category: article.category,
        tags: article.tags,
        meta_title: article.meta_title,
        meta_description: article.meta_description,
        published: false,
      };
      const saved = await save({ data: { ...(draft as any), id: undefined } });
      toast.message("Brouillon IA enregistré. Publication en cours…");
      if (imageMode !== "none") {
        try {
          const coverRes = await genImages({ data: { prompt: article.image_prompt, mode: "cover", count: 1, folder: "actualites" } });
          cover = coverRes.urls[0] || "";
          if (imageMode === "both") {
            const illusRes = await genImages({ data: { prompt: article.image_prompt, mode: "illustrations", count: 2, folder: "actualites" } });
            illus = illusRes.urls;
          }
        } catch (imageError: any) {
          const detail = imageError?.message ?? "Image non générée";
          setDiagnostic(`Actualité publiée sans image. Diagnostic image IA : ${detail}`);
          toast.warning("Image non générée, publication du texte maintenue.");
        }
      }
      const published = { ...draft, id: saved?.id ?? "", cover_url: cover, illustrations: illus, published: true };
      await save({ data: published as any });
      setCurrent(published);
      setGenOpen(false);
      setEditorOpen(true);
      setTopic("");
      await load();
      toast.success("Actualité IA enregistrée, publiée et visible sur le site public.");
    } catch (e: any) {
      const detail = e?.message ?? "Erreur de génération ou d'enregistrement";
      setDiagnostic(`Échec génération/enregistrement actualité : ${detail}`);
      toast.error("Échec génération/enregistrement", { description: detail });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!current.title || !current.body) { toast.error("Titre et contenu requis"); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...current,
        id: current.id || undefined,
        tags: current.tags ?? [],
        illustrations: current.illustrations ?? [],
      };
      delete payload.created_at;
      await save({ data: payload });
      toast.success("Article enregistré");
      setDiagnostic(null);
      setEditorOpen(false);
      load();
    } catch (e: any) {
      const detail = e?.message ?? "Erreur enregistrement";
      setDiagnostic(`Échec upsertNews : ${detail}`);
      toast.error("Échec upsertNews", { description: detail });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: Article) {
    if (!confirm(`Supprimer "${a.title}" ?`)) return;
    try {
      await del({ data: { id: a.id, kind: "news" } });
      toast.success("Supprimé");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Actualités MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        {diagnostic && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Diagnostic Actualités</AlertTitle>
            <AlertDescription>{diagnostic}</AlertDescription>
          </Alert>
        )}
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Gestion des actualités</CardTitle>
              <CardDescription>Créez, éditez et publiez. L'IA peut rédiger un brouillon complet avec image.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setGenOpen(true)}><Wand2 className="mr-2 h-4 w-4" /> Générer avec l'IA</Button>
              <Button variant="outline" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nouvelle actualité</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="py-8 text-center text-muted-foreground">Chargement…</div> :
             rows.length === 0 ? <div className="py-8 text-center text-muted-foreground">Aucune actualité — créez la première !</div> : (
              <div className="grid gap-3">
                {rows.map((a) => (
                  <div key={a.id} className="flex items-start gap-4 rounded-lg border bg-card p-4">
                    {a.cover_url ? (
                      <img src={a.cover_url} alt="" className="h-20 w-32 rounded object-cover" />
                    ) : (
                      <div className="h-20 w-32 rounded bg-muted flex items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6"/></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{a.title}</h3>
                        {a.published ? <Badge>Publié</Badge> : <Badge variant="secondary">Brouillon</Badge>}
                        {a.category && <Badge variant="outline">{a.category}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.summary || a.body?.replace(/<[^>]+>/g, "").slice(0, 200)}</p>
                      <div className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString("fr-FR")}</div>
                    </div>
                    <div className="flex gap-1">
                      {a.slug && <Button asChild size="sm" variant="ghost"><a href={`/actualites/${a.slug}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4"/></a></Button>}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Edit className="h-4 w-4"/></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(a)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog Génération IA */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary"/> Générer une actualité</DialogTitle>
            <DialogDescription>Décrivez le sujet — l'IA produira titre, résumé, contenu, catégorie, tags et SEO.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sujet ou brief</Label>
              <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex : Lancement du nouveau service de cotisation mobile money" />
            </div>
            <div>
              <Label>Illustration</Label>
              <RadioGroup value={imageMode} onValueChange={(v: any) => setImageMode(v)} className="mt-2 grid gap-2">
                <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="none"/> Sans image</Label>
                <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="cover"/> Image de couverture uniquement</Label>
                <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="both"/> Couverture + 2 illustrations dans l'article</Label>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={generating}>Annuler</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Génération…</> : <><Sparkles className="mr-2 h-4 w-4"/>Générer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Éditeur */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{current.id ? "Modifier l'actualité" : "Nouvelle actualité"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input value={current.title} onChange={(e) => setCurrent({ ...current, title: e.target.value })} />
              </div>
              <div>
                <Label>Résumé</Label>
                <Textarea rows={2} value={current.summary ?? ""} onChange={(e) => setCurrent({ ...current, summary: e.target.value })} />
              </div>
              <div>
                <Label>Contenu *</Label>
                <RichEditor value={current.body} onChange={(html) => setCurrent({ ...current, body: html })} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Publié</Label>
                <Switch checked={current.published} onCheckedChange={(v) => setCurrent({ ...current, published: v })} />
              </div>
              <div>
                <Label>Image de couverture (URL)</Label>
                <Input value={current.cover_url ?? ""} onChange={(e) => setCurrent({ ...current, cover_url: e.target.value })} placeholder="https://…" />
                {current.cover_url && <img src={current.cover_url} alt="" className="mt-2 rounded border max-h-32 object-cover w-full" />}
              </div>
              <div>
                <Label>Catégorie</Label>
                <Input value={current.category ?? ""} onChange={(e) => setCurrent({ ...current, category: e.target.value })} />
              </div>
              <div>
                <Label>Tags (séparés par virgule)</Label>
                <Input
                  value={(current.tags ?? []).join(", ")}
                  onChange={(e) => setCurrent({ ...current, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input value={current.slug ?? ""} onChange={(e) => setCurrent({ ...current, slug: e.target.value })} />
              </div>
              <div>
                <Label>Meta titre (SEO)</Label>
                <Input value={current.meta_title ?? ""} onChange={(e) => setCurrent({ ...current, meta_title: e.target.value })} maxLength={70} />
              </div>
              <div>
                <Label>Meta description (SEO)</Label>
                <Textarea rows={2} value={current.meta_description ?? ""} onChange={(e) => setCurrent({ ...current, meta_description: e.target.value })} maxLength={180} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Enregistrement…</> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}