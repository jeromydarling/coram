/**
 * ArrivalSignalsPanel — Readiness signals for a newly arrived tenant.
 *
 * WHAT: Shows activation readiness, migration likelihood, engagement, and confusion risk.
 * WHERE: /operator/nexus/arrival
 * WHY: Gives operator a calm pulse-read on the new tenant's early trajectory.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface SignalRow {
  label: string;
  status: 'settling' | 'guidance' | 'ready';
}

interface ArrivalSignalsPanelProps {
  activationReady: boolean;
  hasConnectors: boolean;
  earlyEngagement: number; // 0-100
  daysInactive: number;
}

function signalBadge(status: 'settling' | 'guidance' | 'ready') {
  const map = {
    settling: { label: 'Settling In', variant: 'outline' as const },
    guidance: { label: 'Needs Guidance', variant: 'secondary' as const },
    ready: { label: 'Ready for Expansion', variant: 'default' as const },
  };
  const s = map[status];
  return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
}

export function ArrivalSignalsPanel({
  activationReady,
  hasConnectors,
  earlyEngagement,
  daysInactive,
}: ArrivalSignalsPanelProps) {
  const signals: SignalRow[] = [
    {
      label: 'Activation Readiness',
      status: activationReady ? 'ready' : 'guidance',
    },
    {
      label: 'Migration Likelihood',
      status: hasConnectors ? 'guidance' : 'settling',
    },
    {
      label: 'Early Engagement',
      status: earlyEngagement > 40 ? 'ready' : earlyEngagement > 10 ? 'settling' : 'guidance',
    },
    {
      label: 'Confusion Risk',
      status: daysInactive >= 3 ? 'guidance' : 'settling',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Readiness Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{s.label}</span>
            {signalBadge(s.status)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
