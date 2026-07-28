import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Radio, Clock } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHomeTerritory, useHomeMetroId } from '@/hooks/useHomeTerritory';
import { HomeMetroSetupCard } from './HomeMetroSetupCard';
import { LocalPulseSourcesManager } from './LocalPulseSourcesManager';
import { LocalPulseKeywordTuner } from './LocalPulseKeywordTuner';
import { LocalPulseEventCard, type LocalPulseEvent } from './LocalPulseEventCard';
import { LocalPulseCrawlStatus } from './LocalPulseCrawlStatus';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTerritories } from '@/hooks/useTerritories';
import { toast } from '@/components/ui/sonner';

const PAGE_SIZE = 12;

export function LocalPulseSection() {
  const { t } = useTranslation('events');
  const { data: homeTerritory, isLoading: metroLoading } = useHomeTerritory();
  const { pathname } = useLocation();
  const isOperator = pathname.startsWith('/operator');
  
  // Operator: browse any metro; Tenant: locked to home territory
  const [operatorMetroId, setOperatorMetroId] = useState<string | null>(null);
  const { data: allTerritories } = useTerritories();
  
  const homeMetroId = isOperator
    ? operatorMetroId ?? homeTerritory?.metro_id ?? null
    : homeTerritory?.metro_id ?? null;
    
  const [showSources, setShowSources] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [changingHome, setChangingHome] = useState(false);
  const queryClient = useQueryClient();

  // Build metro options for operator selector
  const metroOptions = (allTerritories ?? [])
    .filter(t => t.territory_type === 'metro')
    .reduce((acc, t) => {
      // Deduplicate by metro_id
      if (t.metro_id && !acc.find(o => o.metroId === t.metro_id)) {
        acc.push({ metroId: t.metro_id, label: t.state_code ? `${t.name}, ${t.state_code}` : t.name });
      }
      return acc;
    }, [] as Array<{ metroId: string; label: string }>)
    .sort((a, b) => a.label.localeCompare(b.label));

  // Set initial operator metro to home territory's metro
  useEffect(() => {
    if (isOperator && !operatorMetroId && homeTerritory?.metro_id) {
      setOperatorMetroId(homeTerritory.metro_id);
    }
  }, [isOperator, operatorMetroId, homeTerritory?.metro_id]);

  const selectedMetroLabel = metroOptions.find(o => o.metroId === homeMetroId)?.label;
  const homeMetroName = isOperator ? selectedMetroLabel : homeTerritory?.name;

  // Count total for pagination
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['local-pulse-events-count', homeMetroId, showPast],
    queryFn: async () => {
      if (!homeMetroId) return 0;
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('metro_id', homeMetroId)
        .eq('is_local_pulse', true);

      if (!showPast) {
        query = query.or(
          `and(metadata->>dismissed.is.null,event_date.gte.${today}),and(metadata->>dismissed.neq.true,event_date.gte.${today}),and(metadata->>dismissed.is.null,event_date.is.null),and(metadata->>dismissed.neq.true,event_date.is.null)`,
        );
      } else {
        query = query.or('metadata->>dismissed.is.null,metadata->>dismissed.neq.true');
      }
      const { count } = await query;
      return count ?? 0;
    },
    enabled: !!homeMetroId,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handlePageChange = useCallback((page: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (page <= 1) {
        next.delete('page');
      } else {
        next.set('page', String(page));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const { data: pulseEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['local-pulse-events', homeMetroId, showPast, currentPage, pageSize],
    queryFn: async (): Promise<LocalPulseEvent[]> => {
      if (!homeMetroId) return [];
      const from = (currentPage - 1) * pageSize;
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('events')
        .select('id, event_name, event_date, end_date, city, host_organization, url, description, is_local_pulse, needs_review, date_confidence, extraction_status, metadata')
        .eq('metro_id', homeMetroId)
        .eq('is_local_pulse', true)
        .order('event_date', { ascending: true, nullsFirst: false })
        .range(from, from + pageSize - 1);

      if (!showPast) {
        query = query.or(
          `and(metadata->>dismissed.is.null,event_date.gte.${today}),and(metadata->>dismissed.neq.true,event_date.gte.${today}),and(metadata->>dismissed.is.null,event_date.is.null),and(metadata->>dismissed.neq.true,event_date.is.null)`,
        );
      } else {
        query = query.or('metadata->>dismissed.is.null,metadata->>dismissed.neq.true');
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as LocalPulseEvent[];
    },
    enabled: !!homeMetroId,
  });

  const { data: lastRun } = useQuery({
    queryKey: ['local-pulse-last-run', homeMetroId],
    queryFn: async () => {
      if (!homeMetroId) return null;
      const { data, error } = await supabase
        .from('local_pulse_runs')
        .select('*')
        .eq('metro_id', homeMetroId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!homeMetroId,
  });

  // Pending dismiss: track IDs with countdown seconds
  const [pendingDismisses, setPendingDismisses] = useState<Record<string, number>>({});
  const dismissTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  // IDs that have been committed to DB — kept hidden even through refetches
  const [committedIds, setCommittedIds] = useState<Set<string>>(new Set());
  // Track which IDs were undone so setTimeout can check
  const undoneRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      Object.values(dismissTimers.current).forEach(clearInterval);
    };
  }, []);

  const handleDismiss = useCallback((eventId: string) => {
    undoneRef.current.delete(eventId);
    setPendingDismisses(prev => ({ ...prev, [eventId]: 8 }));

    // Countdown interval
    const interval = setInterval(() => {
      setPendingDismisses(prev => {
        const current = prev[eventId];
        if (current === undefined || current <= 1) {
          clearInterval(interval);
          delete dismissTimers.current[eventId];
          const next = { ...prev };
          delete next[eventId];
          return next;
        }
        return { ...prev, [eventId]: current - 1 };
      });
    }, 1000);
    dismissTimers.current[eventId] = interval;

    // Commit after 8 seconds unless undone
    setTimeout(async () => {
      if (undoneRef.current.has(eventId)) {
        undoneRef.current.delete(eventId);
        return;
      }
      setCommittedIds(prev => new Set(prev).add(eventId));
      // Merge dismissed flag into existing metadata instead of overwriting
      const { data: existing } = await supabase
        .from('events')
        .select('metadata')
        .eq('id', eventId)
        .single();
      const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
      await supabase
        .from('events')
        .update({ needs_review: false, metadata: { ...existingMeta, dismissed: true } } as any)
        .eq('id', eventId);
      queryClient.invalidateQueries({ queryKey: ['local-pulse-events'] });
      queryClient.invalidateQueries({ queryKey: ['local-pulse-events-count'] });
    }, 8000);
  }, [queryClient]);

  const handleUndoDismiss = useCallback((eventId: string) => {
    undoneRef.current.add(eventId);
    if (dismissTimers.current[eventId]) {
      clearInterval(dismissTimers.current[eventId]);
      delete dismissTimers.current[eventId];
    }
    setPendingDismisses(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  const handleAdd = async (eventId: string) => {
    // Hide immediately
    setCommittedIds(prev => new Set(prev).add(eventId));
    const { error } = await supabase
      .from('events')
      .update({ is_local_pulse: false } as any)
      .eq('id', eventId);
    if (!error) {
      toast.success(t('localPulse.eventAddedToast'));
      queryClient.invalidateQueries({ queryKey: ['local-pulse-events'] });
      queryClient.invalidateQueries({ queryKey: ['local-pulse-events-count'] });
    }
  };

  // Local Pulse is available for any tenant with a home territory

  if (metroLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOperator && (!homeMetroId || changingHome)) {
    return <HomeMetroSetupCard
      currentName={changingHome ? homeMetroName : undefined}
      onCancel={changingHome ? () => setChangingHome(false) : undefined}
      onSaved={() => setChangingHome(false)}
    />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Radio className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Local Pulse</h3>
          {isOperator ? (
            <Select value={homeMetroId ?? ''} onValueChange={setOperatorMetroId}>
              <SelectTrigger className="h-6 w-auto min-w-[180px] text-[10px] gap-1">
                <MapPin className="w-2.5 h-2.5" />
                <SelectValue placeholder={t('localPulse.selectMetro')} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {metroOptions.map(o => (
                  <SelectItem key={o.metroId} value={o.metroId} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : homeMetroName ? (
            <Badge
              variant="outline"
              className="text-[10px] h-5 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => setChangingHome(true)}
              title={t('localPulse.changeHomeTitle')}
            >
              <MapPin className="w-2.5 h-2.5 mr-0.5" />
              {homeMetroName}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LocalPulseCrawlStatus lastRun={lastRun} />
          <div className="flex-1" />
          <Button
            variant={showPast ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowPast(!showPast)}
          >
            <Clock className="w-3 h-3" />
            {showPast ? t('localPulse.upcoming') : t('localPulse.all')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowSources(!showSources)}
          >
            {t('localPulse.sources')}
          </Button>
        </div>
        <LocalPulseKeywordTuner />
      </div>

      {showSources && <LocalPulseSourcesManager metroId={homeMetroId} />}

      {/* Events list */}
      {eventsLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (() => {
        const visibleEvents = (pulseEvents || []).filter(e => !committedIds.has(e.id));
        // Only subtract items still in the query results but hidden locally
        const hiddenFromQuery = (pulseEvents || []).filter(e => committedIds.has(e.id)).length;
        const adjustedTotal = Math.max(0, totalCount - hiddenFromQuery);
        const adjustedTotalPages = Math.max(1, Math.ceil(adjustedTotal / pageSize));
        return visibleEvents.length > 0 ? (
        <div className="space-y-2">
          {visibleEvents.map(event => (
            <LocalPulseEventCard
              key={event.id}
              event={event}
              onDismiss={handleDismiss}
              onAdd={handleAdd}
              pendingDismiss={pendingDismisses[event.id] !== undefined ? {
                secondsLeft: pendingDismisses[event.id],
                onUndo: () => handleUndoDismiss(event.id),
              } : undefined}
            />
          ))}
          <PaginationControls
            currentPage={currentPage}
            totalPages={adjustedTotalPages}
            pageSize={pageSize}
            totalItems={adjustedTotal}
            onPageChange={handlePageChange}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <Radio className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {showPast ? t('localPulse.noEventsDiscovered') : t('localPulse.noUpcomingEventsDiscovered')}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {t('localPulse.emptyDescription')}
            </p>
          </CardContent>
        </Card>
      );
      })()}
    </div>
  );
}
