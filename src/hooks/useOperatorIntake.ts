/**
 * useOperatorIntake — Hook for the operator intake system.
 *
 * WHAT: CRUD for operator_intake table (global help requests).
 * WHERE: Used by submission form + Operator Console Intake tab.
 * WHY: Routes user help requests to operator-level triage, not tenant admin.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export type IntakeType = 'problem' | 'request';
export type IntakeStatus = 'open' | 'triaged' | 'in_progress' | 'needs_more_info' | 'resolved' | 'closed';

export interface OperatorIntakeRow {
  id: string;
  tenant_id: string;
  submitted_by: string;
  intake_type: IntakeType;
  title: string;
  body: string;
  module_key: string | null;
  page_path: string | null;
  client_meta: Record<string, unknown>;
  attachments: unknown[];
  status: IntakeStatus;
  operator_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIntakeInput {
  tenant_id: string;
  intake_type: IntakeType;
  title: string;
  body: string;
  module_key?: string;
  page_path?: string;
  client_meta?: Record<string, unknown>;
}

/** Collect safe client metadata */
export function collectClientMeta(): Record<string, unknown> {
  return {
    browser: navigator.userAgent.slice(0, 200),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString(),
  };
}

/** Detect module from current path */
export function detectModuleKey(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  const moduleMap: Record<string, string> = {
    journey: 'journey',
    journeys: 'journey',
    opportunities: 'opportunities',
    contacts: 'contacts',
    people: 'contacts',
    email: 'email',
    campaigns: 'email',
    communio: 'communio',
    provisio: 'provisio',
    voluntarium: 'voluntarium',
    volunteers: 'voluntarium',
    narrative: 'narrative',
    relatio: 'migrations',
    impulsus: 'impulsus',
    events: 'events',
    dashboard: 'dashboard',
    pulse: 'pulse',
    settings: 'settings',
  };
  for (const seg of segments) {
    const key = moduleMap[seg.toLowerCase()];
    if (key) return key;
  }
  return null;
}

export function useOperatorIntake() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // User's own submissions
  const { data: myIntake = [], isLoading: isLoadingMyIntake } = useQuery({
    queryKey: ['operator-intake', 'mine', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_intake')
        .select('*')
        .eq('submitted_by', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OperatorIntakeRow[];
    },
    enabled: !!user?.id,
  });

  // All submissions (admin/operator only)
  const { data: allIntake = [], isLoading: isLoadingAllIntake, refetch: refetchAll } = useQuery({
    queryKey: ['operator-intake', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_intake')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OperatorIntakeRow[];
    },
    enabled: !!user?.id,
  });

  const submitIntake = useMutation({
    mutationFn: async (input: CreateIntakeInput) => {
      const { data, error } = await supabase
        .from('operator_intake')
        .insert({
          tenant_id: input.tenant_id,
          submitted_by: user!.id,
          intake_type: input.intake_type,
          title: input.title.slice(0, 120),
          body: input.body.slice(0, 6000),
          module_key: input.module_key || null,
          page_path: input.page_path || null,
          client_meta: input.client_meta || {},
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-intake'] });
      toast.success("Got it. We'll take a look — you'll see updates here.");
    },
    onError: (err) => {
      toast.error('Failed to submit: ' + (err instanceof Error ? err.message : 'Unknown error'));
    },
  });

  const updateIntake = useMutation({
    mutationFn: async (input: { id: string; status?: IntakeStatus; operator_notes?: string; resolved_at?: string | null }) => {
      const updates: Record<string, unknown> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.operator_notes !== undefined) updates.operator_notes = input.operator_notes;
      if (input.resolved_at !== undefined) updates.resolved_at = input.resolved_at;
      
      const { data, error } = await supabase
        .from('operator_intake')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator-intake'] });
      toast.success('Updated');
    },
    onError: (err) => {
      toast.error('Update failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    },
  });

  return {
    myIntake,
    allIntake,
    isLoadingMyIntake,
    isLoadingAllIntake,
    submitIntake,
    updateIntake,
    refetchAll,
  };
}
