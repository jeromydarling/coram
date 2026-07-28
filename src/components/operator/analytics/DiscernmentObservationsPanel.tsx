/**
 * DiscernmentObservationsPanel — Narrative cards for Collective Discernment Signals.
 *
 * WHAT: Shows NRI-generated human-language observations from anonymous marketing interaction patterns.
 * WHERE: /operator/nexus/analytics (Operator Console → SCIENTIA zone).
 * WHY: Replaces charts with calm narrative insights — what language resonates, what reflections pause visitors.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, BookOpen, MessageCircle, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

/* ── NRI Observations from DB ── */
function NRIObservationCards() {
  const { data: observations, isLoading } = useQuery({
    queryKey: ['nri-observations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_nri_observations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        title: string;
        body: string;
        suggested_action: string | null;
        signal_count: number;
        observation_type: string;
        created_at: string;
      }>;
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;
  if (!observations?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground" style={serif}>
            No observations yet. NRI will begin noticing patterns as visitors interact with your marketing pages.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {observations.map((obs) => (
        <Card key={obs.id} className="border-border/50">
          <CardContent className="py-5 px-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-foreground" style={serif}>{obs.title}</h3>
              <Badge variant="outline" className="text-xs shrink-0">{obs.signal_count} signals</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3" style={serif}>{obs.body}</p>
            {obs.suggested_action && (
              <p className="text-xs text-primary/80 italic">
                <Sparkles className="w-3 h-3 inline mr-1" />
                {obs.suggested_action}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Aggregate Signal Stats ── */
function SignalStatsCards() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['discernment-signal-stats', weekAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_discernment_signals')
        .select('page_key, event_key')
        .gte('created_at', weekAgo);
      if (error) throw error;
      const rows = (data || []) as Array<{ page_key: string; event_key: string }>;

      // Aggregate
      const pageCounts: Record<string, number> = {};
      const eventCounts: Record<string, number> = {};
      for (const r of rows) {
        pageCounts[r.page_key] = (pageCounts[r.page_key] || 0) + 1;
        eventCounts[r.event_key] = (eventCounts[r.event_key] || 0) + 1;
      }

      const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const topEvents = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return { total: rows.length, topPages, topEvents };
    },
  });

  if (isLoading) return <Skeleton className="h-20" />;
  if (!stats || stats.total === 0) return null;

  const pageLabels: Record<string, string> = {
    'see-people': 'See People',
    archetypes: 'Archetypes',
    roles: 'Roles',
    pricing: 'Pricing',
    manifesto: 'Manifesto',
    essays: 'Essays',
    libraries: 'Libraries',
  };

  const eventLabels: Record<string, string> = {
    reflection_card_opened: 'Reflections opened',
    question_expanded: 'Questions expanded',
    essay_read_start: 'Essays started',
    essay_read_complete: 'Essays completed',
    cta_clicked: 'CTAs clicked',
    archetype_story_opened: 'Archetype stories opened',
    page_view: 'Page views',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total */}
      <Card>
        <CardContent className="py-4 px-4">
          <p className="text-xs text-muted-foreground mb-1">Anonymous Interactions</p>
          <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">last 7 days</p>
        </CardContent>
      </Card>

      {/* Top Pages */}
      <Card>
        <CardContent className="py-4 px-4">
          <p className="text-xs text-muted-foreground mb-2">Pages Drawing Attention</p>
          <div className="space-y-1">
            {stats.topPages.map(([page, count]) => (
              <div key={page} className="flex justify-between text-sm">
                <span className="text-foreground">{pageLabels[page] || page}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Events */}
      <Card>
        <CardContent className="py-4 px-4">
          <p className="text-xs text-muted-foreground mb-2">Patterns of Engagement</p>
          <div className="space-y-1">
            {stats.topEvents.map(([event, count]) => (
              <div key={event} className="flex justify-between text-sm">
                <span className="text-foreground">{eventLabels[event] || event}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Panel ── */
export default function DiscernmentObservationsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Collective Discernment
          </h2>
          <HelpTip text="Anonymous interaction patterns from marketing pages. NRI interprets what language and reflections resonate with visitors — no individual tracking, no PII." />
        </div>
        <p className="text-xs text-muted-foreground mb-4" style={serif}>
          Noticing what draws attention, what invites pause, what questions people carry.
        </p>
      </div>

      <SignalStatsCards />

      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            NRI Observations
          </h3>
          <HelpTip text="Human-language insights generated daily from aggregated anonymous signals. These are observations, not directives." />
        </div>
        <NRIObservationCards />
      </div>
    </div>
  );
}
