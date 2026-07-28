-- Fix 1: Change profiles SELECT policies to PERMISSIVE (default)
-- Drop existing RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate as PERMISSIVE (default behavior - OR logic)
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Add database constraints for input validation
-- Contacts table constraints
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_name_length CHECK (length(name) <= 100),
  ADD CONSTRAINT contacts_email_length CHECK (email IS NULL OR length(email) <= 255),
  ADD CONSTRAINT contacts_phone_length CHECK (phone IS NULL OR length(phone) <= 30),
  ADD CONSTRAINT contacts_title_length CHECK (title IS NULL OR length(title) <= 100),
  ADD CONSTRAINT contacts_notes_length CHECK (notes IS NULL OR length(notes) <= 2000);

-- Opportunities table constraints
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_organization_length CHECK (length(organization) <= 200),
  ADD CONSTRAINT opportunities_contact_name_length CHECK (primary_contact_name IS NULL OR length(primary_contact_name) <= 100),
  ADD CONSTRAINT opportunities_contact_title_length CHECK (primary_contact_title IS NULL OR length(primary_contact_title) <= 100),
  ADD CONSTRAINT opportunities_contact_email_length CHECK (primary_contact_email IS NULL OR length(primary_contact_email) <= 255),
  ADD CONSTRAINT opportunities_contact_phone_length CHECK (primary_contact_phone IS NULL OR length(primary_contact_phone) <= 30),
  ADD CONSTRAINT opportunities_next_step_length CHECK (next_step IS NULL OR length(next_step) <= 500),
  ADD CONSTRAINT opportunities_notes_length CHECK (notes IS NULL OR length(notes) <= 2000);

-- Events table constraints
ALTER TABLE public.events
  ADD CONSTRAINT events_name_length CHECK (length(event_name) <= 200),
  ADD CONSTRAINT events_staff_range CHECK (staff_deployed IS NULL OR (staff_deployed >= 0 AND staff_deployed <= 10000)),
  ADD CONSTRAINT events_households_range CHECK (households_served IS NULL OR (households_served >= 0 AND households_served <= 100000)),
  ADD CONSTRAINT events_devices_range CHECK (devices_distributed IS NULL OR (devices_distributed >= 0 AND devices_distributed <= 100000)),
  ADD CONSTRAINT events_signups_range CHECK (internet_signups IS NULL OR (internet_signups >= 0 AND internet_signups <= 100000)),
  ADD CONSTRAINT events_referrals_range CHECK (referrals_generated IS NULL OR (referrals_generated >= 0 AND referrals_generated <= 100000)),
  ADD CONSTRAINT events_notes_length CHECK (notes IS NULL OR length(notes) <= 2000);

-- Fix 3: Update contacts RLS policy to restrict access to opportunity owners or admins
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can manage contacts in assigned metros" ON public.contacts;

-- Create more restrictive policy for viewing contacts
-- Users can only view contacts if:
-- 1. They are admin/leadership OR
-- 2. They own the opportunity the contact is linked to OR
-- 3. The contact is not linked to any opportunity (shared contacts)
CREATE POLICY "Users can view contacts for owned opportunities"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR opportunity_id IS NULL
    OR EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = contacts.opportunity_id
      AND o.owner_id = auth.uid()
    )
  );

-- Policy for insert - users with metro access can create contacts
CREATE POLICY "Users can create contacts for opportunities"
  ON public.contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR opportunity_id IS NULL
    OR EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = contacts.opportunity_id
      AND (o.owner_id = auth.uid() OR has_metro_access(auth.uid(), o.metro_id))
    )
  );

-- Policy for update - only opportunity owners or admins
CREATE POLICY "Users can update contacts for owned opportunities"
  ON public.contacts
  FOR UPDATE
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role])
    OR opportunity_id IS NULL
    OR EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = contacts.opportunity_id
      AND o.owner_id = auth.uid()
    )
  );

-- Policy for delete - only admins
CREATE POLICY "Admins can delete contacts"
  ON public.contacts
  FOR DELETE
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'leadership'::app_role]));