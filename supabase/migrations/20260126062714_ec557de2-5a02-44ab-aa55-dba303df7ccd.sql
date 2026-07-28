-- Add attended field to activities table (for meetings)
ALTER TABLE public.activities 
ADD COLUMN attended boolean DEFAULT false;

-- Add attended field to events table
ALTER TABLE public.events 
ADD COLUMN attended boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.activities.attended IS 'Whether the meeting/activity was actually attended';
COMMENT ON COLUMN public.events.attended IS 'Whether the event was actually attended';