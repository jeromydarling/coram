/**
 * OperatorNarrativePage — Operator Nexus Narrative Engine workflow.
 *
 * WHAT: Narrative health dashboard + conversion intelligence for operators.
 * WHERE: /operator/nexus/narrative
 * WHY: Operators need to see where stories are forming, role selections, and archetype interest.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Pause, RefreshCw, Users, Compass, MapPin, TrendingUp } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useState } from 'react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
const SectionTooltip = HelpTooltip;

export default function OperatorNarrativePage() {
  const [building, setBuilding] = useState(false);
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Threads created this week
  const { data: recentThreads, isLoading: l1 } = useQuery({
    queryKey: ['op-narrative-threads-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('narrative_threads' as any)
        .select('id, tenant_id, title, week_start, summary, scope')
        .gte('created_at', now7d)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  // Quiet week detection — tenants with no threads in 30 days
  const { data: threadsByTenant, isLoading: l2 } = useQuery({
    queryKey: ['op-narrative-thread-counts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('narrative_threads' as any)
        .select('tenant_id, week_start')
        .gte('created_at', now30d);
      return (data ?? []) as any[];
    },
  });

  // Moments created this week
  const { data: momentCount, isLoading: l3 } = useQuery({
    queryKey: ['op-narrative-moments-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('narrative_moments' as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', now7d);
      return count ?? 0;
    },
  });

  // Formation prompts active
  const { data: formationCount, isLoading: l4 } = useQuery({
    queryKey: ['op-formation-prompts-active'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from('formation_prompts' as any)
        .select('*', { count: 'exact', head: true })
        .or(`expires_at.is.null,expires_at.gt.${now}`);
      return count ?? 0;
    },
  });

  // Lumen signals for narrative movement
  const { data: lumenSignals } = useQuery({
    queryKey: ['op-narrative-lumen-signals'],
    queryFn: async () => {
      // TEMP TYPE ESCAPE — lumen_signals `status` column not in types.ts
      const { data } = await untypedTable('lumen_signals')
        .select('signal_type, severity, title, metro_id')
        .in('signal_type', ['narrative_surge', 'expansion_ready', 'drift_risk'])
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  // Metro interest from published pages
  const { data: publishedMetros } = useQuery({
    queryKey: ['op-narrative-metro-interest'],
    queryFn: async () => {
      const { data } = await supabase
        .from('public_metro_pages')
        .select('display_name, slug, status')
        .eq('status', 'published')
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  const isLoading = l1 || l2 || l3 || l4;
  const tenantsWithThreads = new Set((threadsByTenant || []).map((t: any) => t.tenant_id)).size;

  // Group lumen signals by type
  const narrativeSurges = (lumenSignals || []).filter((s: any) => s.signal_type === 'narrative_surge').length;
  const expansionReady = (lumenSignals || []).filter((s: any) => s.signal_type === 'expansion_ready').length;
  const driftRisks = (lumenSignals || []).filter((s: any) => s.signal_type === 'drift_risk').length;

  const handleBuildThreads = async () => {
    setBuilding(true);
    try {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id')
        .eq('status', 'active')
        .limit(50);

      let built = 0;
      for (const t of tenants || []) {
        const { error } = await supabase.functions.invoke('narrative-threads-build-weekly', {
          body: { tenant_id: t.id },
        });
        if (!error) built++;
      }
      toast.success(`Built threads for ${built} tenant(s)`);
    } catch {
      toast.error('Failed to build threads');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">
          Narrative Engine
          <SectionTooltip
            what="Narrative health + conversion intelligence dashboard."
            where="/operator/nexus/narrative"
            why="The Gardener observes where stories form, which roles attract visitors, and metro interest."
          />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stories emerge from what your tenants record. This space helps you notice where the story is forming — and where it has grown quiet.
        </p>
      </div>

      {/* Admin action */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBuildThreads} disabled={building}>
          <RefreshCw className={`w-3.5 h-3.5 ${building ? 'animate-spin' : ''}`} />
          Build Threads
        </Button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Threads This Week</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{recentThreads?.length || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Moments Collected</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{momentCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Active Tenants</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{tenantsWithThreads}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">Formation Prompts</p>
            <p className="text-2xl font-semibold text-foreground font-serif">{formationCount}</p>
          </CardContent></Card>
        </div>
      )}

      {/* Narrative Movement — Lumen signals */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Narrative Movement
          <SectionTooltip
            what="Lumen-derived signals showing narrative surges, expansion readiness, and drift."
            where="Aggregated from lumen_signals."
            why="See where narrative energy is rising or fading."
          />
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs text-muted-foreground">Narrative Surges</p>
            </div>
            <p className="text-xl font-semibold text-foreground font-serif">{narrativeSurges}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs text-muted-foreground">Expansion Ready</p>
            </div>
            <p className="text-xl font-semibold text-foreground font-serif">{expansionReady}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-destructive" />
              <p className="text-xs text-muted-foreground">Drift Risks</p>
            </div>
            <p className="text-xl font-semibold text-foreground font-serif">{driftRisks}</p>
          </CardContent></Card>
        </div>
      </section>

      {/* Metro Interest */}
      {publishedMetros && publishedMetros.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Published Metro Pages
            <SectionTooltip
              what="Metros with published public narrative pages."
              where="From public_metro_pages."
              why="See which metros are attracting public interest."
            />
          </h2>
          <div className="flex gap-2 flex-wrap">
            {publishedMetros.map((m: any) => (
              <Badge key={m.slug} variant="outline" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" /> {m.display_name}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Recent Threads */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Recent Threads
        </h2>
        {l1 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : recentThreads && recentThreads.length > 0 ? (
          <div className="space-y-2">
            {recentThreads.map((thread: any) => (
              <Card key={thread.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate font-serif">{thread.title}</p>
                        <Badge variant="outline" className="text-xs shrink-0">{thread.scope}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 ml-5.5">{thread.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <Pause className="w-4 h-4" />
              <p className="text-sm">No threads created this week yet.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
