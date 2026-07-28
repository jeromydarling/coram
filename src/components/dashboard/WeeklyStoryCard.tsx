/**
 * WeeklyStoryCard — "This Week's Story" card for Command Center.
 *
 * WHAT: Shows the latest narrative thread with cited moments.
 * WHERE: Command Center sidebar.
 * WHY: Connects daily work to a larger narrative without metrics pressure.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function WeeklyStoryCard() {
  const { tenantId, tenant } = useTenant();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation('dashboard');

  const { data: thread, isLoading } = useQuery({
    queryKey: ['weekly-story-thread', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_threads' as any)
        .select('id, title, summary, signals, week_start, status')
        .eq('tenant_id', tenantId!)
        .eq('scope', 'tenant')
        .eq('status', 'published')
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: citations } = useQuery({
    queryKey: ['weekly-story-citations', thread?.id],
    enabled: !!thread?.id && expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_thread_moments' as any)
        .select('rank, used_excerpt')
        .eq('thread_id', thread.id)
        .order('rank', { ascending: true })
        .limit(7);
      if (error) throw error;
      return (data ?? []) as unknown as { rank: number; used_excerpt: string }[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-serif">
          <BookOpen className="w-4 h-4 text-primary" />
          {t('weeklyStory.title')}
          <HelpTooltip content={t('weeklyStory.tooltipContent')} />
        </CardTitle>
        <CardDescription className="text-xs">
          {t('weeklyStory.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {thread ? (
          <>
            <h3 className="text-sm font-semibold text-foreground font-serif">{thread.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{thread.summary}</p>

            {Array.isArray(thread.signals) && thread.signals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(thread.signals as string[]).map((s: string) => (
                  <Badge key={s} variant="outline" className="text-xs capitalize">
                    {s.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}

            {/* Expandable citations */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? t('weeklyStory.hideMoments') : t('weeklyStory.seeCitedMoments')}
            </Button>

            {expanded && citations && citations.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {citations.map((c) => (
                  <div key={c.rank} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">{c.rank}.</span>
                    <p className="text-xs text-foreground/80 leading-relaxed">{c.used_excerpt}</p>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => navigate(`/${tenant?.slug}/narrative-threads`)}
            >
              {t('weeklyStory.readFullStory')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            {t('weeklyStory.emptyState')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
