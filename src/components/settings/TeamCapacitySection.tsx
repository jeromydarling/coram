/**
 * TeamCapacitySection — Settings page capacity explanation.
 *
 * WHAT: Shows included capacity, expansion blocks, and human-language explanation.
 * WHERE: Settings page, below subscription card.
 * WHY: Helps admins understand their capacity without billing pressure.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Users } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { planActiveCapacity } from '@/lib/features';

export function TeamCapacitySection() {
  const { subscription } = useTenant();

  const currentPlan = subscription?.tiers?.[0] ?? 'core';
  const included = (planActiveCapacity as Record<string, number>)[currentPlan] ?? 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Capacity
          <HelpTooltip content="Your active team capacity — stewards, shepherds, companions, and admins. Visitors, volunteers, and imported contacts are never counted." />
        </CardTitle>
        <CardDescription
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Capacity reflects your guiding team —
          not the number of people you serve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Included with {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</span>
          <span className="font-medium">{included} active members</span>
        </div>

        <p className="text-xs text-muted-foreground/70 pt-2 leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Visitors, volunteers, imported contacts, and email senders are always welcome
          and never count toward your capacity.
        </p>
      </CardContent>
    </Card>
  );
}
