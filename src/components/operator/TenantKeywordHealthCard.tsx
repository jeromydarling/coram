/**
 * TenantKeywordHealthCard — Gardener visibility into tenant keyword governance.
 *
 * WHAT: Shows keyword stack summary, last enrichment, and health signals across tenants.
 * WHERE: Gardener Nexus (SCIENTIA zone — insight & understanding).
 * WHY: Gardener observability into discovery personalization without touching tenant data.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, HelpCircle, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TenantKeywordSummary {
  tenant_id: string;
  tenant_name: string;
  keyword_count: number;
  source: string;
  archetype: string | null;
}

export function TenantKeywordHealthCard() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['gardener-keyword-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, search_keywords, search_keywords_source, archetype')
        .order('name');
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        tenant_id: t.id,
        tenant_name: t.name || 'Unnamed',
        keyword_count: Array.isArray(t.search_keywords) ? t.search_keywords.length : 0,
        source: t.search_keywords_source || 'none',
        archetype: t.archetype,
      })) as TenantKeywordSummary[];
    },
  });

  const enriched = tenants?.filter(t => t.source === 'enrichment' || t.source === 'both').length ?? 0;
  const manual = tenants?.filter(t => t.source === 'manual' || t.source === 'both').length ?? 0;
  const noKeywords = tenants?.filter(t => t.source === 'none' || t.keyword_count === 0).length ?? 0;
  const total = tenants?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Discovery Keyword Health</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Overview of how tenants have personalized their discovery feeds.</p>
                <p><strong>Where:</strong> Gardener Nexus — understanding ecosystem readiness.</p>
                <p><strong>Why:</strong> Tenants with enriched keywords get better discovery results.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-xs">
          A gentle view of keyword personalization across tenants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-primary/5">
                <div className="text-lg font-semibold text-primary">{enriched}</div>
                <div className="text-[10px] text-muted-foreground">Enriched</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-semibold">{manual}</div>
                <div className="text-[10px] text-muted-foreground">Manual</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className={`text-lg font-semibold ${noKeywords > 0 ? 'text-amber-600' : ''}`}>{noKeywords}</div>
                <div className="text-[10px] text-muted-foreground">No Keywords</div>
              </div>
            </div>

            {/* Tenant list */}
            {total > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tenants!.map((t) => (
                  <div key={t.tenant_id} className="flex items-center gap-2 text-xs py-1">
                    {t.keyword_count > 0 ? (
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 truncate">{t.tenant_name}</span>
                    {t.source !== 'none' && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 gap-0.5 shrink-0">
                        {t.source === 'enrichment' && <><Sparkles className="w-2 h-2" /> Auto</>}
                        {t.source === 'manual' && 'Manual'}
                        {t.source === 'both' && <><Sparkles className="w-2 h-2" /> Both</>}
                      </Badge>
                    )}
                    <span className="text-muted-foreground shrink-0">{t.keyword_count} kw</span>
                  </div>
                ))}
              </div>
            )}

            {total === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                No tenants found.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
