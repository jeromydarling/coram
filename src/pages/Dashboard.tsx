/**
 * Mission Rhythm — A calm view of how care, relationships, and work are unfolding.
 *
 * WHAT: CROS-native analytics dashboard organized into 4 narrative sections.
 * WHERE: /:tenantSlug/analytics
 * WHY: Replaces Profunda-style ops dashboard with human-centered mission awareness.
 */

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardMetroFilter } from '@/components/dashboard/DashboardMetroFilter';
import { VigiliaCompanionCard } from '@/components/vigilia/VigiliaCompanionCard';
import { CommunioAwarenessCard } from '@/components/communio/CommunioAwarenessCard';
import { DiscoveryBriefingPanel } from '@/components/discovery/DiscoveryBriefingPanel';
import { RecommendationsPanel } from '@/components/dashboard/RecommendationsPanel';
import { SuggestedActionsFeed } from '@/components/insights/SuggestedActionsFeed';
import { useTenantCapabilities } from '@/hooks/useTenantCapabilities';
import { useProvisionMode } from '@/hooks/useProvisionMode';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useState } from 'react';
import { EmailSuggestionsCard } from '@/components/dashboard/EmailSuggestionsCard';
import { useTenantLens } from '@/hooks/useTenantLens';
import { useTranslation } from 'react-i18next';
import {
  Heart, Users, Calendar, MapPin, MessageSquare, Eye, Package,
  Sparkles, TrendingUp, Minus, HelpCircle, Hand,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { subDays, startOfWeek, format } from 'date-fns';

function HelpAffordance() {
  const { t } = useTranslation('dashboard');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
            {t('missionRhythm.helpAffordance')}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>{t('missionRhythm.helpTooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface WeeklyCount {
  activities: number;
  visits: number;
  reflections: number;
  events: number;
  volunteers: number;
  provisions: number;
}

function useThisWeekCounts(metroId: string | null) {
  const { tenantId } = useTenant();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

  return useQuery({
    queryKey: ['mission-rhythm-week', tenantId, metroId, weekStart],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async (): Promise<WeeklyCount> => {
      const [acts, visits, refs, evts, vols, provs] = await Promise.all([
        supabase.from('activities').select('id', { count: 'exact', head: true })
          .gte('activity_date_time', weekStart),
        supabase.from('activities').select('id', { count: 'exact', head: true })
          .gte('activity_date_time', weekStart)
          .in('activity_type', ['Site Visit', 'Visit']),
        supabase.from('opportunity_reflections').select('id', { count: 'exact', head: true })
          .gte('created_at', weekStart),
        supabase.from('events').select('id', { count: 'exact', head: true })
          .eq('is_local_pulse', false)
          .gte('created_at', weekStart),
        supabase.from('volunteers').select('id', { count: 'exact', head: true })
          .gte('created_at', weekStart),
        supabase.from('provisions').select('id', { count: 'exact', head: true })
          .gte('created_at', weekStart),
      ]);

      return {
        activities: acts.count ?? 0,
        visits: visits.count ?? 0,
        reflections: refs.count ?? 0,
        events: evts.count ?? 0,
        volunteers: vols.count ?? 0,
        provisions: provs.count ?? 0,
      };
    },
  });
}

function ThisWeekSection({ metroId }: { metroId: string | null }) {
  const { data, isLoading } = useThisWeekCounts(metroId);
  const caps = useTenantCapabilities();
  const { t } = useTranslation('dashboard');

  const cards = [
    { label: t('missionRhythm.thisWeek.relationshipsTouched'), value: data?.activities ?? 0, icon: Users, show: true },
    { label: t('missionRhythm.thisWeek.visitsCompleted'), value: data?.visits ?? 0, icon: Eye, show: caps.hasVisits },
    { label: t('missionRhythm.thisWeek.reflectionsAdded'), value: data?.reflections ?? 0, icon: MessageSquare, show: true },
    { label: t('missionRhythm.thisWeek.events'), value: data?.events ?? 0, icon: Calendar, show: caps.hasEvents },
    { label: t('missionRhythm.thisWeek.volunteersEngaged'), value: data?.volunteers ?? 0, icon: Hand, show: caps.hasVolunteers },
    { label: t('missionRhythm.thisWeek.careRecorded'), value: data?.provisions ?? 0, icon: Package, show: caps.hasProvisio },
  ].filter(c => c.show);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          {t('missionRhythm.thisWeek.title')}
        </CardTitle>
        <CardDescription>{t('missionRhythm.thisWeek.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cards.map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="bg-muted/30 rounded-lg p-3 text-center">
                  <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-[11px] text-muted-foreground">{c.label}</div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && (data?.activities ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4">
            {t('missionRhythm.thisWeek.noActivity')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CarePresenceSection({ metroId }: { metroId: string | null }) {
  const caps = useTenantCapabilities();
  const { t } = useTranslation('dashboard');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          {t('missionRhythm.carePresence.title')}
        </CardTitle>
        <CardDescription>{t('missionRhythm.carePresence.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {caps.hasMetros ? (
          <RecommendationsPanel metroId={metroId} />
        ) : (
          <div className="bg-muted/20 rounded-lg p-6 text-center">
            <MapPin className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('missionRhythm.carePresence.emptyState')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MomentumSection() {
  const { t } = useTranslation('dashboard');
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {t('missionRhythm.momentum.title')}
        </CardTitle>
        <CardDescription>{t('missionRhythm.momentum.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SuggestedActionsFeed />
        <VigiliaCompanionCard />
      </CardContent>
    </Card>
  );
}

function DiscoverySection({ metroId }: { metroId: string | null }) {
  const caps = useTenantCapabilities();
  const { t } = useTranslation('dashboard');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {t('missionRhythm.discovery.title')}
        </CardTitle>
        <CardDescription>{t('missionRhythm.discovery.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metroId ? (
          <DiscoveryBriefingPanel metroId={metroId} modules={['events', 'grants']} />
        ) : (
          <DiscoveryBriefingPanel modules={['events', 'grants']} />
        )}
        {caps.hasCommunio && <CommunioAwarenessCard />}
        {!caps.hasCommunio && (
          <div className="bg-muted/20 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground italic">
              {t('missionRhythm.discovery.emptyState')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [selectedMetroId, setSelectedMetroId] = useState<string | null>(null);
  const { lens } = useTenantLens();
  const { t } = useTranslation('dashboard');
  const showEmailSignals = lens === 'steward' || lens === 'shepherd' || lens === 'companion';

  return (
    <MainLayout
      title={t('missionRhythm.title')}
      subtitle={t('missionRhythm.subtitle')}
      helpKey="page.command-center"
      data-testid="dashboard-root"
      headerActions={
        <div className="flex items-center gap-3">
          <HelpAffordance />
          <DashboardMetroFilter
            selectedMetroId={selectedMetroId}
            onMetroChange={setSelectedMetroId}
          />
        </div>
      }
    >
      <div className="space-y-6">
        {/* Section 1: This Week */}
        <ThisWeekSection metroId={selectedMetroId} />

        {/* Relationship Signals — email follow-up suggestions */}
        {showEmailSignals && <EmailSuggestionsCard />}

        {/* Section 2: Care & Presence */}
        <CarePresenceSection metroId={selectedMetroId} />

        {/* Section 3: Momentum & Adoption */}
        <MomentumSection />

        {/* Section 4: Discovery & Community */}
        <DiscoverySection metroId={selectedMetroId} />
      </div>
    </MainLayout>
  );
}
