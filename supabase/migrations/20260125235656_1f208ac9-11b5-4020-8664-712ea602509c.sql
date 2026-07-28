-- Add description field to events table
ALTER TABLE public.events 
ADD COLUMN description text;