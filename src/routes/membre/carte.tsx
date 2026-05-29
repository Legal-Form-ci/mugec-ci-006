import { MemberAvatarImg } from "@/components/MemberAvatar";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MembreLayout } from "@/components/membre/MembreLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

import logo from "@/assets/mugec-logo.png";
import watermarkUrl from "@/assets/mugec-watermark.png";
import { Download, Printer, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";

export const Route = createFileRoute("/membre/carte")({
  component: Page,
});

type Member = {
  nom?: string;
  prenoms?: string;
  email?: string;
  telephone?: string;
  collectivite?: string;
  region?: string;
  fonction?: string;
  matricule?: string;
  cni?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  date_inscription?: string;
  statut?: string;
  type_membre?: string;
  photo_url?: string;
  qr_code?: string;
};

let imageCache: Record<string, string> = {};
async function imageToDataUrl(src: string) {
  if (imageCache[src]) return imageCache[src];
  const res = await fetch(src);
  const blob = await res.blob();
  imageCache[src] = await new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
  return imageCache[src];
}

function addPdfWatermark(pdf: jsPDF, watermarkData: string) {
  const anyPdf = pdf as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void };
  anyPdf.setGState(new anyPdf.GState({ opacity: 0.07 }));
  pdf.addImage(watermarkData, "PNG", 20, 7, 45, 40, undefined, "FAST");
  anyPdf.setGState(new anyPdf.GState({ opacity: 1 }));
}

function writeLabelValue(pdf: jsPDF, label: string, value: string | undefined, x: number, y: number, maxWidth: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.4);
  pdf.setTextColor(30, 91, 168);
  pdf.text(label.toUpperCase(), x, y);
  pdf.setFont("courier", "normal");
  pdf.setFontSize((value?.length ?? 0) > 26 ? 6.2 : 7);
  pdf.setTextColor(26, 58, 143);
  pdf.text(value?.trim() || "—", x, y + 3.5, { maxWidth });
}

function drawCardFront(pdf: jsPDF, m: Member, qr: string, logoData: string, watermarkData: string) {
  addPdfWatermark(pdf, watermarkData);
  pdf.setDrawColor(30, 91, 168);
  pdf.setLineWidth(0.7);
  pdf.rect(1.5, 1.5, 82.6, 51, "S");
  pdf.addImage(logoData, "PNG", 4, 3.5, 15, 12, undefined, "FAST");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(30, 91, 168);
  pdf.text("CARTE DE MEMBRE MUGEC-CI", 42.8, 7.5, { align: "center" });
  pdf.setFontSize(4.8);
  pdf.setTextColor(40, 40, 40);
  pdf.text("Mutuelle Générale du Personnel des Collectivités Territoriales", 42.8, 11.2, { align: "center" });
  pdf.setDrawColor(210, 210, 210);
  pdf.roundedRect(5, 17, 17, 22, 1, 1, "S");
  pdf.setFontSize(5);
  pdf.setTextColor(120, 120, 120);
  pdf.text("PHOTO", 13.5, 28.5, { align: "center" });
  writeLabelValue(pdf, "Nom & prénoms", `${m.nom ?? ""} ${m.prenoms ?? ""}`.trim(), 25, 18, 38);
  writeLabelValue(pdf, "Matricule", m.matricule, 25, 26, 30);
  writeLabelValue(pdf, "Type", m.type_membre ?? "office", 58, 26, 18);
  writeLabelValue(pdf, "Collectivité", m.collectivite, 25, 34, 34);
  writeLabelValue(pdf, "Statut", m.statut ?? "actif", 58, 34, 18);
  writeLabelValue(pdf, "Date d'inscription", m.date_inscription ? new Date(m.date_inscription).toLocaleDateString("fr-FR") : "—", 25, 42, 30);
  if (qr) pdf.addImage(qr, "PNG", 64, 31, 17, 17, undefined, "FAST");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(3.8);
  pdf.setTextColor(70, 70, 70);
  pdf.text("QR code vérifiable — marge haute correction pour impression", 64, 50);
}

