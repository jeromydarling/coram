import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPermissionState, hasActiveSubscription } from '@/lib/notifications';

interface NotificationSettings {
  user_id: string;
  push_enabled: boolean;
  notify_ai_bundles: boolean;
  notify_weekly_plan: boolean;
  notify_events: boolean;
  notify_post_event: boolean;
  notify_watchlist_signals: boolean;
  notify_campaign_suggestions: boolean;
  notify_event_enrichment: boolean;
  notify_campaign_summary: boolean;
  notify_automation_health: boolean;
  notify_meeting_notes: boolean;
  notify_daily_digest: boolean;
  notify_weekly_summary: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  quiet_hours_enabled: boolean;
  last_ai_bundles_notified_at: string | null;
  last_weekly_plan_notified_at: string | null;
  last_events_notified_at: string | null;
  last_post_event_notified_at: string | null;
  hourly_push_count: number;
  hourly_push_reset_at: string;
  daily_push_count: number;
  daily_push_reset_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the user's notification settings from the database
 */
export function useNotificationSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async (): Promise<NotificationSettings | null> => {
      const { data, error } = await supabase.functions.invoke('profunda-notify', {
        body: { mode: 'get-settings' },
      });

      if (error) {
        console.error('[useNotificationSettings] Error fetching settings:', error);
        throw error;
      }

      return data?.settings || null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Update notification settings (toggle preferences)
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<NotificationSettings, 
      'push_enabled' | 'notify_ai_bundles' | 'notify_weekly_plan' | 'notify_events' | 'notify_post_event' |
      'notify_watchlist_signals' | 'notify_campaign_suggestions' | 'notify_event_enrichment' |
      'notify_campaign_summary' | 'notify_automation_health' | 'notify_meeting_notes' | 'notify_daily_digest' | 'notify_weekly_summary'
    >>) => {
      const { data, error } = await supabase.functions.invoke('profunda-notify', {
        body: {
          mode: 'update-settings',
          ...updates,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings', user?.id] });
    },
  });
}

/**
 * Track the browser's push subscription state
 */
export function usePushSubscriptionState() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkState = async () => {
      setIsChecking(true);
      setPermission(getPermissionState());
      setHasSubscription(await hasActiveSubscription());
      setIsChecking(false);
    };

    checkState();

    // Re-check when permission might have changed (e.g., after enabling)
    const intervalId = setInterval(checkState, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const refresh = async () => {
    setPermission(getPermissionState());
    setHasSubscription(await hasActiveSubscription());
  };

  return {
    permission,
    hasSubscription,
    isChecking,
    refresh,
    isSupported: permission !== 'unsupported',
    isEnabled: permission === 'granted' && hasSubscription,
    isBlocked: permission === 'denied',
  };
}
