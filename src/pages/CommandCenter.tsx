import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useEmailInsightsPanel } from '@/contexts/EmailInsightsPanelContext';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommandCenter } from '@/hooks/useCommandCenter';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardMode } from '@/hooks/useDashboardMode';
import { DashboardModeToggle } from '@/components/dashboard/DashboardModeToggle';

const CommandCenterStory = lazy(() => import('./CommandCenterStory'));

import { WeeklySnapshot } from '@/components/dashboard/WeeklySnapshot';
import { FridayWeeklyScorecard } from '@/components/dashboard/FridayWeeklyScorecard';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { RecycleBinWidget } from '@/components/recycle/RecycleBinWidget';
import { getWeekMode } from '@/lib/weekDate';
import { useTenantLens } from '@/hooks/useTenantLens';
import { WeeklyFocusCard } from '@/components/weekly-plan/WeeklyFocusCard';
import { StaleNextStepsCard } from '@/components/dashboard/StaleNextStepsCard';
import { LeadershipBriefCard } from '@/components/dashboard/LeadershipBriefCard';
import { EventDayBanner } from '@/components/dashboard/EventDayBanner';
import { useEventDayBanner } from '@/hooks/useEventDayBanner';
import { LocalPulseCard } from '@/components/dashboard/LocalPulseCard';
import { StorySignalsCard } from '@/components/dashboard/StorySignalsCard';
import { WeeklyStoryCard } from '@/components/dashboard/WeeklyStoryCard';
import { FormationCard } from '@/components/dashboard/FormationCard';
import { LivingSignalCard } from '@/components/living/LivingSignalCard';
import { DemoActivityPulse } from '@/components/demo/DemoActivityPulse';

