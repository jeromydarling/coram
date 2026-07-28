/**
 * LivingSystemPatternsPanel — Operator-level aggregated Living System patterns.
 *
 * WHAT: Shows aggregated signal counts across all tenants — no individual user data.
 * WHERE: /operator/nexus/lumen
 * WHY: Operators see ecosystem patterns to understand behavioral health.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Feather, Heart, Users, Handshake, Mic } from 'lucide-react';

const PATTERN_META: Record<string, { label: string; icon: React.ElementType }> = {
  reflection_moment: { label: 'Reflection Moments', icon: Feather },
  community_growth: { label: 'Community Growth', icon: Users },
  adoption_support_needed: { label: 'Adoption Support', icon: Heart },
  collaboration_movement: { label: 'Collaboration', icon: Handshake },
  visitor_voice_pattern: { label: 'Voice Patterns', icon: Mic },
};

export function LivingSystemPatternsPanel() {
  const { data: patterns, isLoading } = useQuery({
    queryKey: ['operator-living-patterns'],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data, error } = await supabase
        .from('living_system_signals')
        .select('signal_type')
        .gte('created_at', weekAgo);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.signal_type] = (counts[row.signal_type] || 0) + 1;
      }
      return counts;
    },
  });

  const total = Object.values(patterns || {}).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-serif">
          <Feather className="w-4 h-4 text-primary" />
          Living System Patterns
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Aggregated behavioral signals across the network this week.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No living signals detected this week. The network is quiet.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(PATTERN_META).map(([key, meta]) => {
              const count = patterns?.[key] || 0;
              if (count === 0) return null;
              const Icon = meta.icon;
              return (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{meta.label}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
