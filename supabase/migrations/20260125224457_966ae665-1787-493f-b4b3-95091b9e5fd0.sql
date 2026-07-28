-- Add end_date column for multi-day events
ALTER TABLE public.events ADD COLUMN end_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.events.end_date IS 'Optional end date for multi-day events. If null, event is single-day.';