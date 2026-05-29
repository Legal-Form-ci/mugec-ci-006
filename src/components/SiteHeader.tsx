import { Link } from "@tanstack/react-router";
import logo from "@/assets/mugec-logo.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { QrCode, Menu, X } from "lucide-react";

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/actualites", label: "Actualités" },
  { to: "/opportunites", label: "Opportunités" },
  { to: "/forum", label: "Forum" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-3 sm:h-24 sm:px-4 md:h-28">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <img src={logo} alt="MUGEC-CI" className="h-12 w-auto sm:h-16 md:h-24" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-primary"
              activeProps={{ className: "text-primary bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!mounted ? (
            <div className="h-9 w-40" aria-hidden />
          ) : user ? (
            <>
              <Button asChild variant="outline" size="sm"><Link to="/membre">Mon espace</Link></Button>
              <Button size="sm" variant="ghost" onClick={() => signOut()}>Déconnexion</Button>
              <Button asChild variant="secondary" size="sm"><Link to="/scanner"><QrCode className="mr-1 h-4 w-4" />Scanner</Link></Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Connexion</Link></Button>
              <Button asChild size="sm"><Link to="/inscription">S'inscrire</Link></Button>
              <Button asChild variant="secondary" size="sm"><Link to="/scanner"><QrCode className="mr-1 h-4 w-4" />Scanner</Link></Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <nav className="container mx-auto flex max-w-7xl flex-col gap-1 px-3 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-primary"
                activeProps={{ className: "text-primary bg-secondary" }}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-wrap gap-2 border-t pt-3">
              {mounted && user ? (
                <>
                  <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/membre" onClick={() => setOpen(false)}>Mon espace</Link></Button>
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setOpen(false); signOut(); }}>Déconnexion</Button>
                  <Button asChild variant="secondary" size="sm" className="w-full"><Link to="/scanner" onClick={() => setOpen(false)}><QrCode className="mr-1 h-4 w-4" />Scanner un QR Code</Link></Button>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="flex-1"><Link to="/login" onClick={() => setOpen(false)}>Connexion</Link></Button>
                  <Button asChild size="sm" className="flex-1"><Link to="/inscription" onClick={() => setOpen(false)}>S'inscrire</Link></Button>
                  <Button asChild variant="secondary" size="sm" className="w-full"><Link to="/scanner" onClick={() => setOpen(false)}><QrCode className="mr-1 h-4 w-4" />Scanner un QR Code</Link></Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
