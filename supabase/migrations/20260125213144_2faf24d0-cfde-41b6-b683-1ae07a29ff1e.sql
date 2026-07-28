-- Add recurring event fields to events table
ALTER TABLE public.events
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_pattern text,
ADD COLUMN recurrence_end_date date;

-- Add comment for clarity
COMMENT ON COLUMN public.events.recurrence_pattern IS 'Values: weekly, biweekly, monthly, quarterly, yearly';