/**
 * Movement Intelligence — How care, relationships, and presence are unfolding.
 *
 * WHAT: CROS-native intelligence dashboard organized into 7 movement sections.
 * WHERE: /:tenantSlug/intelligence
 * WHY: Replaces Profunda-era analytics with territory-aware, compass-integrated movement view.
 *
 * HARDENING (v2.7.1):
 *  - Per-card loading skeletons (non-blocking)
 *  - Archetype isolation guards (Part 7)
 *  - Unified window display
 *  - Milestone/memorial extension slots in Restoration (Part 6)
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMovementIntelligence } from '@/hooks/useMovementIntelligence';
import { useTenantCapabilities } from '@/hooks/useTenantCapabilities';
import { VigiliaCompanionCard } from '@/components/vigilia/VigiliaCompanionCard';
import { CommunioAwarenessCard } from '@/components/communio/CommunioAwarenessCard';
import { DiscoveryBriefingPanel } from '@/components/discovery/DiscoveryBriefingPanel';
import { SuggestedActionsFeed } from '@/components/insights/SuggestedActionsFeed';
import { EmailSuggestionsCard } from '@/components/dashboard/EmailSuggestionsCard';
import { useTenantLens } from '@/hooks/useTenantLens';
import { useTenantSectors } from '@/hooks/useTenantSectors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Heart, Users, Calendar, MapPin, MessageSquare, Eye, Package,
  Sparkles, TrendingUp, TrendingDown, Minus, HelpCircle, Hand,
  Compass, Map, BookHeart, Undo2, Search, Activity, Feather, Star,
} from 'lucide-react';
import type {
  TerritoryVitalityData,
  CarePresenceFlowData,
  RelationshipFormationData,
  ActivationEngagementData,
  DiscoveryDiscernmentData,
  RestorationMemoryData,
  NarrativeThreadsData,
} from '@/hooks/useMovementIntelligence';

// ── Help affordance ──
function HelpAffordance() {
  const { t } = useTranslation('intelligence');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
            {t('movementIntelligence.whatYouSeeing')}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>{t('movementIntelligence.whatYouSeeingTooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Loading skeleton (per-card) ──
function SectionSkeleton({ title }: { title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        {title ? (
          <CardTitle className="text-lg text-muted-foreground/50">{title}</CardTitle>
        ) : (
          <Skeleton className="h-6 w-48" />
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Archetype guards (Part 7) ──

/** Returns true if this archetype should NEVER see Territory Vitality */
function shouldHideTerritoryVitality(archetype?: string): boolean {
  return archetype === 'caregiver_solo';
}

/** Returns true if this archetype should NEVER see Metro labels */
function shouldHideMetroLabels(archetype?: string): boolean {
  return archetype === 'missionary';
}

/** Returns true if this archetype should NEVER see "Metro Readiness" */
function shouldHideMetroReadiness(archetype?: string): boolean {
  return archetype === 'rural_org' || archetype === 'missionary';
}

// ── 1. Territory Vitality ──
function TerritoryVitalitySection({ data, archetype }: { data: TerritoryVitalityData; archetype?: string }) {
  const { t } = useTranslation('intelligence');
  // Part 7: Solo caregivers see "Care Rhythm" variant, NOT Territory Vitality
  const isCaregiverSolo = archetype === 'caregiver_solo';
  const title = isCaregiverSolo ? t('movementIntelligence.sections.careRhythm') : t('movementIntelligence.sections.territoryVitality');
  const subtitle = isCaregiverSolo
    ? t('movementIntelligence.sections.careRhythmSubtitle')
    : t('movementIntelligence.sections.territoryVitalitySubtitle');

  const isMissionary = archetype === 'missionary';

  const trendConfig = {
    rising: { icon: TrendingUp, label: t('movementIntelligence.metrics.rising'), className: 'text-green-600 dark:text-green-400' },
    steady: { icon: Minus, label: t('movementIntelligence.metrics.steady'), className: 'text-muted-foreground' },
    declining: { icon: TrendingDown, label: t('movementIntelligence.metrics.declining'), className: 'text-amber-500' },
  };
  const trend = trendConfig[data.momentumTrend];
  const TrendIcon = trend.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {!isCaregiverSolo && (
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <Map className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold">{data.activatedCount}</div>
              <div className="text-[11px] text-muted-foreground">
                {isMissionary ? t('movementIntelligence.metrics.activatedCountries') : t('movementIntelligence.metrics.activatedTerritories')}
              </div>
            </div>
          )}
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Activity className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.activityDensity}</div>
            <div className="text-[11px] text-muted-foreground">
              {isCaregiverSolo ? t('movementIntelligence.metrics.careMoments') : isMissionary ? t('movementIntelligence.metrics.activityPerCountry') : t('movementIntelligence.metrics.activityPerTerritory')}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <TrendIcon className={`w-4 h-4 mx-auto mb-1 ${trend.className}`} />
            <div className="text-sm font-semibold">{trend.label}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.trendLabel')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 2. Care & Presence Flow ──
