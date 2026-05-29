import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Smartphone, Monitor, Tablet, X } from "lucide-react";
import logo from "@/assets/mugec-logo.png";
import { useAuth } from "@/lib/auth";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mugec_pwa_dismissed_at";
const DISMISS_DAYS = 7;

function detectDevice(): "android" | "ios" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return /Mobile/.test(ua) ? "android" : "tablet";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

function recentlyDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const diff = Date.now() - Number(ts);
    return diff < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

export function PWAInstallPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<"android" | "ios" | "tablet" | "desktop">("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setDevice(detectDevice());
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isStandalone()) return;
    if (recentlyDismissed()) return;
    // Petit délai pour ne pas gêner immédiatement après le login
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, [user]);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
  }

  async function install() {
    if (!deferred) {
      // iOS / fallback : on garde le popup ouvert avec instructions
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setOpen(false);
    }
    setDeferred(null);
  }

  const Icon = device === "ios" ? Smartphone : device === "android" ? Smartphone : device === "tablet" ? Tablet : Monitor;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 py-8 text-center">
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-background shadow-md ring-1 ring-border">
            <img src={logo} alt="MUGEC-CI" className="h-12 w-12 object-contain" />
          </div>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-center text-lg font-semibold">
              Installez l'application MUGEC-CI
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              Accédez à votre carte, vos cotisations et vos prestations directement depuis votre écran d'accueil — même hors connexion.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4 text-primary" />
            <span>
              {device === "ios" && "Détecté : iPhone / iPad — Safari requis"}
              {device === "android" && "Détecté : Android — Chrome recommandé"}
              {device === "tablet" && "Détecté : Tablette"}
              {device === "desktop" && "Détecté : Ordinateur"}
            </span>
          </div>

          {device === "ios" ? (
            <ol className="space-y-1.5 rounded-lg border border-dashed bg-background p-3 text-xs text-muted-foreground">
              <li>1. Touchez l'icône <b>Partager</b> dans la barre Safari</li>
              <li>2. Faites défiler et choisissez <b>« Sur l'écran d'accueil »</b></li>
              <li>3. Confirmez avec <b>Ajouter</b></li>
            </ol>
          ) : !deferred ? (
            <p className="text-xs text-muted-foreground">
              Ouvrez le menu de votre navigateur, puis touchez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Plus tard
            </Button>
            {deferred && device !== "ios" && (
              <Button size="sm" onClick={install} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Installer maintenant
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
