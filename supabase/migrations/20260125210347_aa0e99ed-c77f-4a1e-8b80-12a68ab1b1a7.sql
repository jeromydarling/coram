-- Create event_types lookup table
CREATE TABLE public.event_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view event types"
ON public.event_types
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage event types"
ON public.event_types
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_event_types_updated_at
BEFORE UPDATE ON public.event_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Alter events table: change event_type from enum to text
ALTER TABLE public.events 
ALTER COLUMN event_type TYPE text USING event_type::text;

-- Make event_type nullable to allow for flexibility
ALTER TABLE public.events 
ALTER COLUMN event_type DROP NOT NULL;

-- Drop the old enum type (it's no longer needed)
DROP TYPE IF EXISTS public.event_type;