import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Globe, Rss, Calendar as CalIcon, FileText, AlertTriangle, Check, Power, PowerOff, RefreshCw } from 'lucide-react';
import { useLocalPulseSources, useAddLocalPulseSource, useDeleteLocalPulseSource, useToggleLocalPulseSource } from '@/hooks/useLocalPulseSources';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient } from '@tanstack/react-query';

interface LocalPulseSourcesManagerProps {
  metroId: string;
}

const FEED_TYPE_ICONS: Record<string, typeof Rss> = {
  rss: Rss,
  ics: CalIcon,
  html: FileText,
  unknown: Globe,
};

const FEED_TYPE_LABELS: Record<string, string> = {
  rss: 'RSS Feed',
  ics: 'Calendar',
  html: 'Web Page',
  unknown: 'Unknown',
};

export function LocalPulseSourcesManager({ metroId }: LocalPulseSourcesManagerProps) {
  const { t } = useTranslation('events');
  const { data: sources, isLoading } = useLocalPulseSources(metroId);
  const addSource = useAddLocalPulseSource();
  const deleteSource = useDeleteLocalPulseSource();
  const toggleSource = useToggleLocalPulseSource();
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [crawlingSourceId, setCrawlingSourceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    try {
      await addSource.mutateAsync({ url: newUrl.trim(), label: newLabel.trim() || undefined, metroId });
      setNewUrl('');
      setNewLabel('');
    } catch { /* handled by hook */ }
  };

  const handleCrawlSource = async (sourceId: string) => {
    setCrawlingSourceId(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke('local-pulse-worker', {
        body: { metro_id: metroId, source_id: sourceId, run_kind: 'manual' },
      });
      if (error) throw error;
      toast.success(t('sourcesManager.crawlComplete'));
      queryClient.invalidateQueries({ queryKey: ['local-pulse-sources', metroId] });
      // Staggered refetches to catch async extraction results
      const delays = [2000, 8000, 18000, 30000];
      delays.forEach(ms => {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['local-pulse-events'] });
          queryClient.invalidateQueries({ queryKey: ['local-pulse-events-count'] });
        }, ms);
      });
    } catch (err: any) {
      toast.error(t('sourcesManager.crawlFailed', { message: err.message || 'Unknown error' }));
    } finally {
      setCrawlingSourceId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          {t('sourcesManager.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add URL form */}
        <div className="flex gap-2">
          <Input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder={t('sourcesManager.urlPlaceholder')}
            className="flex-1 h-8 text-xs"
          />
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            disabled={!newUrl.trim() || addSource.isPending}
            onClick={handleAdd}
          >
            {addSource.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            {t('sourcesManager.add')}
          </Button>
        </div>

        {/* Sources list */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : sources && sources.length > 0 ? (
          <div className="space-y-2">
            {sources.filter(s => s.source_type === 'url').map(source => {
              const FeedIcon = FEED_TYPE_ICONS[source.detected_feed_type || 'unknown'] || Globe;
              return (
                <div
                  key={source.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-xs",
                    source.enabled ? "border-border/50 bg-background" : "border-border/30 bg-muted/30 opacity-60",
                  )}
                >
                  <FeedIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    {source.label && <p className="truncate font-medium text-xs">{source.label}</p>}
                    <p className="text-muted-foreground text-[10px] break-all leading-tight">{source.url}</p>
                  </div>
                  {source.detected_feed_type && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                      {source.detected_feed_type && ['rss','ics','html','unknown'].includes(source.detected_feed_type) ? t(`sourcesManager.feedTypes.${source.detected_feed_type}`) : source.detected_feed_type}
                    </Badge>
                  )}
                  {source.last_status === 'warning' && (
                    <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                  )}
                  {source.last_status === 'ok' && (
                    <Check className="w-3 h-3 text-green-500 shrink-0" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    disabled={crawlingSourceId === source.id}
                    onClick={() => handleCrawlSource(source.id)}
                    title={t('sourcesManager.crawlNow')}
                  >
                    {crawlingSourceId === source.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => toggleSource.mutate({ id: source.id, enabled: !source.enabled, metroId })}
                  >
                    {source.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive shrink-0"
                    onClick={() => deleteSource.mutate({ id: source.id, metroId })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            {t('sourcesManager.noSources')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