function drawCardBack(pdf: jsPDF, m: Member, watermarkData: string) {
  addPdfWatermark(pdf, watermarkData);
  pdf.setDrawColor(30, 91, 168);
  pdf.setLineWidth(0.7);
  pdf.rect(1.5, 1.5, 82.6, 51, "S");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(30, 91, 168);
  pdf.text("MUGEC-CI", 42.8, 10, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.8);
  pdf.setTextColor(40, 40, 40);
  pdf.text("Cette carte est strictement personnelle et demeure la propriété de la MUGEC-CI.", 42.8, 19, { align: "center", maxWidth: 70 });
  pdf.text("En cas de perte, prévenir immédiatement la mutuelle.", 42.8, 27, { align: "center", maxWidth: 70 });
  pdf.setFont("helvetica", "bold");
  pdf.text("À retourner à la MUGEC-CI en cas de cessation de qualité de membre.", 42.8, 35, { align: "center", maxWidth: 70 });
  pdf.setFont("courier", "normal");
  pdf.setTextColor(26, 58, 143);
  pdf.text(`Matricule : ${m.matricule ?? "—"}`, 42.8, 43, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(30, 91, 168);
  pdf.text("Tél : 07 58 89 43 63 / 07 08 27 67 51", 42.8, 49, { align: "center" });
}

function Page() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Member>({});
  const [qr, setQr] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    (async () => {
      if (user && isSupabaseConfigured) {
        const { data } = await supabase.from("members").select("*").eq("user_id", user.id).maybeSingle();
        if (data) setM(data as Member);
      } else {
        setM({
          nom: "DEMO",
          prenoms: "Utilisateur",
          email: "demo@mugec-ci.org",
          telephone: "+225 00 00 00 00",
          collectivite: "Mairie de Cocody",
          region: "Abidjan",
          fonction: "Agent administratif",
          matricule: "MUGEC-2026-0001",
          cni: "CI00000000",
          date_naissance: "1985-04-12",
          lieu_naissance: "Abidjan",
        });
      }
    })();
  }, [user]);

  useEffect(() => {
    const id = m.matricule ?? user?.id ?? "demo";
    const verifyUrl = m.qr_code ?? `https://mugec-ci.ivoireprojet.com/verifier/${encodeURIComponent(id)}`;
    QRCode.toDataURL(verifyUrl, {
      width: 420,
      margin: 4,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQr);
  }, [m, user]);

  async function downloadPDF() {
    setBusy(true);
    try {
      const logoData = await imageToDataUrl(logo);
      const watermarkData = await imageToDataUrl(watermarkUrl);
      const pdf = new jsPDF({ unit: "mm", format: [85.6, 54], orientation: "landscape" });
      drawCardFront(pdf, m, qr, logoData, watermarkData);
      pdf.addPage([85.6, 54], "landscape");
      drawCardBack(pdf, m, watermarkData);
      pdf.save(`carte-membre-recto-verso-${m.matricule ?? "mugec"}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <MembreLayout title="Carte de membre" subtitle="Format CR80 — recto / verso officiel MUGEC-CI">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Votre carte membre</h2>
            <p className="text-sm text-muted-foreground">Imprimable en format carte bancaire (85,6 × 54 mm).</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimer
            </Button>
            <Button onClick={downloadPDF} disabled={busy} className="bg-primary">
              <Download className="mr-2 h-4 w-4" /> {busy ? "Génération…" : "Télécharger le PDF"}
            </Button>
          </div>
        </div>

        {/* Aperçu recto/verso CR80 — ratio 85.6/54 ≈ 1.585 */}
        <div ref={ref} className="grid gap-8 md:grid-cols-2">
          {/* ---------- RECTO ---------- */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recto</div>
            <div
              className="relative aspect-[1.585/1] w-full overflow-hidden rounded-2xl text-white shadow-2xl ring-1 ring-black/5"
              style={{
                background:
                  "linear-gradient(135deg,#0e2f6b 0%,#1e5ba8 45%,#2580c4 75%,#2baa8a 100%)",
              }}
            >
              {/* Décor logo en filigrane */}
              <img
                src={logo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-[0.08]"
              />
              {/* Pastilles colorées (rappel logo) */}
              <div className="pointer-events-none absolute right-3 top-3 flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1e5ba8] ring-1 ring-white/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#2baa8a] ring-1 ring-white/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#7cb342] ring-1 ring-white/40" />
              </div>

              {/* Bandeau haut */}
              <div className="flex items-center gap-3 border-b border-white/15 bg-white/5 px-4 py-2.5 backdrop-blur-sm">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-white p-1 shadow">
                  <img src={logo} alt="MUGEC-CI" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
                    MUGEC-CI
                  </div>
                  <div className="truncate text-[9px] text-white/70">
                    Mutuelle Générale du Personnel des Collectivités Territoriales
                  </div>
                </div>
                <div className="ml-auto rounded-sm bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                  Carte officielle
                </div>
              </div>

              {/* Corps */}
              <div className="grid grid-cols-[88px_1fr] gap-3 px-4 py-3">
                {/* Photo */}
                <div className="relative h-[108px] w-[88px] overflow-hidden rounded-md bg-white/95 ring-2 ring-white/70 shadow-inner">
                  <MemberAvatarImg
                    src={m.photo_url}
                    alt={m.prenoms ?? "membre"}
                    className="h-full w-full object-cover"
                  />
                  {!m.photo_url && (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-slate-400">
                      PHOTO
                    </div>
                  )}

                  <div
                    className="absolute inset-x-0 bottom-0 h-3"
                    style={{ background: "linear-gradient(90deg,#1e5ba8,#2baa8a,#7cb342)" }}
                  />
                </div>

                {/* Infos */}
                <div className="min-w-0 space-y-1">
                  <CardField label="Nom & prénoms" value={`${m.nom ?? ""} ${m.prenoms ?? ""}`.trim() || "—"} bold />
                  <div className="grid grid-cols-2 gap-2">
                    <CardField label="Matricule" value={m.matricule ?? "—"} mono />
                    <CardField label="Type" value={(m.type_membre ?? "office").toUpperCase()} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <CardField label="Statut" value={(m.statut ?? "actif").toUpperCase()} />
                    <CardField
                      label="Inscrit le"
                      value={m.date_inscription ? new Date(m.date_inscription).toLocaleDateString("fr-FR") : "—"}
                    />
                  </div>
                </div>
              </div>

              {/* Footer collectivité + QR */}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-white/15 bg-black/25 px-4 py-2 backdrop-blur-sm">
                <div className="min-w-0">
                  <div className="text-[8px] uppercase tracking-wider text-white/70">Collectivité</div>
                  <div className="truncate text-[12px] font-semibold">{m.collectivite ?? "—"}</div>
                </div>
                <div className="ml-auto h-12 w-12 shrink-0 overflow-hidden rounded bg-white p-0.5 shadow">
                  {qr ? <img src={qr} alt="QR" className="h-full w-full object-contain" /> : null}
                </div>
              </div>
            </div>
          </div>

          {/* ---------- VERSO ---------- */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verso</div>
            <div
              className="relative aspect-[1.585/1] w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5"
              style={{
                background:
                  "linear-gradient(160deg,#ffffff 0%,#f1f6ff 55%,#e4f3ee 100%)",
              }}
            >
              {/* Bande latérale couleurs */}
              <div
                className="absolute inset-y-0 left-0 w-2"
                style={{ background: "linear-gradient(180deg,#1e5ba8,#2baa8a,#7cb342)" }}
              />
              {/* Logo filigrane centré */}
              <img
                src={logo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
              />

              <div className="relative flex h-full flex-col px-5 py-3 text-slate-800">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <img src={logo} alt="" className="h-7 w-7 object-contain" />
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1e5ba8]">
                    MUGEC-CI
                  </div>
                  <div className="ml-auto text-[9px] font-medium uppercase tracking-wider text-slate-500">
                    République de Côte d'Ivoire
                  </div>
                </div>

                <div className="mt-2 space-y-1.5 text-[10px] leading-snug text-slate-700">
                  <p>
                    Cette carte est <strong>strictement personnelle</strong> et demeure la propriété de la
                    MUGEC-CI. En cas de perte, prévenir immédiatement la mutuelle.
                  </p>
                  <p>
                    À retourner à la MUGEC-CI en cas de cessation de qualité de membre. Toute utilisation
                    frauduleuse expose son auteur à des poursuites.
                  </p>
                </div>

                <div className="mt-auto grid grid-cols-[1fr_auto] items-end gap-3 border-t border-slate-200 pt-2">
                  <div className="space-y-0.5 text-[9.5px] text-slate-600">
                    <div>
                      <span className="font-semibold text-[#1e5ba8]">Tél :</span> 07 58 89 43 63 / 07 08 27 67 51
                    </div>
                    <div>
                      <span className="font-semibold text-[#1e5ba8]">Web :</span> mugec-ci.ivoireprojet.com
                    </div>
                    <div className="font-mono text-[#1e5ba8]">
                      Matricule : {m.matricule ?? "—"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-1 h-9 w-24 rounded border border-dashed border-slate-300" />
                    <div className="text-[8px] uppercase tracking-wider text-slate-500">
                      Cachet & signature
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Légende */}
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#1e5ba8" }} /> Bleu MUGEC
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#2baa8a" }} /> Teal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#7cb342" }} /> Vert
            </span>
            <span className="ml-auto">CR80 · 85,6 × 54 mm · 300 dpi · QR vérifiable</span>
          </CardContent>
        </Card>
      </section>
    </MembreLayout>
  );
}

function CardField({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/70">
        {label}
      </div>
      <div
        className={`truncate text-[12px] leading-tight ${bold ? "font-bold" : "font-medium"} ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}


