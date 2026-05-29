// Enregistrement du service worker MUGEC-CI avec garde anti-iframe / preview Lovable
// (le SW n'est activé qu'en production publiée — jamais dans l'aperçu Lovable).
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") && host.includes("preview");

  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  if (isPreviewHost || isInIframe || import.meta.env.DEV) {
    // Désinscrire tout SW existant pour éviter du cache obsolète en preview/dev
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[SW] registration failed", err));
  });
}