function CarePresenceSection({ data, archetype }: { data: CarePresenceFlowData; archetype?: string }) {
  const { t } = useTranslation('intelligence');
  const isCaregiverSolo = archetype === 'caregiver_solo';
  const caps = useTenantCapabilities();

  const cards = [
    { label: t('movementIntelligence.metrics.visits'), value: data.visits, icon: Eye, show: true },
    { label: t('movementIntelligence.metrics.events'), value: data.events, icon: Calendar, show: caps.hasEvents },
    { label: t('movementIntelligence.metrics.careRecorded'), value: data.provisions, icon: Package, show: caps.hasProvisio },
    { label: t('movementIntelligence.metrics.reflections'), value: data.reflections, icon: MessageSquare, show: true },
    { label: t('movementIntelligence.metrics.projects'), value: data.projects, icon: Heart, show: true },
    { label: t('movementIntelligence.metrics.hoursLogged'), value: data.hoursLogged, icon: Hand, show: isCaregiverSolo || data.hoursLogged > 0 },
  ].filter(c => c.show);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          {t('movementIntelligence.sections.carePresence')}
        </CardTitle>
        <CardDescription>{t('movementIntelligence.sections.carePresenceSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
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
        {data.visits === 0 && data.events === 0 && data.provisions === 0 && (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4 mt-3">
            {t('movementIntelligence.noActivity')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3. Relationship Formation ──
function RelationshipFormationSection({ data }: { data: RelationshipFormationData }) {
  const { t } = useTranslation('intelligence');
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t('movementIntelligence.sections.relationshipFormation')}
        </CardTitle>
        <CardDescription>{t('movementIntelligence.sections.relationshipFormationSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Users className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.newPeopleAdded}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.newPeople')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Heart className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.partnerConnections}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.activePartners')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <MapPin className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.communioInteractions}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.communioConnections')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 4. Activation & Engagement ──
function ActivationSection({ data }: { data: ActivationEngagementData }) {
  const { t } = useTranslation('intelligence');
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {t('movementIntelligence.sections.activationEngagement')}
        </CardTitle>
        <CardDescription>{t('movementIntelligence.sections.activationEngagementSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Activity className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.territoryEngagementDepth}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.engagementDepth')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Calendar className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.eventDensity}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.eventsThisMonth')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Hand className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.volunteerParticipation}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.volunteersActive')}</div>
          </div>
        </div>
        <SuggestedActionsFeed />
        <VigiliaCompanionCard />
      </CardContent>
    </Card>
  );
}

// ── 5. Discovery & Discernment ──
function DiscoverySection({ data }: { data: DiscoveryDiscernmentData }) {
  const { t } = useTranslation('intelligence');
  const caps = useTenantCapabilities();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          {t('movementIntelligence.sections.discoveryDiscernment')}
        </CardTitle>
        <CardDescription>{t('movementIntelligence.sections.discoveryDiscernmentSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Sparkles className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.opportunitiesExplored}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.opportunitiesExplored')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Search className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.grantsPursued}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.grantsPursued')}</div>
          </div>
        </div>
        <DiscoveryBriefingPanel modules={['events', 'grants']} />
        {caps.hasCommunio && <CommunioAwarenessCard />}
      </CardContent>
    </Card>
  );
}

// ── 6. Restoration & Memory (with life event extension slots) ──
function RestorationSection({ data }: { data: RestorationMemoryData }) {
  const { t } = useTranslation('intelligence');
  const hasActivity = data.recordsRestored > 0 || data.lifeEventsLogged > 0 || data.memorials > 0 || data.milestoneEvents > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Undo2 className="w-5 h-5 text-primary" />
          {t('movementIntelligence.sections.restorationMemory')}
        </CardTitle>
        <CardDescription>{t('movementIntelligence.sections.restorationMemorySubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Undo2 className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.recordsRestored}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.recordsRestored')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <BookHeart className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.lifeEventsLogged}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.lifeEvents')}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Heart className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{data.memorials}</div>
            <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.memorials')}</div>
          </div>
          {data.milestoneEvents > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <Star className="w-4 h-4 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold">{data.milestoneEvents}</div>
              <div className="text-[11px] text-muted-foreground">{t('movementIntelligence.metrics.milestones')}</div>
            </div>
          )}
        </div>
        {!hasActivity && (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4 mt-3">
            {t('movementIntelligence.memoryEmpty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── 7. Narrative Threads ──
function NarrativeThreadsSection({ data }: { data: NarrativeThreadsData }) {
  const { t } = useTranslation('intelligence');
  const compassLabels: Record<string, string> = {
    north: t('movementIntelligence.compassLabels.north'),
    east: t('movementIntelligence.compassLabels.east'),
    south: t('movementIntelligence.compassLabels.south'),
    west: t('movementIntelligence.compassLabels.west'),
  };

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-background to-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Feather className="w-5 h-5 text-primary" />
          {t('movementIntelligence.sections.narrativeThreads')}
        </CardTitle>
        <CardDescription>{t('movementIntelligence.sections.narrativeThreadsSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compass direction */}
        <div className="flex items-center gap-3">
          <Compass className="w-5 h-5 text-primary" />
          <div>
            <span className="text-sm font-medium">{t('movementIntelligence.dominantDirection')}</span>
            <Badge variant="secondary">{compassLabels[data.compassDominant] ?? data.compassDominant}</Badge>
          </div>
        </div>

        {/* Providence threads */}
        {data.providenceSummaries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">{t('movementIntelligence.providenceThreads')}</h4>
            <div className="flex flex-wrap gap-2">
              {data.providenceSummaries.map(s => (
                <Badge key={s.label} variant="outline" className="text-xs gap-1">
                  {s.label}
                  <span className="font-bold">{s.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Quarterly narrative */}
        <div className="bg-muted/20 rounded-lg p-4">
          <p className="text-sm text-foreground/80 leading-relaxed italic">
            "{data.quarterlyNarrative}"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function MovementIntelligence() {
  const { t } = useTranslation('intelligence');
  const { report, isLoading, archetype, window } = useMovementIntelligence();
  const { lens } = useTenantLens();
  const { data: tenantSectors = [] } = useTenantSectors();
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const showEmailSignals = lens === 'steward' || lens === 'shepherd' || lens === 'companion';

  return (
    <MainLayout
      title={t('movementIntelligence.title')}
      subtitle={t('movementIntelligence.subtitle')}
      helpKey="page.intelligence"
      data-testid="intelligence-root"
      headerActions={
        <div className="flex items-center gap-3">
          {tenantSectors.length > 1 && (
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder={t('movementIntelligence.allSectors')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('movementIntelligence.allSectors')}</SelectItem>
                {tenantSectors.map((ts) => (
                  <SelectItem key={ts.sector_id} value={ts.sector_id}>
                    {ts.sector?.name ?? ts.sector_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {window && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {window.label}
            </Badge>
          )}
          <HelpAffordance />
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading || !report ? (
          <>
            {/* Part 5: Per-card named skeletons */}
            <SectionSkeleton title={t('movementIntelligence.sections.territoryVitality')} />
            <SectionSkeleton title={t('movementIntelligence.sections.carePresence')} />
            <SectionSkeleton title={t('movementIntelligence.sections.relationshipFormation')} />
            <SectionSkeleton title={t('movementIntelligence.sections.activationEngagement')} />
            <SectionSkeleton title={t('movementIntelligence.sections.discoveryDiscernment')} />
            <SectionSkeleton title={t('movementIntelligence.sections.restorationMemory')} />
            <SectionSkeleton title={t('movementIntelligence.sections.narrativeThreads')} />
          </>
        ) : (
          <>
            {/* 1. Territory Vitality / Care Rhythm — Part 7: hidden for solo caregivers as standalone card */}
            <TerritoryVitalitySection data={report.territoryVitality} archetype={archetype} />

            {/* 2. Care & Presence */}
            <CarePresenceSection data={report.carePresence} archetype={archetype} />

            {/* Relationship Signals */}
            {showEmailSignals && <EmailSuggestionsCard />}

            {/* 3. Relationship Formation */}
            <RelationshipFormationSection data={report.relationshipFormation} />

            {/* 4. Activation & Engagement */}
            <ActivationSection data={report.activationEngagement} />

            {/* 5. Discovery & Discernment */}
            <DiscoverySection data={report.discoveryDiscernment} />

            {/* 6. Restoration & Memory */}
            <RestorationSection data={report.restorationMemory} />

            {/* 7. Narrative Threads */}
            <NarrativeThreadsSection data={report.narrativeThreads} />
          </>
        )}
      </div>
    </MainLayout>
  );
}
