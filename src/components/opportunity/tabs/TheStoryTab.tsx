import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { MomentumCard } from '@/components/momentum/MomentumCard';
import { WeeklyBriefingCard } from '@/components/relationship/WeeklyBriefingCard';
import { RelationshipStoryPanel } from '@/components/opportunity/RelationshipStoryPanel';
import { ProspectPackCard } from '@/components/prospect-pack/ProspectPackCard';
import { MemoryPanel } from '@/components/memory/MemoryPanel';
import { EventsAttendedChapter } from '@/components/opportunity/EventsAttendedChapter';
import { StoryTimeline } from '@/components/story/StoryTimeline';
import { AddReflectionForm } from '@/components/story/AddReflectionForm';
import { StoryChaptersSection } from '@/components/story/StoryChaptersSection';
import { SuggestedNextSteps } from '@/components/story/SuggestedNextSteps';

interface TheStoryTabProps {
  opportunityId: string;
  isAdmin: boolean;
  organizationName?: string;
}

export function TheStoryTab({ opportunityId, isAdmin, organizationName }: TheStoryTabProps) {
  return (
    <div className="space-y-4">
      {/* Narrative Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Relationship Story
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            A living record of what we've shared, learned, and built together.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Reflection */}
          <AddReflectionForm opportunityId={opportunityId} />

          {/* Story Chapters */}
          <StoryChaptersSection
            opportunityId={opportunityId}
            organizationName={organizationName}
          />

          {/* Suggested Next Steps (from emails) */}
          <SuggestedNextSteps opportunityId={opportunityId} />

          {/* Blended Timeline */}
          <StoryTimeline opportunityId={opportunityId} />
        </CardContent>
      </Card>

      {/* Living Memory — Echoes, Chapters, Check-ins */}
      <MemoryPanel scope="opportunity" entityId={opportunityId} entityName={organizationName} />

      {/* Relationship Story Narrative */}
      <RelationshipStoryPanel 
        opportunityId={opportunityId}
        canGenerate={isAdmin}
      />

      {/* Relationship Momentum */}
      <MomentumCard organizationId={opportunityId} />

      {/* Weekly Briefing */}
      <WeeklyBriefingCard scope="opportunity" opportunityId={opportunityId} />

      {/* Events We Showed Up For */}
      <EventsAttendedChapter opportunityId={opportunityId} />

      {/* Prospect Pack */}
      <ProspectPackCard entityId={opportunityId} entityType="opportunity" />
    </div>
  );
}
