import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Watermark } from "@/components/Watermark";
import { toast } from "sonner";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { finalizeRegistration } from "@/lib/inscription.functions";
import { Check, CreditCard, User, ArrowLeft, ArrowRight, Download, FileText, BadgeCheck } from "lucide-react";
import { generateFicheAdhesionPDF, generateAutorisationPrelevementPDF, downloadBlob, type DraftData } from "@/lib/pdf-documents";
import { AyantsDroitFields, ayantsDroitToText, EMPTY_AYANT, type AyantDroit } from "@/components/AyantsDroitFields";
import { FileUploadPreview, PhotoIdentityUpload, type UploadedFile } from "@/components/FileUploadPreview";

export const Route = createFileRoute("/inscription")({ component: Page });
const DRAFT_KEY = "mugec_inscription_draft_v2";

const step1Schema = z.object({
  nom: z.string().trim().min(2, "Nom requis").max(100),
  prenoms: z.string().trim().min(2, "Prénoms requis").max(150),
  dateNaissance: z.string().min(1, "Date de naissance requise"),
  lieuNaissance: z.string().trim().min(2).max(100),
  sexe: z.enum(["M", "F"]),
  email: z.string().trim().email("Email invalide"),
  telephone: z.string().trim().min(8).max(20),
  cni: z.string().trim().min(4).max(30),
  adresse: z.string().trim().min(2).max(255),
  collectivite: z.string().trim().min(2).max(150),
  matriculePro: z.string().trim().min(2).max(50),
});

type PieceType = "cni" | "passeport";

type FormData = {
  nom: string; prenoms: string; dateNaissance: string; lieuNaissance: string;
  sexe: "M" | "F"; email: string; telephone: string; cni: string; adresse: string;
  collectivite: string; region: string; direction?: string; fonction: string;
  matriculePro?: string; dateEmbauche?: string;
  ayantsDroit: AyantDroit[];
  photoIdentite: UploadedFile | null;
  pieceType: PieceType;
  cniRecto: UploadedFile | null;
  cniVerso: UploadedFile | null;
  passeport: UploadedFile | null;
  extraitNaissance: UploadedFile | null;
  ficheSignee: UploadedFile | null;
  autorisationSignee: UploadedFile | null;
  password: string;
  paiement: "orange" | "mtn" | "wave" | "moov";
};

const steps = [
  { id: 1, label: "Formulaire", icon: User },
  { id: 2, label: "Documents signés", icon: FileText },
  { id: 3, label: "Paiement", icon: CreditCard },
  { id: 4, label: "Confirmation", icon: BadgeCheck },
];

const passwordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);

