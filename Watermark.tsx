import { MemberAvatarImage } from "@/components/MemberAvatar";
import { Link, useLocation } from "@tanstack/react-router";
import logo from "@/assets/mugec-logo.png";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, Home, Menu, ChevronDown, ArrowLeftRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type NavChild = { to: string; label: string };
export type NavItem = { to?: string; label: string; children?: NavChild[] };

export function DashboardHeader({
  title,
  nav,
}: {
  title: string;
  nav: NavItem[];
}) {
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<{ photo_url: string | null; nom: string | null; prenoms: string | null } | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    let active = true;
    if (!user) { setMe(null); return; }
    supabase
      .from("members")
      .select("photo_url, nom, prenoms")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (active) setMe(data as any); });
    supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle()
      .then(({ data }) => { if (active) setIsSuper(!!data); });
    return () => { active = false; };
  }, [user?.id]);

  const initials = mounted
    ? ((me?.prenoms?.[0] ?? user?.email?.[0] ?? "?") + (me?.nom?.[0] ?? "")).toUpperCase()
    : "";

  const isActive = (to?: string) => to ? loc.pathname === to : false;
  const groupActive = (item: NavItem) =>
    isActive(item.to) || (item.children?.some((c) => loc.pathname === c.to) ?? false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logo} alt="MUGEC-CI" className="h-14 w-auto" />
          <div className="hidden sm:block min-w-0">
            <div className="text-xs text-muted-foreground">Espace</div>
            <div className="text-sm font-semibold truncate">{title}</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => {
            if (n.children?.length) {
              const active = groupActive(n);
              return (
                <DropdownMenu key={n.label}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={active ? "default" : "ghost"}
                      size="sm"
                      className="gap-1"
                    >
                      {n.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>{n.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {n.children.map((c) => (
                      <DropdownMenuItem key={c.to} asChild>
                        <Link to={c.to} className={loc.pathname === c.to ? "font-semibold text-primary" : ""}>
                          {c.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to!}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-secondary hover:text-primary"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {isSuper && (
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex" title="Basculer entre portails">
              <Link to={loc.pathname.startsWith("/miprojet") ? "/admin" : "/miprojet"}>
                <ArrowLeftRight className="mr-2 h-4 w-4"/>
                {loc.pathname.startsWith("/miprojet") ? "MUGEC-CI" : "MIPROJET"}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/"><Home className="mr-2 h-4 w-4" /> Site public</Link>
          </Button>
          <Avatar className="h-9 w-9 border">
            <MemberAvatarImage src={me?.photo_url} alt="Photo" />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="sm" onClick={() => signOut()} title="Déconnexion">
            <LogOut className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Déconnexion</span>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t bg-background">
          <div className="container mx-auto max-w-7xl px-4 py-2 flex flex-col">
            {nav.map((n) =>
              n.children?.length ? (
                <div key={n.label} className="py-1">
                  <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{n.label}</div>
                  {n.children.map((c) => (
                    <Link
                      key={c.to}
                      to={c.to}
                      onClick={() => setOpen(false)}
                      className={`rounded-md px-4 py-2 text-sm hover:bg-secondary ${loc.pathname === c.to ? "text-primary font-medium" : ""}`}
                    >
                      • {c.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={n.to}
                  to={n.to!}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm hover:bg-secondary"
                >
                  {n.label}
                </Link>
              ),
            )}
            <Link to="/" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              ← Retour au site public
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export const MEMBRE_NAV: NavItem[] = [
  { to: "/membre", label: "Tableau de bord" },
  { to: "/membre/profil", label: "Profil" },
  { to: "/membre/carte", label: "Carte" },
  { to: "/membre/documents", label: "Documents" },
  { to: "/membre/cotisations", label: "Cotisations" },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Tableau de bord" },
  { to: "/admin/membres", label: "Membres" },
  {
    label: "Finances",
    children: [
      { to: "/admin/cotisations", label: "Cotisations" },
      { to: "/admin/droits-adhesion", label: "Droits d'adhésion" },
    ],
  },
  { to: "/admin/prestations", label: "Prestations" },
  {
    label: "Contenus",
    children: [
      { to: "/admin/actualites", label: "Actualités" },
      { to: "/admin/opportunites", label: "Opportunités" },
    ],
  },
  {
    label: "Communication",
    children: [
      { to: "/admin/notifications", label: "Notifications" },
    ],
  },
];

// Navigation séparée du back-office super administrateur.
// NE JAMAIS importer dans l'espace MUGEC-CI.
export const MIPROJET_NAV: NavItem[] = [
  { to: "/miprojet", label: "Tableau de bord" },
  { to: "/miprojet/utilisateurs", label: "Utilisateurs" },
];
