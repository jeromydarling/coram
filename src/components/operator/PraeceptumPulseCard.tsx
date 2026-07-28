/**
 * PraeceptumPulseCard — Narrative insight card for Operator Nexus home.
 *
 * WHAT: Shows gentle narrative about what Praeceptum has learned this week.
 * WHERE: Operator Nexus home page.
 * WHY: Surfaces learning insights without data overload — narrative tone only.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function PraeceptumPulseCard() {
  const { data: stats } = useQuery({
    queryKey: ['praeceptum-pulse-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('praeceptum_guidance_memory')
        .select('prompt_key, context, confidence_score, intervention_count, resolution_count, friction_after_count')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) return null;
      return data as any[];
    },
  });

  if (!stats || stats.length === 0) return null;

  const totalInterventions = stats.reduce((s: number, r: any) => s + (r.intervention_count || 0), 0);
  const totalResolutions = stats.reduce((s: number, r: any) => s + (r.resolution_count || 0), 0);

  // Find best performing context
  const contextMap = new Map<string, { resolutions: number; interventions: number }>();
  stats.forEach((r: any) => {
    const entry = contextMap.get(r.context) || { resolutions: 0, interventions: 0 };
    entry.resolutions += r.resolution_count || 0;
    entry.interventions += r.intervention_count || 0;
    contextMap.set(r.context, entry);
  });

  let bestContext = '';
  let bestRate = 0;
  contextMap.forEach((val, key) => {
    const rate = val.interventions > 0 ? val.resolutions / val.interventions : 0;
    if (rate > bestRate) {
      bestRate = rate;
      bestContext = key;
    }
  });

  const narrativeLines: string[] = [];
  if (totalResolutions > 0) {
    narrativeLines.push(
      `Guidance has helped ${totalResolutions} time${totalResolutions > 1 ? 's' : ''} across ${stats.length} learned prompt${stats.length > 1 ? 's' : ''}.`,
    );
  }
  if (bestContext) {
    narrativeLines.push(
      `${bestContext.charAt(0).toUpperCase() + bestContext.slice(1)} shows the strongest response to guidance (${Math.round(bestRate * 100)}% resolution).`,
    );
  }
  if (narrativeLines.length === 0) {
    narrativeLines.push('Praeceptum is still gathering experience — wisdom takes time.');
  }

  return (
    <Card className="border-border/40">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Praeceptum
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                    <p><strong>What:</strong> Living guidance memory insights</p>
                    <p><strong>Where:</strong> Praeceptum guidance memory table</p>
                    <p><strong>Why:</strong> Shows which guidance prompts help humans most</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {narrativeLines.map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed font-serif">
                {line}
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
