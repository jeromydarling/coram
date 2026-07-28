/**
 * useOnboarding — Hooks for tenant onboarding state.
 *
 * WHAT: Fetches onboarding session, steps, and progress for the current tenant.
 * WHERE: OnboardingGuide, OnboardingDrawer, FirstWeekPanel.
 * WHY: Single source of truth for onboarding UI across components.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface OnboardingStep {
  key: string;
  archetype: string;
  order_index: number;
  title: string;
  description: string;
  action_type: string;
  optional: boolean;
}

export interface OnboardingProgress {
  step_key: string;
  status: 'pending' | 'complete' | 'skipped';
  completed_at: string | null;
}

export interface OnboardingSession {
  tenant_id: string;
  archetype: string;
  status: 'not_started' | 'in_progress' | 'completed';
  current_step: string | null;
  completed_at: string | null;
}

export function useOnboardingSession() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['onboarding-session', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as OnboardingSession | null;
    },
  });
}

export function useOnboardingSteps(archetype: string | null) {
  return useQuery({
    queryKey: ['onboarding-steps', archetype],
    enabled: !!archetype,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_steps')
        .select('*')
        .eq('archetype', archetype!)
        .order('order_index');
      if (error) throw error;
      return (data ?? []) as OnboardingStep[];
    },
  });
}

export function useOnboardingProgress() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['onboarding-progress', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('step_key, status, completed_at')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return (data ?? []) as OnboardingProgress[];
    },
  });
}

export function useCompleteStep() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ step_key, action }: { step_key: string; action?: 'complete' | 'skip' }) => {
      const { data, error } = await supabase.functions.invoke('onboarding-step-complete', {
        body: { tenant_id: tenantId, step_key, action: action ?? 'complete' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding-progress', tenantId] });
      qc.invalidateQueries({ queryKey: ['onboarding-session', tenantId] });
    },
  });
}
