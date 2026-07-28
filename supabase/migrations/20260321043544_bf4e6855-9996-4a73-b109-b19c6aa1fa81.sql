
-- ================================================================
-- Fix cross-tenant data exposure on 6 tables
-- Replace overly permissive SELECT policies with owner/role-scoped ones
-- ================================================================

-- 1. DOCUMENTS: scope SELECT to uploader or admin/leadership
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
CREATE POLICY "Users can view own or admin all documents"
  ON public.documents FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

-- 2. DOCUMENT_ATTACHMENTS: scope SELECT to attacher or admin/leadership
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.document_attachments;
CREATE POLICY "Users can view own or admin all attachments"
  ON public.document_attachments FOR SELECT TO authenticated
  USING (
    attached_by = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

-- 3. CSV_IMPORT_HISTORY: scope SELECT to importer or admin
DROP POLICY IF EXISTS "Users can view import history" ON public.csv_import_history;
CREATE POLICY "Users can view own or admin all import history"
  ON public.csv_import_history FOR SELECT TO authenticated
  USING (
    imported_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. CSV_IMPORT_RECORDS: scope SELECT via parent import ownership
DROP POLICY IF EXISTS "Users can view import records" ON public.csv_import_records;
CREATE POLICY "Users can view own or admin all import records"
  ON public.csv_import_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.csv_import_history h
      WHERE h.id = csv_import_records.import_id
        AND (h.imported_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- 5. AUTOMATION_RUNS: restrict SELECT to admin only (system/operational data)
DROP POLICY IF EXISTS "Authenticated users can read automation_runs" ON public.automation_runs;
CREATE POLICY "Admins can read automation_runs"
  ON public.automation_runs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 6. ORG_KNOWLEDGE_SNAPSHOTS: scope to creator or admin (drop duplicate policies first)
DROP POLICY IF EXISTS "Authenticated users can read org knowledge" ON public.org_knowledge_snapshots;
DROP POLICY IF EXISTS "Authenticated users can read org knowledge snapshots" ON public.org_knowledge_snapshots;
CREATE POLICY "Users can view own or admin all org knowledge"
  ON public.org_knowledge_snapshots FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 7. CONTACT_SUGGESTIONS: restrict SELECT to admin only (system-generated data)
DROP POLICY IF EXISTS "Authenticated users can read contact suggestions" ON public.contact_suggestions;
CREATE POLICY "Admins can read contact_suggestions"
  ON public.contact_suggestions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );
