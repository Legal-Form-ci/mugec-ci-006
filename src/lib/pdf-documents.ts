/**
 * Génération côté client des documents officiels MUGEC-CI (fiche d'adhésion
 * + autorisation de prélèvement) — mise en page fidèle aux modèles fournis
 * par le client. Filigrane = visuel « MUGEC-CI / équipe » (oval).
 *
 * Police « manuscrite bleue » pour les valeurs saisies, conformément au CDC §5.0.
 */
import jsPDF from "jspdf";
import QRCode from "qrcode";
import watermarkUrl from "@/assets/mugec-watermark.png";
import logoUrl from "@/assets/mugec-logo-header.png";

export type AyantDroitItem = {
  type: "pere" | "mere" | "conjoint" | "enfant" | "";
  nom: string;
  dateNaissance: string;
  lieuNaissance: string;
};

export type DraftData = {
  nom?: string;
  prenoms?: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  sexe?: "M" | "F";
  email?: string;
  telephone?: string;
  cni?: string;
  adresse?: string;
  collectivite?: string;
  region?: string;
  direction?: string;
  fonction?: string;
  matriculePro?: string;
  dateEmbauche?: string;
  ayantsDroit?: string;
  ayantsDroitList?: AyantDroitItem[];
  /** Photo d'identité en data URL (JPEG/PNG base64) — encadrée dans le PDF. */
  photoIdentite?: string;
  /** Référence unique (matricule MUGEC ou identifiant brouillon) — encodée dans le QR. */
  reference?: string;
};


// ────────────────────────────────────────────────────────────────────────────
// Helpers chargement images → dataURL (mis en cache)
// ────────────────────────────────────────────────────────────────────────────
const cache = new Map<string, string>();
async function loadImage(url: string): Promise<string> {
  const c = cache.get(url);
  if (c) return c;
  const res = await fetch(url);
  const blob = await res.blob();
  const data: string = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
  cache.set(url, data);
  return data;
}

// ────────────────────────────────────────────────────────────────────────────
// Outils dessin
// ────────────────────────────────────────────────────────────────────────────
const BRAND_BLUE = [31, 78, 156] as const; // #1F4E9C — bleu MUGEC
const HANDWRITE_BLUE = [10, 35, 165] as const; // #0A23A5

type Pdf = jsPDF & {
  GState: new (o: { opacity: number }) => unknown;
  setGState: (g: unknown) => void;
};

function setOpacity(pdf: jsPDF, opacity: number) {
  const a = pdf as Pdf;
  a.setGState(new a.GState({ opacity }));
}

function drawHeader(pdf: jsPDF, logo: string) {
  // Logo officiel (contient déjà le nom + sous-titre + filet bleu).
  // Format source ≈ 1920×500 → ratio ~3.84. Largeur 180mm × hauteur ~47mm.
  const pageW = pdf.internal.pageSize.getWidth();
  const w = 180;
  const h = 28;
  const x = (pageW - w) / 2;
  pdf.addImage(logo, "PNG", x, 8, w, h, undefined, "FAST");
}

function drawFooter(pdf: jsPDF) {
  const h = pdf.internal.pageSize.getHeight();
  pdf.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
  pdf.setLineWidth(0.6);
  pdf.line(15, h - 22, 195, h - 22);
  pdf.setTextColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
  pdf.setFont("times", "italic");
  pdf.setFontSize(10);
  pdf.text(
    "Mutuelle Générale du Personnel des Collectivités Territoriales de Côte d'Ivoire",
    105, h - 16, { align: "center" },
  );
  pdf.setFont("times", "bolditalic");
  pdf.text("Tel : 07 58 89 43 63 / 07 08 27 67 51", 105, h - 11, { align: "center" });
}

/**
 * Cachet numérique + QR code (vérification d'authenticité).
 * Dessine un cachet circulaire bleu et un QR code en bas à droite de la page.
 */
