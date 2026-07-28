import { useState } from 'react';
import { savePendingCall } from '@/utils/pendingCallStorage';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  User,
  Mail,
  Phone,
  Pencil,
  ArrowRight,
  Users,
  Trash2,
  Anchor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteHistoryPanel } from '@/components/notes/NoteHistoryPanel';
import { DocumentAttachmentsPanel } from '@/components/documents/DocumentAttachmentsPanel';
import { OpportunityGrantsList } from '@/components/opportunity/OpportunityGrantsList';
import { OpportunityOrdersCard } from '@/components/opportunity/OpportunityOrdersCard';
import { CascadeDeleteDialog } from './CascadeDeleteDialog';
import { ConvertToAnchorModal } from './ConvertToAnchorModal';
import { useOpportunityRelatedCounts } from '@/hooks/useRelatedCounts';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';
import { useAnchorExistsForOpportunity } from '@/hooks/useConvertOpportunityToAnchor';
import { SuggestedContactsPanel } from '@/components/contact-suggestions/SuggestedContactsPanel';
import { RelationshipStoryPanel } from '@/components/opportunity/RelationshipStoryPanel';
import { CallModal } from '@/components/contacts/CallModal';

interface Opportunity {
  id: string;
  opportunity_id: string;
  organization: string;
  metro_id?: string | null;
  stage?: string | null;
  status?: string | null;
  partner_tier?: string | null;
  partner_tiers?: string[] | null;
  mission_snapshot?: string[] | null;
  best_partnership_angle?: string[] | null;
  grant_alignment?: string[] | null;
  primary_contact?: {
    id: string;
    name: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  next_step?: string | null;
  notes?: string | null;
  metros?: { metro: string } | null;
}

interface OpportunityDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  onEdit: () => void;
}

