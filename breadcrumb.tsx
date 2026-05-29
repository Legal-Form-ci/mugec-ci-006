import { MemberAvatarImage } from "@/components/MemberAvatar";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  User,
  CreditCard,
  FileText,
  Wallet,
  LogOut,
  Home,
  Bell,
} from "lucide-react";
import logo from "@/assets/mugec-logo.png";
import { useAuth } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const NAV_ITEMS = [
  { to: "/membre", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/membre/profil", label: "Mon profil", icon: User },
  { to: "/membre/documents", label: "Documents", icon: FileText },
  { to: "/membre/cotisations", label: "Cotisations", icon: Wallet },
] as const;

type MemberSummary = {
  nom?: string | null;
  prenoms?: string | null;
  photo_url?: string | null;
  matricule?: string | null;
  statut?: string | null;
};

function MemberSidebar({ me }: { me: MemberSummary | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();

  const initials =
    ((me?.prenoms?.[0] ?? user?.email?.[0] ?? "M") +
      (me?.nom?.[0] ?? "")).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <Link to="/membre" className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="MUGEC-CI" className="h-9 w-9 shrink-0 rounded-md object-contain" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Espace
              </div>
              <div className="text-sm font-semibold truncate">Membre MUGEC-CI</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Accès rapide</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Retour au site">
                  <Link to="/" className="flex items-center gap-3">
                    <Home className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Site public</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className={`flex items-center gap-2 rounded-lg p-2 ${collapsed ? "justify-center" : "bg-sidebar-accent/40"}`}>
          <Avatar className="h-9 w-9 ring-2 ring-background">
            <MemberAvatarImage src={me?.photo_url} alt="" />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Bonjour
              </div>
              <div className="text-sm font-semibold truncate">
                {me?.prenoms ?? ""} {me?.nom ?? ""}
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function MembreLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<MemberSummary | null>(null);

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setMe(null);
      return;
    }
    supabase
      .from("members")
      .select("nom, prenoms, photo_url, matricule, statut")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setMe(data as MemberSummary | null);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" style={{ background: "var(--gradient-surface)" }}>
        <MemberSidebar me={me} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur-xl">
            <div className="flex h-full items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger className="shrink-0" />
                <div className="hidden h-8 w-px bg-border sm:block" />
                <div className="min-w-0">
                  <h1 className="text-base font-semibold tracking-tight truncate md:text-lg">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {actions}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {me?.statut && (
                  <Badge
                    variant={me.statut === "actif" ? "default" : "secondary"}
                    className="hidden capitalize sm:inline-flex"
                  >
                    {me.statut}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut()}
                  title="Déconnexion"
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
