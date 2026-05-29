CREATE OR REPLACE FUNCTION public.current_user_dashboard_path()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'::public.app_role
    ) THEN '/admin/miprojet'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN (
          'admin_national','admin_regional','admin_local','agent_saisie',
          'president','secretaire_general','tresorier_national','commissaire_comptes',
          'directeur_executif','comite_controle','conseil_sages','secretaire_regional',
          'tresorier_regional','delegue_section'
        )
    ) THEN '/admin'
    ELSE '/membre'
  END;
$$;

REVOKE ALL ON FUNCTION public.current_user_dashboard_path() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_dashboard_path() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;