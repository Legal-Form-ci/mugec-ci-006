import { Link } from "@tanstack/react-router";
import logo from "@/assets/mugec-logo.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";


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
  useEffect(() => setMounted(true), []);
  return (

    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-28 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="MUGEC-CI" className="h-20 w-auto md:h-24" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
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
        <div className="flex items-center gap-2">
          {!mounted ? (
            <div className="h-9 w-40" aria-hidden />
          ) : user ? (
            <>
              <Button asChild variant="outline" size="sm"><Link to="/membre">Mon espace</Link></Button>
              <Button size="sm" variant="ghost" onClick={() => signOut()}>Déconnexion</Button>
              <Button asChild variant="secondary" size="sm"><Link to="/scanner"><QrCode className="mr-1 h-4 w-4" />Scanner un QR Code</Link></Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Connexion</Link></Button>
              <Button asChild size="sm"><Link to="/inscription">S'inscrire</Link></Button>
              <Button asChild variant="secondary" size="sm"><Link to="/scanner"><QrCode className="mr-1 h-4 w-4" />Scanner un QR Code</Link></Button>
            </>
          )}
        </div>

      </div>
    </header>
  );
}
