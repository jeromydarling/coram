/**
 * PersonTabsLayout — Tabbed narrative view for richness-3 Person entities.
 *
 * WHAT: Six-tab layout distributing existing and new Person panels.
 * WHERE: PersonDetail when effectiveRichness >= 3.
 * WHY: Narrative parity with Partners — relationships that grow deserve structured storytelling space.
 */

import { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { User, BookOpen, Radio, Users, Route, Compass } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface Props {
  /** The Person tab: header card, household, visits, life events */
  personContent: ReactNode;
  /** The Story tab: reflections, narrative timeline */
  storyContent?: ReactNode;
  /** The Pulse tab: signals, patterns */
  pulseContent?: ReactNode;
  /** The Circle tab: household, linked orgs, suggested connections */
  circleContent?: ReactNode;
  /** The Journey tab: per-person journey chapters */
  journeyContent?: ReactNode;
  /** The Next Move tab: suggested actions */
  nextMoveContent?: ReactNode;
}

function EmptyTab({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

export function PersonTabsLayout({
  personContent,
  storyContent,
  pulseContent,
  circleContent,
  journeyContent,
  nextMoveContent,
}: Props) {
  return (
    <Tabs defaultValue="person" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="person" className="gap-1.5 text-xs">
          <User className="w-3.5 h-3.5" />
          The Person
        </TabsTrigger>
        <TabsTrigger value="story" className="gap-1.5 text-xs">
          <BookOpen className="w-3.5 h-3.5" />
          The Story
        </TabsTrigger>
        <TabsTrigger value="pulse" className="gap-1.5 text-xs">
          <Radio className="w-3.5 h-3.5" />
          The Pulse
        </TabsTrigger>
        <TabsTrigger value="circle" className="gap-1.5 text-xs">
          <Users className="w-3.5 h-3.5" />
          The Circle
        </TabsTrigger>
        <TabsTrigger value="journey" className="gap-1.5 text-xs">
          <Route className="w-3.5 h-3.5" />
          The Journey
        </TabsTrigger>
        <TabsTrigger value="next-move" className="gap-1.5 text-xs">
          <Compass className="w-3.5 h-3.5" />
          The Next Move
        </TabsTrigger>
      </TabsList>

      <TabsContent value="person">
        {personContent}
      </TabsContent>

      <TabsContent value="story">
        {storyContent ?? (
          <EmptyTab message="No reflections or stories have been recorded yet. As this relationship deepens, narrative threads will appear here." />
        )}
      </TabsContent>

      <TabsContent value="pulse">
        {pulseContent ?? (
          <EmptyTab message="No signals yet. Patterns will emerge as interactions accumulate." />
        )}
      </TabsContent>

      <TabsContent value="circle">
        {circleContent ?? (
          <EmptyTab message="No connections mapped yet. Household members and linked organizations will appear here." />
        )}
      </TabsContent>

      <TabsContent value="journey">
        {journeyContent ?? (
          <EmptyTab message="No journey chapters recorded. When this person's journey is documented, milestones will appear here." />
        )}
      </TabsContent>

      <TabsContent value="next-move">
        {nextMoveContent ?? (
          <EmptyTab message="No suggested actions at this time. As context grows, gentle next steps will surface here." />
        )}
      </TabsContent>
    </Tabs>
  );
}
