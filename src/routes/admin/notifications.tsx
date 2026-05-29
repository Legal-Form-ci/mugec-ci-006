import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardHeader, ADMIN_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Send, Plus, Search, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({ component: NotificationsPage });

type LogRow = {
  id: string; canal: string; event: string; contenu: string;
  statut: string; created_at: string; sent_at: string | null; error_message: string | null;
};
type Tpl = {
  id: string; event: string; channel: string; title: string; body: string;
  active: boolean; created_at: string;
};

function CanalIcon({ c }: { c: string }) {
  if (c === "email") return <Mail className="h-3.5 w-3.5"/>;
  if (c === "sms") return <Send className="h-3.5 w-3.5"/>;
  if (c === "whatsapp") return <MessageSquare className="h-3.5 w-3.5"/>;
  return <Bell className="h-3.5 w-3.5"/>;
}

function NotificationsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [q, setQ] = useState("");
  const [canal, setCanal] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Partial<Tpl>>({ event: "", channel: "email", title: "", body: "", active: true });
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingTpls, setLoadingTpls] = useState(true);
  const [preview, setPreview] = useState<Tpl | null>(null);

  async function loadLogs() {
    setLoadingLogs(true);
    let qb = supabase
      .from("notifications_log")
      .select("id, canal, event, contenu, statut, created_at, sent_at, error_message")
      .order("created_at", { ascending: false })
      .limit(100);
    if (canal !== "all") qb = qb.eq("canal", canal);
    const { data, error } = await qb;
    if (error) toast.error(error.message); else setLogs((data as any) || []);
    setLoadingLogs(false);
  }
  async function loadTpls() {
    setLoadingTpls(true);
    const { data, error } = await supabase
      .from("notification_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setTpls((data as any) || []);
    setLoadingTpls(false);
  }
  // Charge logs et templates en parallèle au montage; recharge seulement les logs sur changement de canal.
  useEffect(() => { loadTpls(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadLogs(); /* eslint-disable-next-line */ }, [canal]);

  const filtered = logs.filter((l) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return l.event.toLowerCase().includes(s) || l.contenu.toLowerCase().includes(s);
  });

  async function toggleTpl(t: Tpl) {
    const { error } = await supabase.from("notification_templates").update({ active: !t.active }).eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success("Modèle mis à jour"); loadTpls(); }
  }
  async function saveDraft() {
    if (!draft.event || !draft.channel || !draft.title || !draft.body) {
      toast.error("Tous les champs sont requis"); return;
    }
    const { error } = await supabase.from("notification_templates").insert([{
      event: draft.event, channel: draft.channel, title: draft.title, body: draft.body, active: draft.active ?? true,
    }]);
    if (error) toast.error(error.message);
    else { toast.success("Modèle créé"); setCreating(false); setDraft({ event: "", channel: "email", title: "", body: "", active: true }); loadTpls(); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Notifications MUGEC-CI" nav={ADMIN_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Historique</TabsTrigger>
            <TabsTrigger value="templates">Modèles</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary"/> Journal des notifications</CardTitle>
                  <CardDescription>Email · SMS · WhatsApp · In-app</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                    <Input placeholder="Événement, contenu…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72"/>
                  </div>
                  <Select value={canal} onValueChange={setCanal}>
                    <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous canaux</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="in_app">In-app</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Canal</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Contenu</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLogs ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucune notification</TableCell></TableRow>
                    ) : filtered.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell><Badge variant="outline" className="gap-1"><CanalIcon c={l.canal}/>{l.canal}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{l.event}</TableCell>
                        <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={l.contenu}>{l.contenu}</TableCell>
                        <TableCell>
                          {l.statut === "envoye"
                            ? <Badge className="bg-emerald-500/15 text-emerald-700">Envoyé</Badge>
                            : <Badge variant="destructive">{l.statut}</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("fr-FR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Modèles de notification</CardTitle>
                  <CardDescription>Variables : {"{{nom}}, {{prenoms}}, {{matricule}}, {{montant}}, {{periode}}"}</CardDescription>
                </div>
                <Button onClick={() => setCreating((v) => !v)}><Plus className="h-4 w-4 mr-1"/>{creating ? "Annuler" : "Nouveau"}</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {creating && (
                  <Card className="border-dashed">
                    <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Événement</Label>
                        <Input placeholder="ex: cotisation_relance" value={draft.event ?? ""} onChange={(e) => setDraft({ ...draft, event: e.target.value })}/>
                      </div>
                      <div>
                        <Label>Canal</Label>
                        <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="in_app">In-app</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Titre / Sujet</Label>
                        <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Corps du message</Label>
                        <Textarea rows={4} value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })}/>
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <Button onClick={saveDraft}>Enregistrer</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Événement</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Contenu</TableHead>
                      <TableHead>Actif</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTpls ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Chargement…</TableCell></TableRow>
                    ) : tpls.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Aucun modèle</TableCell></TableRow>
                    ) : tpls.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.event}</TableCell>
                        <TableCell><Badge variant="outline" className="gap-1"><CanalIcon c={t.channel}/>{t.channel}</Badge></TableCell>
                        <TableCell>{t.title}</TableCell>
                        <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={t.body}>{t.body}</TableCell>
                        <TableCell><Switch checked={t.active} onCheckedChange={() => toggleTpl(t)}/></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setPreview(t)}><Eye className="h-3.5 w-3.5 mr-1"/>Voir</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {preview && <CanalIcon c={preview.channel}/>} {preview?.title}
              </DialogTitle>
              <DialogDescription>
                Événement : <span className="font-mono">{preview?.event}</span> · Canal : {preview?.channel}
              </DialogDescription>
            </DialogHeader>
            {preview?.channel === "email" ? (
              <div className="rounded-lg border bg-muted/30 p-4">
                <iframe
                  title="Aperçu email"
                  className="h-[420px] w-full rounded bg-white"
                  srcDoc={renderEmailPreview(preview.title, preview.body)}
                />
              </div>
            ) : preview?.channel === "whatsapp" ? (
              <div className="rounded-lg bg-[#ECE5DD] p-4">
                <div className="ml-auto max-w-md rounded-lg bg-[#DCF8C6] p-3 shadow text-sm whitespace-pre-wrap">
                  <img src="/mugec-logo.png" alt="MUGEC-CI" className="mb-2 h-10 w-auto"/>
                  <div className="font-semibold mb-1">{preview.title}</div>
                  {preview.body}
                </div>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">{preview?.body}</pre>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function renderEmailPreview(title: string, body: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeBody = esc(body).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
          <tr><td style="background:linear-gradient(135deg,#0b5cad,#1f8a8b);padding:20px 28px" align="left">
            <img src="/mugec-logo.png" alt="MUGEC-CI" height="48" style="display:block;height:48px"/>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0b5cad">${esc(title)}</h1>
            <div style="font-size:15px;line-height:1.6">${safeBody}</div>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px" align="center">
            © ${new Date().getFullYear()} MUGEC-CI · Mutuelle Générale des Collectivités de Côte d'Ivoire
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}
