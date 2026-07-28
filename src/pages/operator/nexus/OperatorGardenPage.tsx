/**
 * OperatorGardenPage — "The Garden" — unified Gardener discernment view.
 *
 * WHAT: Combines Narrative Gravity, Communio Resonance, Living Library drafts,
 *       and non-error Friction Insights into a single contemplative space.
 * WHERE: /operator/nexus/garden — CURA zone.
 * WHY: The Gardener listens for growth. This page reduces the need to visit
 *       multiple Nexus areas by gently surfacing what may be forming.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/sonner';
import {
  Leaf,
  Waves,
  BookOpen,
  Lightbulb,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ── Section 1: Narrative Gravity ──

function NarrativeGravitySection() {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['garden-narrative-gravity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('living_system_signals')
        .select('id, signal_type, anonymized_summary, confidence_score, created_at')
        .in('signal_type', [
          'reflection_moment',
          'community_growth',
          'collaboration_movement',
          'visitor_voice_pattern',
        ])
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: testimoniumThemes } = useQuery({
    queryKey: ['garden-testimonium-themes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('testimonium_events')
        .select('event_kind, summary, source_module, created_at')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lumenSignals } = useQuery({
    queryKey: ['garden-lumen-gravity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lumen_signals')
        .select('signal_type, severity, source_summary, first_detected_at')
        .in('signal_type', ['narrative_surge', 'expansion_ready', 'capacity_growth'])
        .eq('resolved', false)
        .order('first_detected_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  const hasGravity =
    (signals?.length ?? 0) > 0 ||
    (testimoniumThemes?.length ?? 0) > 0 ||
    (lumenSignals?.length ?? 0) > 0;

  const themeMap = new Map<string, number>();
  (testimoniumThemes ?? []).forEach((t) => {
    const key = t.source_module || t.event_kind;
    themeMap.set(key, (themeMap.get(key) || 0) + 1);
  });
  const topThemes = [...themeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-serif">Narrative Gravity</CardTitle>
          <HelpTooltip
            what="Themes forming across tenants through reflections, voice notes, and communal signals."
            where="The Garden → Narrative Gravity"
            why="Shared meaning emerges organically. This section reveals what may be worth noticing."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Something meaningful may be emerging.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasGravity ? (
          <p className="text-sm text-muted-foreground text-center py-6 font-serif italic">
            The soil is quiet. Themes will surface as the community grows.
          </p>
        ) : (
          <>
            {(signals ?? []).slice(0, 4).map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-md border border-border/50 bg-card space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {s.signal_type.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {s.anonymized_summary || 'A theme may be forming…'}
                </p>
              </div>
            ))}

            {topThemes.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Emerging Themes
                </p>
                <div className="flex flex-wrap gap-1">
                  {topThemes.map(([theme, count]) => (
                    <Badge key={theme} variant="outline" className="text-[10px] py-0">
                      {theme.replace(/_/g, ' ')} ({count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(lumenSignals ?? []).length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Narrative Movement
                </p>
                {(lumenSignals ?? []).map((l, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground ml-2 mb-1">
                    · {(l.source_summary as any)?.title || l.signal_type.replace(/_/g, ' ')}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section 2: Resonance ──

function ResonanceSection() {
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['garden-resonance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_resonance_snapshots')
        .select(
          'archetype_key, search_type, signal_count, tenant_count, communio_participation_count, resonant_keywords, testimonium_themes, computed_at'
        )
        .order('computed_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: awarenessSignals } = useQuery({
    queryKey: ['garden-awareness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communio_awareness_signals')
        .select('anonymized_message, source_signal_type, suggested_action, created_at')
        .eq('is_hipaa_safe', true)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  const rows = snapshots ?? [];
  const allThemes = [...new Set(rows.flatMap((r) => (r.testimonium_themes as string[] | null) ?? []))].slice(0, 8);
  const topKeywords = [...new Set(rows.flatMap((r) => (r.resonant_keywords as string[] | null) ?? []))].slice(0, 10);
  const totalSignals = rows.reduce((s: number, r) => s + (r.signal_count || 0), 0);
  const archetypes = new Set(rows.map((r) => r.archetype_key)).size;
  const awareness = awarenessSignals ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-serif">Resonance</CardTitle>
          <HelpTooltip
            what="Communal echoes across tenants — shared discovery patterns, reflections, and signals."
            where="The Garden → Resonance"
            why="Observe what themes resonate across similar missions, without curating or ranking."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Quietly resonating across similar missions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 && awareness.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 font-serif italic">
            No resonance patterns yet. Echoes will form as tenants participate in discovery.
          </p>
        ) : (
          <>
            {rows.length > 0 && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold text-foreground">{totalSignals}</p>
                  <p className="text-[10px] text-muted-foreground">Signals observed</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{archetypes}</p>
                  <p className="text-[10px] text-muted-foreground">Archetype clusters</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{rows.length}</p>
                  <p className="text-[10px] text-muted-foreground">Snapshots</p>
                </div>
              </div>
            )}

            {allThemes.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Shared Themes
                </p>
                <div className="flex flex-wrap gap-1">
                  {allThemes.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px] py-0">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {topKeywords.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Resonant Keywords
                </p>
                <div className="flex flex-wrap gap-1">
                  {topKeywords.map((kw: string) => (
                    <Badge key={kw} variant="secondary" className="text-[10px] py-0">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {awareness.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Communal Awareness
                </p>
                {awareness.slice(0, 3).map((a, i: number) => (
                  <div key={i} className="p-2 rounded border border-border/30 mb-1.5">
                    <p className="text-xs text-foreground">{a.anonymized_message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.suggested_action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section 3: Living Library Flow ──

function LivingLibrarySection() {
  const qc = useQueryClient();

  const { data: drafts, isLoading } = useQuery({
    queryKey: ['garden-library-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_content_drafts')
        .select('id, title, status, editorial_mode, essay_type, voice_origin, is_anchor, gravity_score, created_at')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_content_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Essay approved for editing');
      qc.invalidateQueries({ queryKey: ['garden-library-drafts'] });
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  const items = drafts ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-serif">Living Library</CardTitle>
            <HelpTooltip
              what="NRI essay drafts and library reflections awaiting Gardener review."
              where="The Garden → Living Library"
              why="Stories grow when they're ready. Review drafts and approve what resonates."
            />
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/operator/nexus/library" className="text-xs text-muted-foreground">
              Full Library <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Stories awaiting review.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 font-serif italic">
            No drafts awaiting review. The library is at rest.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border border-border/50 bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground font-serif truncate">
                    {d.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {d.editorial_mode?.replace(/_/g, ' ') || d.essay_type || 'essay'}
                    </Badge>
                    {d.voice_origin === 'nri' && (
                      <Badge variant="secondary" className="text-[10px]">NRI</Badge>
                    )}
                    {d.is_anchor && (
                      <Badge variant="default" className="text-[10px]">Anchor</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => publishMutation.mutate(d.id)}
                    disabled={publishMutation.isPending}
                    title="Approve for editing"
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" asChild title="Open draft">
                    <Link to="/operator/nexus/content">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section 4: Friction Insights (Human Only) ──

function FrictionInsightsSection() {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['garden-friction-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_design_suggestions')
        .select('id, pattern_key, suggestion_summary, narrative_detail, severity, status, created_at')
        .in('status', ['open', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: playbooks } = useQuery({
    queryKey: ['garden-friction-playbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_playbook_drafts')
        .select('id, title, role, status, created_at')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  const items = suggestions ?? [];
  const playbookItems = playbooks ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-serif">Friction Insights</CardTitle>
            <HelpTooltip
              what="Non-error friction patterns that may improve the human experience."
              where="The Garden → Friction Insights"
              why="These insights emerge from how people navigate the system — loops, hesitations, and moments of confusion."
            />
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/operator/nexus/friction" className="text-xs text-muted-foreground">
              All Signum <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gentle patterns worth noticing.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && playbookItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 font-serif italic">
            No friction patterns to surface. The experience feels smooth.
          </p>
        ) : (
          <>
            {items.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-md border border-border/50 bg-card space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {s.severity}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground">{s.suggestion_summary}</p>
              </div>
            ))}

            {playbookItems.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Suggested Playbooks
                </p>
                {playbookItems.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded border border-border/30 mb-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{p.title}</p>
                      {p.role && (
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {p.role}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/operator/nexus/playbooks">
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function OperatorGardenPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">The Garden</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-prose">
          A contemplative view of ecosystem movement. No analytics, no urgency — just the
          living rhythm of growth, resonance, and emerging narrative.
        </p>
      </div>

      {/* Four sections in a calm, spacious layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NarrativeGravitySection />
        <ResonanceSection />
      </div>

      <LivingLibrarySection />

      <FrictionInsightsSection />
    </div>
  );
}