async function drawCertificate(pdf: jsPDF, reference: string) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const verifyUrl = `https://mugec-ci.ivoireprojet.com/verify/${encodeURIComponent(reference)}`;
  const qrData = await QRCode.toDataURL(verifyUrl, { width: 256, margin: 1, color: { dark: "#0E3A8A", light: "#FFFFFF" } });
  // QR
  const qrSize = 28;
  const qrX = pageW - qrSize - 16;
  const qrY = pageH - qrSize - 30;
  pdf.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);
  pdf.setFontSize(7); pdf.setTextColor(80, 80, 80); pdf.setFont("helvetica", "normal");
  pdf.text("Vérifier", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
  pdf.text(reference.slice(0, 18), qrX + qrSize / 2, qrY + qrSize + 6, { align: "center" });
  // Cachet circulaire
  const cx = 35, cy = pageH - 45, rOut = 16, rIn = 12;
  pdf.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]); pdf.setLineWidth(0.8);
  pdf.circle(cx, cy, rOut); pdf.circle(cx, cy, rIn);
  pdf.setTextColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
  pdf.setFont("times", "bold"); pdf.setFontSize(8);
  pdf.text("MUGEC-CI", cx, cy - 2, { align: "center" });
  pdf.setFontSize(6); pdf.setFont("times", "normal");
  pdf.text("CACHET", cx, cy + 1, { align: "center" });
  pdf.text("NUMÉRIQUE", cx, cy + 4, { align: "center" });
  pdf.setFontSize(5);
  pdf.text(new Date().toLocaleDateString("fr-FR"), cx, cy + 8, { align: "center" });
  pdf.setTextColor(0, 0, 0);
}

function drawWatermark(pdf: jsPDF, dataUrl: string, opacity = 0.10) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const w = 150; const h = 110;
  setOpacity(pdf, opacity);
  pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2 - 5, w, h, undefined, "FAST");
  setOpacity(pdf, 1);
}

