
-- ══════════════════════════════════════════════════════════════
-- Caregiver Network — Privacy-First Opt-In Network
-- ══════════════════════════════════════════════════════════════

-- 1. Contact visibility enum
CREATE TYPE public.caregiver_contact_visibility AS ENUM (
  'relay_only',
  'reveal_on_request',
  'public_email_optional'
);

-- 2. Network request status enum
CREATE TYPE public.caregiver_request_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'blocked'
);

-- ── caregiver_profiles ──────────────────────────────────────
CREATE TABLE public.caregiver_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  base_city text,
  base_state_code text,
  base_country_code text DEFAULT 'US',
  network_opt_in boolean NOT NULL DEFAULT false,
  availability_tags text[] NOT NULL DEFAULT '{}',
  support_needs text[] NOT NULL DEFAULT '{}',
  bio_short text,
  contact_visibility public.caregiver_contact_visibility NOT NULL DEFAULT 'relay_only',
  hidden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.caregiver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caregiver_profiles_own_select"
  ON public.caregiver_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "caregiver_profiles_own_insert"
  ON public.caregiver_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "caregiver_profiles_own_update"
  ON public.caregiver_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "caregiver_profiles_browse"
  ON public.caregiver_profiles FOR SELECT
  USING (
    network_opt_in = true
    AND hidden_at IS NULL
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "caregiver_profiles_gardener_select"
  ON public.caregiver_profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "caregiver_profiles_gardener_update"
  ON public.caregiver_profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ── caregiver_network_requests ──────────────────────────────
CREATE TABLE public.caregiver_network_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.caregiver_profiles(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  status public.caregiver_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caregiver_network_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "network_requests_sender_select"
  ON public.caregiver_network_requests FOR SELECT
  USING (auth.uid() = from_user_id);

CREATE POLICY "network_requests_recipient_select"
  ON public.caregiver_network_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_profiles
      WHERE id = to_profile_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "network_requests_insert"
  ON public.caregiver_network_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "network_requests_recipient_update"
  ON public.caregiver_network_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.caregiver_profiles
      WHERE id = to_profile_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "network_requests_gardener_select"
  ON public.caregiver_network_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ── caregiver_network_messages ──────────────────────────────
CREATE TABLE public.caregiver_network_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.caregiver_network_requests(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  reported boolean NOT NULL DEFAULT false,
  reported_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caregiver_network_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_network_request_participant(
  _user_id uuid,
  _request_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.caregiver_network_requests r
    JOIN public.caregiver_profiles p ON p.id = r.to_profile_id
    WHERE r.id = _request_id
      AND r.status = 'accepted'
      AND (_user_id = r.from_user_id OR _user_id = p.user_id)
  );
$$;

CREATE POLICY "network_messages_participant_select"
  ON public.caregiver_network_messages FOR SELECT
  USING (public.is_network_request_participant(auth.uid(), request_id));

CREATE POLICY "network_messages_participant_insert"
  ON public.caregiver_network_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_user_id
    AND public.is_network_request_participant(auth.uid(), request_id)
  );

CREATE POLICY "network_messages_gardener_reported"
  ON public.caregiver_network_messages FOR SELECT
  USING (
    reported = true
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "network_messages_report_update"
  ON public.caregiver_network_messages FOR UPDATE
  USING (
    public.is_network_request_participant(auth.uid(), request_id)
    AND auth.uid() != sender_user_id
  );

-- ── caregiver_network_reports ───────────────────────────────
CREATE TABLE public.caregiver_network_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_profile_id uuid REFERENCES public.caregiver_profiles(id) ON DELETE SET NULL,
  reported_request_id uuid REFERENCES public.caregiver_network_requests(id) ON DELETE SET NULL,
  reported_message_id uuid REFERENCES public.caregiver_network_messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caregiver_network_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "network_reports_own_select"
  ON public.caregiver_network_reports FOR SELECT
  USING (auth.uid() = reporter_user_id);

CREATE POLICY "network_reports_insert"
  ON public.caregiver_network_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "network_reports_gardener_select"
  ON public.caregiver_network_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "network_reports_gardener_update"
  ON public.caregiver_network_reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_caregiver_profiles_opt_in ON public.caregiver_profiles(network_opt_in) WHERE network_opt_in = true AND hidden_at IS NULL;
CREATE INDEX idx_caregiver_profiles_state ON public.caregiver_profiles(base_state_code) WHERE network_opt_in = true;
CREATE INDEX idx_caregiver_profiles_tenant ON public.caregiver_profiles(tenant_id);
CREATE INDEX idx_caregiver_requests_to ON public.caregiver_network_requests(to_profile_id);
CREATE INDEX idx_caregiver_requests_from ON public.caregiver_network_requests(from_user_id);
CREATE INDEX idx_caregiver_messages_request ON public.caregiver_network_messages(request_id);
CREATE INDEX idx_caregiver_reports_status ON public.caregiver_network_reports(status) WHERE status = 'open';

-- ── Updated_at triggers ─────────────────────────────────────
CREATE TRIGGER update_caregiver_profiles_updated_at
  BEFORE UPDATE ON public.caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_caregiver_requests_updated_at
  BEFORE UPDATE ON public.caregiver_network_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
