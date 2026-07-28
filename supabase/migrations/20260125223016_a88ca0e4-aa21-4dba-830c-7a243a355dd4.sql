-- Add URL field to events table for registration/info page links
ALTER TABLE public.events
ADD COLUMN url text;