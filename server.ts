import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { ADMIN_ROLES } from "@/lib/auth";

export const Route = createFileRoute("/membre")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw redirect({ to: "/login" });
    }
    
    // Si l'utilisateur est un admin, on le redirige vers l'espace admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const adminRolesSet = new Set(ADMIN_ROLES);
    const hasAdminRole = (roles ?? []).some((r) => adminRolesSet.has(String(r.role)));
    const isSuperAdmin = (roles ?? []).some((r) => String(r.role) === "super_admin");

    if (hasAdminRole) {
      // Redirection intelligente : super_admin -> miprojet, autres -> admin
      if (isSuperAdmin) {
        throw redirect({ to: "/miprojet" });
      }
      throw redirect({ to: "/admin" });
    }
  },
  component: () => <Outlet />,
});
