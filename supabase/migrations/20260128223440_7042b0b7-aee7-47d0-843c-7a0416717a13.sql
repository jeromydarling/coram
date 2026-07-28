-- Create enums for feedback system
CREATE TYPE public.feedback_type AS ENUM ('bug', 'feature');
CREATE TYPE public.feedback_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.feedback_status AS ENUM ('open', 'in_progress', 'resolved', 'declined');

-- Create feedback_requests table
CREATE TABLE public.feedback_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type feedback_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority feedback_priority NOT NULL DEFAULT 'medium',
  status feedback_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback_notifications table
CREATE TABLE public.feedback_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.feedback_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feedback_requests
-- Users can view their own requests
CREATE POLICY "Users can view own feedback requests"
ON public.feedback_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins and leadership can view all requests
CREATE POLICY "Admins can view all feedback requests"
ON public.feedback_requests
FOR SELECT
USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Any authenticated user can create feedback
CREATE POLICY "Authenticated users can create feedback"
ON public.feedback_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can update feedback (to change status)
CREATE POLICY "Admins can update feedback requests"
ON public.feedback_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete feedback
CREATE POLICY "Admins can delete feedback requests"
ON public.feedback_requests
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for feedback_notifications
-- Users can view their own notifications
CREATE POLICY "Users can view own feedback notifications"
ON public.feedback_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own feedback notifications"
ON public.feedback_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_feedback_requests_updated_at
BEFORE UPDATE ON public.feedback_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Create function to notify user when feedback status changes
CREATE OR REPLACE FUNCTION public.notify_feedback_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notification_message TEXT;
  feedback_title TEXT;
  feedback_type TEXT;
BEGIN
  -- Only trigger when status changes to resolved or declined
  IF (NEW.status IN ('resolved', 'declined')) AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    feedback_title := NEW.title;
    feedback_type := CASE WHEN NEW.type = 'bug' THEN 'bug report' ELSE 'feature request' END;
    
    IF NEW.status = 'resolved' THEN
      notification_message := 'Great news! Your ' || feedback_type || ' "' || feedback_title || '" has been resolved.';
    ELSE
      notification_message := 'Your ' || feedback_type || ' "' || feedback_title || '" has been declined.';
    END IF;
    
    -- Update resolved_at and resolved_by
    NEW.resolved_at := now();
    NEW.resolved_by := auth.uid();
    
    -- Create notification for the user
    INSERT INTO public.feedback_notifications (feedback_id, user_id, message)
    VALUES (NEW.id, NEW.user_id, notification_message);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for status change notifications
CREATE TRIGGER on_feedback_status_change
BEFORE UPDATE ON public.feedback_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_feedback_status_change();

-- Create indexes for performance
CREATE INDEX idx_feedback_requests_user_id ON public.feedback_requests(user_id);
CREATE INDEX idx_feedback_requests_status ON public.feedback_requests(status);
CREATE INDEX idx_feedback_notifications_user_id ON public.feedback_notifications(user_id);
CREATE INDEX idx_feedback_notifications_is_read ON public.feedback_notifications(is_read);