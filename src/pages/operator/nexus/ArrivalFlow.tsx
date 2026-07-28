/**
 * ArrivalFlow — Operator stewardship workflow for new tenant arrivals.
 *
 * WHAT: Calm, narrative dashboard showing newly arrived tenants with guidance and timeline.
 * WHERE: /operator/nexus/arrival
 * WHY: Helps operators immediately know "someone arrived — here's how to guide them."
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, User } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ArrivalGuidanceCard } from '@/components/operator/arrival/ArrivalGuidanceCard';
import { ArrivalSignalsPanel } from '@/components/operator/arrival/ArrivalSignalsPanel';
import { ArrivalActionsBar } from '@/components/operator/arrival/ArrivalActionsBar';
import { ArrivalTimelineCard } from '@/components/operator/arrival/ArrivalTimelineCard';

interface ArrivalTenant {
  id: string;
  name: string;
  slug: string;
  archetype: string | null;
  tier: string;
  status: string;
  created_at: string;
  civitas_enabled: boolean | null;
  is_operator_granted: boolean | null;
}

export default function ArrivalFlow() {
  const now48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Fetch recently created, awaiting-activation, or operator-granted tenants
  const { data: arrivals, isLoading } = useQuery({
    queryKey: ['arrival-tenants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug, archetype, tier, status, created_at, civitas_enabled, is_operator_granted')
        .or(`created_at.gte.${now48h},status.eq.awaiting_activation`)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as ArrivalTenant[];
    },
  });

  // Fetch activation sessions for all arrivals
  const arrivalIds = (arrivals ?? []).map((a) => a.id);
  const { data: activationSessions } = useQuery({
    queryKey: ['arrival-activations', arrivalIds],
    enabled: arrivalIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('activation_sessions')
        .select('tenant_id, status')
        .in('tenant_id', arrivalIds);
      return (data ?? []) as { tenant_id: string; status: string }[];
    },
  });

  // Fetch tenant stats
  const { data: tenantStats } = useQuery({
    queryKey: ['arrival-stats', arrivalIds],
    enabled: arrivalIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('operator_tenant_stats' as any)
        .select('tenant_id, active_users_7d, total_reflections, total_activities')
        .in('tenant_id', arrivalIds);
      return (data ?? []) as any[];
    },
  });

  const getActivationScheduled = (tenantId: string) =>
    (activationSessions ?? []).some(
      (s) => s.tenant_id === tenantId && (s.status === 'scheduled' || s.status === 'completed')
    );

  const getStats = (tenantId: string) =>
    (tenantStats ?? []).find((s: any) => s.tenant_id === tenantId);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back nav */}
      <Button variant="ghost" size="sm" asChild>
        <Link to="/operator/nexus">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Nexus
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          New Arrivals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Someone has arrived. Guide them gently.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (arrivals ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No new arrivals right now — the network is quiet.
            </p>
          </CardContent>
        </Card>
      ) : (
        (arrivals ?? []).map((tenant) => {
          const stats = getStats(tenant.id);
          const activationScheduled = getActivationScheduled(tenant.id);
          const engagement =
            ((stats?.active_users_7d ?? 0) + (stats?.total_reflections ?? 0) + (stats?.total_activities ?? 0)) * 5;
          const daysInactive = stats?.active_users_7d === 0 ? 7 : 0;

          return (
            <section key={tenant.id} className="space-y-4">
              {/* Arrival Banner */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold font-serif text-foreground">
                        New Organization Entered the Network
                      </h2>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p><strong className="text-foreground">{tenant.name}</strong></p>
                        {tenant.archetype && (
                          <p>Archetype: <Badge variant="outline" className="text-xs ml-1">{tenant.archetype}</Badge></p>
                        )}
                        <p>
                          Plan: <span className="text-foreground">{tenant.tier}</span>
                          {tenant.is_operator_granted && (
                            <Badge variant="secondary" className="text-xs ml-2">Gardener Sponsored</Badge>
                          )}
                        </p>
                        <p>
                          Joined{' '}
                          {formatDistanceToNow(parseISO(tenant.created_at), { addSuffix: true })}
                          {' · '}
                          {format(parseISO(tenant.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Guidance + Signals side by side on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ArrivalGuidanceCard
                  archetype={tenant.archetype}
                  activationScheduled={activationScheduled}
                  hasConnectors={false}
                  communioEnabled={tenant.civitas_enabled ?? false}
                />
                <ArrivalSignalsPanel
                  activationReady={activationScheduled}
                  hasConnectors={false}
                  earlyEngagement={Math.min(engagement, 100)}
                  daysInactive={daysInactive}
                />
              </div>

              {/* Actions */}
              <ArrivalActionsBar tenantId={tenant.id} tenantSlug={tenant.slug} />

              {/* Timeline */}
              <ArrivalTimelineCard tenantId={tenant.id} createdAt={tenant.created_at} />
            </section>
          );
        })
      )}
    </div>
  );
}