/** Écrit une valeur « manuscrite bleue » sur une ligne pointillée. */
function dottedField(
  pdf: jsPDF,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  endX: number,
) {
  pdf.setFont("times", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text(label, x, y);
  const labelWidth = pdf.getTextWidth(label);
  const lineStart = x + labelWidth + 1;
  // Pointillés
  pdf.setDrawColor(120);
  pdf.setLineDashPattern([0.6, 0.8], 0);
  pdf.setLineWidth(0.2);
  pdf.line(lineStart, y + 0.8, endX, y + 0.8);
  pdf.setLineDashPattern([], 0);
  // Valeur en bleu manuscrit
  if (value && value.trim()) {
    pdf.setFont("courier", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
    pdf.text(value, lineStart + 1, y - 0.2, { maxWidth: endX - lineStart - 2 });
    pdf.setTextColor(0, 0, 0);
  }
}

function sectionTitle(pdf: jsPDF, n: string, title: string, x: number, y: number) {
  pdf.setFont("times", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`${n}. ${title}`, x, y);
}

// ────────────────────────────────────────────────────────────────────────────
// FICHE D'ADHÉSION — fidèle au PDF officiel
// ────────────────────────────────────────────────────────────────────────────
export async function generateFicheAdhesionPDF(d: DraftData): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const [wm, logo] = await Promise.all([loadImage(watermarkUrl), loadImage(logoUrl)]);

  drawHeader(pdf, logo);
  drawWatermark(pdf, wm, 0.10);

  // Photo d'identité encadrée (cadre pro 30x40mm en haut à droite)
  if (d.photoIdentite) {
    try {
      const px = 165, py = 40, pw = 30, ph = 40;
      pdf.setDrawColor(BRAND_BLUE[0], BRAND_BLUE[1], BRAND_BLUE[2]);
      pdf.setLineWidth(0.6);
      pdf.rect(px - 1, py - 1, pw + 2, ph + 2);
      pdf.addImage(d.photoIdentite, "JPEG", px, py, pw, ph, undefined, "FAST");
      pdf.setFont("times", "italic"); pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text("Photo d'identité", px + pw / 2, py + ph + 4, { align: "center" });
      pdf.setTextColor(0, 0, 0);
    } catch { /* ignore image errors */ }
  }

  // Titre principal
  pdf.setFont("times", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(0, 0, 0);
  pdf.text("FICHE D'ADHÉSION A LA MUGEC- CI.", 105, 48, { align: "center" });
  pdf.setLineWidth(0.4);
  pdf.line(55, 50, 155, 50);

  const L = 18;   // marge gauche
  const R = 195;  // fin de ligne droite
  let y = 62;

  // 1. IDENTIFICATION
  sectionTitle(pdf, "1", "IDENTIFICATION DE L'ADHÉRENT", L, y); y += 7;
  dottedField(pdf, "Nom : ", d.nom, L, y, R); y += 6;
  dottedField(pdf, "Prénoms : ", d.prenoms, L, y, R); y += 6;
  const dn = d.dateNaissance ? new Date(d.dateNaissance) : null;
  const dn_jj = dn ? String(dn.getDate()).padStart(2, "0") : "";
  const dn_mm = dn ? String(dn.getMonth() + 1).padStart(2, "0") : "";
  const dn_aa = dn ? String(dn.getFullYear()) : "";
  pdf.setFont("times", "normal"); pdf.setFontSize(11);
  pdf.text("Date et lieu de naissance :", L, y);
  let cur = L + pdf.getTextWidth("Date et lieu de naissance :") + 2;
  // jj
  pdf.setFont("courier", "bold"); pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
  pdf.text(dn_jj || "", cur, y - 0.2); pdf.setTextColor(0, 0, 0);
  pdf.setFont("times", "normal"); pdf.text(" / ", cur + 8, y);
  pdf.setFont("courier", "bold"); pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
  pdf.text(dn_mm || "", cur + 14, y - 0.2); pdf.setTextColor(0, 0, 0);
  pdf.setFont("times", "normal"); pdf.text(" / ", cur + 22, y);
  pdf.setFont("courier", "bold"); pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
  pdf.text(dn_aa || "", cur + 28, y - 0.2); pdf.setTextColor(0, 0, 0);
  pdf.setFont("times", "normal"); pdf.text(" à ", cur + 44, y);
  dottedField(pdf, "", d.lieuNaissance, cur + 50, y, R); y += 6;

  // Sexe avec cases cochées
  pdf.setFont("times", "normal"); pdf.text("Sexe : ", L, y);
  const sx = L + pdf.getTextWidth("Sexe : ") + 1;
  pdf.rect(sx, y - 3.5, 4, 4);
  if (d.sexe === "M") { pdf.setFont("times", "bold"); pdf.text("X", sx + 0.8, y - 0.2); pdf.setFont("times", "normal"); }
  pdf.text("M", sx + 6, y);
  pdf.rect(sx + 14, y - 3.5, 4, 4);
  if (d.sexe === "F") { pdf.setFont("times", "bold"); pdf.text("X", sx + 14.8, y - 0.2); pdf.setFont("times", "normal"); }
  pdf.text("F", sx + 20, y); y += 6;

  dottedField(pdf, "Matricule (Obligatoire) : ", d.matriculePro, L, y, R); y += 6;
  dottedField(pdf, "Numéro CNI / Passeport : ", d.cni, L, y, R); y += 10;

  // 2. SITUATION
  sectionTitle(pdf, "2", "SITUATION PROFESSIONNELLE", L, y); y += 7;
  dottedField(pdf, "Collectivité d'origine : ", d.collectivite, L, y, R); y += 6;
  dottedField(pdf, "Direction / Service : ", d.direction, L, y, R); y += 10;

  // 3. COORDONNÉES
  sectionTitle(pdf, "3", "COORDONNÉES", L, y); y += 7;
  dottedField(pdf, "Téléphone mobile whatsapp (de préférence) : ", d.telephone, L, y, R); y += 6;
  dottedField(pdf, "E-mail : ", d.email, L, y, R); y += 6;
  dottedField(pdf, "Adresse postale : ", d.adresse, L, y, R); y += 10;

  // 4. AYANTS-DROIT — tableau structuré
  sectionTitle(pdf, "4", "INFORMATIONS SUR LES AYANTS-DROIT", L, y); y += 7;
  const TYPE_LBL: Record<string, string> = { pere: "Père", mere: "Mère", conjoint: "Conjoint(e)", enfant: "Enfant" };
  const items = (d.ayantsDroitList ?? []).filter((a) => a.type && a.nom);
  if (items.length > 0) {
    // En-tête de tableau
    const colX = [L, L + 28, L + 90, L + 130];
    const colW = [28, 62, 40, R - colX[3]];
    pdf.setFont("times", "bold"); pdf.setFontSize(10);
    pdf.setFillColor(230, 236, 245);
    pdf.rect(L, y - 4.5, R - L, 6, "F");
    pdf.text("Parenté", colX[0] + 1, y);
    pdf.text("Nom complet", colX[1] + 1, y);
    pdf.text("Né(e) le", colX[2] + 1, y);
    pdf.text("Lieu", colX[3] + 1, y);
    y += 4;
    pdf.setFont("times", "normal");
    items.forEach((a) => {
      pdf.setDrawColor(200); pdf.setLineWidth(0.1);
      pdf.line(L, y + 1.5, R, y + 1.5);
      pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
      pdf.setFont("courier", "bold"); pdf.setFontSize(10);
      pdf.text(TYPE_LBL[a.type] ?? a.type, colX[0] + 1, y, { maxWidth: colW[0] - 2 });
      pdf.text(a.nom || "—", colX[1] + 1, y, { maxWidth: colW[1] - 2 });
      pdf.text(a.dateNaissance || "—", colX[2] + 1, y, { maxWidth: colW[2] - 2 });
      pdf.text(a.lieuNaissance || "—", colX[3] + 1, y, { maxWidth: colW[3] - 2 });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("times", "normal");
      y += 6;
    });
    y += 4;
  } else {
    // Fallback texte libre
    const ad = (d.ayantsDroit ?? "").split("\n");
    const findLine = (re: RegExp) => ad.find((l) => re.test(l))?.replace(re, "").trim() ?? "";
    dottedField(pdf, "- Père : ", findLine(/p[èe]re\s*[:\-]?/i), L, y, R); y += 6;
    dottedField(pdf, "- Mère : ", findLine(/m[èe]re\s*[:\-]?/i), L, y, R); y += 6;
    dottedField(pdf, "- Enfants : ", findLine(/enfants?\s*[:\-]?/i), L, y, R); y += 6;
    dottedField(pdf, "- Conjoint(E) : ", findLine(/conjoint\(?e?\)?\s*[:\-]?/i), L, y, R); y += 10;
  }

  // 5. ENGAGEMENT
  sectionTitle(pdf, "5", "ENGAGEMENT ET SIGNATURE", L, y); y += 7;
  pdf.setFont("times", "normal"); pdf.setFontSize(11);
  const nomComplet = `${d.prenoms ?? ""} ${d.nom ?? ""}`.trim();
  pdf.text("Je soussigné(e),", L, y);
  dottedField(pdf, "", nomComplet, L + pdf.getTextWidth("Je soussigné(e), ") + 1, y, 150);
  pdf.text(", sollicite mon adhésion à la MUGEC-CI et", 151, y); y += 5;
  pdf.text("m'engage à respecter les statuts et le règlement intérieur de la mutuelle.", L, y); y += 7;
  pdf.text(
    "J'autorise le prélèvement de mon adhésion de cinq mille francs (5 000) une seule fois et de mes cotisations de deux milles (2 000) FCFA mensuel de mon salaire conformément aux tarifs en vigueur.",
    L, y, { maxWidth: R - L },
  ); y += 14;

  // Lieu / date
  const today = new Date();
  pdf.text("Fait à :", L, y);
  dottedField(pdf, "", "", L + pdf.getTextWidth("Fait à : ") + 1, y, 95);
  pdf.text(", le :", 96, y);
  pdf.setFont("courier", "bold"); pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
  pdf.text(String(today.getDate()).padStart(2, "0"), 108, y - 0.2);
  pdf.setTextColor(0, 0, 0); pdf.setFont("times", "normal"); pdf.text(" / ", 115, y);
  pdf.setFont("courier", "bold"); pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
  pdf.text(String(today.getMonth() + 1).padStart(2, "0"), 122, y - 0.2);
  pdf.setTextColor(0, 0, 0); pdf.setFont("times", "normal"); pdf.text(" / 20", 129, y);
  pdf.setFont("courier", "bold"); pdf.setTextColor(HANDWRITE_BLUE[0], HANDWRITE_BLUE[1], HANDWRITE_BLUE[2]);
  pdf.text(String(today.getFullYear()).slice(2), 138, y - 0.2);
  pdf.setTextColor(0, 0, 0);
  y += 10;

  pdf.setFont("times", "normal"); pdf.text("Signature de l'Adhérent : ", L, y); y += 14;

  // Pièces à joindre
  pdf.setFont("times", "normal"); pdf.setFontSize(10.5);
  pdf.text("PIÈCES À JOINDRE (Dossier physique) :", L, y); y += 5;
  pdf.text("• Une photocopie de la Carte Nationale d'Identité (CNI) + l'extrait de naissance de l'adhérent", L, y); y += 5;
  pdf.text("• Deux (02) photos d'identité récentes de même tirage.", L, y); y += 5;
  pdf.text("• Les extraits de naissance pour les enfants", L, y);

  await drawCertificate(pdf, d.reference || `DRAFT-${Date.now()}`);
  drawFooter(pdf);
  return pdf.output("blob");
}

// ────────────────────────────────────────────────────────────────────────────
// AUTORISATION DE PRÉLÈVEMENT — fidèle au PDF officiel
// ────────────────────────────────────────────────────────────────────────────
export async function generateAutorisationPrelevementPDF(d: DraftData): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const [wm, logo] = await Promise.all([loadImage(watermarkUrl), loadImage(logoUrl)]);
  drawHeader(pdf, logo);
  drawWatermark(pdf, wm, 0.10);

  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(0, 0, 0);
  pdf.text("ENGAGEMENT ET AUTORISATION DE PRÉLÈVEMENT", 105, 52, { align: "center" });
  pdf.setLineWidth(0.4);
  pdf.line(42, 54, 168, 54);

  const L = 22, R = 188;
  let y = 68;

  // Identification
  pdf.setFont("times", "bold"); pdf.setFontSize(12);
  pdf.text("•  IDENTIFICATION DE L'ADHÉRENT", L, y); y += 10;
  const nomComplet = `${d.prenoms ?? ""} ${d.nom ?? ""}`.trim();
  dottedField(pdf, "Je soussigné(e), M./Mme : ", nomComplet, L, y, R); y += 9;
  dottedField(pdf, "Matricule Solde : ", d.matriculePro, L, y, R); y += 9;
  dottedField(pdf, "Service/Direction : ", d.direction, L, y, R); y += 9;
  dottedField(pdf, "Collectivité Territoriale : ", d.collectivite, L, y, R); y += 14;

  // Engagement
  pdf.setFont("times", "bold"); pdf.setFontSize(12);
  pdf.text("•  ENGAGEMENT", L, y); y += 9;
  pdf.setFont("times", "normal"); pdf.setFontSize(11);
  pdf.text(
    "Par la présente, je sollicite mon adhésion à la Mutuelle Générale du Personnel des Collectivités Territoriales de Côte d'Ivoire (MUGEC-CI).",
    L, y, { maxWidth: R - L }); y += 12;
  pdf.text(
    "Je déclare avoir pris connaissance des Statuts et du Règlement Intérieur de la Mutuelle et m'engage formellement à en respecter l'intégralité des dispositions.",
    L, y, { maxWidth: R - L }); y += 14;

  pdf.setFont("times", "bold");
  pdf.text("AUTORISATION DE PRÉLÈVEMENT", L, y); y += 8;
  pdf.setFont("times", "normal");
  pdf.text(
    "J'autorise expressément le service de la solde de ma collectivité employeur à opérer sur ma rémunération les retenues suivantes au profit de la MUGEC-CI :",
    L, y, { maxWidth: R - L }); y += 12;
  pdf.text(
    "Droit d'adhésion : Un versement unique de cinq mille (5 000) FCFA, prélevé lors du premier mois d'affiliation.",
    L, y, { maxWidth: R - L }); y += 10;
  pdf.text(
    "Cotisation mensuelle : Un montant de deux mille (2 000) FCFA, prélevé chaque mois à terme échu.",
    L, y, { maxWidth: R - L }); y += 22;

  // Fait à / le
  const today = new Date();
  pdf.text("Fait à", L, y);
  dottedField(pdf, "", "", L + 12, y, 100);
  pdf.text(", le", 102, y);
  dottedField(pdf, "", today.toLocaleDateString("fr-FR"), 112, y, 180);
  y += 22;
  pdf.text("Signature de l'Adhérent (Précédée de la mention manuscrite « Lu et approuvé »)", L, y);

  await drawCertificate(pdf, d.reference || `PREL-${Date.now()}`);
  drawFooter(pdf);
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}
