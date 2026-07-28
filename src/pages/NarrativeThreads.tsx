/**
 * NarrativeThreads — Weekly story threads page.
 *
 * WHAT: Shows narrative threads with citations, organized by week.
 * WHERE: /:tenantSlug/narrative-threads
 * WHY: Gives teams a story-first view of their work without metrics pressure.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { format, startOfWeek } from 'date-fns';

function ThreadCard({ thread }: { thread: any }) {
  const { t } = useTranslation('narrative');
  const [expanded, setExpanded] = useState(false);

  const { data: citations } = useQuery({
    queryKey: ['thread-citations', thread.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_thread_moments' as any)
        .select('rank, used_excerpt')
        .eq('thread_id', thread.id)
        .order('rank', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as { rank: number; used_excerpt: string }[];
    },
  });

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-serif">{thread.title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('narrativeThreads.weekOf', { date: format(new Date(thread.week_start + 'T00:00:00'), 'MMM d, yyyy') })}
            </p>
          </div>
          {Array.isArray(thread.signals) && thread.signals.length > 0 && (
            <div className="flex flex-wrap gap-1 shrink-0">
              {(thread.signals as string[]).slice(0, 3).map((s: string) => (
                <Badge key={s} variant="outline" className="text-xs capitalize">
                  {s.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{thread.summary}</p>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? t('narrativeThreads.threadCard.hideCitedMoments') : t('narrativeThreads.threadCard.seeCitedMoments')}
        </Button>

        {expanded && citations && citations.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground italic mb-2">
              {t('narrativeThreads.threadCard.citationsIntro')}
            </p>
            {citations.map((c) => (
              <div key={c.rank} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">{c.rank}.</span>
                <p className="text-xs text-foreground/80 leading-relaxed">{c.used_excerpt}</p>
              </div>
            ))}
          </div>
        )}

        {expanded && (!citations || citations.length === 0) && (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            {t('narrativeThreads.threadCard.noCitedMoments')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function NarrativeThreads() {
  const { t } = useTranslation('narrative');
  const { tenantId } = useTenant();
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const thisWeekStr = format(thisWeekStart, 'yyyy-MM-dd');

  const { data: threads, isLoading } = useQuery({
    queryKey: ['narrative-threads', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('narrative_threads' as any)
        .select('id, title, summary, signals, week_start, status, scope')
        .eq('tenant_id', tenantId!)
        .eq('status', 'published')
        .order('week_start', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const thisWeekThreads = threads?.filter(thread => thread.week_start === thisWeekStr) || [];
  const archiveThreads = threads?.filter(thread => thread.week_start !== thisWeekStr) || [];

  return (
    <MainLayout
      title={t('narrativeThreads.title')}
      mobileTitle={t('narrativeThreads.mobileTitle')}
      subtitle={t('narrativeThreads.subtitle')}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <Tabs defaultValue="this-week">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="this-week">{t('narrativeThreads.tabs.thisWeek')}</TabsTrigger>
            <TabsTrigger value="archive">{t('narrativeThreads.tabs.archive')}</TabsTrigger>
          </TabsList>

          <TabsContent value="this-week" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : thisWeekThreads.length > 0 ? (
              thisWeekThreads.map(thread => <ThreadCard key={thread.id} thread={thread} />)
            ) : (
              <Card className="border-dashed border-primary/20">
                <CardContent className="py-12 text-center space-y-3">
                  <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto italic">
                    {t('narrativeThreads.emptyThisWeek')}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="archive" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : archiveThreads.length > 0 ? (
              archiveThreads.map(thread => <ThreadCard key={thread.id} thread={thread} />)
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">{t('narrativeThreads.emptyArchive')}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
