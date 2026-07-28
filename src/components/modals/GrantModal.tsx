import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useCreateGrant, useUpdateGrant, Grant, GrantInput, GrantStage, FunderType, ReportingFrequency } from '@/hooks/useGrants';
import { useGrantTypes } from '@/hooks/useGrantTypes';
import { useGrantAlignments } from '@/hooks/useGrantAlignments';
import { useMetros } from '@/hooks/useMetros';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useAuth } from '@/contexts/AuthContext';
import { StarRatingControl } from '@/components/grants/StarRatingControl';
import { useDirtyClose } from '@/hooks/useDirtyClose';
import { UnsavedChangesDialog } from '@/components/modals/UnsavedChangesDialog';

const GRANT_STAGES: GrantStage[] = [
  'Researching',
  'Eligible',
  'Cultivating',
  'LOI Submitted',
  'Full Proposal Submitted',
  'Awarded',
  'Declined',
  'Closed'
];

const FUNDER_TYPES: FunderType[] = [
  'Foundation',
  'Government - Federal',
  'Government - State',
  'Government - Local',
  'Corporate',
  'Other'
];

const REPORTING_FREQUENCIES: ReportingFrequency[] = [
  'Quarterly',
  'Annual',
  'End of Grant'
];

const grantSchema = z.object({
  grant_name: z.string().min(1, 'Grant name is required'),
  funder_name: z.string().min(1, 'Funder name is required'),
  funder_type: z.enum(['Foundation', 'Government - Federal', 'Government - State', 'Government - Local', 'Corporate', 'Other']),
  star_rating: z.number().min(1).max(5),
  opportunity_id: z.string().nullable(),
  metro_id: z.string().nullable(),
  stage: z.enum(['Researching', 'Eligible', 'Cultivating', 'LOI Submitted', 'Full Proposal Submitted', 'Awarded', 'Declined', 'Closed']),
  status: z.enum(['Active', 'Closed']),
  available_funding: z.number().nullable(),
  amount_requested: z.number().nullable(),
  amount_awarded: z.number().nullable(),
  fiscal_year: z.number().nullable(),
  grant_term_start: z.string().nullable(),
  grant_term_end: z.string().nullable(),
  is_multiyear: z.boolean(),
  grant_types: z.array(z.string()),
  strategic_focus: z.array(z.string()),
  match_required: z.boolean(),
  reporting_required: z.boolean(),
  reporting_frequency: z.enum(['Quarterly', 'Annual', 'End of Grant']).nullable(),
  notes: z.string().nullable(),
  internal_strategy_notes: z.string().nullable(),
});

type GrantFormData = z.infer<typeof grantSchema>;

interface GrantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grant?: Grant | null;
  defaultOpportunityId?: string | null;
}

