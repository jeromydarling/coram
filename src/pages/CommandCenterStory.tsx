import { useState, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCommandCenter, useAIInsight } from '@/hooks/useCommandCenter';
import { useLatestMetroNarrative } from '@/hooks/useMetroNarratives';
import { useHomeMetroId } from '@/hooks/useHomeTerritory';
import { useAuth } from '@/contexts/AuthContext';
import { RelationshipStoryRibbon } from '@/components/dashboard/RelationshipStoryRibbon';
import { 
  Feather, 
  MapPin, 
  Heart, 
  ChevronDown, 
  Sparkles, 
  Compass,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy-load heavier operational widgets for the insights drawer
const WeeklySnapshot = lazy(() => import('@/components/dashboard/WeeklySnapshot').then(m => ({ default: m.WeeklySnapshot })));
const RecentActivityFeed = lazy(() => import('@/components/dashboard/RecentActivityFeed').then(m => ({ default: m.RecentActivityFeed })));
const StaleNextStepsCard = lazy(() => import('@/components/dashboard/StaleNextStepsCard').then(m => ({ default: m.StaleNextStepsCard })));

// Reuse NBA data hook
import { useTopNextActions } from '@/hooks/useNextActions';

interface StoryViewProps {
  onError?: () => void;
}

export default function CommandCenterStory({ onError }: StoryViewProps) {
  const { t } = useTranslation('intelligence');
  const { user } = useAuth();
  const { data: commandData, isLoading: commandLoading, isError: commandError } = useCommandCenter();
  const { data: aiData, isLoading: aiLoading } = useAIInsight();
  const { data: homeMetroId } = useHomeMetroId();
  const { data: narrative, isLoading: narrativeLoading } = useLatestMetroNarrative(homeMetroId ?? undefined);
  const { data: actions, isLoading: actionsLoading } = useTopNextActions(6);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // Group actions into story-friendly categories
  const groupedActions = useMemo(() => {
    if (!actions) return { nudges: [], relationships: [], metro: [] };
    const nudges: typeof actions = [];
    const relationships: typeof actions = [];
    const metro: typeof actions = [];
    
    actions.forEach(action => {
      const type = (action as any).action_type || '';
      if (type.includes('follow_up') || type.includes('check_in')) {
        relationships.push(action);
      } else if (type.includes('metro') || type.includes('event')) {
        metro.push(action);
      } else {
        nudges.push(action);
      }
    });
    
    return { nudges, relationships, metro };
  }, [actions]);

  const isLoading = commandLoading || narrativeLoading;

  return (
    <div className="space-y-8">
      {/* HERO: Your Metro Today */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">
              {narrative?.narrative_json?.headline ? t('commandCenterStory.yourMetroToday') : t('commandCenterStory.yourFocusToday')}
            </span>
          </div>
          
          {isLoading ? (
            <div className="space-y-3 mt-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {/* Narrative headline */}
              <h2 className="text-xl sm:text-2xl font-normal leading-relaxed text-foreground">
                {narrative?.narrative_json?.headline || 
                 aiData?.aiInsight || 
                 'A gentle snapshot of what\'s unfolding around you.'}
              </h2>
              
              {/* Blended signals */}
              <div className="flex flex-wrap gap-2">
                {narrative?.narrative_json?.on_the_ground?.slice(0, 3).map((signal, i) => (
                  <Badge key={i} variant="secondary" className="font-normal text-xs">
                    {signal}
                  </Badge>
                ))}
                {commandData?.focusItems?.[0] && (
                  <Badge variant="outline" className="font-normal text-xs">
                    {commandData.focusItems[0].name}
                  </Badge>
                )}
              </div>

              {/* Community story excerpt */}
              {narrative?.narrative_json?.community_story && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  {narrative.narrative_json.community_story.slice(0, 280)}
                  {narrative.narrative_json.community_story.length > 280 ? '…' : ''}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION B: Where You Can Show Up */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Compass className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium">{t('commandCenterStory.whereYouCanShowUp')}</h3>
        </div>

        {actionsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : actions && actions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gentle Nudges */}
            <ActionGroup
              title={t('commandCenterStory.actionGroups.gentleNudges')}
              items={groupedActions.nudges.length > 0 ? groupedActions.nudges : actions.slice(0, 2)}
              emptyText={t('commandCenterStory.emptyText.nudges')}
            />
            {/* Relationship Moments */}
            <ActionGroup
              title={t('commandCenterStory.actionGroups.relationshipMoments')}
              items={groupedActions.relationships.length > 0 ? groupedActions.relationships : actions.slice(2, 4)}
              emptyText={t('commandCenterStory.emptyText.relationships')}
            />
            {/* In Your Metro */}
            <ActionGroup
              title={t('commandCenterStory.actionGroups.inYourMetro')}
              items={groupedActions.metro.length > 0 ? groupedActions.metro : actions.slice(4, 6)}
              emptyText={t('commandCenterStory.emptyText.metro')}
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('commandCenterStory.noActions')}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* SECTION C: Relationship Ribbon */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium">{t('commandCenterStory.relationshipFocus')}</h3>
        </div>
        <RelationshipStoryRibbon />
      </div>

      {/* SECTION D: Today's Narrative (collapsed) */}
      {narrative?.narrative_md && (
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Feather className="w-4 h-4 text-primary" />
                    {t('commandCenterStory.todaysNarrative')}
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                  {narrative.narrative_md.split('\n').map((line, i) => (
                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* SECTION E: Insights Drawer (collapsed) */}
      <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  {t('commandCenterStory.metricsSignals')}
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  insightsOpen && "rotate-180"
                )} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <WeeklySnapshot />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <StaleNextStepsCard />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <RecentActivityFeed />
              </Suspense>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

// Internal helper component for action groups
function ActionGroup({ title, items, emptyText }: { title: string; items: any[]; emptyText: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">{emptyText}</p>
        ) : (
          items.slice(0, 3).map((item: any) => (
            <div key={item.id} className="text-sm p-2 rounded-md bg-muted/30">
              <p className="font-medium truncate">{item.title || item.org_name || 'Action'}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.reason || item.description || ''}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
