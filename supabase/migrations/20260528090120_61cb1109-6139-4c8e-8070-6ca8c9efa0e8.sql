DROP POLICY IF EXISTS "drafts admin read" ON public.registration_drafts;
CREATE POLICY "drafts top admin read"
  ON public.registration_drafts
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin_national'::public.app_role)
  );

DROP POLICY IF EXISTS "subscriptions owner or admin read" ON public.subscriptions;
CREATE POLICY "subscriptions owner or super admin read"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = subscriptions.member_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "subscriptions admin update" ON public.subscriptions;
CREATE POLICY "subscriptions super admin update"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));