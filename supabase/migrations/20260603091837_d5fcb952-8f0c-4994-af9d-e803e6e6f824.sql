-- 1) Restrict notification_queue read access to top-tier admins only
DROP POLICY IF EXISTS "queue admin read" ON public.notification_queue;
CREATE POLICY "queue top admin read" ON public.notification_queue
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin_national'::public.app_role));

-- 2) Harden registration_drafts with RESTRICTIVE deny policies for client roles
DROP POLICY IF EXISTS "drafts client no access" ON public.registration_drafts;

CREATE POLICY "drafts deny client insert" ON public.registration_drafts
  AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "drafts deny client update" ON public.registration_drafts
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "drafts deny client delete" ON public.registration_drafts
  AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

CREATE POLICY "drafts deny anon select" ON public.registration_drafts
  AS RESTRICTIVE FOR SELECT TO anon
  USING (false);
