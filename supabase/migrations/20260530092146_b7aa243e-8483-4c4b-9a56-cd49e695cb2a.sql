
-- 1) Restrict sensitive financial/identity columns on members to super_admin / tresorier_national only.
-- Keep the broad admin update for non-sensitive fields, add a restrictive policy that blocks
-- lower-privilege admins from touching financial/integrity columns.

CREATE OR REPLACE FUNCTION public.can_manage_member_financials(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('super_admin','admin_national','tresorier_national')
  );
$$;

DROP POLICY IF EXISTS "members financial fields restricted" ON public.members;
CREATE POLICY "members financial fields restricted"
ON public.members
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  public.can_manage_member_financials(auth.uid())
  OR (
    frais_paye           IS NOT DISTINCT FROM (SELECT m.frais_paye           FROM public.members m WHERE m.id = members.id)
    AND droits_ouverts_le    IS NOT DISTINCT FROM (SELECT m.droits_ouverts_le    FROM public.members m WHERE m.id = members.id)
    AND payment_confirmed_at IS NOT DISTINCT FROM (SELECT m.payment_confirmed_at FROM public.members m WHERE m.id = members.id)
    AND payment_reference    IS NOT DISTINCT FROM (SELECT m.payment_reference    FROM public.members m WHERE m.id = members.id)
    AND validation_mode      IS NOT DISTINCT FROM (SELECT m.validation_mode      FROM public.members m WHERE m.id = members.id)
    AND matricule            IS NOT DISTINCT FROM (SELECT m.matricule            FROM public.members m WHERE m.id = members.id)
    AND is_legacy            IS NOT DISTINCT FROM (SELECT m.is_legacy            FROM public.members m WHERE m.id = members.id)
    AND statut               IS NOT DISTINCT FROM (SELECT m.statut               FROM public.members m WHERE m.id = members.id)
  )
);

-- 2) Explicit deny-by-default write policies on notification_queue (only service_role / SECURITY DEFINER may write).

DROP POLICY IF EXISTS "queue deny client insert" ON public.notification_queue;
CREATE POLICY "queue deny client insert"
ON public.notification_queue
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "queue deny client update" ON public.notification_queue;
CREATE POLICY "queue deny client update"
ON public.notification_queue
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "queue deny client delete" ON public.notification_queue;
CREATE POLICY "queue deny client delete"
ON public.notification_queue
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);
