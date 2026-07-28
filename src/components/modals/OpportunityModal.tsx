import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { useCreateOpportunity, useUpdateOpportunity } from '@/hooks/useOpportunities';
import { useMetros } from '@/hooks/useMetros';
import { useMissionSnapshots } from '@/hooks/useMissionSnapshots';
import { usePartnershipAngles } from '@/hooks/usePartnershipAngles';
import { useSectors } from '@/hooks/useSectors';
import { useGrantAlignments } from '@/hooks/useGrantAlignments';
import { opportunitySchema, formatValidationErrors } from '@/lib/validations';
import { toast } from '@/components/ui/sonner';
import { z } from 'zod';
import { ContactSearchSelect } from '@/components/contacts/ContactSearchSelect';
import { useDuplicateCheck } from '@/hooks/useDuplicateCheck';
import { useFormDirty } from '@/hooks/useUnsavedChanges';
import { useFormDraft } from '@/hooks/useFormDraft';
import { DuplicateWarningDialog } from './DuplicateWarningDialog';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { Loader2 } from 'lucide-react';

interface Opportunity {
  id: string;
  opportunity_id: string;
  organization: string;
  metro_id?: string | null;
  stage?: string | null;
  status?: string | null;
  partner_tier?: string | null;
  partner_tiers?: string[] | null;
  grant_alignment?: string[] | null;
  mission_snapshot?: string[] | null;
  best_partnership_angle?: string[] | null;
  primary_contact_id?: string | null;
  primary_contact_name?: string | null;
  primary_contact_title?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  next_step?: string | null;
  notes?: string | null;
  website_url?: string | null;
}

interface OpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity | null;
  defaultSourceUrl?: string;
}

interface FieldErrors {
  organization?: string;
  next_step?: string;
  notes?: string;
}

import { CHAPTERS, toChapterLabel } from '@/lib/journeyChapters';

const STAGES = CHAPTERS;

