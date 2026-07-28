
-- 2) Idempotency: composite unique index on volunteer_shifts
CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteer_shifts_email_dedupe
ON public.volunteer_shifts (source_email_message_id, volunteer_id, shift_date)
WHERE source_email_message_id IS NOT NULL;

-- 6) Performance: index on volunteers(last_volunteered_at DESC)
-- (may already exist from initial migration, safe to create IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_volunteers_last_volunteered
ON public.volunteers (last_volunteered_at DESC);
