/**
 * OperatorRhythmPage — Daily Rhythm Engine for calm operator guidance.
 *
 * WHAT: A narrative-driven daily briefing showing where presence is needed.
 * WHERE: /operator/nexus/rhythm
 * WHY: Operators need gentle guidance, not urgent dashboards. This surfaces
 *       meaning from existing systems without adding stress.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSentryErrorCount } from '@/lib/sentry/queryCounts';
import { useVigiliaOverview } from '@/hooks/useVigilia';
import { VigiliaCard } from '@/components/operator/vigilia/VigiliaCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  Globe,
  Heart,
  Inbox,
  Leaf,
  Shield,
  Sparkles,
  Sun,
  TestTube2,
  TrendingUp,
} from 'lucide-react';
import { calmText, calmVariant } from '@/lib/calmMode';
import GrowthSignalsCard from '@/components/operator/GrowthSignalsCard';
import EditorialRecommendations from '@/components/operator/EditorialRecommendations';
import EmergingAnchors from '@/components/operator/EmergingAnchors';
import { format } from 'date-fns';

/* ─── Helpers ──────────────────────────────────── */

function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
      <Icon className="w-3.5 h-3.5" />
      {children}
    </h2>
  );
}

function RhythmCard({
  title,
  subtitle,
  to,
  badge,
  badgeVariant,
}: {
  title: string;
  subtitle: string;
  to: string;
  badge?: string;
  badgeVariant?: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="hover:border-primary/20 transition-colors">
        <CardContent className="pt-4 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge && (
              <Badge variant={calmVariant(badgeVariant || 'ok')} className="text-xs">
                {badge}
              </Badge>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── Main Component ──────────────────────────── */

export default function OperatorRhythmPage() {
  const { data: vigilia, isLoading: vigiliaLoading } = useVigiliaOverview();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const tomorrowISO = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const weekAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dayAgoISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ── Section 1: Presence Needed ──
  const { data: todayActivations, isLoading: la } = useQuery({
    queryKey: ['rhythm-activations-today'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activation_sessions')
        .select('id, session_type, scheduled_at, status, tenant_id')
        .eq('status', 'scheduled')
        .gte('scheduled_at', todayISO)
        .lt('scheduled_at', tomorrowISO)
        .order('scheduled_at')
        .limit(5);
      return data ?? [];
    },
  });

  const { data: driftTenants, isLoading: ld } = useQuery({
    queryKey: ['rhythm-drift-tenants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('testimonium_events' as any)
        .select('tenant_id, event_type, created_at')
        .eq('event_type', 'drift_detected')
        .gte('created_at', weekAgoISO)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data as any[]) ?? [];
    },
  });

  const { data: expansionReview, isLoading: le } = useQuery({
    queryKey: ['rhythm-expansion-review'],
    queryFn: async () => {
      const { count } = await supabase
        .from('operator_expansion_watch' as any)
        .select('*', { count: 'exact', head: true })
        .eq('risk_level', 'high');
      return count ?? 0;
    },
  });

  // ── Section 2: Quiet Signals ──
  const { data: quietSignals, isLoading: ls } = useQuery({
    queryKey: ['rhythm-quiet-signals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('communio_shared_signals')
        .select('id, signal_type, signal_summary, metro_id, created_at')
        .gte('created_at', weekAgoISO)
        .order('created_at', { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  // ── Section 3: Upcoming Moments ──
  const { data: upcomingSessions, isLoading: lu } = useQuery({
    queryKey: ['rhythm-upcoming-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activation_sessions')
        .select('id, session_type, scheduled_at, status, tenant_id, meet_link')
        .eq('status', 'scheduled')
        .gte('scheduled_at', todayISO)
        .order('scheduled_at')
        .limit(8);
      return data ?? [];
    },
  });

  // ── Section 4: Care & Support ──
  const { data: openSupport, isLoading: lc } = useQuery({
    queryKey: ['rhythm-support-open'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback_requests')
        .select('id, title, type, status, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // ── Section 5: Expansion Watch ──
  const { data: expansionPlans, isLoading: lx } = useQuery({
    queryKey: ['rhythm-expansion-plans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('metro_expansion_plans' as any)
        .select('id, metro_id, status, priority, target_launch_date, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      return (data as any[]) ?? [];
    },
  });

  // ── Section 6: System Health ──
  const { data: qaFailures, isLoading: lq } = useQuery({
    queryKey: ['rhythm-qa-failures'],
    queryFn: async () => {
      const { count } = await supabase
        .from('qa_run_results' as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'fail')
        .gte('created_at', dayAgoISO);
      return count ?? 0;
    },
  });

  const { data: automationErrors, isLoading: lae } = useQuery({
    queryKey: ['rhythm-automation-errors'],
    queryFn: async () => {
      const { count } = await supabase
        .from('automation_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', dayAgoISO);
      return count ?? 0;
    },
  });

  const { data: frictionCount, isLoading: lf } = useQuery({
    queryKey: ['rhythm-system-friction'],
    // Now sourced from Sentry (system_error_events retired)
    queryFn: () => getSentryErrorCount({ sinceHoursAgo: 24 }),
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const presenceLoading = la || ld || le;
  const loading = presenceLoading || ls || lu || lc || lx || lq || lae || lf;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM d')} — here is where your presence matters today.
        </p>
      </div>

      {/* ── Vigilia: The Watch ── */}
      <VigiliaCard
        title="Vigilia — The Watch"
        highlights={vigilia?.highlights ?? []}
        tone={vigilia?.tone}
        isLoading={vigiliaLoading}
        helpText="Vigilia gently aggregates signals from across the ecosystem — lumen, activation, communio, and system health — into a living pulse."
      />

      {/* ── Section 1: Today Needs Presence ── */}
      <section>
        <SectionHeading icon={Sun}>Today Needs Presence</SectionHeading>
        {presenceLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <div className="space-y-2">
            {(todayActivations?.length ?? 0) > 0 && todayActivations!.map((s) => (
              <RhythmCard
                key={s.id}
                title={`${s.session_type} activation session`}
                subtitle={s.scheduled_at ? `Scheduled for ${format(new Date(s.scheduled_at), 'h:mm a')}` : 'Time to be confirmed'}
                to="/operator/nexus/activation"
                badge="Today"
              />
            ))}
            {(driftTenants?.length ?? 0) > 0 && (
              <RhythmCard
                title={`${driftTenants!.length} tenant${driftTenants!.length > 1 ? 's' : ''} showing narrative drift`}
                subtitle="Presence and gentle attention may help these communities reconnect."
                to="/operator/testimonium"
                badge="Drift"
                badgeVariant="warning"
              />
            )}
            {(expansionReview ?? 0) > 0 && (
              <RhythmCard
                title={`${expansionReview} expansion ${expansionReview === 1 ? 'area' : 'areas'} need review`}
                subtitle="Growth signals detected — your perspective will guide next steps."
                to="/operator/nexus/expansion"
                badge="Review"
              />
            )}
            {(todayActivations?.length ?? 0) === 0 && (driftTenants?.length ?? 0) === 0 && (expansionReview ?? 0) === 0 && (
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
                  <Leaf className="w-4 h-4 text-primary" />
                  <p className="text-sm">A quiet day ahead. All communities are steady.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ── Section 2: Quiet Signals ── */}
      <section>
        <SectionHeading icon={Heart}>Quiet Signals</SectionHeading>
        {ls ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : quietSignals && quietSignals.length > 0 ? (
          <div className="space-y-2">
            {quietSignals.map((sig) => (
              <RhythmCard
                key={sig.id}
                title={sig.signal_summary}
                subtitle={`${sig.signal_type} signal · ${format(new Date(sig.created_at), 'MMM d')}`}
                to="/operator/communio"
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <Shield className="w-4 h-4 text-primary" />
              <p className="text-sm">No new cross-community signals this week.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 3: Upcoming Moments ── */}
      <section>
        <SectionHeading icon={Calendar}>Upcoming Moments</SectionHeading>
        {lu ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : upcomingSessions && upcomingSessions.length > 0 ? (
          <div className="space-y-2">
            {upcomingSessions.map((s) => (
              <RhythmCard
                key={s.id}
                title={`${s.session_type} session`}
                subtitle={s.scheduled_at ? format(new Date(s.scheduled_at), 'EEE, MMM d · h:mm a') : 'Time to be confirmed'}
                to="/operator/nexus/activation"
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm">No upcoming sessions scheduled.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 4: Care & Support ── */}
      <section>
        <SectionHeading icon={Inbox}>Care & Support</SectionHeading>
        {lc ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : openSupport && openSupport.length > 0 ? (
          <div className="space-y-2">
            {openSupport.map((r) => (
              <RhythmCard
                key={r.id}
                title={r.title}
                subtitle={`${r.type === 'bug' ? 'Something to look into' : 'A thoughtful request'} · ${format(new Date(r.created_at), 'MMM d')}`}
                to="/operator/nexus/support"
                badge={r.type === 'bug' ? 'Care' : 'Idea'}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <Inbox className="w-4 h-4 text-primary" />
              <p className="text-sm">No open support messages right now.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 5: Expansion Watch ── */}
      <section>
        <SectionHeading icon={Globe}>Expansion Watch</SectionHeading>
        {lx ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : expansionPlans && expansionPlans.length > 0 ? (
          <div className="space-y-2">
            {expansionPlans.map((p: any) => (
              <RhythmCard
                key={p.id}
                title={`Expansion plan — ${p.status}`}
                subtitle={`Priority: ${p.priority || 'standard'} · ${p.target_launch_date ? `Target: ${format(new Date(p.target_launch_date), 'MMM yyyy')}` : 'No target date yet'}`}
                to="/operator/nexus/expansion"
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm">No active expansion plans at the moment.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Section 5b: Editorial Rhythm ── */}
      <section>
        <SectionHeading icon={Sparkles}>Narrative Editorial</SectionHeading>
        <div className="space-y-4">
          <EditorialRecommendations />
          <EmergingAnchors />
        </div>
      </section>

      {/* ── Section 5c: Quiet Growth ── */}
      <section>
        <SectionHeading icon={TrendingUp}>Quiet Growth</SectionHeading>
        <GrowthSignalsCard />
      </section>

      {/* ── Section 6: System Health (Calm) ── */}
      <section>
        <SectionHeading icon={TestTube2}>System Health</SectionHeading>
        {(lq || lae || lf) ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link to="/operator/nexus/qa">
              <Card className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">QA Stability</p>
                    <p className="text-xs text-muted-foreground">
                      {(qaFailures ?? 0) === 0
                        ? 'All tests passing — everything looks good.'
                        : `${qaFailures} test${qaFailures === 1 ? '' : 's'} may need attention.`}
                    </p>
                  </div>
                  <Badge variant={calmVariant((qaFailures ?? 0) > 0 ? 'warning' : 'ok')} className="text-xs shrink-0">
                    {(qaFailures ?? 0) === 0 ? 'Stable' : calmText('Warning')}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
            <Link to="/operator/automation">
              <Card className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Automations</p>
                    <p className="text-xs text-muted-foreground">
                      {(automationErrors ?? 0) === 0
                        ? 'All workflows running smoothly.'
                        : `${automationErrors} workflow${automationErrors === 1 ? '' : 's'} may need a look.`}
                    </p>
                  </div>
                  <Badge variant={calmVariant((automationErrors ?? 0) > 0 ? 'warning' : 'ok')} className="text-xs shrink-0">
                    {(automationErrors ?? 0) === 0 ? 'Healthy' : calmText('Warning')}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
            <Link to="/operator/nexus/stability">
              <Card className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">System Friction</p>
                    <p className="text-xs text-muted-foreground">
                      {(frictionCount ?? 0) === 0
                        ? 'No friction detected today.'
                        : `${frictionCount} event${frictionCount === 1 ? '' : 's'} worth a glance.`}
                    </p>
                  </div>
                  <Badge variant={calmVariant((frictionCount ?? 0) > 0 ? 'warning' : 'ok')} className="text-xs shrink-0">
                    {(frictionCount ?? 0) === 0 ? 'Clear' : calmText('Friction')}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
