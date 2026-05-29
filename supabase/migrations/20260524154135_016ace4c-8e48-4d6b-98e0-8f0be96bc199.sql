DROP POLICY IF EXISTS "roles self or admin read" ON public.user_roles;

CREATE POLICY "roles self or top admin read"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'admin_national')
);