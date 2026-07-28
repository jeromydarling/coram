import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Handshake, TrendingUp, Heart, Calendar } from 'lucide-react';
import { useStoryEvents, type StoryEvent } from '@/hooks/useStoryEvents';

interface StoryChaptersSectionProps {
  opportunityId: string;
  organizationName?: string;
  stage?: string;
  hasWebsite?: boolean;
}

interface Chapter {
  title: string;
  icon: typeof BookOpen;
  events: StoryEvent[];
  summary: string;
}

export function StoryChaptersSection({ opportunityId, organizationName, stage, hasWebsite }: StoryChaptersSectionProps) {
  const { data: allEvents = [] } = useStoryEvents(opportunityId, 'all');

  const chapters = useMemo(() => {
    if (allEvents.length === 0) return [];

    const result: Chapter[] = [];
    const reflections = allEvents.filter(e => e.kind === 'reflection');
    const emails = allEvents.filter(e => e.kind === 'email');
    const campaigns = allEvents.filter(e => e.kind === 'campaign');

    // Chapter 1: How We Met — always show if there's any history
    if (allEvents.length > 0) {
      const oldest = allEvents[allEvents.length - 1];
      result.push({
        title: 'How we connected',
        icon: Handshake,
        events: [oldest],
        summary: oldest
          ? `Our earliest recorded touchpoint with ${organizationName || 'this partner'}.`
          : `We're just getting started with ${organizationName || 'this partner'}.`,
      });
    }

    // Chapter 2: The Conversation — only if emails exist
    if (emails.length > 0) {
      result.push({
        title: 'The conversation',
        icon: BookOpen,
        events: emails.slice(0, 3),
        summary: `${emails.length} email${emails.length !== 1 ? 's' : ''} exchanged — an ongoing dialogue.`,
      });
    }

    // Chapter 3: What We've Shared — campaigns
    if (campaigns.length > 0) {
      result.push({
        title: 'What we\'ve shared',
        icon: Heart,
        events: campaigns.slice(0, 3),
        summary: `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} sent — keeping the connection warm.`,
      });
    }

    // Chapter 4: Reflections along the way
    if (reflections.length >= 2) {
      result.push({
        title: 'Reflections along the way',
        icon: TrendingUp,
        events: reflections.slice(0, 3),
        summary: `${reflections.length} reflection${reflections.length !== 1 ? 's' : ''} recorded by the team.`,
      });
    }

    return result.slice(0, 4); // Max 4 chapters
  }, [allEvents, organizationName]);

  if (chapters.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-primary/60" />
        Story chapters
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {chapters.map((chapter, i) => {
          const Icon = chapter.icon;
          return (
            <Card key={i} className="border-border/40">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-sm font-medium">{chapter.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{chapter.summary}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
