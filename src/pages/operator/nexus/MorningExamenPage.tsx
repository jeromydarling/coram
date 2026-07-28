/**
 * MorningExamenPage — Gardener Morning Examen.
 *
 * WHAT: Daily orientation through narrative awareness of overnight movement.
 * WHERE: /operator/nexus/examen/morning — CURA zone.
 * WHY: Grounds the Gardener in what is alive, before the day begins.
 *      Follows an implicit Ignatian rhythm: Noticing → Gratitude → Attention → Invitation → Sending Forth.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Leaf, BookOpen, Eye, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STORAGE_KEY = 'cros-morning-examen-last-seen';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Section: Noticing ──

function NoticingSection() {
  const { data: lumenSignals, isLoading: l1 } = useQuery({
    queryKey: ['examen-morning-lumen'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lumen_signals')
        .select('signal_type, severity, source_summary, first_detected_at')
        .eq('resolved', false)
        .order('first_detected_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: livingSignals, isLoading: l2 } = useQuery({
    queryKey: ['examen-morning-living'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('living_system_signals')
        .select('signal_type, anonymized_summary, created_at')
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: drafts } = useQuery({
    queryKey: ['examen-morning-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_content_drafts')
        .select('id, title')
        .eq('status', 'draft')
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: communioEvents } = useQuery({
    queryKey: ['examen-morning-communio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_activity_log')
        .select('action_type, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (l1 || l2) return <Skeleton className="h-28" />;

  const allSignals = [
    ...(livingSignals ?? []).map((s: any) => s.anonymized_summary || `A ${s.signal_type.replace(/_/g, ' ')} was observed.`),
    ...(lumenSignals ?? []).map((s: any) => (s.source_summary as any)?.title || `${s.signal_type.replace(/_/g, ' ')} noticed.`),
  ];
  const draftCount = drafts?.length ?? 0;
  const communioCount = communioEvents?.length ?? 0;

  // Build narrative sentences
  const sentences: string[] = [];
  if (draftCount > 0) sentences.push(`${draftCount === 1 ? 'One reflection is' : `${draftCount} reflections are`} ready for listening.`);
  if (communioCount > 0) sentences.push(`${communioCount === 1 ? 'A quiet movement' : 'Quiet movements'} appeared in Communio.`);
  allSignals.slice(0, 3).forEach(s => sentences.push(s));

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Noticing</p>
      {sentences.length === 0 ? (
        <p className="text-sm text-muted-foreground font-serif italic">
          The network rested quietly overnight.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sentences.slice(0, 5).map((s, i) => (
            <p key={i} className="text-sm text-foreground font-serif">{s}</p>
          ))}
        </div>
      )}
    </ExamenCard>
  );
}

// ── Section: Gratitude ──

function GratitudeSection() {
  const { data: testimoniumEvents } = useQuery({
    queryKey: ['examen-morning-gratitude'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonium_events')
        .select('event_kind, summary, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: resonance } = useQuery({
    queryKey: ['examen-morning-resonance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_resonance_snapshots')
        .select('tenant_count, signal_count, computed_at')
        .order('computed_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const events = testimoniumEvents ?? [];
  const sentences: string[] = [];

  if (events.length > 0) sentences.push('Stories continue to form across the network.');
  if (resonance && resonance.tenant_count > 1) sentences.push('Connections are quietly deepening between missions.');
  if (events.length > 2) sentences.push(`${events.length} narrative moments were recorded.`);

  if (sentences.length === 0) return null;

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Gratitude</p>
      <div className="space-y-1.5">
        {sentences.map((s, i) => (
          <p key={i} className="text-sm text-foreground font-serif">{s}</p>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: Attention ──

function AttentionSection() {
  const { data: frictionInsights } = useQuery({
    queryKey: ['examen-morning-friction'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_design_suggestions')
        .select('suggestion_summary, pattern_key, severity')
        .in('status', ['open', 'reviewed'])
        .neq('severity', 'high') // exclude error-like
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = frictionInsights ?? [];
  if (items.length === 0) return null;

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Attention</p>
      <div className="space-y-1.5">
        {items.map((f: any, i: number) => (
          <p key={i} className="text-sm text-foreground font-serif">
            {f.suggestion_summary}
          </p>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: Invitation ──

function InvitationSection() {
  const { data: drafts } = useQuery({
    queryKey: ['examen-morning-invite-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_content_drafts')
        .select('id')
        .eq('status', 'draft')
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: playbooks } = useQuery({
    queryKey: ['examen-morning-invite-playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_playbook_drafts')
        .select('id')
        .eq('status', 'draft')
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actions: { label: string; to: string }[] = [];

  if ((drafts?.length ?? 0) > 0) actions.push({ label: 'Review Reflection', to: '/operator/nexus/library' });
  if ((playbooks?.length ?? 0) > 0) actions.push({ label: 'Read New Playbook', to: '/operator/nexus/playbooks' });
  actions.push({ label: 'Open Garden View', to: '/operator/nexus/garden' });

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Invitation</p>
      <div className="flex flex-wrap gap-2">
        {actions.slice(0, 3).map((a) => (
          <Button key={a.to} variant="outline" size="sm" asChild className="font-serif text-xs">
            <Link to={a.to}>
              {a.label} <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: Sending Forth ──

const SENDING_FORTH_LINES = [
  'The work continues quietly today.',
  'Seeds planted recently will unfold in time.',
  'Tend what is near. The rest will grow.',
  'The garden asks only for presence, not perfection.',
  'Small movements carry great meaning.',
];

function SendingForthSection() {
  const [line] = useState(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return SENDING_FORTH_LINES[dayOfYear % SENDING_FORTH_LINES.length];
  });

  return (
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground font-serif italic">"{line}"</p>
    </div>
  );
}

// ── Shared Card Wrapper ──

function ExamenCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border/40 bg-card/80">
      <CardContent className="pt-5 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function MorningExamenPage() {
  const [dismissed, setDismissed] = useState(false);
  const lastSeen = localStorage.getItem(STORAGE_KEY);
  const todayKey = getTodayKey();
  const alreadySeen = lastSeen === todayKey;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, todayKey);
    setDismissed(true);
  };

  return (
    <MainLayout
      title="Morning Examen"
      mobileTitle="Morning"
      subtitle="Orient toward what is alive."
    >
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-2 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-serif font-semibold text-foreground">
              Good morning, Gardener.
            </h2>
          </div>
          {alreadySeen && !dismissed && (
            <p className="text-xs text-muted-foreground">You've already visited today's examen.</p>
          )}
        </div>

        {/* Sections */}
        <NoticingSection />
        <GratitudeSection />
        <AttentionSection />
        <InvitationSection />
        <SendingForthSection />

        {/* Dismiss */}
        {!alreadySeen && !dismissed && (
          <div className="text-center pb-4">
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs text-muted-foreground">
              I've noticed. Begin the day.
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
