/**
 * OperatorExpansionWatch — Monitor tenant metro expansion activity.
 *
 * WHAT: Shows expansion watch entries, metro expansion plans, and expansion signals.
 * WHERE: /operator/nexus/expansion
 * WHY: Operators need to monitor geographic growth across all tenants.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { toast } from '@/components/ui/sonner';
import { TrendingUp, MapPin, AlertTriangle, Plus, Globe, ExternalLink } from 'lucide-react';
import { MISSION_ATLAS, getCoveredArchetypes, getUncoveredArchetypes, getArchetypeDisplay } from '@/content/missionAtlas';
import { ARCHETYPE_GRAPH } from '@/content/narrativeGraph';

const PHASES = ['considering', 'scouting', 'first_presence', 'early_relationships', 'community_entry'] as const;
const RISK_LEVELS = ['low', 'medium', 'high'] as const;

const riskColors: Record<string, string> = {
  low: 'text-green-700 dark:text-green-300',
  medium: 'text-amber-700 dark:text-amber-300',
  high: 'text-red-700 dark:text-red-300',
};

export default function OperatorExpansionWatch() {
  const { activeTab, setActiveTab } = useTabPersistence('watch');
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Operator expansion watch entries
  const { data: watchEntries, isLoading: watchLoading } = useQuery({
    queryKey: ['nexus-expansion-watch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_expansion_watch' as any)
        .select('*, tenants:tenant_id(name), metros:metro_id(metro)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Metro expansion plans (tenant-created)
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['nexus-expansion-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_expansion_plans')
        .select('*, tenants:tenant_id(name), metros:metro_id(metro)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recent expansion signals
  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['nexus-expansion-signals'],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('expansion_signals')
        .select('*, tenants:tenant_id(name), metros:metro_id(metro)')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRiskMutation = useMutation({
    mutationFn: async ({ id, risk_level }: { id: string; risk_level: string }) => {
      const { error } = await supabase
        .from('operator_expansion_watch' as any)
        .update({ risk_level, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nexus-expansion-watch'] });
      toast.success('Risk level updated');
    },
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Expansion Watch</h1>
        <p className="text-sm text-muted-foreground">
          Watching where new roots are forming.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="watch" className="whitespace-nowrap">Garden Watch</TabsTrigger>
            <TabsTrigger value="plans" className="whitespace-nowrap">Tenant Plans</TabsTrigger>
            <TabsTrigger value="signals" className="whitespace-nowrap">Signals (14d)</TabsTrigger>
          </TabsList>
        </div>

        {/* Watch */}
        <TabsContent value="watch" className="mt-4">
          {watchLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !watchEntries?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No expansion entries being watched. They are created as tenants begin exploring new metros.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {watchEntries.map((w: any) => (
                <Card key={w.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{w.tenants?.name || 'Unknown'}</p>
                          <span className="text-xs text-muted-foreground">→</span>
                          <p className="text-sm text-foreground">{w.metros?.metro || 'Unknown metro'}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{w.phase?.replace(/_/g, ' ')}</Badge>
                          <Badge variant="outline" className={`text-xs capitalize ${riskColors[w.risk_level] || ''}`}>
                            {w.risk_level === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {w.risk_level} risk
                          </Badge>
                        </div>
                        {w.notes && <p className="text-xs text-muted-foreground mt-1">{w.notes}</p>}
                      </div>
                      <Select value={w.risk_level} onValueChange={(v) => updateRiskMutation.mutate({ id: w.id, risk_level: v })}>
                        <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RISK_LEVELS.map((r) => <SelectItem key={r} value={r} className="capitalize text-xs">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Plans */}
        <TabsContent value="plans" className="mt-4">
          {plansLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !plans?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No tenant expansion plans found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {plans.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
                        <TrendingUp className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{p.tenants?.name || 'Unknown'}</p>
                          <span className="text-xs text-muted-foreground">→</span>
                          <p className="text-sm text-foreground">{p.metros?.metro || 'Unknown metro'}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{p.priority} priority</Badge>
                        </div>
                        {p.target_launch_date && (
                          <p className="text-xs text-muted-foreground mt-1">Target: {new Date(p.target_launch_date).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Signals */}
        <TabsContent value="signals" className="mt-4">
          {signalsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !signals?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No expansion signals in the last 14 days.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {signals.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1 rounded bg-muted shrink-0 mt-0.5">
                        <TrendingUp className="w-3 h-3 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-foreground">{s.tenants?.name || 'Unknown'}</p>
                          <span className="text-xs text-muted-foreground">·</span>
                          <p className="text-xs text-muted-foreground">{s.metros?.metro || 'Unknown metro'}</p>
                          <Badge variant="outline" className="text-xs">{s.signal_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Score: {s.score} · {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mission Atlas Health Panel */}
      <MissionAtlasHealthPanel />
    </div>
  );
}

function MissionAtlasHealthPanel() {
  const allArchetypes = Object.keys(ARCHETYPE_GRAPH);
  const covered = getCoveredArchetypes();
  const uncovered = getUncoveredArchetypes(allArchetypes);

  return (
    <section className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-serif flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Mission Atlas™ Signals
        </h2>
        <Link to="/mission-atlas" target="_blank">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ExternalLink className="h-3 w-3" /> View Atlas
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Atlas Entries</p>
            <p className="text-2xl font-semibold font-serif">{MISSION_ATLAS.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Archetypes Covered</p>
            <p className="text-2xl font-semibold font-serif">{covered.length} / {allArchetypes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Uncovered Archetypes</p>
            <p className="text-2xl font-semibold font-serif">{uncovered.length}</p>
            {uncovered.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {uncovered.map((a) => getArchetypeDisplay(a)).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
