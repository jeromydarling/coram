/**
 * OrientationDebugPage — Aggregate-only orientation & compass posture for Gardener.
 *
 * Feature Name: Orientation Observatory
 * Primary Purpose: Aggregate system posture visibility
 * Chosen Zone: MACHINA
 * Why this Zone: System-level monitoring of tenant configuration
 * Why NOT others: Not daily stewardship (CURA), not growth (CRESCERE), not insight (SCIENTIA)
 * Operator Impact: Sanity-check orientation distribution without tenant PII
 * Navigation Location: /operator/machina/orientation
 *
 * WHAT: Shows orientation distribution, average richness, compass direction counts.
 * WHERE: Machina zone — system monitoring.
 * WHY: Gardener needs aggregate posture visibility without cross-tenant PII.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, Building2, Blend, Compass } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface OrientationStats {
  orientation: string;
  count: number;
  avg_people_richness: number;
  avg_partner_richness: number;
}

export default function OrientationDebugPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['gardener-orientation-stats'],
    queryFn: async () => {
      // Aggregate only — no tenant names or PII
      const { data, error } = await supabase
        .from('tenants')
        .select('relational_orientation, people_richness_level, partner_richness_level');
      if (error) throw error;

      const grouped: Record<string, { count: number; peopleSum: number; partnerSum: number }> = {};
      for (const t of data ?? []) {
        const key = t.relational_orientation ?? 'institution_focused';
        if (!grouped[key]) grouped[key] = { count: 0, peopleSum: 0, partnerSum: 0 };
        grouped[key].count++;
        grouped[key].peopleSum += (t.people_richness_level ?? 1);
        grouped[key].partnerSum += (t.partner_richness_level ?? 3);
      }

      return Object.entries(grouped).map(([orientation, g]): OrientationStats => ({
        orientation,
        count: g.count,
        avg_people_richness: Math.round((g.peopleSum / g.count) * 10) / 10,
        avg_partner_richness: Math.round((g.partnerSum / g.count) * 10) / 10,
      }));
    },
  });

  const { data: overrideCounts } = useQuery({
    queryKey: ['gardener-richness-override-counts'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('entity_richness_overrides')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const orientationIcon = (o: string) => {
    if (o === 'human_focused') return <Users className="w-4 h-4 text-primary" />;
    if (o === 'institution_focused') return <Building2 className="w-4 h-4 text-primary" />;
    return <Blend className="w-4 h-4 text-primary" />;
  };

  const orientationLabel = (o: string) => {
    if (o === 'human_focused') return 'Human-Focused';
    if (o === 'institution_focused') return 'Institution-Focused';
    return 'Hybrid';
  };

  const totalTenants = stats?.reduce((sum, s) => sum + s.count, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          Orientation Observatory
          <HelpTooltip
            what="Aggregate orientation distribution and richness levels across all tenants."
            where="Machina → Orientation Observatory"
            why="Allows the Gardener to sanity-check system posture without accessing tenant PII."
          />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {totalTenants} tenant{totalTenants !== 1 ? 's' : ''} • {overrideCounts ?? 0} entity-level richness override{overrideCounts !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats?.map(s => (
          <Card key={s.orientation}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {orientationIcon(s.orientation)}
                {orientationLabel(s.orientation)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tenants</span>
                <span className="font-medium">{s.count}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg people richness</span>
                <span className="font-medium">{s.avg_people_richness}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Avg partner richness</span>
                <span className="font-medium">{s.avg_partner_richness}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${totalTenants > 0 ? (s.count / totalTenants) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!stats || stats.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tenants have configured orientation yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
