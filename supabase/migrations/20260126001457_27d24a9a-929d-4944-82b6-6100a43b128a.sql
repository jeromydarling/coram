-- Create contact tasks table
CREATE TABLE public.contact_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_contact_tasks_contact_id ON public.contact_tasks(contact_id);
CREATE INDEX idx_contact_tasks_due_date ON public.contact_tasks(due_date) WHERE due_date IS NOT NULL;

-- Enable RLS
ALTER TABLE public.contact_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage tasks for contacts they have access to
CREATE POLICY "Users can view tasks for accessible contacts"
ON public.contact_tasks
FOR SELECT
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR EXISTS (
    SELECT 1 FROM contacts c
    LEFT JOIN opportunities o ON o.id = c.opportunity_id
    WHERE c.id = contact_tasks.contact_id
    AND (c.opportunity_id IS NULL OR o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
  )
);

CREATE POLICY "Users can create tasks for accessible contacts"
ON public.contact_tasks
FOR INSERT
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR EXISTS (
    SELECT 1 FROM contacts c
    LEFT JOIN opportunities o ON o.id = c.opportunity_id
    WHERE c.id = contact_tasks.contact_id
    AND (c.opportunity_id IS NULL OR o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
  )
);

CREATE POLICY "Users can update tasks for accessible contacts"
ON public.contact_tasks
FOR UPDATE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR EXISTS (
    SELECT 1 FROM contacts c
    LEFT JOIN opportunities o ON o.id = c.opportunity_id
    WHERE c.id = contact_tasks.contact_id
    AND (c.opportunity_id IS NULL OR o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
  )
);

CREATE POLICY "Users can delete tasks for accessible contacts"
ON public.contact_tasks
FOR DELETE
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
  OR created_by = auth.uid()
);

-- Trigger for updated_at
CREATE TRIGGER update_contact_tasks_updated_at
BEFORE UPDATE ON public.contact_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();