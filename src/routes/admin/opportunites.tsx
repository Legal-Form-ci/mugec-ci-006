import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { generateArticle, generateArticleImages, upsertOpportunite, deleteContent } from "@/lib/ai-editor.functions";
import { AlertCircle, Sparkles, Plus, Edit, Trash2, Wand2, Eye, Image as ImageIcon, Loader2, Briefcase } from "lucide-react";

export const Route = createFileRoute("/admin/opportunites")({ component: OpportunitesAdmin });

type Opp = {
  id: string; title: string; slug: string | null; summary: string | null;
  description: string; body: string | null; cover_url: string | null;
  illustrations: string[] | null; type: string | null; category: string | null;
  tags: string[] | null; lieu: string | null; date_limite: string | null;
  meta_title: string | null; meta_description: string | null;
  published: boolean; created_at: string;
};

const EMPTY: Opp = {
  id: "", title: "", slug: "", summary: "", description: "", body: "", cover_url: "",
  illustrations: [], type: "", category: "", tags: [], lieu: "", date_limite: "",
  meta_title: "", meta_description: "", published: true, created_at: "",
};

function OpportunitesAdmin() {
  const [rows, setRows] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [current, setCurrent] = useState<Opp>(EMPTY);
  const [topic, setTopic] = useState("");
  const [imageMode, setImageMode] = useState<"none"|"cover"|"both">("cover");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const genArticle = useServerFn(generateArticle);
  const genImages = useServerFn(generateArticleImages);
  const save = useServerFn(upsertOpportunite);
  const del = useServerFn(deleteContent);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("opportunites").select("*")
      .order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    else setRows((data as Opp[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleGenerate() {
    if (!topic.trim()) { toast.error("Donnez un sujet"); return; }
    setGenerating(true);
    setDiagnostic(null);
    try {
      toast.message("Génération du texte IA…");
      const article = await genArticle({ data: { topic: topic.trim(), kind: "opportunite" } });
      let cover = ""; let illus: string[] = [];
      const draft: Opp = {
        ...EMPTY,
        title: article.title, slug: article.slug, summary: article.summary,
        description: article.summary || article.title, body: article.body,
        cover_url: cover, illustrations: illus, category: article.category, type: article.category,
        tags: article.tags, meta_title: article.meta_title, meta_description: article.meta_description,
        published: false,
      };
      const saved = await save({ data: { ...(draft as any), id: undefined } });
      toast.message("Brouillon IA enregistré. Publication en cours…");
      if (imageMode !== "none") {
        try {
          const c = await genImages({ data: { prompt: article.image_prompt, mode: "cover", count: 1, folder: "opportunites" } });
          cover = c.urls[0] || "";
          if (imageMode === "both") {
            const i = await genImages({ data: { prompt: article.image_prompt, mode: "illustrations", count: 2, folder: "opportunites" } });
            illus = i.urls;
          }
        } catch (imageError: any) {
          const detail = imageError?.message ?? "Image non générée";
          setDiagnostic(`Opportunité publiée sans image. Diagnostic image IA : ${detail}`);
          toast.warning("Image non générée, publication du texte maintenue.");
        }
      }
      const published = { ...draft, id: saved?.id ?? "", cover_url: cover, illustrations: illus, published: true };
      await save({ data: published as any });
      setCurrent(published);
      setGenOpen(false); setEditorOpen(true); setTopic("");
      await load();
      toast.success("Opportunité IA enregistrée, publiée et visible sur le site public.");
    } catch (e: any) {
      const detail = e?.message ?? "Erreur de génération ou d'enregistrement";
      setDiagnostic(`Échec génération/enregistrement opportunité : ${detail}`);
      toast.error("Échec upsertOpportunite", { description: detail });
    }
    finally { setGenerating(false); }
  }

  async function handleSave() {
    if (!current.title || !current.body) { toast.error("Titre et contenu requis"); return; }
    setSaving(true);
    try {
      const payload: any = { ...current, id: current.id || undefined };
      delete payload.created_at;
      await save({ data: payload });
      toast.success("Opportunité enregistrée");
      setDiagnostic(null);
      setEditorOpen(false); load();
    } catch (e: any) {
      const detail = e?.message ?? "Erreur enregistrement";
      setDiagnostic(`Échec upsertOpportunite : ${detail}`);
      toast.error("Échec upsertOpportunite", { description: detail });
    }
    finally { setSaving(false); }
  }

  async function handleDelete(o: Opp) {
    if (!confirm(`Supprimer "${o.title}" ?`)) return;
    try { await del({ data: { id: o.id, kind: "opportunites" } }); toast.success("Supprimé"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Opportunités MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        {diagnostic && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Diagnostic Opportunités</AlertTitle>
            <AlertDescription>{diagnostic}</AlertDescription>
          </Alert>
        )}
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Gestion des opportunités</CardTitle>
              <CardDescription>Formations, emplois, marchés publics. L'IA peut rédiger un brouillon complet.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setGenOpen(true)}><Wand2 className="mr-2 h-4 w-4"/> Générer avec l'IA</Button>
              <Button variant="outline" onClick={() => { setCurrent(EMPTY); setEditorOpen(true); }}><Plus className="mr-2 h-4 w-4"/> Nouvelle</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="py-8 text-center text-muted-foreground">Chargement…</div> :
             rows.length === 0 ? <div className="py-8 text-center text-muted-foreground">Aucune opportunité</div> : (
              <div className="grid gap-3">
                {rows.map((o) => (
                  <div key={o.id} className="flex items-start gap-4 rounded-lg border bg-card p-4">
                    {o.cover_url ? <img src={o.cover_url} alt="" className="h-20 w-32 rounded object-cover" /> :
                      <div className="h-20 w-32 rounded bg-muted flex items-center justify-center text-muted-foreground"><ImageIcon className="h-6 w-6"/></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{o.title}</h3>
                        {o.published ? <Badge>Publié</Badge> : <Badge variant="secondary">Brouillon</Badge>}
                        {o.type && <Badge variant="outline">{o.type}</Badge>}
                        {o.date_limite && <Badge variant="outline">Échéance : {new Date(o.date_limite).toLocaleDateString("fr-FR")}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{o.summary || o.description?.slice(0, 200)}</p>
                    </div>
                    <div className="flex gap-1">
                      {o.slug && <Button asChild size="sm" variant="ghost"><a href={`/opportunites/${o.slug}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4"/></a></Button>}
                      <Button size="sm" variant="ghost" onClick={() => { setCurrent({ ...o, illustrations: o.illustrations ?? [], tags: o.tags ?? [] }); setEditorOpen(true); }}><Edit className="h-4 w-4"/></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(o)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary"/> Générer une opportunité</DialogTitle>
            <DialogDescription>Décrivez l'offre, l'IA rédige le brouillon complet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Sujet</Label>
              <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex : Recrutement agent comptable, Mairie de Yamoussoukro, dépôt 30 juillet" /></div>
            <div><Label>Illustration</Label>
              <RadioGroup value={imageMode} onValueChange={(v: any) => setImageMode(v)} className="mt-2 grid gap-2">
                <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="none"/> Sans image</Label>
                <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="cover"/> Couverture uniquement</Label>
                <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="both"/> Couverture + 2 illustrations</Label>
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

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{current.id ? "Modifier" : "Nouvelle opportunité"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <div><Label>Titre *</Label><Input value={current.title} onChange={(e) => setCurrent({ ...current, title: e.target.value })} /></div>
              <div><Label>Résumé / Description courte</Label><Textarea rows={2} value={current.summary ?? ""} onChange={(e) => setCurrent({ ...current, summary: e.target.value, description: e.target.value })} /></div>
              <div><Label>Contenu complet *</Label>
                <RichEditor value={current.body ?? ""} onChange={(html) => setCurrent({ ...current, body: html })} /></div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Publié</Label>
                <Switch checked={current.published} onCheckedChange={(v) => setCurrent({ ...current, published: v })} />
              </div>
              <div><Label>Type</Label>
                <Input value={current.type ?? ""} onChange={(e) => setCurrent({ ...current, type: e.target.value, category: e.target.value })} placeholder="Emploi, Formation, Marché public…" /></div>
              <div><Label>Lieu</Label><Input value={current.lieu ?? ""} onChange={(e) => setCurrent({ ...current, lieu: e.target.value })} /></div>
              <div><Label>Date limite</Label><Input type="date" value={current.date_limite ?? ""} onChange={(e) => setCurrent({ ...current, date_limite: e.target.value })} /></div>
              <div><Label>Slug (URL)</Label><Input value={current.slug ?? ""} onChange={(e) => setCurrent({ ...current, slug: e.target.value })} /></div>
              <div><Label>Image de couverture (URL)</Label>
                <Input value={current.cover_url ?? ""} onChange={(e) => setCurrent({ ...current, cover_url: e.target.value })} />
                {current.cover_url && <img src={current.cover_url} alt="" className="mt-2 rounded border max-h-32 object-cover w-full"/>}</div>
              <div><Label>Tags (virgule)</Label>
                <Input value={(current.tags ?? []).join(", ")} onChange={(e) => setCurrent({ ...current, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
              <div><Label>Meta titre</Label><Input value={current.meta_title ?? ""} onChange={(e) => setCurrent({ ...current, meta_title: e.target.value })} /></div>
              <div><Label>Meta description</Label><Textarea rows={2} value={current.meta_description ?? ""} onChange={(e) => setCurrent({ ...current, meta_description: e.target.value })} /></div>
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