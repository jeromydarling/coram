
-- Create email_template_presets table
CREATE TABLE public.email_template_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  template_type TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  defaults JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_template_presets ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users can read active presets
CREATE POLICY "Authenticated users can read active presets"
ON public.email_template_presets
FOR SELECT
USING (active = true);

-- Write: admin only
CREATE POLICY "Admins can manage presets"
ON public.email_template_presets
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_email_template_presets_updated_at
BEFORE UPDATE ON public.email_template_presets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed the conference followup preset
INSERT INTO public.email_template_presets (key, template_type, name, defaults)
VALUES (
  'conference_followup_intro_call_warm_short_v1',
  'conference_followup',
  'Conference Follow-up (Intro Call · Warm · Short)',
  '{
    "ask_type": "intro_call",
    "tone": "warm",
    "length": "short",
    "subject_variants": [
      "Great meeting you at {{ context.event_name }}",
      "Following up from {{ context.event_name }}",
      "Quick follow-up from {{ context.event_name }}"
    ],
    "constraints": [
      "Do not invent facts. Use only company KB approved claims and org knowledge if present.",
      "4–5 short paragraphs max.",
      "Ask for a 15–20 minute intro call.",
      "Warm, human, professional. No hype."
    ]
  }'::jsonb
);
