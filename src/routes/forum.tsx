import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Lock, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/forum")({
  component: Page,
});

type Topic = { id: string; title: string; author_id: string; created_at: string; closed: boolean };

function Page() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("forum_topics")
      .select("id,title,author_id,created_at,closed")
      .order("created_at", { ascending: false })
      .limit(50);
    setTopics((data as Topic[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { if (user) void load(); }, [user]);

  async function createTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!user || title.trim().length < 4) return;
    setBusy(true);
    const { error } = await supabase.from("forum_topics").insert({
      title: title.trim(),
      author_id: user.id,
    });
    setBusy(false);
    if (error) { toast.error("Impossible de créer le sujet"); return; }
    toast.success("Sujet créé");
    setTitle(""); setCreating(false);
    void load();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-4xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Forum & Discussions</h1>
            <p className="mt-2 text-muted-foreground">Espace réservé aux membres. Tout utilisateur connecté peut créer un sujet.</p>
          </div>
          {user && (
            <Button onClick={() => setCreating((c) => !c)}>
              <Plus className="mr-2 h-4 w-4" /> {creating ? "Annuler" : "Nouveau sujet"}
            </Button>
          )}
        </div>

        {!user ? (
          <Card className="mt-10">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Lock className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Connectez-vous pour accéder au forum et créer un sujet.</p>
              <Button asChild><Link to="/login">Se connecter</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {creating && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <form onSubmit={createTopic} className="space-y-3">
                    <Label htmlFor="t">Titre du sujet</Label>
                    <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ex: Question sur les cotisations" />
                    <Button type="submit" disabled={busy || title.trim().length < 4}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publier
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : topics.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <MessageSquare className="h-5 w-5" />
                      Aucun sujet pour le moment. Soyez le premier à lancer une discussion !
                    </div>
                  </CardContent>
                </Card>
              ) : (
                topics.map((t) => (
                  <Card key={t.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("fr-FR")} {t.closed && "· fermé"}</p>
                      </div>
                      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
