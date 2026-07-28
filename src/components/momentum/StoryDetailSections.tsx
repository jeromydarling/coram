import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Waves, Users, Feather, Calendar, ExternalLink, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantPath } from '@/hooks/useTenantPath';
import type { MetroStoryData, StoryDensityLabel } from '@/hooks/useStoryMomentum';
import { formatDistanceToNow } from 'date-fns';

interface StoryDetailSectionsProps {
  storyData: MetroStoryData | null;
  isLoading: boolean;
  metroName: string;
}

const densityLabels: Record<StoryDensityLabel, { text: string; description: string }> = {
  quiet: { text: 'Quiet', description: 'The story is resting — seeds are being planted.' },
  active: { text: 'Active', description: 'Conversations are happening — connections forming.' },
  growing: { text: 'Growing', description: 'Multiple threads are weaving together.' },
  vibrant: { text: 'Vibrant', description: 'A rich story is unfolding across many touchpoints.' },
};

export function StoryDetailSections({ storyData, isLoading, metroName }: StoryDetailSectionsProps) {
  const navigate = useNavigate();
  const { tenantPath } = useTenantPath();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!storyData) return null;

  const density = densityLabels[storyData.densityLabel];
  const { sources } = storyData;

  return (
    <div className="space-y-6">
      {/* Story Density Header */}
      <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-xs font-normal">
            {density.text}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{density.description}</p>
        {storyData.latestNarrativeHeadline && (
          <p className="text-sm mt-2 font-medium text-foreground/80">
            "{storyData.latestNarrativeHeadline}"
          </p>
        )}
      </div>

      <Separator />

      {/* Pulse Highlights */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Waves className="w-4 h-4 text-primary" />
          Pulse Highlights
        </h4>
        {sources.local_pulse_event_count > 0 ? (
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Community events discovered</span>
              <span className="text-sm font-medium">{sources.local_pulse_event_count}</span>
            </div>
            {sources.metro_signal_count > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-muted-foreground">Opportunity signals</span>
                <span className="text-sm font-medium">{sources.metro_signal_count}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            No recent community signals. The story is forming.
          </p>
        )}
        {sources.local_pulse_event_count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 gap-2 text-xs"
            onClick={() => navigate(tenantPath('/metros/narratives'))}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Open Metro Narrative
          </Button>
        )}
      </div>

      <Separator />

      {/* Partner Threads */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Partner Threads
        </h4>
        {storyData.topPartners.length > 0 ? (
          <div className="space-y-2">
            {storyData.topPartners.map((partner, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{partner.orgName}</p>
                  <p className="text-xs text-muted-foreground">
                    Last touch {formatDistanceToNow(new Date(partner.lastTouch), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs gap-1"
                  onClick={() => navigate('/opportunities')}
                >
                  Open Story
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">
            No recent partner conversations in this metro.
          </p>
        )}
        {sources.email_touch_count > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {sources.email_touch_count} email touchpoint{sources.email_touch_count !== 1 ? 's' : ''} this month
          </p>
        )}
        {sources.campaign_touch_count > 0 && (
          <p className="text-xs text-muted-foreground">
            {sources.campaign_touch_count} campaign message{sources.campaign_touch_count !== 1 ? 's' : ''} sent
          </p>
        )}
      </div>

      <Separator />

      {/* Your Impact */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Feather className="w-4 h-4 text-primary" />
          Your Impact
        </h4>
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 text-center space-y-2">
          {sources.reflections_count > 0 ? (
            <>
              <div className="flex items-center justify-center gap-4 text-sm">
                <div>
                  <div className="text-xl font-semibold">{sources.reflections_count}</div>
                  <div className="text-xs text-muted-foreground">Reflections</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{sources.partner_activity_count}</div>
                  <div className="text-xs text-muted-foreground">Partners touched</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your presence is shaping this metro.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add a reflection to start shaping this story.
            </p>
          )}
        </div>
      </div>

      {/* Add Reflection CTA */}
      {storyData.isHomeMetro && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate(tenantPath('/metros/narratives'))}
        >
          <Feather className="w-4 h-4" />
          Add Reflection
        </Button>
      )}
    </div>
  );
}
