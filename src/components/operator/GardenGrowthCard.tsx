/**
 * GardenGrowthCard — Revenue-aware observational card for Gardener Nexus.
 *
 * WHAT: Shows new tenants, founding members, onboarding sessions, and Bridge adoption.
 * WHERE: Gardener Nexus home (/operator/nexus).
 * WHY: Calm, observational view of ecosystem growth without KPI pressure.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Sprout, Users, Sparkles, Link2 } from 'lucide-react';

interface GrowthMetric {
  icon: React.ElementType;
  label: string;
  value: number | string;
  note: string;
}

export function GardenGrowthCard() {
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newTenants } = useQuery({
    queryKey: ['garden-growth-new-tenants'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', now7d);
      return count ?? 0;
    },
  });

  const { data: foundingCount } = useQuery({
    queryKey: ['garden-growth-founding'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('founding_garden_status', true as any);
      return count ?? 0;
    },
  });

  const { data: activationSessions } = useQuery({
    queryKey: ['garden-growth-activation'],
    queryFn: async () => {
      const { count } = await supabase
        .from('activation_sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['scheduled', 'pending']);
      return count ?? 0;
    },
  });

  const { data: bridgeCount } = useQuery({
    queryKey: ['garden-growth-bridge'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tenant_add_ons' as any)
        .select('*', { count: 'exact', head: true })
        .eq('add_on_key', 'bridge')
        .eq('status', 'active');
      return count ?? 0;
    },
  });

  const metrics: GrowthMetric[] = [
    {
      icon: Sprout,
      label: 'New this week',
      value: newTenants ?? 0,
      note: 'communities joined',
    },
    {
      icon: Sparkles,
      label: 'Founding Garden',
      value: foundingCount ?? 0,
      note: 'early members',
    },
    {
      icon: Users,
      label: 'Guided sessions',
      value: activationSessions ?? 0,
      note: 'scheduled or purchased',
    },
    {
      icon: Link2,
      label: 'Bridge adopted',
      value: bridgeCount ?? 0,
      note: 'active connections',
    },
  ];

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <h3 className="text-sm font-semibold text-foreground font-serif mb-1">
          Garden Growth
        </h3>
        <p className="text-xs text-muted-foreground mb-4" style={{ fontFamily: 'Georgia, serif' }}>
          Watching where new roots are forming.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="p-2 rounded-lg bg-muted">
                  <m.icon className="w-4 h-4 text-foreground" />
                </div>
              </div>
              <p className="text-xl font-bold text-foreground">{m.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{m.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{m.note}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