export function OpportunityDetailModal({ 
  open, 
  onOpenChange, 
  opportunity, 
  onEdit 
}: OpportunityDetailModalProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const { data: relatedCounts } = useOpportunityRelatedCounts(opportunity?.id || null);
  const { deleteRecord, isDeleting } = useDeleteWithUndo();
  const { data: anchorExists } = useAnchorExistsForOpportunity(opportunity?.id || null);

  // Determine if conversion button should show
  const conversionEligibleStages = ['Agreement Signed', 'First Volume', 'Stable Producer'];
  const canConvertToAnchor = 
    opportunity?.status === 'Active' &&
    conversionEligibleStages.includes(opportunity?.stage || '') &&
    !anchorExists;

  if (!opportunity) return null;

  const handleViewAllContacts = () => {
    onOpenChange(false);
    navigate(`/contacts?org=${encodeURIComponent(opportunity.organization)}`);
  };

  const handleDelete = async () => {
    await deleteRecord(opportunity.id, 'opportunity');
    setShowDeleteDialog(false);
    onOpenChange(false);
  };

  const getStageBadge = (stage: string | null | undefined) => {
    const styles: Record<string, string> = {
      'Target Identified': 'bg-muted text-muted-foreground',
      'Contacted': 'bg-info/15 text-info',
      'Discovery Scheduled': 'bg-info/15 text-info',
      'Discovery Held': 'bg-primary/15 text-primary',
      'Proposal Sent': 'bg-warning/15 text-warning',
      'Agreement Pending': 'bg-warning/15 text-warning',
      'Agreement Signed': 'bg-success/15 text-success',
      'First Volume': 'bg-success/15 text-success',
      'Stable Producer': 'bg-success/15 text-success',
      'Closed - Not a Fit': 'bg-destructive/15 text-destructive'
    };
    return styles[stage || ''] || 'bg-muted text-muted-foreground';
  };

  const getTierBadge = (tier: string | null | undefined) => {
    const styles: Record<string, string> = {
      'Anchor': 'bg-primary/15 text-primary',
      'Distribution': 'bg-success/15 text-success',
      'Referral': 'bg-info/15 text-info',
      'Workforce': 'bg-warning/15 text-warning',
      'Housing': 'bg-accent/15 text-accent',
      'Education': 'bg-secondary/15 text-secondary-foreground',
      'Other': 'bg-muted text-muted-foreground'
    };
    return styles[tier || ''] || 'bg-muted text-muted-foreground';
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {opportunity.organization}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={cn('font-medium', getStageBadge(opportunity.stage))}>
                  {opportunity.stage || 'No stage'}
                </Badge>
                {/* Display multiple partner tiers */}
                {(opportunity.partner_tiers?.length ? opportunity.partner_tiers : [opportunity.partner_tier || 'Other']).map((tier, index) => (
                  <Badge key={index} variant="outline" className={cn('font-medium', getTierBadge(tier))}>
                    {tier}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Location */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">{opportunity.metros?.metro || 'No metro assigned'}</span>
          </div>

          {/* Primary Contact */}
          {opportunity.primary_contact && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Primary Contact</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="font-medium">{opportunity.primary_contact.name}</span>
                {opportunity.primary_contact.title && (
                  <span className="text-muted-foreground">{opportunity.primary_contact.title}</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                {opportunity.primary_contact.email && (
                  <a 
                    href={`mailto:${opportunity.primary_contact.email}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {opportunity.primary_contact.email}
                  </a>
                )}
                {opportunity.primary_contact.phone && (
                  <button 
                    type="button"
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={() => {
                      savePendingCall({
                        contactId: opportunity.primary_contact.id,
                        contactName: opportunity.primary_contact.name,
                        opportunityId: opportunity.id,
                        metroId: opportunity.metro_id,
                      });
                      const a = document.createElement('a');
                      a.href = `tel:${opportunity.primary_contact.phone}`;
                      a.click();
                      setTimeout(() => setIsCallModalOpen(true), 500);
                    }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {opportunity.primary_contact.phone}
                  </button>
                )}
              </div>
              <button
                onClick={handleViewAllContacts}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
              >
                <Users className="w-3.5 h-3.5" />
                View all contacts at this organization
              </button>
            </div>
          )}

          {/* Mission Snapshot */}
          {opportunity.mission_snapshot && opportunity.mission_snapshot.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Mission Snapshot</p>
              <div className="flex flex-wrap gap-2">
                {opportunity.mission_snapshot.map((snapshot, index) => (
                  <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                    {snapshot}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Best Partnership Angle */}
          {opportunity.best_partnership_angle && opportunity.best_partnership_angle.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Best Partnership Angle</p>
              <div className="flex flex-wrap gap-2">
                {opportunity.best_partnership_angle.map((angle, index) => (
                  <Badge key={index} variant="secondary" className="bg-info/10 text-info">
                    {angle}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Grant Alignment */}
          {opportunity.grant_alignment && opportunity.grant_alignment.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Grant Alignment</p>
              <div className="flex flex-wrap gap-2">
                {opportunity.grant_alignment.map((alignment, index) => (
                  <Badge key={index} variant="secondary" className="bg-success/15 text-success">
                    {alignment}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Next Step */}
          {opportunity.next_step && (
            <div className="flex items-start gap-2 text-sm bg-warning/10 rounded-lg p-3">
              <ArrowRight className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-warning font-medium mb-1">Next Step</p>
                <p className="text-foreground">{opportunity.next_step}</p>
              </div>
            </div>
          )}

          {/* Relationship Story */}
          <div className="pt-4 border-t border-border">
            <RelationshipStoryPanel 
              opportunityId={opportunity.id}
              canGenerate={true}
            />
          </div>

          {/* Suggested Contacts */}
          <div className="pt-4 border-t border-border">
            <SuggestedContactsPanel entityType="opportunity" entityId={opportunity.id} />
          </div>

          {/* Recent Orders */}
          <div className="pt-4 border-t border-border">
            <OpportunityOrdersCard 
              opportunityId={opportunity.id}
              opportunityStage={opportunity.stage}
              onStageUpdateRequest={onEdit}
            />
          </div>

          {/* Linked Grants */}
          <div className="pt-4 border-t border-border">
            <OpportunityGrantsList 
              opportunityId={opportunity.id} 
              opportunityName={opportunity.organization}
            />
          </div>

          {/* Documents */}
          <div className="pt-4 border-t border-border overflow-hidden min-w-0">
            <DocumentAttachmentsPanel 
              entityType="opportunity"
              entityId={opportunity.id}
              entityName={opportunity.organization}
            />
          </div>

          {/* Note History */}
          <NoteHistoryPanel 
            entityType="opportunity" 
            entityId={opportunity.id} 
            className="pt-4 border-t border-border"
          />

          {/* Actions */}
          <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              {canConvertToAnchor && (
                <Button 
                  variant="outline" 
                  className="gap-2 text-success hover:text-success hover:bg-success/10"
                  onClick={() => setShowConvertModal(true)}
                >
                  <Anchor className="w-4 h-4" />
                  Convert to Anchor
                </Button>
              )}
              <Button className="gap-2" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
                Edit Opportunity
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    <CascadeDeleteDialog
      open={showDeleteDialog}
      entityType="opportunity"
      entityName={opportunity.organization}
      relatedCounts={{
        contacts: relatedCounts?.contacts || 0,
        grants: relatedCounts?.grants || 0,
        events: relatedCounts?.events || 0,
        activities: relatedCounts?.activities || 0,
        pipeline: relatedCounts?.pipeline || 0,
      }}
      onConfirm={handleDelete}
      onCancel={() => setShowDeleteDialog(false)}
      isDeleting={isDeleting}
    />
    
    {opportunity && (
      <ConvertToAnchorModal
        open={showConvertModal}
        onOpenChange={setShowConvertModal}
        opportunity={opportunity}
        onSuccess={() => onOpenChange(false)}
      />
    )}

    {opportunity.primary_contact && (
      <CallModal
        open={isCallModalOpen}
        onOpenChange={setIsCallModalOpen}
        contactId={opportunity.primary_contact.id}
        contactName={opportunity.primary_contact.name}
        opportunityId={opportunity.id}
        metroId={opportunity.metro_id}
      />
    )}
    </>
  );
}