import { MetroDiscoveryCard } from '@/components/dashboard/MetroDiscoveryCard';
import { TeamCapacityCard } from '@/components/dashboard/TeamCapacityCard';
import { enqueuePushNotification } from '@/lib/notifications';
import { 
  AlertTriangle, 
  Target, 
  Clock, 
  TrendingUp, 
  Zap, 
  Calendar,
  ArrowRight,
  ChevronRight,
  Building2,
  GitBranch,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';


export default function CommandCenter() {
  const { t } = useTranslation('intelligence');
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading } = useCommandCenter();
  const { data: eventDayEvents } = useEventDayBanner();
  const isWarehouseManager = roles.includes('warehouse_manager');
  const { mode, setMode } = useDashboardMode();
  const { lens } = useTenantLens();
  
  
  // Deep link handling
  const openParam = searchParams.get('open');
  const shouldOpenWeeklyPlan = openParam === 'weekly_plan';
  const shouldOpenBundles = openParam === 'bundles';
  const { setIsOpen: setEmailPanelOpen } = useEmailInsightsPanel();
  
  // Event week push notification (once per day)
  useEffect(() => {
    const checkEventWeek = async () => {
      const lastCheck = localStorage.getItem('profunda_event_week_check');
      const today = new Date().toDateString();
      if (lastCheck === today) return;
      
      enqueuePushNotification('event_week').catch(console.error);
      localStorage.setItem('profunda_event_week_check', today);
    };
    
    if (user) {
      checkEventWeek();
    }
  }, [user]);
  
  // Open the bundle review panel if deep link param is set
  useEffect(() => {
    if (shouldOpenBundles) {
      setEmailPanelOpen(true);
      // Clean the query param so refreshing doesn't re-open
      searchParams.delete('open');
      setSearchParams(searchParams, { replace: true });
    }
  }, [shouldOpenBundles]);


  const navigateToItem = (link?: { type: string; id: string }) => {
    if (!link) return;
    switch (link.type) {
      case 'opportunity':
        navigate(`/opportunities?selected=${link.id}`);
        break;
      case 'pipeline':
        navigate(`/pipeline?selected=${link.id}`);
        break;
      case 'grant':
        navigate(`/grants?selected=${link.id}`);
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stale_opportunity':
        return <Clock className="w-4 h-4" />;
      case 'pipeline_near':
        return <GitBranch className="w-4 h-4" />;
      case 'grant_deadline':
        return <FileText className="w-4 h-4" />;
      case 'overdue_followup':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'stale_opportunity':
        return { label: t('commandCenter.badges.stale'), variant: 'warning' as const };
      case 'pipeline_near':
        return { label: t('commandCenter.badges.nearWin'), variant: 'success' as const };
      case 'grant_deadline':
        return { label: t('commandCenter.badges.grant'), variant: 'info' as const };
      case 'overdue_followup':
        return { label: t('commandCenter.badges.overdue'), variant: 'destructive' as const };
      default:
        return { label: t('commandCenter.badges.task'), variant: 'secondary' as const };
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'border-l-destructive bg-destructive/5';
      case 'medium':
        return 'border-l-warning bg-warning/5';
      default:
        return 'border-l-muted';
    }
  };

  // Story View with fallback
  if (mode === 'story' && !isWarehouseManager) {
    return (
      <MainLayout
        title={t('commandCenter.storyTitle')}
        mobileTitle={t('commandCenter.storyMobileTitle')}
        subtitle={t('commandCenter.storySubtitle')}
        headerActions={<DashboardModeToggle mode={mode} onModeChange={setMode} />}
        data-testid="command-center-root"
      >
        <Suspense fallback={<div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>}>
          <CommandCenterStory onError={() => setMode('operational')} />
        </Suspense>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title={t('commandCenter.title')}
      mobileTitle={t('commandCenter.mobileTitle')}
      data-testid="command-center-root"
      subtitle={t('commandCenter.subtitleTemplate', { name: user?.email ? `, ${user.email.split('@')[0]}` : '' })}
      headerActions={!isWarehouseManager ? <DashboardModeToggle mode={mode} onModeChange={setMode} /> : undefined}
      helpKey="page.command-center"
    >
      <div className="space-y-6">

        {/* Event Day Banner - only shows when today is a conference day */}
        {eventDayEvents && eventDayEvents.length > 0 && (
          <EventDayBanner events={eventDayEvents} />
        )}



        {/* Weekly Snapshot - Full Width */}
        <div data-tour="weekly-snapshot">
          <WeeklySnapshot />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Focus Items - Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">

            {getWeekMode() === 'review' && (
              <FridayWeeklyScorecard metroFilter={null} />
            )}

            {/* Top 5 Focus Items */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary shrink-0" />
                      <span className="truncate">{t('commandCenter.focusItems.title')}</span>
                      <HelpTooltip contentKey="card.top-focus-items" />
                    </CardTitle>
                    <CardDescription className="truncate">{t('commandCenter.focusItems.description')}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 self-start sm:self-center">
                    {t('commandCenter.focusItems.items', { count: data?.focusItems?.length || 0 })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </>
                ) : data?.focusItems?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success/50" />
                    <p className="font-medium">{t('commandCenter.focusItems.allCaughtUp')}</p>
                    <p className="text-sm">{t('commandCenter.focusItems.noUrgent')}</p>
                  </div>
                ) : (
                      data?.focusItems?.map((item, index) => {
                    const badge = getTypeBadge(item.type);
                    const badgeVariant = badge.variant === 'success' ? 'default' : 
                                        badge.variant === 'info' ? 'secondary' : 
                                        badge.variant === 'warning' ? 'outline' : badge.variant;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-lg border-l-4 cursor-pointer transition-colors hover:bg-accent/50",
                          getUrgencyColor(item.urgency)
                        )}
                        onClick={() => navigateToItem(item.link)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {getTypeIcon(item.type)}
                            <span className="font-medium truncate">{item.name}</span>
                            <Badge variant={badgeVariant} className="text-xs">
                              {badge.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.description}
                            {item.metroName && <span className="text-xs ml-2">• {item.metroName}</span>}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/opportunities?filter=stale')}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-warning" />
                  <div className="text-xl sm:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-7 w-10 mx-auto" /> : (data?.focusItems?.filter(f => f.type === 'stale_opportunity').length || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('commandCenter.quickActions.staleOpportunities')}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/pipeline?filter=near')}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-success" />
                  <div className="text-xl sm:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-7 w-10 mx-auto" /> : (data?.focusItems?.filter(f => f.type === 'pipeline_near').length || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('commandCenter.quickActions.nearConversion')}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/grants?filter=deadline')}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <Calendar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-info" />
                  <div className="text-xl sm:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-7 w-10 mx-auto" /> : (data?.focusItems?.filter(f => f.type === 'grant_deadline').length || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('commandCenter.quickActions.grantDeadlines')}</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate('/activities?filter=overdue')}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-destructive" />
                  <div className="text-xl sm:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-7 w-10 mx-auto" /> : (data?.adminTasks?.followupsOverdue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('commandCenter.quickActions.overdueFollowups')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Stale Next Steps */}
            <div data-tour="stale-next-steps">
              <StaleNextStepsCard />
            </div>
          </div>

          {/* Sidebar Widgets - Right Column */}
          <div className="space-y-6">
            {/* Demo Activity Pulse — simulated real-time feed */}
            <DemoActivityPulse />

            {/* Leadership Weekly Brief */}
            <div data-tour="leadership-brief">
              <LeadershipBriefCard />
            </div>

            {/* Weekly Focus Plan */}
            <div data-tour="focus-plan">
              <WeeklyFocusCard defaultOpen={shouldOpenWeeklyPlan} />
            </div>
            
            {/* Local Pulse */}
            <div data-tour="local-pulse-card">
              <LocalPulseCard />
            </div>

            {/* This Week's Story */}
            <WeeklyStoryCard />

            {/* Living Signal */}
            <LivingSignalCard />

            {/* Team Capacity */}
            <TeamCapacityCard />

            {/* Gentle Formation */}
            <FormationCard />

            {/* NRI Story Signals */}
            <StorySignalsCard />

            {/* Activity Feed */}
            <RecentActivityFeed />
            <RecycleBinWidget />

            {/* Anchor Velocity Snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="w-4 h-4 text-warning" />
                  {t('commandCenter.anchorVelocity.title')}
                  <HelpTooltip contentKey="card.anchor-velocity" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </>
                ) : (
                  <>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      {data?.anchorVelocity?.totalActive === 0 ? (
                        <>
                          <div className="text-2xl font-bold text-muted-foreground">—</div>
                          <p className="text-sm text-muted-foreground">{t('commandCenter.anchorVelocity.noAnchors')}</p>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl font-bold text-primary">
                            {data?.anchorVelocity?.daysSinceLastAnchor || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">{t('commandCenter.anchorVelocity.daysSinceLastAnchor')}</p>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-xl font-semibold">{data?.anchorVelocity?.anchorsInRamp || 0}</div>
                        <p className="text-xs text-muted-foreground">{t('commandCenter.anchorVelocity.inRamp')}</p>
                      </div>
                      <div>
                        <div className="text-xl font-semibold">{data?.anchorVelocity?.anchorsInScale || 0}</div>
                        <p className="text-xs text-muted-foreground">{t('commandCenter.anchorVelocity.atScale')}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate('/anchors')}
                    >
                      {t('commandCenter.anchorVelocity.viewAnchors')}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Outstanding Admin Tasks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {t('commandCenter.adminTasks.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm">{t('commandCenter.adminTasks.followupsOverdue')}</span>
                      <Badge variant={data?.adminTasks?.followupsOverdue ? 'destructive' : 'secondary'}>
                        {data?.adminTasks?.followupsOverdue || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm">{t('commandCenter.adminTasks.reportsDue')}</span>
                      <Badge variant="secondary">
                        {data?.adminTasks?.reportsdue || 0}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
        </Card>

        {/* Metro Intelligence Discovery — elevated for visibility */}
        <MetroDiscoveryCard />


          </div>
        </div>
      </div>
    </MainLayout>
  );
}
