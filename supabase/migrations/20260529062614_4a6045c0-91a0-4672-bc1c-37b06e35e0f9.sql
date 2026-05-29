
-- ============================================================
-- 1) Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-media', 'public-media', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2) Storage policies — `documents` (privé, par dossier user_id)
-- ============================================================
DROP POLICY IF EXISTS "documents owner read" ON storage.objects;
CREATE POLICY "documents owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "documents owner write" ON storage.objects;
CREATE POLICY "documents owner write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "documents owner update" ON storage.objects;
CREATE POLICY "documents owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "documents admin delete" ON storage.objects;
CREATE POLICY "documents admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_super_admin(auth.uid()))
);

-- ============================================================
-- 3) Storage policies — `public-media` (lecture publique, écriture admin)
-- ============================================================
DROP POLICY IF EXISTS "public-media read" ON storage.objects;
CREATE POLICY "public-media read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'public-media');

DROP POLICY IF EXISTS "public-media admin write" ON storage.objects;
CREATE POLICY "public-media admin write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'public-media' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "public-media admin update" ON storage.objects;
CREATE POLICY "public-media admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'public-media' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "public-media admin delete" ON storage.objects;
CREATE POLICY "public-media admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'public-media' AND public.is_admin(auth.uid()));

-- ============================================================
-- 4) Index supplémentaires (lecture rapide sur colonnes filtrées)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_news_published_created ON public.news (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunites_published_created ON public.opportunites (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunites_date_limite ON public.opportunites (date_limite);
CREATE INDEX IF NOT EXISTS idx_contact_messages_traite_created ON public.contact_messages (traite, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires_at ON public.payment_sessions (expires_at) WHERE statut = 'en_attente';
CREATE INDEX IF NOT EXISTS idx_documents_member_created ON public.documents (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_documents_member_validated ON public.member_documents (member_id, validated);
CREATE INDEX IF NOT EXISTS idx_prestation_validations_request ON public.prestation_validations (request_id, niveau);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_channel ON public.notification_templates (event, channel) WHERE active;
