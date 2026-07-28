/**
 * ArrivalGuidanceCard — Dynamic operator guidance checklist for new tenant arrivals.
 *
 * WHAT: Context-aware suggestions based on tenant archetype, activation status, and features.
 * WHERE: /operator/nexus/arrival
 * WHY: Helps operator know exactly what stewardship action to take next.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';

interface GuidanceItem {
  label: string;
  met: boolean;
}

interface ArrivalGuidanceCardProps {
  archetype: string | null;
  activationScheduled: boolean;
  hasConnectors: boolean;
  communioEnabled: boolean;
}

export function ArrivalGuidanceCard({
  archetype,
  activationScheduled,
  hasConnectors,
  communioEnabled,
}: ArrivalGuidanceCardProps) {
  const items: GuidanceItem[] = [];

  if (!activationScheduled) {
    items.push({ label: 'Invite them to Guided Activation', met: false });
  } else {
    items.push({ label: 'Guided Activation session scheduled', met: true });
  }

  if (hasConnectors) {
    items.push({ label: 'Prepare Migration Workspace', met: false });
  }

  if (archetype === 'church' || archetype === 'faith_community') {
    items.push({ label: 'Encourage Shepherd role setup', met: false });
  }

  if (communioEnabled) {
    items.push({ label: 'Recommend joining a Communio network', met: false });
  }

  // Always suggest a welcome
  items.push({ label: 'Send a personal welcome message', met: false });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Operator Guidance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm">
            {item.met ? (
              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <span className={item.met ? 'text-muted-foreground line-through' : 'text-foreground'}>
              {item.label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
