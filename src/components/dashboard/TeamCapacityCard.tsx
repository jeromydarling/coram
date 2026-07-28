/**
 * TeamCapacityCard — Calm team presence indicator.
 *
 * WHAT: Shows how many active team members are guiding the mission.
 * WHERE: Command Center dashboard sidebar (low prominence).
 * WHY: Reflects growth without billing pressure — stewardship, not quotas.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { planActiveCapacity } from '@/lib/features';

/** Roles that count toward active team capacity */
const COUNTED_ROLES = ['admin', 'steward', 'shepherd', 'companion'];

export function TeamCapacityCard() {
  const { t } = useTranslation('dashboard');
  const { subscription } = useTenant();

  const { data: activeCount } = useQuery({
    queryKey: ['team-capacity-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('user_roles' as any)
        .select('*', { count: 'exact', head: true })
        .in('role', COUNTED_ROLES);
      return count ?? 0;
    },
  });

  const currentPlan = subscription?.tiers?.[0] ?? 'core';
  const included = (planActiveCapacity as Record<string, number>)[currentPlan] ?? 10;
  const count = activeCount ?? 0;
  const overCapacity = count > included;

  return (
    <Card className="border-border/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-primary/60" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <p
                className="text-sm font-semibold text-foreground"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('teamCapacity.title')}
              </p>
              <HelpTooltip content={t('teamCapacity.tooltipContent')} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(count === 1 ? 'teamCapacity.companion_one' : 'teamCapacity.companion_other', { count })}
              <br />
              <span className="text-muted-foreground/70">
                {t('teamCapacity.visitorsWelcome')}
              </span>
            </p>

            {overCapacity && (
              <p
                className="text-xs text-muted-foreground/80 mt-2"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t('teamCapacity.overCapacity')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
