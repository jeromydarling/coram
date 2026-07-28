import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useOpportunities } from '@/hooks/useOpportunities';
import { useMetros } from '@/hooks/useMetros';
import { useSectors } from '@/hooks/useSectors';
import { useGrantAlignments } from '@/hooks/useGrantAlignments';
import { useMissionSnapshots } from '@/hooks/useMissionSnapshots';
import { usePartnershipAngles } from '@/hooks/usePartnershipAngles';
import { useGrantTypes } from '@/hooks/useGrantTypes';
import { toast } from '@/components/ui/sonner';

// Field configuration types
interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multi-select' | 'checkbox' | 'switch' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
}

interface BulkEditModalProps<T extends { id: string }> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: T[];
  entityType: 'contact' | 'opportunity' | 'grant';
  onBulkUpdate: (ids: string[], updates: Partial<T>) => Promise<void>;
}

// The "no change" sentinel value
const NO_CHANGE = '__no_change__';

export function BulkEditModal<T extends { id: string }>({
  open,
  onOpenChange,
  selectedItems,
  entityType,
  onBulkUpdate,
}: BulkEditModalProps<T>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());

  // Fetch lookup data
  const { data: opportunities } = useOpportunities();
  const { data: metros } = useMetros();
  const { data: sectors } = useSectors(true);
  const { data: grantAlignments } = useGrantAlignments(true);
  const { data: missionSnapshots } = useMissionSnapshots();
  const { data: partnershipAngles } = usePartnershipAngles();
  const { data: grantTypes } = useGrantTypes(true);

  // Build field configs based on entity type
  const getFieldConfigs = (): FieldConfig[] => {
    switch (entityType) {
      case 'contact':
        return [
          { key: 'name', label: 'Name', type: 'text', maxLength: 100, placeholder: 'Full name' },
          { key: 'title', label: 'Title', type: 'text', maxLength: 100, placeholder: 'Job title' },
          { key: 'email', label: 'Email', type: 'text', placeholder: 'email@example.com' },
          { key: 'phone', label: 'Phone', type: 'text', maxLength: 30, placeholder: '(555) 123-4567' },
          { 
            key: 'opportunity_id', 
            label: 'Organization', 
            type: 'select',
            options: [
              { value: '__clear__', label: '(Clear value)' },
              ...(opportunities?.map(o => ({ value: o.id, label: o.organization })) || [])
            ]
          },
          { key: 'is_primary', label: 'Primary Contact', type: 'switch' },
          { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, placeholder: 'Additional notes...' },
        ];

      case 'opportunity':
        return [
          { key: 'organization', label: 'Organization', type: 'text', maxLength: 200, placeholder: 'Organization name' },
          { 
            key: 'metro_id', 
            label: 'Metro', 
            type: 'select',
            options: [
              { value: '__clear__', label: '(Clear value)' },
              ...(metros?.map(m => ({ value: m.id, label: m.metro })) || [])
            ]
          },
          { 
            key: 'stage', 
            label: 'Stage', 
            type: 'select',
            options: [
              { value: 'Target Identified', label: 'Target Identified' },
              { value: 'Contacted', label: 'Contacted' },
              { value: 'Discovery Scheduled', label: 'Discovery Scheduled' },
              { value: 'Discovery Held', label: 'Discovery Held' },
              { value: 'Proposal Sent', label: 'Proposal Sent' },
              { value: 'Agreement Pending', label: 'Agreement Pending' },
              { value: 'Agreement Signed', label: 'Agreement Signed' },
              { value: 'First Volume', label: 'First Volume' },
              { value: 'Stable Producer', label: 'Stable Producer' },
              { value: 'Closed - Not a Fit', label: 'Closed - Not a Fit' },
            ]
          },
          { 
            key: 'partner_tiers', 
            label: 'Partner Sectors', 
            type: 'multi-select',
            options: sectors?.map(s => ({ value: s.name, label: s.name })) || []
          },
          { 
            key: 'grant_alignment', 
            label: 'Grant Alignment', 
            type: 'multi-select',
            options: grantAlignments?.map(g => ({ value: g.name, label: g.name })) || []
          },
          { 
            key: 'mission_snapshot', 
            label: 'Mission Snapshot', 
            type: 'multi-select',
            options: missionSnapshots?.map(m => ({ value: m.name, label: m.name })) || []
          },
          { 
            key: 'best_partnership_angle', 
            label: 'Partnership Angles', 
            type: 'multi-select',
            options: partnershipAngles?.map(p => ({ value: p.name, label: p.name })) || []
          },
          { key: 'next_step', label: 'Next Step', type: 'text', maxLength: 500, placeholder: "What's the next action?" },
          { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, placeholder: 'Additional notes...' },
        ];

      case 'grant':
        return [
          { key: 'grant_name', label: 'Grant Name', type: 'text', placeholder: 'Grant name' },
          { key: 'funder_name', label: 'Funder Name', type: 'text', placeholder: 'Funder name' },
          { 
            key: 'funder_type', 
            label: 'Funder Type', 
            type: 'select',
            options: [
              { value: 'Foundation', label: 'Foundation' },
              { value: 'Government - Federal', label: 'Government - Federal' },
              { value: 'Government - State', label: 'Government - State' },
              { value: 'Government - Local', label: 'Government - Local' },
              { value: 'Corporate', label: 'Corporate' },
              { value: 'Other', label: 'Other' },
            ]
          },
          { 
            key: 'stage', 
            label: 'Stage', 
            type: 'select',
            options: [
              { value: 'Researching', label: 'Researching' },
              { value: 'Eligible', label: 'Eligible' },
              { value: 'Cultivating', label: 'Cultivating' },
              { value: 'LOI Submitted', label: 'LOI Submitted' },
              { value: 'Full Proposal Submitted', label: 'Full Proposal Submitted' },
              { value: 'Awarded', label: 'Awarded' },
              { value: 'Declined', label: 'Declined' },
              { value: 'Closed', label: 'Closed' },
            ]
          },
          { 
            key: 'status', 
            label: 'Status', 
            type: 'select',
            options: [
              { value: 'Active', label: 'Active' },
              { value: 'Closed', label: 'Closed' },
            ]
          },
          { 
            key: 'metro_id', 
            label: 'Metro', 
            type: 'select',
            options: [
              { value: '__clear__', label: '(Clear value)' },
              ...(metros?.map(m => ({ value: m.id, label: m.metro })) || [])
            ]
          },
          { 
            key: 'opportunity_id', 
            label: 'Linked Organization', 
            type: 'select',
            options: [
              { value: '__clear__', label: '(Clear value)' },
              ...(opportunities?.map(o => ({ value: o.id, label: o.organization })) || [])
            ]
          },
          { key: 'amount_requested', label: 'Amount Requested ($)', type: 'number', placeholder: '0' },
          { key: 'amount_awarded', label: 'Amount Awarded ($)', type: 'number', placeholder: '0' },
          { key: 'fiscal_year', label: 'Fiscal Year', type: 'number', placeholder: '2026' },
          { 
            key: 'grant_types', 
            label: 'Grant Types', 
            type: 'multi-select',
            options: grantTypes?.map(t => ({ value: t.name, label: t.name })) || []
          },
          { 
            key: 'strategic_focus', 
            label: 'Strategic Focus', 
            type: 'multi-select',
            options: grantAlignments?.map(g => ({ value: g.name, label: g.name })) || []
          },
          { key: 'is_multiyear', label: 'Multi-Year Grant', type: 'switch' },
          { key: 'match_required', label: 'Match Required', type: 'switch' },
          { key: 'reporting_required', label: 'Reporting Required', type: 'switch' },
          { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, placeholder: 'Notes...' },
        ];

      default:
        return [];
    }
  };

  const fieldConfigs = getFieldConfigs();

  const toggleField = (key: string) => {
    setEnabledFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Clear the value when disabling
        setFieldValues(vals => {
          const newVals = { ...vals };
          delete newVals[key];
          return newVals;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const updateFieldValue = (key: string, value: unknown) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (enabledFields.size === 0) {
      toast.error('Please enable at least one field to update');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: Record<string, unknown> = {};
      
      enabledFields.forEach(key => {
        let value = fieldValues[key];
        // Handle "clear value" option
        if (value === '__clear__') {
          value = null;
        }
        updates[key] = value;
      });

      const ids = selectedItems.map(item => item.id);
      await onBulkUpdate(ids, updates as Partial<T>);
      
      toast.success(`Updated ${selectedItems.length} ${entityType}(s)`);
      onOpenChange(false);
      
      // Reset state
      setFieldValues({});
      setEnabledFields(new Set());
    } catch (error) {
      toast.error(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFieldValues({});
    setEnabledFields(new Set());
  };

  const renderField = (config: FieldConfig) => {
    const isEnabled = enabledFields.has(config.key);
    const value = fieldValues[config.key];

    return (
      <div key={config.key} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
        <Checkbox
          id={`enable-${config.key}`}
          checked={isEnabled}
          onCheckedChange={() => toggleField(config.key)}
          className="mt-1"
        />
        <div className="flex-1 space-y-2">
          <Label 
            htmlFor={`field-${config.key}`}
            className={!isEnabled ? 'text-muted-foreground' : ''}
          >
            {config.label}
          </Label>
          
          {config.type === 'text' && (
            <Input
              id={`field-${config.key}`}
              value={(value as string) || ''}
              onChange={(e) => updateFieldValue(config.key, e.target.value)}
              disabled={!isEnabled}
              placeholder={config.placeholder}
              maxLength={config.maxLength}
            />
          )}

          {config.type === 'number' && (
            <Input
              id={`field-${config.key}`}
              type="number"
              value={(value as number) || ''}
              onChange={(e) => updateFieldValue(config.key, e.target.value ? Number(e.target.value) : null)}
              disabled={!isEnabled}
              placeholder={config.placeholder}
            />
          )}

          {config.type === 'textarea' && (
            <Textarea
              id={`field-${config.key}`}
              value={(value as string) || ''}
              onChange={(e) => updateFieldValue(config.key, e.target.value)}
              disabled={!isEnabled}
              placeholder={config.placeholder}
              maxLength={config.maxLength}
              rows={3}
            />
          )}

          {config.type === 'select' && (
            <Select
              value={(value as string) || NO_CHANGE}
              onValueChange={(v) => updateFieldValue(config.key, v === NO_CHANGE ? undefined : v)}
              disabled={!isEnabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {config.options?.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {config.type === 'multi-select' && (
            <MultiSelect
              options={config.options || []}
              selected={(value as string[]) || []}
              onChange={(v) => updateFieldValue(config.key, v)}
              disabled={!isEnabled}
              placeholder="Select..."
            />
          )}

          {config.type === 'switch' && (
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id={`field-${config.key}`}
                checked={(value as boolean) || false}
                onCheckedChange={(v) => updateFieldValue(config.key, v)}
                disabled={!isEnabled}
              />
              <Label htmlFor={`field-${config.key}`} className="text-sm">
                {(value as boolean) ? 'Yes' : 'No'}
              </Label>
            </div>
          )}
        </div>
      </div>
    );
  };

  const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Edit {entityLabel}s</DialogTitle>
          <DialogDescription>
            Update multiple {entityLabel.toLowerCase()}s at once. Check the fields you want to modify.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center gap-2">
              <span>You are editing</span>
              <Badge variant="secondary">{selectedItems.length} {entityLabel.toLowerCase()}(s)</Badge>
            </div>
          </AlertDescription>
        </Alert>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-1">
            {fieldConfigs.map(renderField)}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || enabledFields.size === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              `Update ${selectedItems.length} ${entityLabel}(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
