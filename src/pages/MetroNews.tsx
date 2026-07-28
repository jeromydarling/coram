import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMetros } from '@/hooks/useMetros';
import type { MetroNarrative } from '@/hooks/useMetroNarratives';
import { MainLayout } from '@/components/layout/MainLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Newspaper, Clock, Sparkles, TrendingUp, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

function useAllLatestNarratives(metroId: string | null) {
  return useQuery({
    queryKey: ['metro-narratives-all-latest', metroId],
    queryFn: async (): Promise<(MetroNarrative & { metro_name: string })[]> => {
      let query = supabase
        .from('metro_narratives')
        .select('*, metros!inner(metro)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (metroId) {
        query = query.eq('metro_id', metroId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        metro_name: row.metros?.metro || 'Unknown',
      })) as (MetroNarrative & { metro_name: string })[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function MetroNews() {
  const { t } = useTranslation('metros');
  const [selectedMetroId, setSelectedMetroId] = useState<string | null>(null);
  const { data: metros, isLoading: metrosLoading } = useMetros();
  const { data: narratives, isLoading } = useAllLatestNarratives(selectedMetroId);

  return (
    <MainLayout title={t('metroNews.title')} subtitle={t('metroNews.subtitle')} helpKey="page.metro-narratives" data-testid="narratives-root">
      <div className="space-y-6">
        {/* Metro filter */}
        <div className="flex items-center gap-2 justify-end" data-tour="narrative-metro-filter">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <Select
            value={selectedMetroId || 'all'}
            onValueChange={(v) => setSelectedMetroId(v === 'all' ? null : v)}
            disabled={metrosLoading}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('metroNews.allMetros')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('metroNews.allMetros')}</SelectItem>
              {metros?.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-2/3" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : !narratives?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">{t('metroNews.noStories')}</p>
            <p className="text-sm mt-1">{t('metroNews.noStoriesMessage')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-tour="narrative-feed">
          {narratives.map((n) => (
            <NarrativeCard key={n.id} narrative={n} />
          ))}
        </div>
      )}
      </div>
    </MainLayout>
  );
}

function NarrativeCard({ narrative }: { narrative: MetroNarrative & { metro_name: string } }) {
  const { t } = useTranslation('metros');
  const [expanded, setExpanded] = useState(false);
  const json = narrative.narrative_json;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <MapPin className="w-3 h-3" />
                {narrative.metro_name}
              </Badge>
              {narrative.ai_generated && (
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <CardTitle className="text-base leading-snug">
              {narrative.headline || `${narrative.metro_name} Community Story`}
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(narrative.created_at), 'MMM d, yyyy')}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Community story snippet */}
        {json?.community_story && (
          <p className={`text-sm text-muted-foreground ${!expanded ? 'line-clamp-3' : ''}`}>
            {json.community_story}
          </p>
        )}

        {/* Emerging patterns */}
        {expanded && json?.emerging_patterns && json.emerging_patterns.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> {t('metroNews.card.emergingPatterns')}
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {json.emerging_patterns.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Partner response clusters */}
        {expanded && json?.partner_response_clusters && json.partner_response_clusters.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {t('metroNews.card.partnerResponses')}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {json.partner_response_clusters.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {c.org_name}{c.trend ? ` — ${c.trend}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Gentle outlook */}
        {expanded && json?.gentle_outlook && (
          <div className="p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground italic">
            {json.gentle_outlook}
          </div>
        )}

        {/* Source stats */}
        {expanded && narrative.source_summary && (
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            {narrative.source_summary.org_count != null && (
              <span>{t('metroNews.card.orgsCount', { count: narrative.source_summary.org_count })}</span>
            )}
            {narrative.source_summary.external_signal_count != null && (
              <span>{t('metroNews.card.signalsCount', { count: narrative.source_summary.external_signal_count })}</span>
            )}
            {narrative.source_summary.rising_orgs != null && (
              <span>{t('metroNews.card.risingCount', { count: narrative.source_summary.rising_orgs })}</span>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          {expanded ? t('metroNews.card.showLess') : t('metroNews.card.readFull')}
        </button>
      </CardContent>
    </Card>
  );
}
