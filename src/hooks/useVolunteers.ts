import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { crosToast } from '@/lib/crosToast';
import { handleMutationError } from '@/lib/permissionErrors';
import { useTestimoniumCapture } from './useTestimoniumCapture';

export type Volunteer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  notes: string | null;
  last_volunteered_at: string | null;
  lifetime_minutes: number;
  created_at: string;
  updated_at: string;
};

export type VolunteerShift = {
  id: string;
  volunteer_id: string;
  kind: string;
  event_id: string | null;
  shift_date: string;
  minutes: number;
  source: string;
  source_email_message_id: string | null;
  raw_text: string | null;
  created_by: string | null;
  created_at: string;
  events?: { id: string; event_name: string } | null;
};

export type VolunteerHoursInbox = {
  id: string;
  gmail_message_id: string;
  from_email: string;
  received_at: string;
  subject: string | null;
  snippet: string | null;
  raw_text: string;
  parsed_json: Record<string, unknown>;
  parse_status: string;
  reason: string | null;
  created_at: string;
};

import { RELIABILITY_THRESHOLDS, RELIABILITY_DEFAULT, RELIABILITY_NEW } from '@/lib/volunteerConfig';

/** Get reliability label based on days since last volunteered */
export function getReliabilityLabel(lastVolunteeredAt: string | null): {
  label: string;
  className: string;
} {
  if (!lastVolunteeredAt) {
    return { ...RELIABILITY_NEW };
  }
  const days = Math.floor(
    (Date.now() - new Date(lastVolunteeredAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  for (const t of RELIABILITY_THRESHOLDS) {
    if (days <= t.maxDays) return { label: t.label, className: t.className };
  }
  return { ...RELIABILITY_DEFAULT };
}

export function useVolunteers(statusFilter?: string) {
  return useQuery({
    queryKey: ['volunteers', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('volunteers')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Volunteer[];
    },
  });
}

export function useVolunteer(id: string | undefined) {
  return useQuery({
    queryKey: ['volunteer', id],
    queryFn: async () => {
      if (!id) throw new Error('No volunteer ID');
      const { data, error } = await supabase
        .from('volunteers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Volunteer;
    },
    enabled: !!id,
  });
}

export function useVolunteerShifts(volunteerId: string | undefined) {
  return useQuery({
    queryKey: ['volunteer-shifts', volunteerId],
    queryFn: async () => {
      if (!volunteerId) throw new Error('No volunteer ID');
      const { data, error } = await supabase
        .from('volunteer_shifts')
        .select('*, events(id, event_name)')
        .eq('volunteer_id', volunteerId)
        .order('shift_date', { ascending: false });
      if (error) throw error;
      return data as VolunteerShift[];
    },
    enabled: !!volunteerId,
  });
}

export function useCreateVolunteer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Volunteer>) => {
      const { data: result, error } = await supabase
        .from('volunteers')
        .insert(data as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteers'] });
      crosToast.noted('Volunteer added');
    },
    onError: (err: Error) => handleMutationError(err, () => crosToast.gentle(err.message)),
  });
}

export function useUpdateVolunteer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Volunteer> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('volunteers')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['volunteers'] });
      qc.invalidateQueries({ queryKey: ['volunteer', vars.id] });
      crosToast.updated();
    },
    onError: (err: Error) => handleMutationError(err, () => crosToast.gentle(err.message)),
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  const { captureTestimonium } = useTestimoniumCapture();
  return useMutation({
    mutationFn: async (data: {
      volunteer_id: string;
      kind: string;
      event_id?: string | null;
      shift_date: string;
      minutes: number;
      created_by?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('volunteer_shifts')
        .insert({ ...data, source: 'manual' })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['volunteer-shifts', vars.volunteer_id] });
      qc.invalidateQueries({ queryKey: ['volunteer', vars.volunteer_id] });
      qc.invalidateQueries({ queryKey: ['volunteers'] });
      crosToast.recorded('Hours logged');
      captureTestimonium({
        sourceModule: 'voluntarium',
        eventKind: 'hours_logged',
        summary: `I logged ${vars.minutes} minutes of volunteer time.`,
        metadata: { volunteer_id: vars.volunteer_id, minutes: vars.minutes },
      });
    },
    onError: (err: Error) => handleMutationError(err, () => crosToast.gentle(err.message)),
  });
}

export function useVolunteerInbox(statusFilter: string) {
  return useQuery({
    queryKey: ['volunteer-inbox', statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteer_hours_inbox')
        .select('*')
        .eq('parse_status', statusFilter)
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as VolunteerHoursInbox[];
    },
  });
}

export function useUpdateInboxItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; parse_status: string; reason?: string }) => {
      const { error } = await supabase
        .from('volunteer_hours_inbox')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-inbox'] });
    },
  });
}

/** Lookup volunteers by email for inbox matching */
export function useVolunteerByEmail(email: string | undefined) {
  return useQuery({
    queryKey: ['volunteer-by-email', email],
    queryFn: async () => {
      if (!email) return null;
      const { data, error } = await supabase
        .from('volunteers')
        .select('id, first_name, last_name, email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();
      if (error) throw error;
      return data as Volunteer | null;
    },
    enabled: !!email,
  });
}
