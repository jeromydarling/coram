/**
 * OperatorNarrativeEcosystem — Ecosystem Observatory for operators.
 *
 * WHAT: Dashboard showing archetype momentum, metro interest, narrative heatmap, and role trends.
 * WHERE: /operator/nexus/narrative-ecosystem
 * WHY: Operators see where the living ecosystem is growing without monitoring raw data.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, Layers, MapPin, TrendingUp, Users, Feather, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getGraphHealth } from '@/content/narrativeGraph';

function LivingArchetypeSignalsPanel() {
  const { data: rollups, isLoading } = useQuery({
    queryKey: ['nexus-archetype-rollups'],
    queryFn: async () => {
      const { data } = await supabase
        .from('archetype_signal_rollups')
        .select('archetype_key, period_end, tenant_sample_size, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  const latest = rollups?.[0];
  const archetypesUpdated = new Set((rollups || []).map((r: any) => r.archetype_key)).size;
  const suppressed = (rollups || []).filter((r: any) => r.tenant_sample_size < 5).length;

  return (
    <section>
      <h2 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
        <Feather className="h-4 w-4" />
        Living Archetype Signals
      </h2>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Rollup</p>
              <p className="text-sm font-medium font-serif">
                {latest?.updated_at ? new Date(latest.updated_at).toLocaleDateString() : 'Never'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Archetypes Updated</p>
              <p className="text-2xl font-semibold font-serif">{archetypesUpdated}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Suppressed (Low Sample)</p>
              <p className="text-2xl font-semibold font-serif">{suppressed}</p>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="mt-3">
        <Link to="/archetypes/church/deep">
          <Button variant="outline" size="sm" className="text-xs">
            <ExternalLink className="mr-1.5 h-3 w-3" /> Preview Archetype Stories
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Tip({ what, where, why }: { what: string; where: string; why: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
          <p><strong>What:</strong> {what}</p>
          <p><strong>Where:</strong> {where}</p>
          <p><strong>Why:</strong> {why}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NarrativeGraphHealthPanel() {
  const health = getGraphHealth();
  return (
    <section>
      <h2 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Narrative Graph Health
        <Tip
          what="Total nodes, edges, and orphans in the narrative knowledge graph."
          where="src/content/narrativeGraph.ts"
          why="Monitor graph connectivity for SEO authority."
        />
      </h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Nodes</p>
            <p className="text-2xl font-semibold font-serif">{health.totalNodes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Edges</p>
            <p className="text-2xl font-semibold font-serif">{health.totalEdges}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Orphan Nodes</p>
            <p className="text-2xl font-semibold font-serif">{health.orphanCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Connected Pages</p>
            <p className="text-2xl font-semibold font-serif">{health.totalNodes - health.orphanCount}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default function OperatorNarrativeEcosystem() {
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Lumen signals for heatmap
  const { data: lumenSignals, isLoading: l1 } = useQuery({
    queryKey: ['eco-lumen-signals'],
    queryFn: async () => {
      // TEMP TYPE ESCAPE — lumen_signals `status` column not in types.ts
      const { data } = await untypedTable('lumen_signals')
        .select('signal_type, severity, title, metro_id, tenant_id')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data ?? []) as any[];
    },
  });

  // Published metro pages
  const { data: publishedMetros, isLoading: l2 } = useQuery({
    queryKey: ['eco-metro-pages'],
    queryFn: async () => {
      const { data } = await supabase
        .from('public_metro_pages')
        .select('display_name, slug, archetypes_active, momentum_summary, status')
        .order('updated_at', { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  // Narrative stories published
  const { data: publishedStories, isLoading: l3 } = useQuery({
    queryKey: ['eco-published-stories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('narrative_stories')
        .select('title, slug, role, archetype, status')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  // Communio shared signals (7d)
  const { data: communioCount, isLoading: l4 } = useQuery({
    queryKey: ['eco-communio-7d'],
    queryFn: async () => {
      const { count } = await supabase
        .from('communio_shared_signals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', now7d);
      return count ?? 0;
    },
  });

  const isLoading = l1 || l2 || l3 || l4;

  // Aggregate archetype momentum from published metros
  const archetypeCounts: Record<string, number> = {};
  for (const m of publishedMetros || []) {
    if (Array.isArray(m.archetypes_active)) {
      for (const a of m.archetypes_active) {
        archetypeCounts[a] = (archetypeCounts[a] || 0) + 1;
      }
    }
  }
  const topArchetypes = Object.entries(archetypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  // Signal heatmap by type
  const signalTypeCounts: Record<string, number> = {};
  for (const s of lumenSignals || []) {
    signalTypeCounts[s.signal_type] = (signalTypeCounts[s.signal_type] || 0) + 1;
  }
  const topSignals = Object.entries(signalTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const publishedCount = (publishedMetros || []).filter((m: any) => m.status === 'published').length;
  const draftCount = (publishedMetros || []).filter((m: any) => m.status === 'draft').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">
          Narrative Ecosystem
          <Tip
            what="Living observatory of ecosystem momentum across archetypes, metros, and signals."
            where="/operator/nexus/narrative-ecosystem"
            why="See where stories, archetypes, and metros are gaining civic gravity."
          />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Where the ecosystem is breathing — patterns of movement across the network.
        </p>
      </div>

      {/* Top-level counts */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Published Metros</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">{draftCount} drafts</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Published Stories</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{publishedStories?.length ?? 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Communio Signals (7d)</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{communioCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Open Lumen Signals</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{lumenSignals?.length ?? 0}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Narrative Heatmap */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Signal Heatmap
          <Tip what="Distribution of open Lumen signals by type." where="lumen_signals" why="Shows where narrative energy concentrates." />
        </h2>
        {topSignals.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {topSignals.map(([type, count]) => (
              <Card key={type}>
                <CardContent className="pt-4 pb-3 flex items-center justify-between">
                  <span className="text-sm text-foreground capitalize">{type.replace(/_/g, ' ')}</span>
                  <Badge variant="outline" className="text-xs">{count}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="pt-5 pb-4 text-sm text-muted-foreground">No open signals right now.</CardContent></Card>
        )}
      </section>

      {/* Archetype Momentum */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Archetype Momentum
          <Tip what="Archetypes appearing most across published metro pages." where="public_metro_pages" why="Shows which mission types have the most civic gravity." />
        </h2>
        {topArchetypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topArchetypes.map(([arch, count]) => (
              <div key={arch} className="flex items-center gap-2 bg-muted rounded-full px-4 py-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">{arch}</span>
                <Badge variant="secondary" className="text-xs">{count} metros</Badge>
              </div>
            ))}
          </div>
        ) : (
          <Card><CardContent className="pt-5 pb-4 text-sm text-muted-foreground">No archetype data yet.</CardContent></Card>
        )}
      </section>

      {/* Metro Interest */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Metro Interest
          <Tip what="Published and draft metro pages." where="public_metro_pages" why="Track which metros attract public interest." />
        </h2>
        {(publishedMetros || []).length > 0 ? (
          <div className="space-y-2">
            {(publishedMetros || []).slice(0, 8).map((m: any) => (
              <Card key={m.slug} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{m.display_name}</span>
                  </div>
                  <Badge variant={m.status === 'published' ? 'default' : 'outline'} className="text-xs shrink-0">
                    {m.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="pt-5 pb-4 text-sm text-muted-foreground">No metro pages yet.</CardContent></Card>
        )}
      </section>

      {/* Published Stories */}
      {(publishedStories || []).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Published Stories
          </h2>
          <div className="space-y-2">
            {publishedStories.map((s: any) => (
              <Card key={s.slug}>
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate font-serif">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.role && <span className="capitalize">{s.role}</span>}
                      {s.role && s.archetype && ' · '}
                      {s.archetype && <span>{s.archetype}</span>}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Authority Engine Health */}
      <section>
        <h2 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Authority Engine Health
          <Tip
            what="Summary of narrative library pages and discovery pathways"
            where="Public marketing site content graph"
            why="Track how the narrative ecosystem supports organic discovery"
          />
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Week Stories</p>
              <p className="text-2xl font-semibold font-serif">5</p>
              <p className="text-xs text-muted-foreground mt-1">Visitor · Shepherd · Steward · Companion · Outreach</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Role Pathways</p>
              <p className="text-2xl font-semibold font-serif">4</p>
              <p className="text-xs text-muted-foreground mt-1">Shepherd · Companion · Visitor · Steward</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Library Concepts</p>
              <p className="text-2xl font-semibold font-serif">9</p>
              <p className="text-xs text-muted-foreground mt-1">Canonical civic language definitions</p>
            </CardContent>
          </Card>
        </div>
        <Card className="mt-4">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Discovery Pathways</p>
            <div className="space-y-1.5">
              <p className="text-sm text-foreground">/library → Roles → Week Stories → Onboarding</p>
              <p className="text-sm text-foreground">/archetypes → Week Stories → Role Pathways</p>
              <p className="text-sm text-foreground">/manifesto → NRI → Roles → Library</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Living Archetype Signals — Operator view */}
      <LivingArchetypeSignalsPanel />

      {/* Narrative Graph Health */}
      <NarrativeGraphHealthPanel />
    </div>
  );
}
