-- Create audit log table for tracking user changes
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert audit logs (their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can delete audit logs (for cleanup)
CREATE POLICY "Admins can delete audit logs"
ON public.audit_log
FOR DELETE
USING (has_role(auth.uid(), 'admin'));