export function OpportunityModal({ open, onOpenChange, opportunity, defaultSourceUrl }: OpportunityModalProps) {
  const [organization, setOrganization] = useState('');
  const [metroId, setMetroId] = useState<string>('');
  const [stage, setStage] = useState<typeof STAGES[number]>('Found');
  const [partnerTiers, setPartnerTiers] = useState<string[]>(['Other']);
  const [grantAlignments, setGrantAlignments] = useState<string[]>([]);
  const [missionSnapshots, setMissionSnapshots] = useState<string[]>([]);
  const [partnershipAngles, setPartnershipAngles] = useState<string[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  
  // Safety features state
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  
  const { data: metros } = useMetros();
  const { data: missionSnapshotOptions } = useMissionSnapshots();
  const { data: partnershipAngleOptions } = usePartnershipAngles();
  const { data: sectors, isLoading: sectorsLoading } = useSectors(true);
  const { data: grantAlignmentOptions, isLoading: grantAlignmentsLoading } = useGrantAlignments(true);
  const createOpportunity = useCreateOpportunity();
  const updateOpportunity = useUpdateOpportunity();
  const { similarOpportunities, checkForDuplicates, clearDuplicates } = useDuplicateCheck();
  const { isDirty, markDirty, reset: resetDirty } = useFormDirty();
  const { saveDraft, restoreDraft, clearDraft } = useFormDraft('opportunity_modal');

  const isEditMode = !!opportunity;

  // Auto-save draft whenever form is dirty and values change
  useEffect(() => {
    if (isDirty && open && !isEditMode) {
      saveDraft({
        organization, metroId, stage, partnerTiers, grantAlignments,
        missionSnapshots, partnershipAngles, primaryContactId, nextStep, notes, sourceUrl,
      });
    }
  }, [isDirty, open, isEditMode, organization, metroId, stage, partnerTiers, grantAlignments, missionSnapshots, partnershipAngles, primaryContactId, nextStep, notes, sourceUrl, saveDraft]);

  useEffect(() => {
    if (opportunity) {
      setOrganization(opportunity.organization || '');
      setMetroId(opportunity.metro_id || '');
      setStage(toChapterLabel(opportunity.stage) as typeof STAGES[number]);
      const tiers = opportunity.partner_tiers?.length 
        ? opportunity.partner_tiers 
        : opportunity.partner_tier 
          ? [opportunity.partner_tier] 
          : ['Other'];
      setPartnerTiers(tiers);
      setGrantAlignments(opportunity.grant_alignment || []);
      setMissionSnapshots(opportunity.mission_snapshot || []);
      setPartnershipAngles(opportunity.best_partnership_angle || []);
      setPrimaryContactId(opportunity.primary_contact_id || null);
      setNextStep(opportunity.next_step || '');
      setNotes(opportunity.notes || '');
      setSourceUrl(opportunity.website_url || '');
    } else if (open) {
      // For new opportunities, try to restore draft
      const draft = restoreDraft();
      if (draft) {
        setOrganization((draft.organization as string) || '');
        setMetroId((draft.metroId as string) || '');
        setStage(toChapterLabel(draft.stage as string) as typeof STAGES[number]);
        setPartnerTiers((draft.partnerTiers as string[]) || ['Other']);
        setGrantAlignments((draft.grantAlignments as string[]) || []);
        setMissionSnapshots((draft.missionSnapshots as string[]) || []);
        setPartnershipAngles((draft.partnershipAngles as string[]) || []);
        setPrimaryContactId((draft.primaryContactId as string) || null);
        setNextStep((draft.nextStep as string) || '');
        setNotes((draft.notes as string) || '');
        setSourceUrl((draft.sourceUrl as string) || defaultSourceUrl || '');
        markDirty();
      } else {
        resetForm();
        // Apply default source URL for new opportunities
        if (defaultSourceUrl) {
          setSourceUrl(defaultSourceUrl);
        }
      }
    } else {
      resetForm();
    }
    setFieldErrors({});
  }, [opportunity, open]);

  const resetForm = () => {
    setOrganization('');
    setMetroId('');
    setStage('Found');
    setPartnerTiers(['Other']);
    setGrantAlignments([]);
    setMissionSnapshots([]);
    setPartnershipAngles([]);
    setPrimaryContactId(null);
    setNextStep('');
    setNotes('');
    setSourceUrl('');
    setFieldErrors({});
    resetDirty();
    clearDraft();
    clearDuplicates();
  };

  // Handle safe close with unsaved changes check
  const handleSafeClose = useCallback((newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setPendingClose(true);
      setShowUnsavedWarning(true);
    } else {
      onOpenChange(newOpen);
      if (!newOpen) resetForm();
    }
  }, [isDirty, onOpenChange]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedWarning(false);
    setPendingClose(false);
    resetForm();
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCancelClose = useCallback(() => {
    setShowUnsavedWarning(false);
    setPendingClose(false);
  }, []);

  // Check for duplicates on organization blur (only for new opportunities)
  const handleOrganizationBlur = async () => {
    validateField('organization', organization);
    if (!isEditMode && organization.trim().length >= 3) {
      await checkForDuplicates(organization, opportunity?.id);
    }
  };

  const handleGrantAlignmentToggle = (alignment: string, checked: boolean) => {
    if (checked) {
      setGrantAlignments([...grantAlignments, alignment]);
    } else {
      setGrantAlignments(grantAlignments.filter(a => a !== alignment));
    }
  };

  const handleTierToggle = (tier: string, checked: boolean) => {
    if (checked) {
      // Remove 'Other' when adding a specific tier
      const newTiers = tier === 'Other' 
        ? ['Other'] 
        : [...partnerTiers.filter(t => t !== 'Other'), tier];
      setPartnerTiers(newTiers);
    } else {
      const newTiers = partnerTiers.filter(t => t !== tier);
      // Default to 'Other' if no tiers selected
      setPartnerTiers(newTiers.length > 0 ? newTiers : ['Other']);
    }
  };

  const validateField = (fieldName: keyof FieldErrors, value: string) => {
    try {
      const fieldSchema = opportunitySchema.shape[fieldName as keyof typeof opportunitySchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setFieldErrors(prev => ({ ...prev, [fieldName]: undefined }));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFieldErrors(prev => ({ ...prev, [fieldName]: error.errors[0]?.message }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent, skipDuplicateCheck = false) => {
    e.preventDefault();
    
    // Check for duplicates before creating (not updating)
    if (!isEditMode && !skipDuplicateCheck) {
      const duplicates = await checkForDuplicates(organization, opportunity?.id);
      if (duplicates.length > 0) {
        setShowDuplicateWarning(true);
        return;
      }
    }
    
    try {
      const formData = {
        organization,
        metro_id: metroId || null,
        stage,
        partner_tier: partnerTiers[0] || 'Other',
        partner_tiers: partnerTiers,
        grant_alignment: grantAlignments,
        mission_snapshot: missionSnapshots,
        best_partnership_angle: partnershipAngles,
        primary_contact_id: primaryContactId || null,
        next_step: nextStep || undefined,
        notes: notes || undefined
      };

      // Validate all fields
      const validated = opportunitySchema.parse(formData);

      if (isEditMode && opportunity) {
        await updateOpportunity.mutateAsync({
          id: opportunity.id,
          organization: validated.organization,
          metro_id: validated.metro_id ?? null,
           stage: validated.stage as any,
          partner_tier: (partnerTiers[0] || 'Other') as 'Anchor' | 'Distribution' | 'Referral' | 'Workforce' | 'Housing' | 'Education' | 'Other',
          partner_tiers: partnerTiers,
          grant_alignment: grantAlignments,
          mission_snapshot: missionSnapshots,
          best_partnership_angle: partnershipAngles,
          primary_contact_id: primaryContactId,
          next_step: validated.next_step || undefined,
          notes: validated.notes || undefined,
          website_url: sourceUrl.trim() || null
        });
      } else {
        const opportunityId = `OPP-${Date.now()}`;
        const result = await createOpportunity.mutateAsync({
          opportunity_id: opportunityId,
          organization: validated.organization,
          metro_id: validated.metro_id ?? undefined,
          stage: validated.stage as any,
          partner_tier: (partnerTiers[0] || 'Other') as 'Anchor' | 'Distribution' | 'Referral' | 'Workforce' | 'Housing' | 'Education' | 'Other',
          partner_tiers: partnerTiers,
          grant_alignment: grantAlignments,
          mission_snapshot: missionSnapshots,
          best_partnership_angle: partnershipAngles,
          primary_contact_id: primaryContactId,
          next_step: validated.next_step || undefined,
          notes: validated.notes || undefined,
          website_url: sourceUrl.trim() || null
        });

        // Auto-trigger enrichment if we have a source URL
        if (sourceUrl.trim() && result?.id) {
          supabase.functions.invoke('opportunity-auto-enrich', {
            body: {
              opportunity_id: result.id,
              source_url: sourceUrl.trim(),
              idempotency_key: `opp-create-${result.id}`,
            },
          }).then(({ error }) => {
            if (error) {
              console.error('Auto-enrich failed:', error);
              toast.error('Auto-enrichment failed to start');
            } else {
              toast.success('Auto-enrichment started — researching organization…');
            }
          });
        }
      }
      
      resetForm();
      resetDirty();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatValidationErrors(error);
        errors.forEach(err => toast.error(err));
        
        // Set field-level errors
        const newFieldErrors: FieldErrors = {};
        error.errors.forEach(err => {
          const field = err.path[0] as keyof FieldErrors;
          if (field && !newFieldErrors[field]) {
            newFieldErrors[field] = err.message;
          }
        });
        setFieldErrors(newFieldErrors);
      }
    }
  };

  const isPending = createOpportunity.isPending || updateOpportunity.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={handleSafeClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Opportunity' : 'Add New Opportunity'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="organization">Organization *</Label>
            <Input
              id="organization"
              value={organization}
              onChange={(e) => { setOrganization(e.target.value); markDirty(); }}
              onBlur={handleOrganizationBlur}
              maxLength={200}
              required
              placeholder="Organization name"
              className={fieldErrors.organization ? 'border-destructive' : ''}
            />
            {fieldErrors.organization && (
              <p className="text-xs text-destructive">{fieldErrors.organization}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">Website URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => { setSourceUrl(e.target.value); markDirty(); }}
              placeholder="https://organization-website.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {isEditMode ? 'Organization website for enrichment' : 'Auto-enrichment will run after creation if provided'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="metro">Metro</Label>
              <Select value={metroId} onValueChange={(v) => { setMetroId(v); markDirty(); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select metro" />
                </SelectTrigger>
                <SelectContent>
                  {metros?.map((metro) => (
                    <SelectItem key={metro.id} value={metro.id}>
                      {metro.metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary Contact</Label>
              <ContactSearchSelect
                value={primaryContactId}
                onChange={(v) => { setPrimaryContactId(v); markDirty(); }}
                placeholder="Search contacts..."
              />
            </div>
          <div className="space-y-2 col-span-2">
              <Label>Partner Sectors (select all that apply)</Label>
              {sectorsLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading sectors...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {sectors?.map((sector) => (
                    <div key={sector.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tier-${sector.name}`}
                        checked={partnerTiers.includes(sector.name)}
                        onCheckedChange={(checked) => { handleTierToggle(sector.name, !!checked); markDirty(); }}
                      />
                      <label
                        htmlFor={`tier-${sector.name}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {sector.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Grant Alignment (select all that apply)</Label>
            {grantAlignmentsLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading grant alignments...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {grantAlignmentOptions?.map((alignment) => (
                  <div key={alignment.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`alignment-${alignment.name}`}
                    checked={grantAlignments.includes(alignment.name)}
                    onCheckedChange={(checked) => { handleGrantAlignmentToggle(alignment.name, !!checked); markDirty(); }}
                  />
                  <label
                    htmlFor={`alignment-${alignment.name}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {alignment.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mission Snapshot</Label>
            <MultiSelect
              options={missionSnapshotOptions?.map(s => ({ value: s.name, label: s.name })) || []}
              selected={missionSnapshots}
              onChange={(v) => { setMissionSnapshots(v); markDirty(); }}
              placeholder="Select mission focus areas..."
            />
          </div>

          <div className="space-y-2">
            <Label>Best Partnership Angle</Label>
            <MultiSelect
              options={partnershipAngleOptions?.map(a => ({ value: a.name, label: a.name })) || []}
              selected={partnershipAngles}
              onChange={(v) => { setPartnershipAngles(v); markDirty(); }}
              placeholder="Select partnership angles..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Chapter</Label>
            <Select value={stage} onValueChange={(v) => { setStage(v as typeof STAGES[number]); markDirty(); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextStep">Next Step</Label>
            <Input
              id="nextStep"
              value={nextStep}
              onChange={(e) => { setNextStep(e.target.value); markDirty(); }}
              onBlur={() => validateField('next_step', nextStep)}
              maxLength={500}
              placeholder="What's the next action?"
              className={fieldErrors.next_step ? 'border-destructive' : ''}
            />
            {fieldErrors.next_step && (
              <p className="text-xs text-destructive">{fieldErrors.next_step}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); markDirty(); }}
              onBlur={() => validateField('notes', notes)}
              maxLength={2000}
              placeholder="Additional notes..."
              rows={3}
              className={fieldErrors.notes ? 'border-destructive' : ''}
            />
            {fieldErrors.notes && (
              <p className="text-xs text-destructive">{fieldErrors.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">{notes.length}/2000</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => handleSafeClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Opportunity')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    
    <DuplicateWarningDialog
      open={showDuplicateWarning}
      organizationName={organization}
      similarOpportunities={similarOpportunities}
      onCreateAnyway={() => {
        setShowDuplicateWarning(false);
        // Create a synthetic form event to resubmit
        const form = document.querySelector('form');
        if (form) {
          const event = new Event('submit', { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'preventDefault', { value: () => {} });
          handleSubmit(event as unknown as React.FormEvent, true);
        }
      }}
      onCancel={() => setShowDuplicateWarning(false)}
    />
    
    <UnsavedChangesDialog
      open={showUnsavedWarning}
      onDiscard={handleDiscardChanges}
      onCancel={handleCancelClose}
    />
    </>
  );
}
