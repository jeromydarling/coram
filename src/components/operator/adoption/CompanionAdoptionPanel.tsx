/**
 * CompanionAdoptionPanel -- Operator Nexus panel for companion mode telemetry.
 *
 * WHAT: Aggregated stats on companion mode usage across tenants.
 * WHERE: Operator Nexus -> Adoption page.
 * WHY: Operators see which guidance resonates and where friction exists.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface GuideStat {
  guide_key: string;
  shown: number;
  accepted: number;
  dismissed: number;
}

export function CompanionAdoptionPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['companion-adoption-stats'],
    queryFn: async () => {
      // Aggregate guide-level stats
      const { data, error } = await supabase
        .from('micro_guidance_events')
        .select('guide_key, action')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;

      const byGuide: Record<string, GuideStat> = {};
      let totalShown = 0;
      let totalAccepted = 0;
      let totalDismissed = 0;

      for (const row of (data ?? [])) {
        if (!byGuide[row.guide_key]) {
          byGuide[row.guide_key] = { guide_key: row.guide_key, shown: 0, accepted: 0, dismissed: 0 };
        }
        if (row.action === 'shown') { byGuide[row.guide_key].shown++; totalShown++; }
        if (row.action === 'accepted') { byGuide[row.guide_key].accepted++; totalAccepted++; }
        if (row.action === 'dismissed') { byGuide[row.guide_key].dismissed++; totalDismissed++; }
      }

      const topGuides = Object.values(byGuide)
        .sort((a, b) => b.shown - a.shown)
        .slice(0, 8);

      const acceptanceRate = totalShown > 0 ? Math.round((totalAccepted / totalShown) * 100) : 0;

      return { totalShown, totalAccepted, totalDismissed, acceptanceRate, topGuides };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading companion adoption data...</CardContent></Card>
    );
  }

  const s = stats ?? { totalShown: 0, totalAccepted: 0, totalDismissed: 0, acceptanceRate: 0, topGuides: [] };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5" /> Companion Adoption
      </h2>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Guidance Shown</p>
            <p className="text-2xl font-semibold" style={serif}>{s.totalShown}</p>
            <p className="text-[10px] text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Acceptance Rate</p>
            <p className="text-2xl font-semibold" style={serif}>{s.acceptanceRate}%</p>
            <p className="text-[10px] text-muted-foreground">{s.totalAccepted} accepted / {s.totalDismissed} dismissed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Engagement</p>
            <p className="text-2xl font-semibold" style={serif}>{s.totalAccepted + s.totalDismissed}</p>
            <p className="text-[10px] text-muted-foreground">Total interactions</p>
          </CardContent>
        </Card>
      </div>

      {s.topGuides.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Top Guides</p>
            <div className="space-y-2">
              {s.topGuides.map((g) => (
                <div key={g.guide_key} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{g.guide_key.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{g.shown} shown</Badge>
                    {g.accepted > 0 && <Badge variant="outline" className="text-[10px] text-primary">{g.accepted} used</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {s.topGuides.length === 0 && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            No companion guidance events recorded yet. Signals will appear here once users enable Companion Mode.
          </CardContent>
        </Card>
      )}
    </section>
  );
}
