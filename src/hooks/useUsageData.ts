import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UsageDailyRow {
  usage_date: string;
  workflow_key: string;
  total_quantity: number;
  unit: string;
  event_count: number;
}

export interface UsageByWorkflow {
  workflow_key: string;
  total_quantity: number;
  event_count: number;
}

export interface UsageByUnit {
  unit: string;
  total_quantity: number;
  event_count: number;
}

/**
 * Daily usage breakdown by workflow for charts & dashboard.
 */
export function useUsageDailyByOrg(windowDays: number = 30) {
  return useQuery<UsageDailyRow[]>({
    queryKey: ['usage-daily', windowDays],
    queryFn: async () => {
      const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('usage_events')
        .select('workflow_key, quantity, unit, occurred_at')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: true });
      if (error) throw error;

      // Aggregate client-side by date + workflow
      const map = new Map<string, UsageDailyRow>();
      for (const row of data ?? []) {
        const date = (row.occurred_at as string).slice(0, 10);
        const key = `${date}|${row.workflow_key}`;
        const existing = map.get(key);
        if (existing) {
          existing.total_quantity += Number(row.quantity) || 0;
          existing.event_count += 1;
        } else {
          map.set(key, {
            usage_date: date,
            workflow_key: row.workflow_key,
            total_quantity: Number(row.quantity) || 0,
            unit: row.unit ?? 'count',
            event_count: 1,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.usage_date.localeCompare(b.usage_date));
    },
    staleTime: 60_000,
  });
}

/**
 * Usage aggregated by workflow key.
 */
export function useUsageByWorkflow(windowDays: number = 30) {
  return useQuery<UsageByWorkflow[]>({
    queryKey: ['usage-by-workflow', windowDays],
    queryFn: async () => {
      const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('usage_events')
        .select('workflow_key, quantity')
        .gte('occurred_at', since);
      if (error) throw error;

      const map = new Map<string, UsageByWorkflow>();
      for (const row of data ?? []) {
        const key = row.workflow_key;
        const existing = map.get(key);
        if (existing) {
          existing.total_quantity += Number(row.quantity) || 0;
          existing.event_count += 1;
        } else {
          map.set(key, {
            workflow_key: key,
            total_quantity: Number(row.quantity) || 0,
            event_count: 1,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.total_quantity - a.total_quantity);
    },
    staleTime: 60_000,
  });
}

/**
 * Usage aggregated by unit type (pages, tokens, signals, etc.)
 */
export function useUsageByUnit(windowDays: number = 30) {
  return useQuery<UsageByUnit[]>({
    queryKey: ['usage-by-unit', windowDays],
    queryFn: async () => {
      const since = new Date(Date.now() - windowDays * 86400 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('usage_events')
        .select('unit, quantity')
        .gte('occurred_at', since);
      if (error) throw error;

      const map = new Map<string, UsageByUnit>();
      for (const row of data ?? []) {
        const u = row.unit ?? 'count';
        const existing = map.get(u);
        if (existing) {
          existing.total_quantity += Number(row.quantity) || 0;
          existing.event_count += 1;
        } else {
          map.set(u, {
            unit: u,
            total_quantity: Number(row.quantity) || 0,
            event_count: 1,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.total_quantity - a.total_quantity);
    },
    staleTime: 60_000,
  });
}

/**
 * Current month usage totals for billing readiness.
 */
export function useCurrentMonthUsage() {
  return useQuery({
    queryKey: ['usage-current-month'],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from('usage_events')
        .select('workflow_key, quantity, unit')
        .gte('occurred_at', monthStart);
      if (error) throw error;

      let totalEvents = 0;
      let totalQuantity = 0;
      const byWorkflow = new Map<string, number>();
      const byUnit = new Map<string, number>();

      for (const row of data ?? []) {
        const qty = Number(row.quantity) || 0;
        totalEvents += 1;
        totalQuantity += qty;
        byWorkflow.set(row.workflow_key, (byWorkflow.get(row.workflow_key) ?? 0) + qty);
        byUnit.set(row.unit ?? 'count', (byUnit.get(row.unit ?? 'count') ?? 0) + qty);
      }

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const projectedTotal = dayOfMonth > 0 ? Math.round((totalQuantity / dayOfMonth) * daysInMonth) : 0;

      return {
        totalEvents,
        totalQuantity,
        projectedTotal,
        daysInMonth,
        dayOfMonth,
        byWorkflow: Object.fromEntries(byWorkflow),
        byUnit: Object.fromEntries(byUnit),
      };
    },
    staleTime: 120_000,
  });
}
