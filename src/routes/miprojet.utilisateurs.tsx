import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DashboardHeader, MIPROJET_NAV } from "@/components/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from "@/lib/admin-users.functions";
import { UserPlus, Trash2, KeyRound, Users, Loader2, Copy } from "lucide-react";

export const Route = createFileRoute("/miprojet/utilisateurs")({ ssr: false, component: MiprojetUsers });

const MUGEC_ROLES = [
  { value: "admin_national", label: "Admin national" },
  { value: "admin_regional", label: "Admin régional" },
  { value: "admin_local", label: "Admin local" },
  { value: "secretaire_general", label: "Secrétaire général" },
  { value: "tresorier_national", label: "Trésorier national" },
  { value: "president", label: "Président" },
  { value: "directeur_executif", label: "Directeur exécutif" },
  { value: "secretaire_regional", label: "Secrétaire régional" },
  { value: "tresorier_regional", label: "Trésorier régional" },
  { value: "delegue_section", label: "Délégué de section" },
  { value: "agent_saisie", label: "Agent de saisie" },
];
const MIPROJET_ROLES = [
  { value: "miprojet_admin", label: "Admin MIPROJET (accès total)" },
  { value: "miprojet_viewer", label: "Lecture seule MIPROJET" },
];

function MiprojetUsers() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState<string | null>(null);

  const [form, setForm] = useState({
    portal: "mugec" as "mugec" | "miprojet",
    role: "admin_national",
    full_name: "",
    email: "",
    phone: "",
    send_via: "email" as "email" | "whatsapp",
    password: "",
  });

  const list = useServerFn(listAdminUsers);
  const create = useServerFn(createAdminUser);
  const update = useServerFn(updateAdminUser);
  const remove = useServerFn(deleteAdminUser);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/miprojet" }); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      if (!data) { navigate({ to: "/miprojet" }); return; }
      setAuthorized(true);
    })();
  }, [navigate]);

  async function load() {
    setLoading(true);
    try {
      const res = await list();
      setUsers(res.users ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Erreur de chargement"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (authorized) load(); }, [authorized]);

  async function handleCreate() {
    if (!form.email || !form.full_name) { toast.error("Nom et email requis"); return; }
    setSubmitting(true);
    setGeneratedPwd(null);
    try {
      const res = await create({ data: { ...form, phone: form.phone || undefined, password: form.password || undefined } });
      setGeneratedPwd((res as any).password);
      toast.success("Utilisateur créé et invitation envoyée");
      load();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setSubmitting(false); }
  }

  async function handleResetPwd(uid: string) {
    if (!confirm("Réinitialiser le mot de passe ?")) return;
    try {
      const res = await update({ data: { user_id: uid, reset_password: true } });
      const pwd = (res as any).password;
      if (pwd) {
        navigator.clipboard?.writeText(pwd);
        toast.success(`Nouveau mot de passe : ${pwd} (copié)`);
      }
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  async function handleDelete(uid: string) {
    if (!confirm("Supprimer définitivement cet utilisateur ?")) return;
    try { await remove({ data: { user_id: uid } }); toast.success("Supprimé"); load(); }
    catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  }

  const roles = form.portal === "mugec" ? MUGEC_ROLES : MIPROJET_ROLES;

  if (authorized === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Vérification…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <DashboardHeader title="Gestion utilisateurs" nav={MIPROJET_NAV} />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Administrateurs des deux portails</CardTitle>
              <CardDescription>Créer / révoquer les admins MUGEC-CI et MIPROJET. Réservé au super administrateur.</CardDescription>
            </div>
            <Button onClick={() => { setGeneratedPwd(null); setDialogOpen(true); }}><UserPlus className="mr-2 h-4 w-4"/> Nouveau compte</Button>
          </CardHeader>
          <CardContent>
            {loading ? <div className="py-8 text-center text-muted-foreground">Chargement…</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Aucun administrateur</TableCell></TableRow>
                  ) : users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                      <TableCell className="flex flex-wrap gap-1">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="text-[10px]">{r}</Badge>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleResetPwd(u.id)} title="Réinitialiser MDP"><KeyRound className="h-4 w-4"/></Button>
                        {!u.roles.includes("super_admin") && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} title="Supprimer"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setGeneratedPwd(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary"/> Créer un compte administrateur</DialogTitle>
            <DialogDescription>Le mot de passe par défaut est appliqué si vous le laissez vide.</DialogDescription>
          </DialogHeader>

          {generatedPwd ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-700">Compte créé avec succès</div>
                <div className="mt-2 text-sm">Mot de passe initial :</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-background px-2 py-1 font-mono">{generatedPwd}</code>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(generatedPwd); toast.success("Copié"); }}><Copy className="h-3 w-3"/></Button>
                </div>
              </div>
              <DialogFooter><Button onClick={() => { setDialogOpen(false); setGeneratedPwd(null); }}>Fermer</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Portail</Label>
                <RadioGroup value={form.portal} onValueChange={(v: any) => setForm({ ...form, portal: v, role: v === "mugec" ? "admin_national" : "miprojet_admin" })} className="mt-2 grid grid-cols-2 gap-2">
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="mugec"/> MUGEC-CI</Label>
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="miprojet"/> MIPROJET</Label>
                </RadioGroup>
              </div>
              <div>
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom complet</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+225…" /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Mot de passe (vide = défaut)</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={form.portal === "mugec" ? "@Mugec26" : "@Miprojet"} /></div>
              <div>
                <Label>Envoyer l'invitation par</Label>
                <RadioGroup value={form.send_via} onValueChange={(v: any) => setForm({ ...form, send_via: v })} className="mt-2 grid grid-cols-2 gap-2">
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="email"/> Email</Label>
                  <Label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer"><RadioGroupItem value="whatsapp"/> WhatsApp</Label>
                </RadioGroup>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Annuler</Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Création…</> : "Créer & envoyer"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}