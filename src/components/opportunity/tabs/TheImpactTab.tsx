import { Card, CardContent } from '@/components/ui/card';
import { OpportunityOrdersCard } from '@/components/opportunity/OpportunityOrdersCard';
import { GrantSuggestionsPanel } from '@/components/opportunity/GrantSuggestionsPanel';
import { OpportunityGrantsList } from '@/components/opportunity/OpportunityGrantsList';
import { DocumentAttachmentsPanel } from '@/components/documents/DocumentAttachmentsPanel';
import { NoteHistoryPanel } from '@/components/notes/NoteHistoryPanel';
import { ImpactDimensionsPanel } from '@/components/impact/ImpactDimensionsPanel';

interface TheImpactTabProps {
  opportunity: any;
  isAdmin: boolean;
  onStageUpdateRequest: () => void;
}

export function TheImpactTab({ opportunity, isAdmin, onStageUpdateRequest }: TheImpactTabProps) {
  return (
    <div className="space-y-4">
      {/* What We've Provided */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground mb-3">
            This reflects how we are supporting this partner through access to technology.
          </p>
          <OpportunityOrdersCard 
            opportunityId={opportunity.id}
            opportunityStage={opportunity.stage}
            onStageUpdateRequest={onStageUpdateRequest}
          />
        </CardContent>
      </Card>

      {/* Impact Dimensions */}
      <Card>
        <CardContent className="pt-6">
          <ImpactDimensionsPanel entityType="provision" entityId={opportunity.id} />
        </CardContent>
      </Card>

      {/* Grant Suggestions & Linked Grants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <GrantSuggestionsPanel opportunityId={opportunity.id} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <OpportunityGrantsList opportunityId={opportunity.id} />
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardContent className="pt-6">
          <DocumentAttachmentsPanel 
            entityType="opportunity"
            entityId={opportunity.id}
            entityName={opportunity.organization}
          />
        </CardContent>
      </Card>

      {/* Reflections (formerly Note History) */}
      <Card>
        <CardContent className="pt-6">
          <NoteHistoryPanel 
            entityType="opportunity" 
            entityId={opportunity.id} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
