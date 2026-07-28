/**
 * EveningExamenPage — Gardener Evening Examen.
 *
 * WHAT: End-of-day reflection surfacing patterns without pressure.
 * WHERE: /operator/nexus/examen/evening — CURA zone.
 * WHY: The Gardener closes the day by noticing where life moved, where
 *      resistance appeared, and what grew quietly — never as productivity review.
 *      Follows implicit Ignatian rhythm: Where Life Moved → Resistance → Quiet Growth → NRI Learning → Rest.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Moon, BookOpen, ArrowRight } from 'lucide-react';
import { startOfDay } from 'date-fns';

const STORAGE_KEY = 'cros-evening-examen-last-seen';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Section: Where Life Moved ──

function LifeMovedSection() {
  const todayStart = startOfDay(new Date()).toISOString();

  const { data: testimoniumEvents, isLoading } = useQuery({
    queryKey: ['examen-evening-life'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonium_events')
        .select('event_kind, summary, created_at')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: livingSignals } = useQuery({
    queryKey: ['examen-evening-living'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('living_system_signals')
        .select('signal_type, anonymized_summary, created_at')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-28" />;

  const sentences: string[] = [];
  (livingSignals ?? []).forEach((s: any) => {
    if (s.anonymized_summary) sentences.push(s.anonymized_summary);
  });
  (testimoniumEvents ?? []).forEach((t: any) => {
    if (t.summary) sentences.push(t.summary);
  });

  if (sentences.length === 0) {
    return (
      <ExamenCard>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Where Life Moved</p>
        <p className="text-sm text-muted-foreground font-serif italic">
          Today moved gently. Nothing needs your attention tonight.
        </p>
      </ExamenCard>
    );
  }

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Where Life Moved</p>
      <div className="space-y-1.5">
        {sentences.slice(0, 4).map((s, i) => (
          <p key={i} className="text-sm text-foreground font-serif">{s}</p>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: Where Resistance Appeared ──

function ResistanceSection() {
  const { data: frictionInsights } = useQuery({
    queryKey: ['examen-evening-resistance'],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const { data, error } = await supabase
        .from('nri_design_suggestions')
        .select('suggestion_summary, pattern_key')
        .in('status', ['open', 'reviewed'])
        .gte('created_at', todayStart)
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
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Where Resistance Appeared</p>
      <div className="space-y-1.5">
        {items.map((f: any, i: number) => (
          <p key={i} className="text-sm text-foreground font-serif">{f.suggestion_summary}</p>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: What Grew Quietly ──

function QuietGrowthSection() {
  const { data: communioActivity } = useQuery({
    queryKey: ['examen-evening-growth'],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const { data, error } = await supabase
        .from('communio_activity_log')
        .select('action_type, created_at')
        .gte('created_at', todayStart)
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: resonance } = useQuery({
    queryKey: ['examen-evening-resonance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_resonance_snapshots')
        .select('tenant_count, signal_count')
        .order('computed_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const sentences: string[] = [];
  const activityCount = communioActivity?.length ?? 0;
  if (activityCount > 0) sentences.push('Communio connections continued to form.');
  if (resonance && resonance.tenant_count > 1) sentences.push('Shared themes deepened between missions.');

  if (sentences.length === 0) return null;

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">What Grew Quietly</p>
      <div className="space-y-1.5">
        {sentences.map((s, i) => (
          <p key={i} className="text-sm text-foreground font-serif">{s}</p>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: What NRI Is Learning ──

function NRILearningSection() {
  const { data: playbooks } = useQuery({
    queryKey: ['examen-evening-nri'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_playbook_drafts')
        .select('id, title, status')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(2);
      if (error) throw error;
      return data ?? [];
    },
  });

  const items = playbooks ?? [];
  if (items.length === 0) return null;

  return (
    <ExamenCard>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">What NRI Is Learning</p>
      <div className="space-y-2">
        <p className="text-sm text-foreground font-serif">
          A new playbook may be forming from recurring patterns.
        </p>
        {items.map((p: any) => (
          <Button key={p.id} variant="outline" size="sm" asChild className="font-serif text-xs">
            <Link to="/operator/nexus/playbooks">
              Review: {p.title} <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        ))}
      </div>
    </ExamenCard>
  );
}

// ── Section: Rest ──

const REST_LINES = [
  'The garden rests tonight.',
  'Seeds planted today will unfold in time.',
  'Tomorrow brings its own rhythm.',
  'Rest is part of the work.',
  'What was tended today will grow.',
];

function RestSection() {
  const [line] = useState(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return REST_LINES[dayOfYear % REST_LINES.length];
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

export default function EveningExamenPage() {
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
      title="Evening Examen"
      mobileTitle="Evening"
      subtitle="Notice what moved today."
    >
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-2 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-serif font-semibold text-foreground">
              Good evening, Gardener.
            </h2>
          </div>
          {alreadySeen && !dismissed && (
            <p className="text-xs text-muted-foreground">You've already reflected tonight.</p>
          )}
        </div>

        {/* Sections */}
        <LifeMovedSection />
        <ResistanceSection />
        <QuietGrowthSection />
        <NRILearningSection />
        <RestSection />

        {/* Dismiss */}
        {!alreadySeen && !dismissed && (
          <div className="text-center pb-4">
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs text-muted-foreground">
              I've noticed. Rest well.
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
