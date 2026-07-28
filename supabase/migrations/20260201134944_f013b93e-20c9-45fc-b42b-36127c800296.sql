-- Create weekly_plans table for storing user focus plans
CREATE TABLE public.weekly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  plan_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  source_snapshot_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT weekly_plans_user_week_unique UNIQUE (user_id, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies (NO DELETE policy - users cannot delete plans)
CREATE POLICY "Users can view their own plans" ON public.weekly_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plans" ON public.weekly_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans" ON public.weekly_plans
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER set_weekly_plans_updated_at
  BEFORE UPDATE ON public.weekly_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for efficient lookups by user and week
CREATE INDEX idx_weekly_plans_user_week ON public.weekly_plans (user_id, week_start_date);