/**
 * useVigilia — React hooks for the Vigilia awareness layer.
 *
 * WHAT: Wraps vigilia.ts queries in React Query for UI consumption.
 * WHERE: Used by Daily Rhythm, Presence, Activation, Crescere, Machina pages.
 * WHY: Gentle, cached awareness that refreshes every 5 minutes.
 */
import { useQuery } from '@tanstack/react-query';
import {
  getOperatorAwarenessSummary,
  getActivationWatchSignals,
  getGrowthWatchSignals,
  getSystemWatchSignals,
} from '@/lib/operator/vigilia';

const STALE_TIME = 1000 * 60 * 5; // 5 minutes
const REFETCH = 1000 * 60 * 10;   // 10 minutes

export function useVigiliaOverview() {
  return useQuery({
    queryKey: ['vigilia-overview'],
    queryFn: getOperatorAwarenessSummary,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH,
  });
}

export function useVigiliaActivation() {
  return useQuery({
    queryKey: ['vigilia-activation'],
    queryFn: getActivationWatchSignals,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH,
  });
}

export function useVigiliaGrowth() {
  return useQuery({
    queryKey: ['vigilia-growth'],
    queryFn: getGrowthWatchSignals,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH,
  });
}

export function useVigiliaSystem() {
  return useQuery({
    queryKey: ['vigilia-system'],
    queryFn: getSystemWatchSignals,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH,
  });
}
