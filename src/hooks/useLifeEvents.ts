/**
 * useLifeEvents — CRUD hook for life events on a Person.
 *
 * WHAT: Fetches, creates, and deletes life events for a given person.
 * WHERE: PersonDetail page, Life Events section.
 * WHY: Narrative ontology — structured seasons of life shape relational memory.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

export interface LifeEvent {
  id: string;
  tenant_id: string;
  person_id: string;
  event_type: string;
  event_date: string;
  title: string | null;
  description: string | null;
  visibility: string;
  created_by: string | null;
  created_at: string;
  event_month: number | null;
  event_day: number | null;
  event_year: number | null;
  notify_enabled: boolean | null;
  remind_enabled: boolean | null;
  remind_rule: string | null;
  remind_at: string | null;
  last_reminded_at: string | null;
}

export const LIFE_EVENT_TYPES = [
  { value: 'birthday', label: 'Birthday', compass: 'south' as const, allowNoYear: true },
  { value: 'marriage', label: 'Marriage', compass: 'north' as const },
  { value: 'birth', label: 'Birth', compass: 'south' as const },
  { value: 'adoption', label: 'Adoption', compass: 'south' as const },
  { value: 'graduation', label: 'Graduation', compass: 'north' as const },
  { value: 'ordination', label: 'Ordination', compass: 'north' as const },
  { value: 'retirement', label: 'Retirement', compass: 'west' as const },
  { value: 'anniversary', label: 'Anniversary', compass: 'north' as const },
  { value: 'milestone', label: 'Milestone', compass: 'east' as const },
  { value: 'breakthrough', label: 'Breakthrough', compass: 'east' as const },
  { value: 'recovery_milestone', label: 'Recovery Milestone', compass: 'east' as const },
  { value: 'spiritual_milestone', label: 'Spiritual Milestone', compass: 'north' as const },
  { value: 'celebration', label: 'Celebration', compass: 'north' as const },
  { value: 'major_transition', label: 'Major Transition', compass: 'west' as const },
  { value: 'sobriety_milestone', label: 'Sobriety Milestone', compass: 'east' as const },
  { value: 'relapse', label: 'Relapse', compass: 'west' as const, sensitive: true, noAutoNotify: true },
  { value: 'hospitalization', label: 'Hospitalization', compass: 'south' as const, sensitive: true },
  { value: 'recovery', label: 'Recovery', compass: 'east' as const },
  { value: 'care_completed', label: 'Care Completed', compass: 'west' as const },
  { value: 'death', label: 'Death', compass: 'west' as const, sensitive: true, noAutoNotify: true },
] as const;

/** Default remind rule per event type */
export function defaultRemindRule(eventType: string): string | null {
  switch (eventType) {
    case 'birthday': return 'annual';
    case 'sobriety_milestone': return 'annual';
    case 'marriage': return 'annual';
    case 'ordination': return 'annual';
    case 'graduation': return 'annual';
    default: return null;
  }
}

export const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private — only you' },
  { value: 'tenant_only', label: 'Organization — your team' },
  { value: 'familia_aggregate', label: 'Familia — anonymized patterns' },
  { value: 'communio_aggregate', label: 'Communio — anonymized patterns' },
] as const;

/** Default visibility per event type. */
export function defaultVisibility(eventType: string): string {
  switch (eventType) {
    case 'relapse': return 'private';
    case 'death': return 'tenant_only';
    case 'hospitalization': return 'private';
    default: return 'tenant_only';
  }
}

export function useLifeEvents(personId: string | undefined, entityType: 'person' | 'partner' = 'person') {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const entityId = personId;
  const queryKey = ['life-events', entityType, entityId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!entityId || !tenantId) return [];

      if (entityType === 'person') {
        // Query by person_id for backward compat with legacy data
        const { data, error } = await supabase
          .from('life_events')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('person_id', entityId)
          .order('event_date', { ascending: false });
        if (error) throw error;
        return (data ?? []) as LifeEvent[];
      } else {
        // Partner or future entity types — use canonical entity_type/entity_id
        const q = supabase
          .from('life_events')
          .select('*')
          .eq('tenant_id', tenantId) as any;
        const { data, error } = await q
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('event_date', { ascending: false });
        if (error) throw error;
        return (data ?? []) as LifeEvent[];
      }
    },
    enabled: !!entityId && !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      event_type: string;
      event_date: string;
      title?: string;
      description?: string;
      visibility: string;
      event_month?: number | null;
      event_day?: number | null;
      event_year?: number | null;
      notify_enabled?: boolean | null;
      remind_enabled?: boolean | null;
      remind_rule?: string | null;
    }) => {
      if (!entityId || !tenantId) throw new Error('Missing context');
      const { data: { user } } = await supabase.auth.getUser();
      const insertPayload: any = {
        tenant_id: tenantId,
        person_id: entityType === 'person' ? entityId : null,
        entity_type: entityType,
        entity_id: entityId,
        event_type: input.event_type,
        event_date: input.event_date,
        title: input.title || null,
        description: input.description || null,
        visibility: input.visibility,
        created_by: user?.id ?? null,
        event_month: input.event_month ?? null,
        event_day: input.event_day ?? null,
        event_year: input.event_year ?? null,
        notify_enabled: input.notify_enabled ?? null,
        remind_enabled: input.remind_enabled ?? null,
        remind_rule: input.remind_rule ?? null,
      };
      const { error } = await supabase.from('life_events').insert(insertPayload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Life event recorded');
    },
    onError: () => toast.error('Could not save life event'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from('life_events').delete().eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Life event removed');
    },
    onError: () => toast.error('Could not remove life event'),
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    remove: deleteMutation.mutateAsync,
  };
}
