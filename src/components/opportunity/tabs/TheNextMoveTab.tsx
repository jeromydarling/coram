import { RelationshipActionsCard } from '@/components/relationship/RelationshipActionsCard';
import { NextBestActionsPanel } from '@/components/opportunity/NextBestActionsPanel';
import { OutreachDraftCard } from '@/components/outreach/OutreachDraftCard';
import { OutreachSuggestionsCard } from '@/components/suggestions/OutreachSuggestionsCard';
import { OrgActionTimeline } from '@/components/insights/OrgActionTimeline';

interface TheNextMoveTabProps {
  opportunityId: string;
  isAdmin: boolean;
}

export function TheNextMoveTab({ opportunityId, isAdmin }: TheNextMoveTabProps) {
  return (
    <div className="space-y-4">
      {/* Relationship Actions */}
      <RelationshipActionsCard opportunityId={opportunityId} />

      {/* Next Best Actions */}
      <NextBestActionsPanel orgId={opportunityId} />

      {/* Outreach Drafts */}
      <OutreachDraftCard opportunityId={opportunityId} />

      {/* Outreach Suggestions */}
      <OutreachSuggestionsCard orgId={opportunityId} />

      {/* Actions Timeline */}
      <OrgActionTimeline orgId={opportunityId} />
    </div>
  );
}
