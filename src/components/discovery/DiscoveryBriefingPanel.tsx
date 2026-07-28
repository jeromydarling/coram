/**
 * DiscoveryBriefingPanel — Territory-aware discovery briefings.
 *
 * WHAT: Shows discovery briefings and urgent highlights for activated territories.
 * WHERE: Metro detail, territory views, dashboard discovery section.
 * WHY: Surfaces community intelligence scoped to the tenant's activated geography.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Calendar, Users, DollarSign, Loader2 } from 'lucide-react';

interface DiscoveryBriefingPanelProps {
  /** Legacy metro scope — still supported for backward compat */
  metroId?: string;
  /** Territory scope — preferred */
  territoryId?: string;
  opportunityId?: string;
  modules?: ('events' | 'grants' | 'people')[];
}

interface Briefing {
  id: string;
  module: string;
  scope: string;
  briefing_md: string;
  briefing_json: Record<string, unknown>;
  created_at: string;
}

interface Highlight {
  id: string;
  module: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const moduleIcons: Record<string, React.ReactNode> = {
  events: <Calendar className="h-4 w-4" />,
  grants: <DollarSign className="h-4 w-4" />,
  people: <Users className="h-4 w-4" />,
};

const kindColors: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  new: 'bg-primary text-primary-foreground',
  changed: 'bg-accent text-accent-foreground',
  recommended_source: 'bg-muted text-muted-foreground',
};

export function DiscoveryBriefingPanel({ metroId, territoryId, opportunityId, modules = ['events', 'grants', 'people'] }: DiscoveryBriefingPanelProps) {
  // Prefer territory_id, fall back to metro_id
  const scopeId = territoryId || metroId;

  // Fetch latest briefings
  const { data: briefings, isLoading: briefingsLoading } = useQuery({
    queryKey: ['discovery-briefings', scopeId, opportunityId, modules],
    queryFn: async () => {
      let query = supabase
        .from('discovery_briefings')
        .select('id, module, scope, briefing_md, briefing_json, created_at')
        .in('module', modules)
        .order('created_at', { ascending: false })
        .limit(6);

      if (scopeId) query = query.eq('metro_id', scopeId);
      if (opportunityId) query = query.eq('opportunity_id', opportunityId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Briefing[];
    },
    enabled: !!(scopeId || opportunityId),
  });

  // Fetch highlights (urgent items)
  const { data: highlights, isLoading: highlightsLoading } = useQuery({
    queryKey: ['discovery-highlights', scopeId, opportunityId],
    queryFn: async () => {
      let runQuery = supabase
        .from('discovery_runs')
        .select('id')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (scopeId) runQuery = runQuery.eq('metro_id', scopeId);
      if (opportunityId) runQuery = runQuery.eq('opportunity_id', opportunityId);

      const { data: runs } = await runQuery;
      if (!runs || runs.length === 0) return [];

      const runIds = runs.map((r: { id: string }) => r.id);

      const { data, error } = await supabase
        .from('discovery_highlights')
        .select('id, module, kind, payload, created_at')
        .in('run_id', runIds)
        .eq('kind', 'urgent')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as Highlight[];
    },
    enabled: !!(scopeId || opportunityId),
  });

  const isLoading = briefingsLoading || highlightsLoading;

  if (!scopeId && !opportunityId) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading discovery briefings…</span>
        </CardContent>
      </Card>
    );
  }

  const hasContent = (briefings && briefings.length > 0) || (highlights && highlights.length > 0);

  if (!hasContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Community Briefings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No community briefings yet. Scheduled discovery will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Urgent highlights */}
      {highlights && highlights.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-destructive" />
              Urgent — Next 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {highlights.map((h) => (
              <div key={h.id} className="flex items-start gap-2 text-sm">
                <Badge className={kindColors[h.kind] || 'bg-muted'} variant="secondary">
                  {h.module}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{(h.payload as Record<string, string>).title || 'Untitled'}</span>
                  {(h.payload as Record<string, string>).event_date && (
                    <span className="text-muted-foreground ml-1">
                      ({(h.payload as Record<string, string>).event_date})
                    </span>
                  )}
                  {(h.payload as Record<string, string>).why_this_week && (
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {(h.payload as Record<string, string>).why_this_week}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Briefings by module */}
      {briefings && briefings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Latest Community Briefings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {briefings.map((b) => {
              const json = b.briefing_json as Record<string, unknown>;
              const highlightsList = Array.isArray(json?.highlights) ? json.highlights as Array<Record<string, string>> : [];

              return (
                <div key={b.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    {moduleIcons[b.module] || null}
                    <span className="font-medium text-sm capitalize">{b.module}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {highlightsList.length > 0 ? (
                    <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                      {highlightsList.slice(0, 3).map((hl, i) => (
                        <li key={i}>
                          <span className="font-medium text-foreground">{hl.title}</span>
                          {hl.why_it_matters && ` — ${hl.why_it_matters}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground ml-6">No highlights this run.</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
