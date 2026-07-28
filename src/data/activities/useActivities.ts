/**
 * useActivities / useActivitiesForCalendar — Tenant-scoped activity reads.
 *
 * WHAT: Reads from `public.activities` joined with opportunity, contact,
 *       and metro lookups.
 * WHERE: Activities list, calendar surfaces, contact/opportunity timelines.
 * WHY: Centralized so cache keys and invalidation contracts stay consistent.
 *
 * Cache keys:
 *   - queryKeys.activities.list(tenantId) for the full list
 *   - ['activities-calendar', tenantId, startDate, endDate] for ranged reads
 * Legacy `['activities']` invalidations still match the list key.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRows } from '@/lib/supabaseRow';
import type { Database } from '@/integrations/supabase/types';

type ActivityType = Database['public']['Enums']['activity_type'];
type ActivityOutcome = Database['public']['Enums']['activity_outcome'];

export interface Activity {
  id: string;
  activity_id: string;
  activity_type: ActivityType;
  activity_date_time: string;
  outcome?: ActivityOutcome | null;
  notes?: string | null;
  next_action?: string | null;
  next_action_due?: string | null;
  opportunity_id?: string | null;
  metro_id?: string | null;
  contact_id?: string | null;
  google_calendar_event_id?: string | null;
  google_calendar_synced_at?: string | null;
  attended?: boolean | null;
  tenant_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  opportunities?: { organization: string; metros?: { metro: string } | null } | null;
  contacts?: { name: string; email?: string | null } | null;
  metros?: { metro: string } | null;
}

const SELECT = `
  *,
  opportunities (organization, metros (metro)),
  contacts!contact_id (name, email),
  metros (metro)
`;

export function useActivities() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: tenantId
      ? queryKeys.activities.list(tenantId)
      : (['activities', 'no-tenant'] as const),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(SELECT)
        .eq('tenant_id', tenantId!)
        .order('activity_date_time', { ascending: false });

      if (error) throw error;
      return supabaseRows<Activity>(data);
    },
  });
}

export function useActivitiesForCalendar(startDate: string, endDate: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['activities-calendar', tenantId ?? 'no-tenant', startDate, endDate] as const,
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(SELECT)
        .eq('tenant_id', tenantId!)
        .gte('activity_date_time', startDate)
        .lte('activity_date_time', endDate)
        .order('activity_date_time', { ascending: true });

      if (error) throw error;
      return supabaseRows<Activity>(data);
    },
  });
}
