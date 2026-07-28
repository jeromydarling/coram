/**
 * TrustSignalBar — Reusable trust signal component.
 *
 * WHAT: Displays last backup, integration uptime, and last operator review.
 * WHERE: Marketing site footer + Operator Console header.
 * WHY: Builds trust by showing platform reliability without alarming language.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Clock, Activity } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface TrustSignalBarProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function TrustSignalBar({ variant = 'compact', className = '' }: TrustSignalBarProps) {
  const { data: signals } = useQuery({
    queryKey: ['trust-signals'],
    queryFn: async () => {
      // Last operator review (most recent system_health_event)
      const { data: healthEvent } = await supabase
        .from('system_health_events')
        .select('occurred_at, status')
        .eq('status', 'ok')
        .order('occurred_at', { ascending: false })
        .limit(1);

      // Last operator schedule run
      const { data: scheduleRun } = await supabase
        .from('operator_schedules')
        .select('last_run_at, last_status')
        .eq('last_status', 'ok')
        .order('last_run_at', { ascending: false })
        .limit(1);

      // Integration uptime (from operator_integration_health)
      const { data: integrations } = await supabase
        .from('operator_integration_health')
        .select('success_rate');

      const avgUptime = integrations && integrations.length > 0
        ? Math.round(integrations.reduce((s, i) => s + (i.success_rate ?? 100), 0) / integrations.length)
        : 100;

      return {
        lastBackup: healthEvent?.[0]?.occurred_at ?? null,
        integrationUptime: avgUptime,
        lastReview: scheduleRun?.[0]?.last_run_at ?? null,
      };
    },
    staleTime: 60_000,
  });

  if (!signals) return null;

  const items = [
    {
      icon: Clock,
      label: 'Last system check',
      value: signals.lastBackup
        ? formatDistanceToNow(new Date(signals.lastBackup), { addSuffix: true })
        : 'Pending',
    },
    {
      icon: Activity,
      label: 'Integration uptime',
      value: `${signals.integrationUptime}%`,
    },
    {
      icon: Shield,
      label: 'Last operator review',
      value: signals.lastReview
        ? formatDistanceToNow(new Date(signals.lastReview), { addSuffix: true })
        : 'Pending',
    },
  ];

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-4 text-xs text-muted-foreground ${className}`}>
        {items.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <item.icon className="h-3 w-3" />
            <span>{item.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-muted/30"
        >
          <item.icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium text-foreground">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
