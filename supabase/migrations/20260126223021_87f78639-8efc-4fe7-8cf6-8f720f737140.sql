-- Create table to store email communications
CREATE TABLE public.email_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  subject TEXT,
  snippet TEXT,
  body_preview TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recipient_email TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_communications ENABLE ROW LEVEL SECURITY;

-- Users can view their own email communications
CREATE POLICY "Users can view own email communications"
  ON public.email_communications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own email communications
CREATE POLICY "Users can insert own email communications"
  ON public.email_communications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own email communications
CREATE POLICY "Users can delete own email communications"
  ON public.email_communications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_email_communications_user_id ON public.email_communications(user_id);
CREATE INDEX idx_email_communications_contact_id ON public.email_communications(contact_id);
CREATE INDEX idx_email_communications_sent_at ON public.email_communications(sent_at DESC);

-- Add gmail_sync_enabled to profiles for email sync preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gmail_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gmail_last_sync_at TIMESTAMP WITH TIME ZONE;