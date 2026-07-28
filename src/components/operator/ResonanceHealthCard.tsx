/**
 * ResonanceHealthCard — Gardener observability for Communio Resonance Engine.
 *
 * WHAT: Shows ecosystem resonance health — pattern distribution, theme drift, participation.
 * WHERE: Gardener Nexus (/operator/nexus) — SCIENTIA zone.
 * WHY: Gardener observes resonance health but does NOT manually curate discovery outcomes.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Waves, Leaf, Users } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface ResonanceRow {
  archetype_key: string;
  search_type: string;
  signal_count: number;
  tenant_count: number;
  communio_participation_count: number;
  resonant_keywords: string[];
  testimonium_themes: string[];
  computed_at: string;
}

export function ResonanceHealthCard() {
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['resonance-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_resonance_snapshots' as any)
        .select('archetype_key, search_type, signal_count, tenant_count, communio_participation_count, resonant_keywords, testimonium_themes, computed_at')
        .order('computed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ResonanceRow[];
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  const rows = snapshots ?? [];
  const totalSignals = rows.reduce((s, r) => s + r.signal_count, 0);
  const totalTenants = new Set(rows.map(r => r.archetype_key)).size;
  const communioActive = rows.filter(r => r.communio_participation_count > 0).length;
  const allThemes = [...new Set(rows.flatMap(r => r.testimonium_themes))].slice(0, 8);
  const topKeywords = [...new Set(rows.flatMap(r => r.resonant_keywords))].slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Waves className="w-4 h-4 text-muted-foreground" />
            Communio Resonance
            <HelpTooltip
              what="Aggregated cross-tenant discovery patterns — themes that quietly resonate across similar missions."
              where="Gardener Nexus → Ecosystem Health"
              why="Observe how shared patterns emerge organically. No curation, no rankings — just ecosystem awareness."
            />
          </CardTitle>
          {rows.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {rows.length} snapshots
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No resonance patterns yet. Signals will emerge as tenants participate in discovery.
          </p>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{totalSignals}</p>
                <p className="text-[10px] text-muted-foreground">Signals observed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{totalTenants}</p>
                <p className="text-[10px] text-muted-foreground">Archetype clusters</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{communioActive}</p>
                <p className="text-[10px] text-muted-foreground">Communio-active</p>
              </div>
            </div>

            {/* Resonant themes */}
            {allThemes.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Leaf className="w-3 h-3" /> Emerging Themes
                </p>
                <div className="flex flex-wrap gap-1">
                  {allThemes.map(theme => (
                    <Badge key={theme} variant="outline" className="text-[10px] py-0">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Top resonant keywords */}
            {topKeywords.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Resonant Keywords
                </p>
                <div className="flex flex-wrap gap-1">
                  {topKeywords.map(kw => (
                    <Badge key={kw} variant="secondary" className="text-[10px] py-0">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