function Page() {
  const nav = useNavigate();
  const finalize = useServerFn(finalizeRegistration);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<FormData>>({
    sexe: "M",
    paiement: "orange",
    pieceType: "cni",
    ayantsDroit: [{ ...EMPTY_AYANT }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<"fiche" | "autorisation" | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData((d) => ({ ...d, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        // Strip sensitive fields (password, identity photo) before persisting draft.
        const { password: _pw, photoIdentite: _ph, ...safe } = data as FormData & Record<string, unknown>;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [data]);

  const upd = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setData((d) => ({ ...d, [k]: v }));
  const val = (k: keyof FormData) => (data[k] ?? "") as string;

  const ayantsText = () => ayantsDroitToText(data.ayantsDroit ?? []);

  function pdfPayload(): DraftData {
    return {
      nom: data.nom,
      prenoms: data.prenoms,
      dateNaissance: data.dateNaissance,
      lieuNaissance: data.lieuNaissance,
      sexe: data.sexe,
      email: data.email,
      telephone: data.telephone,
      cni: data.cni,
      adresse: data.adresse,
      collectivite: data.collectivite,
      region: data.region,
      direction: data.direction,
      fonction: data.fonction,
      matriculePro: data.matriculePro,
      dateEmbauche: data.dateEmbauche,
      ayantsDroit: ayantsText(),
      ayantsDroitList: data.ayantsDroit,
      photoIdentite: data.photoIdentite?.dataUrl,
    };
  }

  async function downloadFiche() {
    setGeneratingPdf("fiche");
    try {
      const blob = await generateFicheAdhesionPDF(pdfPayload());
      downloadBlob(blob, `fiche-inscription-${data.nom ?? "mugec"}.pdf`);
    } finally { setGeneratingPdf(null); }
  }
  async function downloadAutorisation() {
    setGeneratingPdf("autorisation");
    try {
      const blob = await generateAutorisationPrelevementPDF(pdfPayload());
      downloadBlob(blob, `autorisation-prelevement-${data.nom ?? "mugec"}.pdf`);
    } finally { setGeneratingPdf(null); }
  }

  function validateStep(): boolean {
    try {
      if (step === 1) {
        step1Schema.parse(data);
        if (!data.photoIdentite) {
          toast.error("La photo d'identité est obligatoire.");
          return false;
        }
        const valid = (data.ayantsDroit ?? []).filter((a) => a.type && a.nom.trim());
        if (valid.length === 0) {
          toast.error("Renseignez au moins un ayant-droit.");
          return false;
        }
      }
      if (step === 2) {
        if (!data.ficheSignee) { toast.error("La fiche d'adhésion signée est obligatoire."); return false; }
        if (!data.autorisationSignee) { toast.error("L'autorisation de prélèvement signée est obligatoire."); return false; }
        if (!data.extraitNaissance) { toast.error("L'extrait de naissance est obligatoire."); return false; }
        if (data.pieceType === "cni") {
          if (!data.cniRecto || !data.cniVerso) {
            toast.error("Veuillez téléverser la CNI recto ET verso.");
            return false;
          }
        } else if (!data.passeport) {
          toast.error("Veuillez téléverser la copie du passeport.");
          return false;
        }
      }
      if (step === 3) {
        if (!data.password || !passwordSchema.safeParse(data.password).success) {
          toast.error("Mot de passe : 8 caractères, 1 majuscule, 1 chiffre, 1 spécial.");
          return false;
        }
      }
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.errors.slice(0, 3).forEach((e) => toast.error(e.message));
      } else {
        toast.error("Veuillez vérifier le formulaire.");
      }
      return false;
    }
  }

  async function submit() {
    if (!validateStep()) return;
    if (!isSupabaseConfigured) {
      toast.error("Supabase non configuré.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: authErr } = await supabase.auth.signUp({
        email: data.email!,
        password: data.password!,
        options: { emailRedirectTo: `${window.location.origin}/membre` },
      });
      if (authErr && !/already/i.test(authErr.message)) throw authErr;
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email!,
        password: data.password!,
      });
      if (signInErr) throw signInErr;

      const payRef = `${(data.paiement ?? "pay").toUpperCase()}-${Date.now()}`;

      // Upload photo to private avatars bucket, store only the path.
      let photoPath: string | null = null;
      const userId = signInData.user?.id;
      if (data.photoIdentite?.dataUrl && userId) {
        const res = await fetch(data.photoIdentite.dataUrl);
        const blob = await res.blob();
        const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
        const path = `${userId}/photo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: blob.type, upsert: true });
        if (upErr) throw upErr;
        photoPath = path;
      }

      await finalize({
        data: {
          nom: data.nom!,
          prenoms: data.prenoms!,
          date_naissance: data.dateNaissance!,
          lieu_naissance: data.lieuNaissance!,
          sexe: data.sexe!,
          email: data.email!,
          telephone: data.telephone!,
          cni: data.cni!,
          adresse: data.adresse!,
          collectivite: data.collectivite!,
          region: data.region!,
          direction: data.direction || null,
          fonction: data.fonction!,
          matricule_pro: data.matriculePro || null,
          date_embauche: data.dateEmbauche || null,
          ayants_droit: ayantsText() || null,
          photo_url: photoPath,
          paiement_methode: data.paiement!,
          payment_reference: payRef,
        },
      });

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success("Inscription validée. Bienvenue !");
      nav({ to: "/membre" });
    } catch (e) {
      console.error("inscription submit failed", e);
      toast.error("Échec de l'inscription. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Formulaire d'inscription</h1>
        <p className="mt-2 text-muted-foreground">
          Étape {step} sur 4 — vos informations sont sauvegardées automatiquement. Frais d'inscription : <strong>5 000 FCFA</strong>.
        </p>

        <div className="mt-6">
          <Progress value={(step / 4) * 100} />
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.id} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                s.id === step ? "border-primary bg-primary/5 text-primary" : s.id < step ? "border-accent/40 bg-accent/5 text-accent" : "text-muted-foreground"
              }`}>
                {s.id < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                <span className="font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="relative mt-8 overflow-hidden">
          <Watermark opacity={0.07} />
          <CardContent className="relative p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <F label="Nom" v={val("nom")} on={(v) => upd("nom", v)} />
                  <F label="Prénoms" v={val("prenoms")} on={(v) => upd("prenoms", v)} />
                  <F label="Date de naissance" type="date" v={val("dateNaissance")} on={(v) => upd("dateNaissance", v)} />
                  <F label="Lieu de naissance" v={val("lieuNaissance")} on={(v) => upd("lieuNaissance", v)} />
                  <div>
                    <Label>Sexe</Label>
                    <Select value={data.sexe} onValueChange={(v) => upd("sexe", v as "M" | "F")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <F label="N° CNI / Passeport" v={val("cni")} on={(v) => upd("cni", v)} />
                  <F label="Matricule Solde" v={val("matriculePro")} on={(v) => upd("matriculePro", v)} />
                  <F label="E-mail" type="email" v={val("email")} on={(v) => upd("email", v)} />
                  <F label="Téléphone (WhatsApp)" v={val("telephone")} on={(v) => upd("telephone", v)} />
                  <F label="Collectivité d'origine" v={val("collectivite")} on={(v) => upd("collectivite", v)} />
                  <F label="Région" v={val("region")} on={(v) => upd("region", v)} />
                  <F label="Direction / Service" v={val("direction")} on={(v) => upd("direction", v)} />
                  <F label="Fonction" v={val("fonction")} on={(v) => upd("fonction", v)} />
                  <F label="Date d'embauche" type="date" v={val("dateEmbauche")} on={(v) => upd("dateEmbauche", v)} />
                </div>

                <div>
                  <Label>Adresse postale</Label>
                  <Textarea value={val("adresse")} onChange={(e) => upd("adresse", e.target.value)} rows={2} />
                </div>

                <div className="rounded-md border bg-secondary/30 p-4">
                  <PhotoIdentityUpload
                    label="Photo d'identité (auto-cadrée, 3:4)"
                    value={data.photoIdentite ?? null}
                    onChange={(v) => upd("photoIdentite", v)}
                  />
                </div>

                <div className="rounded-md border bg-secondary/30 p-4">
                  <Label className="text-base font-semibold">
                    Ayants-droit (maximum 4)
                  </Label>
                  <p className="mb-3 mt-1 text-xs text-muted-foreground">
                    Renseignez chaque ayant-droit : lien de parenté, nom complet, date et lieu de naissance.
                  </p>
                  <AyantsDroitFields
                    value={data.ayantsDroit ?? [{ ...EMPTY_AYANT }]}
                    onChange={(v) => upd("ayantsDroit", v)}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-primary">
                    <FileText className="h-4 w-4" /> Documents pré-remplis
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Téléchargez les documents pré-remplis, imprimez-les, signez-les puis téléversez les scans exigés ci-dessous.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={downloadFiche} disabled={generatingPdf !== null}>
                      <Download className="mr-2 h-4 w-4" />
                      {generatingPdf === "fiche" ? "Génération…" : "Fiche d'inscription (pré-remplie)"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={downloadAutorisation} disabled={generatingPdf !== null}>
                      <Download className="mr-2 h-4 w-4" />
                      {generatingPdf === "autorisation" ? "Génération…" : "Autorisation de prélèvement (pré-remplie)"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FileUploadPreview
                    label="Fiche d'inscription signée"
                    value={data.ficheSignee ?? null}
                    onChange={(v) => upd("ficheSignee", v)}
                  />
                  <FileUploadPreview
                    label="Autorisation de prélèvement signée"
                    value={data.autorisationSignee ?? null}
                    onChange={(v) => upd("autorisationSignee", v)}
                  />
                </div>

                <div className="rounded-md border bg-secondary/30 p-4">
                  <Label>Type de pièce d'identité</Label>
                  <Select
                    value={data.pieceType}
                    onValueChange={(v) => {
                      upd("pieceType", v as PieceType);
                      // reset autres
                      if (v === "cni") upd("passeport", null);
                      else { upd("cniRecto", null); upd("cniVerso", null); }
                    }}
                  >
                    <SelectTrigger className="mt-2 max-w-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cni">Carte Nationale d'Identité (CNI)</SelectItem>
                      <SelectItem value="passeport">Passeport</SelectItem>
                    </SelectContent>
                  </Select>

                  {data.pieceType === "cni" ? (
                    <div className="mt-4 grid gap-6 md:grid-cols-2">
                      <FileUploadPreview
                        label="CNI — Recto"
                        value={data.cniRecto ?? null}
                        onChange={(v) => upd("cniRecto", v)}
                        aspect="document"
                      />
                      <FileUploadPreview
                        label="CNI — Verso"
                        value={data.cniVerso ?? null}
                        onChange={(v) => upd("cniVerso", v)}
                        aspect="document"
                      />
                    </div>
                  ) : (
                    <div className="mt-4">
                      <FileUploadPreview
                        label="Passeport (page d'identité)"
                        value={data.passeport ?? null}
                        onChange={(v) => upd("passeport", v)}
                        aspect="document"
                      />
                    </div>
                  )}
                </div>

                <FileUploadPreview
                  label="Extrait de naissance"
                  value={data.extraitNaissance ?? null}
                  onChange={(v) => upd("extraitNaissance", v)}
                  aspect="document"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <Label>Choisissez votre moyen de paiement (5 000 FCFA)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { id: "orange", name: "Orange Money" },
                      { id: "mtn", name: "MTN MoMo" },
                      { id: "wave", name: "Wave" },
                      { id: "moov", name: "Moov Money" },
                    ].map((m) => (
                      <button key={m.id} type="button" onClick={() => upd("paiement", m.id as FormData["paiement"])}
                        className={`rounded-md border p-4 text-sm font-medium transition ${
                          data.paiement === m.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary"
                        }`}>{m.name}</button>
                    ))}
                  </div>
                </div>
                <F label="Numéro de téléphone du paiement" v={val("telephone")} on={(v) => upd("telephone", v)} />
                <div>
                  <Label>Créez un mot de passe sécurisé</Label>
                  <Input type="password" value={val("password")} onChange={(e) => upd("password", e.target.value)} />
                </div>
                <div className="rounded-md bg-secondary/60 p-4 text-sm text-muted-foreground">
                  En cliquant sur <strong>Payer & confirmer</strong>, vous acceptez les statuts de la MUGEC-CI
                  et autorisez le débit de 5 000 FCFA sur le numéro renseigné.
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-primary"><BadgeCheck className="h-4 w-4" /> Confirmation du dossier</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Après confirmation du paiement, le compte membre, le matricule, la fiche finale avec QR code et la carte CR80 recto/verso sont générés automatiquement.
                  </p>
                </div>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <Summary k="Nom complet" v={`${data.prenoms ?? ""} ${data.nom ?? ""}`.trim()} />
                  <Summary k="Téléphone" v={data.telephone ?? "—"} />
                  <Summary k="Collectivité" v={data.collectivite ?? "—"} />
                  <Summary k="Paiement" v={`${data.paiement ?? "orange"} — 5 000 FCFA`} />
                </dl>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Précédent
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={() => validateStep() && setStep((s) => s + 1)}>
                  Continuer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={submitting}>
                  {submitting ? "Traitement…" : "Payer & confirmer"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}

function F({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border bg-background/80 p-3">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="mt-1 font-medium text-foreground">{v || "—"}</dd>
    </div>
  );
}
