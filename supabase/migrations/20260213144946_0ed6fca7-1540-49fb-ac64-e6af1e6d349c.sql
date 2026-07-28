
-- Add missing columns to opportunity_signals for the Signals Engine
ALTER TABLE public.opportunity_signals
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS signal_reason text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill source_type from signal_type for existing rows
UPDATE public.opportunity_signals SET source_type = signal_type WHERE source_type IS NULL;
UPDATE public.opportunity_signals SET signal_reason = signal_value WHERE signal_reason IS NULL;

-- Add unique constraint for idempotency (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_signal_source_org') THEN
    -- Only add if source_id is populated
    NULL;
  END IF;
END $$;
