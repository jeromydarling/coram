/**
 * OperatorNexusHome — Unified workflow cockpit overview.
 *
 * WHAT: Workflow-driven landing with signal badges and narrative summaries.
 * WHERE: /operator/nexus
 * WHY: Centralizes the most important operator workflows in one calm dashboard.
 */
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { SignumPulseCard } from '@/components/operator/SignumPulseCard';
import { PraeceptumPulseCard } from '@/components/operator/PraeceptumPulseCard';
import { LumenPulseCard } from '@/components/operator/LumenPulseCard';
import { OperatorAwarenessPanel } from '@/components/operator/awareness/OperatorAwarenessPanel';
import { GardenGrowthCard } from '@/components/operator/GardenGrowthCard';
import { FoundingGardenProgramCard } from '@/components/operator/FoundingGardenProgramCard';
import { TenantKeywordHealthCard } from '@/components/operator/TenantKeywordHealthCard';
import { ResonanceHealthCard } from '@/components/operator/ResonanceHealthCard';
import { GoodWorkPulseCard } from '@/components/operator/GoodWorkPulseCard';
import { FocusTenantPicker } from '@/components/operator/awareness/FocusTenantPicker';
import { CalmModeToggle } from '@/components/operator/awareness/CalmModeToggle';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  ChevronRight,
  Compass,
  Globe,
  Heart,
  Inbox,
  MapPin,
  Mic,
  Plug,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  TestTube2,
} from 'lucide-react';
import { calmVariant } from '@/lib/calmMode';
import GardenOrientationCard from '@/components/operator/GardenOrientationCard';

interface WorkflowCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  to: string;
  signalCount?: number;
  signalLabel?: string;
  signalVariant?: string;
}

