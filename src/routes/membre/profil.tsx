import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberAvatarImage } from "@/components/MemberAvatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Loader2,
  Pencil,
  Upload,
  User,
  MapPin,
  Briefcase,
  Mail,
  Phone,
  Save,
  X,
  Camera,
} from "lucide-react";

export const Route = createFileRoute("/membre/profil")({ component: Page });

function Page() {
  const { user, loading } = useAuth();
  const [m, setM] = useState<any>(null);
  const [fetched, setFetched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) { console.error("profil load failed", error); toast.error("Impossible de charger votre profil."); }
      setM(data ?? { user_id: user.id, email: user.email });
      setFetched(true);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function save() {
    if (!m) return;
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({
        telephone: m.telephone,
        adresse: m.adresse,
        direction: m.direction,
        fonction: m.fonction,
        collectivite: m.collectivite,
        region: m.region,
      })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) { console.error("profil save failed", error); return toast.error("Impossible d'enregistrer les modifications."); }
    toast.success("Profil mis à jour");
    setEdit(false);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setUploading(true);
    const path = `${user.id}/photo-${Date.now()}-${f.name}`;
    const up = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (up.error) {
      console.error("avatar upload failed", up.error);
      setUploading(false);
      return toast.error("Impossible d'envoyer la photo. Veuillez réessayer.");
    }
    // Store the storage path (bucket is private — signed URLs are generated on render)
    const url = path;
    const { error } = await supabase
      .from("members")
      .update({ photo_url: url })
      .eq("user_id", user.id);
    setUploading(false);
    if (error) { console.error("avatar update failed", error); return toast.error("Impossible d'enregistrer la photo."); }
    setM({ ...m, photo_url: url });
    toast.success("Photo mise à jour");
  }

  if (loading || !user || !fetched) {
    return (
      <MembreLayout title="Mon profil">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </MembreLayout>
    );
  }

  const ro = !edit;
  const initials = ((m.prenoms?.[0] ?? "") + (m.nom?.[0] ?? "")).toUpperCase() || "M";

  return (
    <MembreLayout
      title="Mon profil"
      subtitle="Gérez vos informations personnelles et professionnelles"
      actions={
        ro ? (
          <Button onClick={() => setEdit(true)} size="sm">
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEdit(false)}>
              <X className="mr-1 h-4 w-4" /> Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Identity card */}
        <Card className="lg:col-span-1 overflow-hidden border-0 shadow-[var(--shadow-elegant)]">
          <div className="relative h-24" style={{ background: "var(--gradient-primary)" }} />
          <CardContent className="-mt-12 p-6 text-center">
            <div className="relative inline-block">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                <MemberAvatarImage src={m.photo_url} />
                <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background transition hover:scale-105">
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPhoto}
                  disabled={uploading}
                />
              </label>
            </div>
            <h2 className="mt-3 text-lg font-bold tracking-tight">
              {m.prenoms} {m.nom}
            </h2>
            <p className="text-sm text-muted-foreground">{m.fonction ?? "Membre"}</p>
            <Badge
              variant={m.statut === "actif" ? "default" : "secondary"}
              className="mt-3 capitalize"
            >
              {m.statut ?? "en attente"}
            </Badge>
            <Separator className="my-4" />
            <div className="space-y-2 text-left text-sm">
              <InfoRow icon={Mail} value={m.email ?? "—"} />
              <InfoRow icon={Phone} value={m.telephone ?? "—"} />
              <InfoRow icon={MapPin} value={m.collectivite ?? m.region ?? "—"} />
              <InfoRow
                icon={Briefcase}
                value={<span className="font-mono text-xs">{m.matricule ?? "—"}</span>}
              />
            </div>
            <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition hover:border-primary hover:text-primary">
              <Upload className="h-3 w-3" />
              {uploading ? "Envoi en cours…" : "Changer la photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhoto}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>

        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Identité
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Nom" v={m.nom} disabled />
              <Field label="Prénoms" v={m.prenoms} disabled />
              <Field label="Email" v={m.email} disabled />
              <Field
                label="Téléphone"
                v={m.telephone}
                disabled={ro}
                on={(v) => setM({ ...m, telephone: v })}
              />
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4 text-primary" />
                Vie professionnelle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field
                label="Collectivité"
                v={m.collectivite}
                disabled={ro}
                on={(v) => setM({ ...m, collectivite: v })}
              />
              <Field
                label="Région"
                v={m.region}
                disabled={ro}
                on={(v) => setM({ ...m, region: v })}
              />
              <Field
                label="Direction / Service"
                v={m.direction}
                disabled={ro}
                on={(v) => setM({ ...m, direction: v })}
              />
              <Field
                label="Fonction"
                v={m.fonction}
                disabled={ro}
                on={(v) => setM({ ...m, fonction: v })}
              />
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Adresse postale
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label
                  htmlFor="adresse"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Adresse complète
                </Label>
                <Input
                  id="adresse"
                  value={m.adresse ?? ""}
                  disabled={ro}
                  onChange={(e) => setM({ ...m, adresse: e.target.value })}
                  className="h-11"
                  placeholder="Quartier, ville…"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MembreLayout>
  );
}

function Field({
  label,
  v,
  on,
  disabled,
}: {
  label: string;
  v?: string;
  on?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        value={v ?? ""}
        disabled={disabled}
        onChange={(e) => on?.(e.target.value)}
        className="h-11 transition disabled:bg-muted/40 disabled:opacity-100"
      />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}
