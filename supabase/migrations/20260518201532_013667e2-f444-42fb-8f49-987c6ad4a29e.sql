
CREATE TABLE public.migration_review_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_id UUID NOT NULL REFERENCES public.relatio_migrations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_key TEXT NOT NULL,
  source_row JSONB NOT NULL,
  target_entity TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  ai_proposed_payload JSONB,
  ai_confidence NUMERIC(3,2),
  ai_reasoning TEXT,
  ai_error_kind TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','unrescuable','auto_rescued_pending_review')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mrq_tenant_status ON public.migration_review_queue(tenant_id, status);
CREATE INDEX idx_mrq_migration ON public.migration_review_queue(migration_id);

ALTER TABLE public.migration_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view review queue"
ON public.migration_review_queue FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can insert review queue"
ON public.migration_review_queue FOR INSERT TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can update review queue"
ON public.migration_review_queue FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE TRIGGER trg_mrq_updated_at
BEFORE UPDATE ON public.migration_review_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
