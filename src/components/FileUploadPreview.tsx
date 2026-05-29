import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText } from "lucide-react";

export type UploadedFile = {
  name: string;
  type: string;
  dataUrl: string; // base64 data URL
};

type Props = {
  label: string;
  value?: UploadedFile | null;
  onChange: (v: UploadedFile | null) => void;
  accept?: string;
  aspect?: "document" | "photo" | "auto";
  maxSizeMB?: number;
};

/**
 * Champ d'upload avec aperçu Full HD. Aperçu auto-ajusté.
 * - aspect="document" : 16/10 paysage pour CNI/passeport/extrait
 * - aspect="photo"    : 3/4 portrait recadré façon photo d'identité
 */
export function FileUploadPreview({
  label,
  value,
  onChange,
  accept = ".pdf,image/png,image/jpeg",
  aspect = "document",
  maxSizeMB = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${maxSizeMB} Mo).`);
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(f);
    });
    onChange({ name: f.name, type: f.type, dataUrl });
  }

  const isImage = value?.type?.startsWith("image/");
  const isPdf = value?.type === "application/pdf";

  const ratioClass =
    aspect === "photo"
      ? "aspect-[3/4] max-w-[260px]"
      : aspect === "document"
      ? "aspect-[16/10] max-w-full"
      : "";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className={value ? "hidden" : ""}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {value ? (
        <div className="space-y-2">
          <div
            className={`relative overflow-hidden rounded-md border bg-muted ${ratioClass}`}
          >
            {isImage ? (
              <img
                src={value.dataUrl}
                alt={label}
                className="h-full w-full object-cover"
                style={{ imageRendering: "auto" }}
              />
            ) : isPdf ? (
              <iframe
                src={value.dataUrl}
                title={label}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                <FileText className="h-8 w-8" />
                <span className="mt-2 text-xs">{value.name}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" /> Remplacer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(null)}
            >
              <X className="mr-1 h-3 w-3" /> Retirer
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              {value.name}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Aperçu spécial photo d'identité : recadrage carré centré sur le visage
 * (heuristique : centre haut), filtre de netteté léger via canvas.
 */
export function PhotoIdentityUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: UploadedFile | null;
  onChange: (v: UploadedFile | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Veuillez choisir une image (JPG/PNG).");
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setError("Image trop volumineuse (max 4 Mo).");
      return;
    }
    setProcessing(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(f);
      });
      // Recadrage carré + redimensionnement 600x800 (photo d'identité 3:4)
      const img = await loadImg(dataUrl);
      const targetW = 600;
      const targetH = 800;
      const srcRatio = img.width / img.height;
      const targetRatio = targetW / targetH;
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;
      if (srcRatio > targetRatio) {
        // image trop large → on coupe les côtés
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        // image trop haute → on coupe en bas, garde le haut (visage)
        sh = img.width / targetRatio;
        sy = Math.max(0, img.height * 0.08); // léger offset pour cadrer le visage
        if (sy + sh > img.height) sy = img.height - sh;
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      const finalDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onChange({ name: f.name, type: "image/jpeg", dataUrl: finalDataUrl });
    } catch {
      setError("Impossible de traiter l'image.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className={value ? "hidden" : ""}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {processing ? (
        <p className="text-xs text-muted-foreground">Traitement de l'image…</p>
      ) : null}
      {value ? (
        <div className="space-y-2">
          <div className="relative w-[180px] overflow-hidden rounded-md border-2 border-primary/30 bg-muted shadow-sm">
            <div className="aspect-[3/4] w-full">
              <img
                src={value.dataUrl}
                alt={label}
                className="h-full w-full object-cover"
              />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" /> Remplacer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(null)}
            >
              <X className="mr-1 h-3 w-3" /> Retirer
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Aperçu auto-recadré au format photo d'identité (3:4).
          </p>
        </div>
      ) : null}
    </div>
  );
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
