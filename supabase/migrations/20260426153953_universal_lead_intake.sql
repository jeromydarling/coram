-- ─────────────────────────────────────────────────────────────────────────
-- Universal Lead Intake — extends inbound_leads with portfolio attribution
-- ─────────────────────────────────────────────────────────────────────────
-- Layer 1 of the CROS Cosmos initiative. Every satellite app in the CROS
-- family (Hortus, Schola, Communis, Refugium, Vigilia, Transitus, Resurrectio,
-- Propria, Cormundum, Bitoku, Rehearso, Heritage Kitchen, Via Publica,
-- Fabrica Forge, Catholic Insurance, VRT Method) submits leads through the
-- new public-leads-intake edge function. This migration adds the columns
-- needed to attribute, deduplicate, and route those submissions.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Attribution columns ---------------------------------------------------
ALTER TABLE public.inbound_leads
  ADD COLUMN IF NOT EXISTS source_app   TEXT,
  ADD COLUMN IF NOT EXISTS source_url   TEXT,
  ADD COLUMN IF NOT EXISTS source_page  TEXT,
  ADD COLUMN IF NOT EXISTS form_variant TEXT,
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS referrer     TEXT,
  ADD COLUMN IF NOT EXISTS user_agent   TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash      TEXT,
  ADD COLUMN IF NOT EXISTS lead_kind    TEXT NOT NULL DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS interest     TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS extra        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key   TEXT,
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS routed_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes        TEXT;

-- lead_kind: 'demo' | 'waitlist' | 'contact' | 'feedback' | 'partner'
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_lead_kind_check;
ALTER TABLE public.inbound_leads
  ADD CONSTRAINT inbound_leads_lead_kind_check
  CHECK (lead_kind IN ('demo','waitlist','contact','feedback','partner','beta'));

-- status: 'new' | 'triaged' | 'routed' | 'replied' | 'won' | 'lost' | 'spam'
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_status_check;
ALTER TABLE public.inbound_leads
  ADD CONSTRAINT inbound_leads_status_check
  CHECK (status IN ('new','triaged','routed','replied','won','lost','spam'));

-- Defensive length caps mirror api-contacts conventions
ALTER TABLE public.inbound_leads
  DROP CONSTRAINT IF EXISTS inbound_leads_lengths;
ALTER TABLE public.inbound_leads
  ADD CONSTRAINT inbound_leads_lengths
  CHECK (
    length(name) <= 120 AND
    length(email) <= 255 AND
    (organization IS NULL OR length(organization) <= 200) AND
    (message IS NULL OR length(message) <= 4000) AND
    (source_app IS NULL OR length(source_app) <= 64) AND
    (source_url IS NULL OR length(source_url) <= 2048) AND
    (source_page IS NULL OR length(source_page) <= 1024) AND
    (form_variant IS NULL OR length(form_variant) <= 64) AND
    (interest IS NULL OR length(interest) <= 200) AND
    (phone IS NULL OR length(phone) <= 30)
  );

-- 2. Soft-dedupe index (per-app + email + 24h window logic in code) ---------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inbound_leads_dedupe
  ON public.inbound_leads (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_leads_source_app
  ON public.inbound_leads (source_app, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_leads_status
  ON public.inbound_leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_leads_routed_tenant
  ON public.inbound_leads (routed_tenant_id, created_at DESC);

-- 3. Operator view: leads-by-app rollup ------------------------------------
CREATE OR REPLACE VIEW public.operator_leads_by_app AS
SELECT
  COALESCE(source_app, 'unknown')                                AS source_app,
  COUNT(*)                                                       AS total,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24h')   AS last_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '7d')    AS last_7d,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30d')   AS last_30d,
  COUNT(*) FILTER (WHERE status = 'new')                         AS new_count,
  COUNT(*) FILTER (WHERE status = 'spam')                        AS spam_count,
  COUNT(*) FILTER (WHERE status = 'won')                         AS won_count,
  COUNT(*) FILTER (WHERE converted_contact_id IS NOT NULL)       AS converted_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE converted_contact_id IS NOT NULL)
         / NULLIF(COUNT(*) FILTER (WHERE status <> 'spam'), 0),
    1
  ) AS conversion_pct,
  MAX(created_at) AS last_lead_at
FROM public.inbound_leads
GROUP BY COALESCE(source_app, 'unknown');

GRANT SELECT ON public.operator_leads_by_app TO authenticated;

-- 4. Operator-only RLS policies for the new fields -------------------------
-- (existing policies on inbound_leads already cover anon-insert + admin-select;
--  we just add an UPDATE policy for admins to triage / mark spam / convert.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'inbound_leads'
      AND policyname = 'Admins can update leads'
  ) THEN
    CREATE POLICY "Admins can update leads"
      ON public.inbound_leads
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 5. Touch the updated_at automatically (table doesn't have it yet) --------
ALTER TABLE public.inbound_leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.tg_inbound_leads_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbound_leads_set_updated_at ON public.inbound_leads;
CREATE TRIGGER trg_inbound_leads_set_updated_at
BEFORE UPDATE ON public.inbound_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_inbound_leads_set_updated_at();

-- 6. Documentation comments ------------------------------------------------
COMMENT ON COLUMN public.inbound_leads.source_app   IS 'Slug of the CROS-family app that submitted the lead (e.g. "hortus", "communis"). Matches watchtower projects.json slug.';
COMMENT ON COLUMN public.inbound_leads.source_url   IS 'Full URL of the page that contained the form at submission time.';
COMMENT ON COLUMN public.inbound_leads.form_variant IS 'Optional label for A/B variants of the same form ("hero","footer","modal-v2").';
COMMENT ON COLUMN public.inbound_leads.lead_kind    IS 'Kind of submission: demo | waitlist | contact | feedback | partner | beta.';
COMMENT ON COLUMN public.inbound_leads.dedupe_key   IS 'sha256(lower(email) + "|" + source_app + "|" + day-bucket). Set by edge function to prevent burst-double-submits within a 24h window.';
COMMENT ON COLUMN public.inbound_leads.extra        IS 'Free-form JSON for app-specific fields (zone of interest, garden size, parish, etc.) that we do not want first-class columns for.';
COMMENT ON VIEW   public.operator_leads_by_app      IS 'Cosmos rollup: per-app lead volume, conversion %, and last-lead-at. Powers the Operator Console "Leads by App" tab.';
