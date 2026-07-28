import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface FeedItem {
  id: string;
  title: string;
  summary: string;
  priority_score: number;
  created_at: string;
  signal_id: string | null;
}

function PriorityBadge({ score }: { score: number }) {
  const { t } = useTranslation('intelligence');
  if (score >= 50) return <Badge variant="destructive">{t('intelligenceFeed.priority.high')}</Badge>;
  if (score >= 20) return <Badge variant="outline">{t('intelligenceFeed.priority.medium')}</Badge>;
  return <Badge variant="secondary">{t('intelligenceFeed.priority.low')}</Badge>;
}

export default function IntelligenceFeed() {
  const { t } = useTranslation('intelligence');
  const { data: feedItems, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['intelligence-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intelligence_feed_items')
        .select('*')
        .order('priority_score', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as FeedItem[];
    },
  });

  return (
    <MainLayout title={t('intelligenceFeed.title')} helpKey="page.intel-feed">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{t('intelligenceFeed.subtitle')}</p>
          <Button data-tour="intel-refresh" variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            {t('intelligenceFeed.refresh')}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !feedItems || feedItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('intelligenceFeed.empty')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" data-tour="intel-feed-list">
            {feedItems.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{item.title}</h3>
                        <PriorityBadge score={item.priority_score} />
                      </div>
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-muted-foreground">
                        {item.priority_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
