import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface CrawlStatusProps {
  lastRun: {
    created_at: string;
    status: string;
    stats: {
      auto_discovery_results?: number;
      user_source_results?: number;
      events_inserted?: number;
      events_skipped_duplicate?: number;
      events_pending_extraction?: number;
      events_low_confidence?: number;
      sources_checked?: number;
      sources_cached?: number;
      discovery_engine?: string;
      errors?: number;
      capped?: boolean;
      // New density + reliability stats
      perplexity_parse_failures?: number;
      perplexity_citations_fallback?: number;
      domains_rejected?: number;
      dedupe_prevented?: number;
      long_tail_included?: boolean;
      dry_run?: boolean;
    } | null;
  } | null;
}

export function LocalPulseCrawlStatus({ lastRun }: CrawlStatusProps) {
  const { t } = useTranslation('events');
  if (!lastRun) return null;

  const stats = lastRun.stats;
  const statusIcon = lastRun.status === 'completed'
    ? <CheckCircle className="w-3 h-3 text-green-500" />
    : lastRun.status === 'failed'
    ? <XCircle className="w-3 h-3 text-destructive" />
    : <Clock className="w-3 h-3 text-muted-foreground" />;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
          {statusIcon}
          <span>{formatDistanceToNow(new Date(lastRun.created_at), { addSuffix: true })}</span>
          {stats?.dry_run && <Badge variant="outline" className="text-[10px] h-4 px-1">{t('crawlStatus.dryRun')}</Badge>}
          <Info className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            {t('crawlStatus.lastCrawlDetails')}
            <HelpTooltip
              content={t('crawlStatus.helpTooltip')}
            />
          </h4>
          <div className="flex items-center gap-1.5">
            {statusIcon}
            <span className="text-xs capitalize">{lastRun.status}</span>
            {stats?.discovery_engine && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">{stats.discovery_engine}</Badge>
            )}
          </div>
          {stats && (
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>{t('crawlStatus.sourcesChecked')}</span>
                <span className="font-medium text-foreground">
                  {stats.sources_checked ?? 0}{(stats.sources_cached ?? 0) > 0 ? ` (${t('crawlStatus.cached', { count: stats.sources_cached })})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('crawlStatus.eventsFound')}</span>
                <span className="font-medium text-foreground">
                  {(stats.auto_discovery_results ?? 0) + (stats.user_source_results ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('crawlStatus.inserted')}</span>
                <span className="font-medium text-foreground">{stats.events_inserted ?? 0}</span>
              </div>
              {(stats.events_skipped_duplicate ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>{t('crawlStatus.skippedDuplicates')}</span>
                  <span>{stats.events_skipped_duplicate}</span>
                </div>
              )}
              {(stats.dedupe_prevented ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>{t('crawlStatus.dedupePrevented')}</span>
                  <span>{stats.dedupe_prevented}</span>
                </div>
              )}
              {(stats.domains_rejected ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span>{t('crawlStatus.lowQualityFiltered')}</span>
                  <span>{stats.domains_rejected}</span>
                </div>
              )}
              {(stats.events_pending_extraction ?? 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span>{t('crawlStatus.awaitingParsing')}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {stats.events_pending_extraction}
                  </Badge>
                </div>
              )}
              {(stats.events_low_confidence ?? 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    {t('crawlStatus.lowConfidenceDates')}
                  </span>
                  <span>{stats.events_low_confidence}</span>
                </div>
              )}
              {(stats.perplexity_parse_failures ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('crawlStatus.parseFallbacks')}</span>
                  <span>{stats.perplexity_parse_failures}</span>
                </div>
              )}
              {stats.long_tail_included && (
                <p className="text-[10px] text-primary/70 mt-1">
                  {t('crawlStatus.longTailIncluded')}
                </p>
              )}
              {(stats.errors ?? 0) > 0 && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{t('crawlStatus.didNotComplete')}</span>
                  <span>{stats.errors}</span>
                </div>
              )}
              {stats.capped && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('crawlStatus.hitSafetyCap')}
                </p>
              )}
            </div>
          )}
          {!stats && (
            <p className="text-[11px] text-muted-foreground">{t('crawlStatus.noStats')}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