export function GrantModal({ open, onOpenChange, grant, defaultOpportunityId }: GrantModalProps) {
  const dirtyGuard = useDirtyClose(onOpenChange);
  const { user } = useAuth();
  const createGrant = useCreateGrant();
  const updateGrant = useUpdateGrant();
  const { data: grantTypes } = useGrantTypes(true);
  const { data: grantAlignments } = useGrantAlignments(true);
  const { data: metros } = useMetros();
  const { data: opportunities } = useOpportunities();
  
  const isEditing = !!grant;
  
  const form = useForm<GrantFormData>({
    resolver: zodResolver(grantSchema),
    defaultValues: {
      grant_name: '',
      funder_name: '',
      funder_type: 'Other',
      star_rating: 3,
      opportunity_id: null,
      metro_id: null,
      stage: 'Researching',
      status: 'Active',
      available_funding: null,
      amount_requested: null,
      amount_awarded: null,
      fiscal_year: null,
      grant_term_start: null,
      grant_term_end: null,
      is_multiyear: false,
      grant_types: [],
      strategic_focus: [],
      match_required: false,
      reporting_required: false,
      reporting_frequency: null,
      notes: null,
      internal_strategy_notes: null,
    }
  });
  
  // Reset form when grant changes
  useEffect(() => {
    if (grant) {
      form.reset({
        grant_name: grant.grant_name,
        funder_name: grant.funder_name,
        funder_type: grant.funder_type,
        star_rating: grant.star_rating,
        opportunity_id: grant.opportunity_id,
        metro_id: grant.metro_id,
        stage: grant.stage,
        status: grant.status,
        available_funding: grant.available_funding ? Number(grant.available_funding) : null,
        amount_requested: grant.amount_requested ? Number(grant.amount_requested) : null,
        amount_awarded: grant.amount_awarded ? Number(grant.amount_awarded) : null,
        fiscal_year: grant.fiscal_year,
        grant_term_start: grant.grant_term_start,
        grant_term_end: grant.grant_term_end,
        is_multiyear: grant.is_multiyear || false,
        grant_types: grant.grant_types || [],
        strategic_focus: grant.strategic_focus || [],
        match_required: grant.match_required || false,
        reporting_required: grant.reporting_required || false,
        reporting_frequency: grant.reporting_frequency,
        notes: grant.notes,
        internal_strategy_notes: grant.internal_strategy_notes,
      });
    } else {
      form.reset({
        grant_name: '',
        funder_name: '',
        funder_type: 'Other',
        star_rating: 3,
        opportunity_id: defaultOpportunityId || null,
        metro_id: null,
        stage: 'Researching',
        status: 'Active',
        available_funding: null,
        amount_requested: null,
        amount_awarded: null,
        fiscal_year: new Date().getFullYear(),
        grant_term_start: null,
        grant_term_end: null,
        is_multiyear: false,
        grant_types: [],
        strategic_focus: [],
        match_required: false,
        reporting_required: false,
        reporting_frequency: null,
        notes: null,
        internal_strategy_notes: null,
      });
    }
  }, [grant, form, defaultOpportunityId]);
  
  const onSubmit = async (data: GrantFormData) => {
    try {
      if (isEditing && grant) {
        await updateGrant.mutateAsync({
          id: grant.id,
          ...data
        });
      } else {
        await createGrant.mutateAsync({
          ...data,
          owner_id: user?.id || '',
        } as GrantInput);
      }
      dirtyGuard.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  const isPending = createGrant.isPending || updateGrant.isPending;
  
  return (
    <>
    <Dialog open={open} onOpenChange={dirtyGuard.handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" onChange={dirtyGuard.markDirty}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Grant' : 'Add Grant'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update grant details' : 'Track a new grant opportunity'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="grant_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grant Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Digital Equity Initiative" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="funder_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Funder Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Ford Foundation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="funder_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Funder Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FUNDER_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="star_rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority Rating</FormLabel>
                        <FormControl>
                          <div className="pt-2">
                            <StarRatingControl 
                              value={field.value} 
                              onChange={field.onChange}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Pipeline */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Pipeline</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stage</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GRANT_STAGES.map(stage => (
                              <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Relationships */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Relationships</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="metro_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metro</FormLabel>
                        <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select metro" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {metros?.map(metro => (
                              <SelectItem key={metro.id} value={metro.id}>{metro.metro}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="opportunity_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Linked Opportunity</FormLabel>
                        <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select opportunity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {opportunities?.map(opp => (
                              <SelectItem key={opp.id} value={opp.id}>{opp.organization}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Amounts */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Amounts & Timing</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="available_funding"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Funding ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            value={field.value || ''} 
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fiscal_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fiscal Year</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="2024"
                            value={field.value || ''} 
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount_requested"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Requested ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            value={field.value || ''} 
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="amount_awarded"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Awarded ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            value={field.value || ''} 
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="grant_term_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term Start</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            value={field.value || ''} 
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="grant_term_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term End</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            value={field.value || ''} 
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="is_multiyear"
                    render={({ field }) => (
                      <FormItem className="flex items-end gap-2 pb-2">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Multi-year Grant</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Strategy Tagging */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Strategy Tagging</h4>
                
                <FormField
                  control={form.control}
                  name="grant_types"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grant Types</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {grantTypes?.map(type => (
                          <label key={type.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={field.value.includes(type.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, type.name]);
                                } else {
                                  field.onChange(field.value.filter(t => t !== type.name));
                                }
                              }}
                            />
                            {type.name}
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="strategic_focus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategic Focus (Grant Alignments)</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {grantAlignments?.map(alignment => (
                          <label key={alignment.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={field.value.includes(alignment.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, alignment.name]);
                                } else {
                                  field.onChange(field.value.filter(a => a !== alignment.name));
                                }
                              }}
                            />
                            {alignment.name}
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Requirements */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Requirements</h4>
                
                <div className="flex flex-wrap gap-6">
                  <FormField
                    control={form.control}
                    name="match_required"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Match Required</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="reporting_required"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox 
                            checked={field.value} 
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Reporting Required</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('reporting_required') && (
                    <FormField
                      control={form.control}
                      name="reporting_frequency"
                      render={({ field }) => (
                        <FormItem>
                          <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || null)}>
                            <FormControl>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {REPORTING_FREQUENCIES.map(freq => (
                                <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
              
              {/* Notes */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Notes</h4>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ''}
                          placeholder="General notes about this grant..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="internal_strategy_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Strategy Notes (Admin/Leadership Only)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ''}
                          placeholder="Strategy notes visible only to admin and leadership..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => dirtyGuard.handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Grant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog
      open={dirtyGuard.showPrompt}
      onDiscard={dirtyGuard.discard}
      onCancel={dirtyGuard.cancelPrompt}
    />
    </>
  );
}
