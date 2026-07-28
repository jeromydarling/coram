import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Anchor, MapPin, Building2, Calendar, GitBranch, CheckCircle2 } from 'lucide-react';
import { useConvertOpportunityToAnchor, usePipelineForOpportunity } from '@/hooks/useConvertOpportunityToAnchor';
import { format, parseISO } from 'date-fns';

interface Opportunity {
  id: string;
  opportunity_id: string;
  organization: string;
  metro_id?: string | null;
  stage?: string | null;
  status?: string | null;
  notes?: string | null;
  metros?: { metro: string } | null;
}

interface ConvertToAnchorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity;
  onSuccess?: () => void;
}

type AnchorTier = 'Strategic' | 'Standard' | 'Pilot';

export function ConvertToAnchorModal({ 
  open, 
  onOpenChange, 
  opportunity,
  onSuccess 
}: ConvertToAnchorModalProps) {
  const [anchorTier, setAnchorTier] = useState<AnchorTier>('Standard');
  const [agreementDate, setAgreementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState(opportunity.notes || '');
  
  const { data: pipelineRecord } = usePipelineForOpportunity(opportunity.id);
  const convertMutation = useConvertOpportunityToAnchor();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAnchorTier('Standard');
      setAgreementDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes(opportunity.notes || '');
    }
  }, [open, opportunity.notes]);

  const handleConvert = () => {
    convertMutation.mutate({
      opportunityId: opportunity.id,
      organizationName: opportunity.organization,
      metroId: opportunity.metro_id,
      anchorTier,
      agreementSignedDate: agreementDate,
      notes: notes || undefined
    }, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-primary" />
            Convert to Anchor
          </DialogTitle>
          <DialogDescription>
            This will create an Anchor record and close the opportunity as won.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary Card */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{opportunity.organization}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{opportunity.metros?.metro || 'No metro assigned'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-success/15 text-success">
                {opportunity.stage}
              </Badge>
            </div>
          </div>

          {/* Pipeline Info */}
          {pipelineRecord && (
            <Alert>
              <GitBranch className="w-4 h-4" />
              <AlertDescription>
                Pipeline record <span className="font-mono text-xs">{pipelineRecord.anchor_pipeline_id}</span> will be removed after conversion.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="anchorTier">Anchor Tier *</Label>
              <Select value={anchorTier} onValueChange={(v) => setAnchorTier(v as AnchorTier)}>
                <SelectTrigger id="anchorTier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Strategic">Strategic</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Pilot">Pilot</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Strategic: High-volume regional partners. Standard: Consistent producers. Pilot: Testing phase.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agreementDate" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Agreement Signed Date *
              </Label>
              <Input
                id="agreementDate"
                type="date"
                value={agreementDate}
                onChange={(e) => setAgreementDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this anchor..."
                rows={3}
              />
            </div>
          </div>

          {/* What happens */}
          <div className="bg-primary/5 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-primary">What happens when you convert:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Anchor record created with tier and dates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Opportunity status updated to "Closed - Won"
              </li>
              {pipelineRecord && (
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Pipeline record removed
                </li>
              )}
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Audit trail entry logged
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={convertMutation.isPending || !agreementDate}
            className="gap-2"
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Anchor className="w-4 h-4" />
                Convert to Anchor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
