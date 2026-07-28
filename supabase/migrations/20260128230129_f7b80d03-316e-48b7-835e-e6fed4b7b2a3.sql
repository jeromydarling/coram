-- Create feedback audit log table to track all admin actions
CREATE TABLE public.feedback_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'status_changed', 'notes_updated', 'created', 'deleted'
  previous_value TEXT,
  new_value TEXT,
  performed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view feedback audit logs"
ON public.feedback_audit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert audit logs
CREATE POLICY "Admins can insert feedback audit logs"
ON public.feedback_audit_log
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups by feedback_id
CREATE INDEX idx_feedback_audit_log_feedback_id ON public.feedback_audit_log(feedback_id);

-- Create trigger function to auto-log feedback changes
CREATE OR REPLACE FUNCTION public.log_feedback_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.feedback_audit_log (feedback_id, action, previous_value, new_value, performed_by)
    VALUES (NEW.id, 'status_changed', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  
  -- Log admin notes changes
  IF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    INSERT INTO public.feedback_audit_log (feedback_id, action, previous_value, new_value, performed_by)
    VALUES (NEW.id, 'notes_updated', 
      CASE WHEN OLD.admin_notes IS NULL THEN '(empty)' ELSE LEFT(OLD.admin_notes, 100) END,
      CASE WHEN NEW.admin_notes IS NULL THEN '(empty)' ELSE LEFT(NEW.admin_notes, 100) END,
      auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to feedback_requests table
CREATE TRIGGER feedback_changes_audit_trigger
AFTER UPDATE ON public.feedback_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_feedback_changes();

-- Also log when feedback is created (via trigger on INSERT)
CREATE OR REPLACE FUNCTION public.log_feedback_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feedback_audit_log (feedback_id, action, new_value, performed_by)
  VALUES (NEW.id, 'created', NEW.type::text || ': ' || NEW.title, NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER feedback_created_audit_trigger
AFTER INSERT ON public.feedback_requests
FOR EACH ROW
EXECUTE FUNCTION public.log_feedback_created();