function WorkflowCard({ icon: Icon, title, description, to, signalCount, signalLabel, signalVariant }: WorkflowCardProps) {
  return (
    <Link to={to} className="block group">
      <Card className="hover:border-primary/30 transition-colors h-full">
        <CardContent className="pt-5 pb-4 flex flex-col gap-3 h-full">
          <div className="flex items-start justify-between gap-2">
            <div className="p-2 rounded-lg bg-muted shrink-0">
              <Icon className="w-5 h-5 text-foreground" />
            </div>
            {signalCount !== undefined && signalCount > 0 && (
              <Badge variant={calmVariant(signalVariant || 'ok')} className="text-xs shrink-0">
                {signalCount} {signalLabel || 'pending'}
              </Badge>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground font-serif">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
            Open Workflow <ChevronRight className="w-3 h-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function OperatorNexusHome() {
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // New arrivals (last 24h or awaiting activation)
  const { data: newArrivals } = useQuery({
    queryKey: ['nexus-new-arrivals'],
    queryFn: async () => {
      const now48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug, created_at, status')
        .or(`created_at.gte.${now48h},status.eq.awaiting_activation`)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data ?? []) as { id: string; name: string; slug: string; created_at: string; status: string }[];
    },
  });

  // QA failures last 24h
  const { data: qaFailures, isLoading: l1 } = useQuery({
    queryKey: ['nexus-qa-failures'],
    queryFn: async () => {
      const { count } = await supabase
        .from('qa_run_results' as any)
        .select('*', { count: 'exact', head: true })
        .eq('status', 'fail')
        .gte('created_at', now24h);
      return count ?? 0;
    },
  });

  // Scheduled activation sessions
  const { data: activationCount, isLoading: l2 } = useQuery({
    queryKey: ['nexus-activation-upcoming'],
    queryFn: async () => {
      const { count } = await supabase
        .from('activation_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'scheduled');
      return count ?? 0;
    },
  });

  // Open support threads
  const { data: supportCount, isLoading: l3 } = useQuery({
    queryKey: ['nexus-support-open'],
    queryFn: async () => {
      const { count } = await supabase
        .from('feedback_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      return count ?? 0;
    },
  });

  // High-risk expansion entries
  const { data: expansionAlerts, isLoading: l4 } = useQuery({
    queryKey: ['nexus-expansion-alerts'],
    queryFn: async () => {
      const { count } = await supabase
        .from('operator_expansion_watch' as any)
        .select('*', { count: 'exact', head: true })
        .eq('risk_level', 'high');
      return count ?? 0;
    },
  });

  // Drift flags this week
  const { data: driftFlags, isLoading: l5 } = useQuery({
    queryKey: ['nexus-narrative-drift'],
    queryFn: async () => {
      const { count } = await supabase
        .from('testimonium_events' as any)
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'drift_detected')
        .gte('created_at', now7d);
      return count ?? 0;
    },
  });

  // Recycle bin count (pending restores)
  const { data: recycleCount, isLoading: l6 } = useQuery({
    queryKey: ['nexus-recycle-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('recycle_bin' as any)
        .select('*', { count: 'exact', head: true })
        .is('restored_at', null)
        .is('purged_at', null);
      return count ?? 0;
    },
  });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Gardener Orientation — session-once, collapsible */}
      <GardenOrientationCard />
      {/* New Arrival Cards */}
      {(newArrivals ?? []).length > 0 && (
        <div className="space-y-2">
          {(newArrivals ?? []).map((t) => (
            <Link key={t.id} to="/operator/nexus/arrival" className="block group">
              <Card className="border-primary/30 hover:border-primary/50 transition-colors bg-primary/5">
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground font-serif truncate">New Tenant Arrived</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.name} joined {formatDistanceToNow(parseISO(t.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-medium shrink-0 group-hover:gap-2 transition-all">
                    View Arrival <ChevronRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Daily Rhythm CTA */}
      <Link to="/operator/nexus/rhythm" className="block group">
        <Card className="border-primary/20 hover:border-primary/40 transition-colors bg-primary/5">
          <CardContent className="pt-5 pb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Sun className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground font-serif">Daily Rhythm</h2>
                <p className="text-xs text-muted-foreground">Where your presence matters today</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
          </CardContent>
        </Card>
      </Link>

      {/* Header with controls */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground font-serif">Gardener Nexus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tend the ecosystem. Notice signs of growth and drift.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <FocusTenantPicker />
          <CalmModeToggle />
        </div>
      </div>

      {/* Ecosystem Awareness */}
      <OperatorAwarenessPanel />

      {/* Workflow Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <WorkflowCard
            icon={Sparkles}
            title="Activation"
            description="Run onboarding sessions, review checklists, and guide new tenants through their first steps."
            to="/operator/nexus/activation"
            signalCount={activationCount ?? 0}
            signalLabel="scheduled"
          />
          <WorkflowCard
            icon={TestTube2}
            title="QA & Stability"
            description="Platform health signals, failing suites, self-healing prompts, and automation error trends."
            to="/operator/nexus/qa"
            signalCount={qaFailures ?? 0}
            signalLabel="failures"
            signalVariant={(qaFailures ?? 0) > 0 ? 'warning' : 'ok'}
          />
          <WorkflowCard
            icon={Plug}
            title="Migration & Integrations"
            description="Connector registry, migration run history, sandbox status, and data movement oversight."
            to="/operator/nexus/migrations"
          />
          <WorkflowCard
            icon={Inbox}
            title="Support & Care"
            description="Feedback intake, bug reports, feature requests, and high-drift tenant monitoring."
            to="/operator/nexus/support"
            signalCount={supportCount ?? 0}
            signalLabel="open"
            signalVariant={(supportCount ?? 0) > 3 ? 'warning' : 'ok'}
          />
          <WorkflowCard
            icon={Globe}
            title="Expansion"
            description="Metro growth monitoring, expansion pipeline status, and field intelligence signals."
            to="/operator/nexus/expansion"
            signalCount={expansionAlerts ?? 0}
            signalLabel="high risk"
            signalVariant={(expansionAlerts ?? 0) > 0 ? 'warning' : 'ok'}
          />
          <WorkflowCard
            icon={Mic}
            title="Presence"
            description="How humans are using the system — visit note volume, voice patterns, and quiet signals."
            to="/operator/nexus/presence"
          />
          <WorkflowCard
            icon={BookOpen}
            title="Knowledge & Playbooks"
            description="Activation scripts, migration guides, outreach templates, and QA repair workflows."
            to="/operator/nexus/knowledge"
          />
          <WorkflowCard
            icon={Activity}
            title="Signum"
            description="Where humans paused, hesitated, or repeated actions — gentle friction intelligence."
            to="/operator/nexus/friction"
          />
          <WorkflowCard
            icon={BookOpen}
            title="Praeceptum"
            description="Living guidance memory — which prompts help humans move forward, remembered wisdom."
            to="/operator/nexus/guidance"
          />
          <WorkflowCard
            icon={Compass}
            title="Lumen"
            description="Quiet foresight — emerging patterns detected before they become friction or drift."
            to="/operator/nexus/lumen"
          />
          <WorkflowCard
            icon={RotateCcw}
            title="Recovery"
            description="Restore soft-deleted records for tenants — 90-day safety net for accidental deletions."
            to="/operator/nexus/recovery"
            signalCount={recycleCount ?? 0}
            signalLabel="pending"
            signalVariant={(recycleCount ?? 0) > 5 ? 'warning' : 'ok'}
          />
          <WorkflowCard
            icon={Heart}
            title="Narrative Engine"
            description="Stories emerge from what your tenants record — threads, moments, and quiet-week signals."
            to="/operator/nexus/narrative"
          />
          <WorkflowCard
            icon={BookOpen}
            title="Narrative Studio"
            description="Curate and publish stories from emerging platform patterns."
            to="/operator/nexus/narrative-studio"
          />
          <WorkflowCard
            icon={MapPin}
            title="Civitas Studio"
            description="Manage public metro narrative pages — civic patterns, momentum, and community stories."
            to="/operator/nexus/civitas"
          />
          <WorkflowCard
            icon={Globe}
            title="Narrative Ecosystem"
            description="Living observatory — archetype momentum, metro interest, signal heatmap, and civic gravity."
            to="/operator/nexus/narrative-ecosystem"
          />
        </div>
      )}

      {/* Garden Growth — observational revenue card */}
      <GardenGrowthCard />

      {/* Founding Garden Program — cap tracking + audit */}
      <FoundingGardenProgramCard />

      {/* Discovery Keyword Health — tenant personalization overview */}
      <TenantKeywordHealthCard />

      {/* Communio Resonance — ecosystem pattern health */}
      <ResonanceHealthCard />

      {/* Good Work Pulse — project awareness */}
      <GoodWorkPulseCard />

      {/* Narrative Health Strip */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Narrative Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/operator/testimonium">
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Heart className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Drift Flags (7d)</p>
                  <p className="text-xs text-muted-foreground">{driftFlags ?? 0} Testimonium signals</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/operator/communio">
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Communio</p>
                  <p className="text-xs text-muted-foreground">Cross-tenant collaboration active</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/operator/nexus/integrations">
            <Card className="hover:border-primary/20 transition-colors">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Plug className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Relatio Registry</p>
                  <p className="text-xs text-muted-foreground">Connector field maps & caveats</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          <SignumPulseCard />
          <PraeceptumPulseCard />
          <LumenPulseCard />
        </div>
      </section>
    </div>
  );
}
