/**
 * OperatorDiscoveryInsights — Gardener-facing discovery insight feed.
 *
 * WHAT: Calm insight cards showing what visitors explore, where users linger, and which essays await review.
 * WHERE: /operator/nexus/discovery-insights (Zone: SCIENTIA)
 * WHY: Translates behavioral signals into human-language guidance. No charts, no GA jargon.
 *
 * Feature Name: Discovery Insights
 * Primary Purpose: Help Gardeners notice curiosity and friction patterns
 * Chosen Zone: SCIENTIA — Insight & Understanding
 * Why this Zone: Reflective, pattern-oriented, helps Gardener understand rather than act immediately
 * Why NOT others: Not daily workflow (CURA), not system config (MACHINA), not revenue (CRESCERE)
 * Operator Impact: Calm feed of 3/day max, dismiss/snooze, narrative tone
 * Navigation Location: /operator/nexus/discovery-insights
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Lightbulb, BookOpen, X, Clock, ArrowRight } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const TYPE_CONFIG: Record<string, { icon: typeof Eye; label: string; accent: string }> = {
  essay_ready: { icon: BookOpen, label: 'Essay Ready', accent: 'bg-primary/10 text-primary' },
  discovery_interest: { icon: Eye, label: 'Curiosity Signal', accent: 'bg-accent/30 text-accent-foreground' },
  adoption_friction: { icon: Lightbulb, label: 'Worth Noticing', accent: 'bg-muted text-muted-foreground' },
  onboarding_dropoff: { icon: Lightbulb, label: 'Onboarding', accent: 'bg-muted text-muted-foreground' },
  integration_interest: { icon: Eye, label: 'Integration Interest', accent: 'bg-accent/30 text-accent-foreground' },
};

export default function OperatorDiscoveryInsights() {
  const queryClient = useQueryClient();

  const { data: insights, isLoading } = useQuery({
    queryKey: ['gardener-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gardener_insights')
        .select('*')
        .is('dismissed_at', null)
        .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gardener_insights')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gardener-insights'] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: async (id: string) => {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 7);
      const { error } = await supabase
        .from('gardener_insights')
        .update({ snoozed_until: snoozeUntil.toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gardener-insights'] });
      toast.success('Snoozed for 7 days');
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-serif text-foreground">Discovery Insights</h1>
          <HelpTooltip
            what="Calm, human-language observations about what visitors and users find meaningful."
            where="Gardener Console → Scientia"
            why="Helps you notice curiosity and friction patterns without charts or jargon."
          />
        </div>
        <p className="text-sm text-muted-foreground">
          What people seem drawn to — and where they might need a gentler path.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      )}

      {!isLoading && (!insights || insights.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Eye className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-serif italic">
              Nothing requires your attention right now.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Insights appear when patterns emerge from visitor curiosity or user behavior.
            </p>
          </CardContent>
        </Card>
      )}

      {insights?.map((insight: any) => {
        const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.discovery_interest;
        const Icon = config.icon;
        const steps = (insight.suggested_next_steps || []) as { label: string; url?: string }[];

        return (
          <Card key={insight.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded-md ${config.accent}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <Badge variant="outline" className="text-xs mb-1">{config.label}</Badge>
                    <CardTitle className="text-base font-medium text-foreground leading-snug">
                      {insight.title}
                    </CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => snoozeMutation.mutate(insight.id)}
                    title="Snooze 7 days"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => dismissMutation.mutate(insight.id)}
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {insight.body}
              </p>
              {steps.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {steps.map((step, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        if (step.url) window.location.href = step.url;
                      }}
                    >
                      {step.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/50">
                {new Date(insight.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
