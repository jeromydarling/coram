-- Add ROI scoring columns to events table
ALTER TABLE public.events
ADD COLUMN roi_score numeric DEFAULT NULL,
ADD COLUMN roi_calculated_at timestamp with time zone DEFAULT NULL;