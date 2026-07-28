/**
 * LivingArchetypeStoryCard — Anonymized narrative signals from the ecosystem.
 *
 * WHAT: Displays aggregated, anonymized story text for a given archetype.
 * WHERE: Below "Week Inside CROS" on archetype deep pages.
 * WHY: Makes archetype pages living, self-updating story surfaces without exposing tenant data.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Feather } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface Props {
  archetypeKey: string;
}

export default function LivingArchetypeStoryCard({ archetypeKey }: Props) {
  const { t } = useTranslation('marketing');
  const { data: rollup, isLoading } = useQuery({
    queryKey: ['archetype-living-signal', archetypeKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('archetype_signal_rollups')
        .select('generated_story, period_start, period_end, tenant_sample_size, updated_at')
        .eq('archetype_key', archetypeKey)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as {
        generated_story: string;
        period_start: string;
        period_end: string;
        tenant_sample_size: number;
        updated_at: string;
      } | null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  // Don't render if no data or threshold not met
  if (isLoading || !rollup?.generated_story || rollup.tenant_sample_size < 5) {
    return null;
  }

  return (
    <section className="mb-12">
      <h2
        className="text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5 flex items-center gap-2"
        style={serif}
      >
        <Feather className="h-5 w-5 text-[hsl(var(--marketing-blue)/0.6)]" />
        {t('livingArchetypeStoryCard.heading')}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> {t('livingArchetypeStoryCard.tooltip.what')}</p>
              <p><strong>Where:</strong> {t('livingArchetypeStoryCard.tooltip.where')}</p>
              <p><strong>Why:</strong> {t('livingArchetypeStoryCard.tooltip.why')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h2>

      <Card className="border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))]">
        <CardContent className="p-6 sm:p-8">
          <p
            className="text-sm font-medium text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider mb-3"
          >
            {t('livingArchetypeStoryCard.recentMovement')}
          </p>
          <p
            className="text-base text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed"
            style={serif}
          >
            {rollup.generated_story}
          </p>
          <p className="text-xs text-[hsl(var(--marketing-navy)/0.3)] mt-5 italic">
            {t('livingArchetypeStoryCard.anonymizedNote')}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
