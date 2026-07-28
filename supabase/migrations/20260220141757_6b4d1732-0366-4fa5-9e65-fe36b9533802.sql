
-- ═══════════════════════════════════════════════════════════
-- STABILIZATION PATCH: Outlook + Campaign Add-on Alignment
-- ═══════════════════════════════════════════════════════════

-- 1. Add do_not_email flag to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS do_not_email boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_contacts_do_not_email ON public.contacts (do_not_email) WHERE do_not_email = true;

-- 2. Add source_connector to email_suppressions for bridge import tracking
ALTER TABLE public.email_suppressions ADD COLUMN IF NOT EXISTS source_connector text NULL;

-- 3. Update the reason constraint to include new migration-based reasons
ALTER TABLE public.email_suppressions DROP CONSTRAINT IF EXISTS email_suppressions_reason_check;
ALTER TABLE public.email_suppressions ADD CONSTRAINT email_suppressions_reason_check 
  CHECK (reason IN ('unsubscribed', 'complaint', 'bounce', 'manual', 'unsubscribed_source', 'cleaned'));

-- 4. Update the source constraint to include connector imports
ALTER TABLE public.email_suppressions DROP CONSTRAINT IF EXISTS email_suppressions_source_check;
ALTER TABLE public.email_suppressions ADD CONSTRAINT email_suppressions_source_check 
  CHECK (source IN ('self_service', 'admin', 'system', 'connector_import'));
