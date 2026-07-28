/**
 * LocalPulseHealthPanel — Discovery health metrics for the AI Observatory.
 *
 * WHAT: Shows Local Pulse discovery reliability, domain filtering, dedupe, and parse stats.
 * WHERE: Embedded in AIObservatoryPage (MACHINA zone).
 * WHY: Gardener needs calm, observable confidence in discovery pipeline health.
 *
 * Feature Name: Local Pulse Health Panel
 * Primary Purpose: Discovery pipeline observability
 * Chosen Zone: MACHINA
 * Why this Zone: System engine monitoring — pipeline reliability
 * Why NOT others: Not daily stewardship (CURA), not growth (CRESCERE)
 * Operator Impact: Confidence in discovery quality and resilience
 * Navigation Location: /operator/machina/ai-observatory (embedded)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Radio, Shield, Search, Filter, Copy, FlaskConical, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calmText } from '@/lib/calmMode';

interface PulseHealthStats {
  totalDiscoveryResults: number;
  parseFailures: number;
  citationsFallbacks: number;
  domainsRejected: number;
  dedupesPrevented: number;
  runsThisMonth: number;
  lastRunExplain: string | null;
}

function useLocalPulseHealth() {
  return useQuery({
    queryKey: ['local-pulse-health'],
    queryFn: async (): Promise<PulseHealthStats> => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: runs } = await supabase
        .from('local_pulse_runs')
        .select('stats, status, completed_at')
        .gte('created_at', monthStart)
        .order('completed_at', { ascending: false })
        .limit(100);

      let totalDiscovery = 0, parseFailures = 0, citationsFallbacks = 0;
      let domainsRejected = 0, dedupesPrevented = 0;

      for (const run of runs ?? []) {
        const s = run.stats as Record<string, number | boolean> | null;
        if (!s) continue;
        totalDiscovery += (s.auto_discovery_results as number) || 0;
        parseFailures += (s.perplexity_parse_failures as number) || 0;
        citationsFallbacks += (s.perplexity_citations_fallback as number) || 0;
        domainsRejected += (s.domains_rejected as number) || 0;
        dedupesPrevented += (s.dedupe_prevented as number) || 0;
      }

      // Build last run explanation
      const lastRun = (runs ?? [])[0];
      let lastRunExplain: string | null = null;
      if (lastRun?.stats) {
        const ls = lastRun.stats as Record<string, unknown>;
        const parts: string[] = [];
        const discovered = (ls.auto_discovery_results as number) || 0;
        const inserted = (ls.events_inserted as number) || 0;
        parts.push(`Found ${discovered} items, inserted ${inserted}.`);
        if ((ls.perplexity_parse_failures as number) > 0) {
          parts.push(`Some results required fallback parsing.`);
        }
        if ((ls.dedupe_prevented as number) > 0) {
          parts.push(`${ls.dedupe_prevented} duplicates were caught.`);
        }
        if (ls.long_tail_included) {
          parts.push(`Included a long-tail refresh for stable services.`);
        }
        if (ls.dry_run) {
          parts.push(`This was a dry run — no data was inserted.`);
        }
        lastRunExplain = parts.join(' ');
      }

      return {
        totalDiscoveryResults: totalDiscovery,
        parseFailures,
        citationsFallbacks,
        domainsRejected,
        dedupesPrevented,
        runsThisMonth: (runs ?? []).length,
        lastRunExplain,
      };
    },
    staleTime: 60_000,
  });
}

function useDryRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (metroId: string) => {
      const { data, error } = await supabase.functions.invoke('local-pulse-worker', {
        body: { metro_id: metroId, dry_run: true, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['local-pulse-health'] });
      const sampleCount = data?.sample?.length ?? 0;
      toast.success(`Dry run complete — ${sampleCount} sample results found`);
    },
    onError: () => toast.error(calmText('Failed')),
  });
}

function StatRow({ label, value, secondary }: { label: string; value: number | string; secondary?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums">{value}</span>
        {secondary && <span className="text-xs text-muted-foreground">({secondary})</span>}
      </div>
    </div>
  );
}

export function LocalPulseHealthPanel() {
  const { data, isLoading } = useLocalPulseHealth();
  const dryRun = useDryRun();
  const [showExplain, setShowExplain] = useState(false);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  const parsePct = data.runsThisMonth > 0
    ? Math.round((data.parseFailures / Math.max(data.runsThisMonth, 1)) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="h-4 w-4" />
          Local Pulse Discovery Health
          <HelpTooltip
            content="Tracks discovery pipeline quality: how many results are ingested, filtered, and how resilient the parsing is."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-md border p-3 text-center">
            <Search className="h-3.5 w-3.5 mx-auto text-primary mb-1" />
            <p className="text-lg font-semibold tabular-nums">{data.totalDiscoveryResults}</p>
            <p className="text-[10px] text-muted-foreground">Results ingested</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <Shield className="h-3.5 w-3.5 mx-auto text-primary mb-1" />
            <p className="text-lg font-semibold tabular-nums">{data.parseFailures}</p>
            <p className="text-[10px] text-muted-foreground">Parse fallbacks ({parsePct}%)</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <Filter className="h-3.5 w-3.5 mx-auto text-primary mb-1" />
            <p className="text-lg font-semibold tabular-nums">{data.domainsRejected}</p>
            <p className="text-[10px] text-muted-foreground">Domains rejected</p>
          </div>
        </div>

        <div className="space-y-0.5">
          <StatRow label="Citations-only fallbacks" value={data.citationsFallbacks} />
          <StatRow label="Dedupe prevented inserts" value={data.dedupesPrevented} />
          <StatRow label="Runs this month" value={data.runsThisMonth} />
        </div>

        {/* Explain drawer */}
        {data.lastRunExplain && (
          <Collapsible open={showExplain} onOpenChange={setShowExplain}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground justify-between h-7">
                <span>What happened last run?</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showExplain ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2 mt-1">
                {data.lastRunExplain}
              </p>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Dry Run button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1.5"
          onClick={() => {
            // For now, trigger without metro_id (will use user's home metro)
            dryRun.mutate('');
          }}
          disabled={dryRun.isPending}
        >
          <FlaskConical className="h-3 w-3" />
          {dryRun.isPending ? 'Running dry test...' : 'Test Run (Dry)'}
        </Button>
        {dryRun.data?.sample && (
          <ScrollArea className="max-h-40 mt-2">
            <div className="space-y-1">
              {(dryRun.data.sample as Array<{ title: string; date: string; url: string }>).map((s, i) => (
                <div key={i} className="text-[11px] border-b pb-1 last:border-b-0">
                  <p className="font-medium truncate">{s.title}</p>
                  <p className="text-muted-foreground">{s.date || 'No date'}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
