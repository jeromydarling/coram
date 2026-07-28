/**
 * FamiliaStewardshipCard — Gentle narrative card showing aggregated Familia stewardship patterns.
 *
 * WHAT: Displays anonymized care trends from Familia members who opted in.
 * WHERE: Prōvīsiō standalone page or embedded provision surfaces.
 * WHY: "Your work contributes to a wider story" — encouragement, not comparison.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useFamiliaStatus } from '@/hooks/useFamilia';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface RollupRow {
  familia_id: string;
  metro_id: string | null;
  period: string;
  resource_category: string;
  care_count: number;
  participants_count: number;
}

export function FamiliaStewardshipCard() {
  const { t } = useTranslation('provisions');
  const { tenant } = useTenant();
  const { data: familiaStatus } = useFamiliaStatus();
  const familiaId = tenant?.familia_id;

  const { data: rollups = [], isLoading } = useQuery({
    queryKey: ['familia-provision-rollups', familiaId],
    enabled: !!familiaId && !!familiaStatus?.isInFamilia,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('familia_provision_rollups')
        .select('*')
        .eq('familia_id', familiaId)
        .order('period', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as RollupRow[];
    },
    refetchInterval: 10 * 60_000,
  });

  // Only render when tenant is in a Familia
  if (!familiaStatus?.isInFamilia) return null;

  const totalCare = rollups.reduce((sum, r) => sum + r.care_count, 0);
  const totalParticipants = rollups.reduce((sum, r) => sum + r.participants_count, 0);

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{t('familiaStewardship.cardTitle')}</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> {t('familiaStewardship.tooltipWhat')}</p>
              <p><strong>Where:</strong> {t('familiaStewardship.tooltipWhere')}</p>
              <p><strong>Why:</strong> {t('familiaStewardship.tooltipWhy')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          {t('familiaStewardship.cardDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('familiaStewardship.loading')}</p>
        ) : rollups.length === 0 ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{t('familiaStewardship.emptyState')}</p>
            <p className="text-xs italic">{t('familiaStewardship.emptyStateNote')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {t('familiaStewardship.peopleBadge', { count: totalParticipants })}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {t('familiaStewardship.momentsBadge', { count: totalCare })}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('familiaStewardship.narrative', { care: totalCare, participants: totalParticipants })}
            </p>

            <p className="text-xs text-muted-foreground italic">
              {t('familiaStewardship.anonymizedNote')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
