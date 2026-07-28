import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateSuggestion } from '@/hooks/useUpdateSuggestion';
import type { Database } from '@/integrations/supabase/types';

type AISuggestion = Database['public']['Tables']['ai_suggestions']['Row'];

interface EditSuggestionModalProps {
  suggestion: AISuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSuggestionModal({
  suggestion,
  open,
  onOpenChange,
}: EditSuggestionModalProps) {
  const updateMutation = useUpdateSuggestion();
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (suggestion) {
      const initial: Record<string, string> = {};
      for (const key of editableFields(suggestion.suggestion_type)) {
        initial[key] = (suggestion as any)[key] ?? '';
      }
      setFields(initial);
    }
  }, [suggestion]);

  if (!suggestion) return null;

  const type = suggestion.suggestion_type;

  function handleSave() {
    if (!suggestion) return;
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(fields)) {
      const original = (suggestion as any)[key] ?? '';
      if (value !== original) {
        updates[key] = value || null;
      }
    }
    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }
    updateMutation.mutate(
      { suggestionId: suggestion.id, updates },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  const set = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Suggestion</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {type === 'new_contact' && (
            <>
              <Field label="Name" value={fields.suggested_name} onChange={(v) => set('suggested_name', v)} />
              <Field label="Email" value={fields.suggested_email} onChange={(v) => set('suggested_email', v)} type="email" />
              <Field label="Phone" value={fields.suggested_phone} onChange={(v) => set('suggested_phone', v)} type="tel" />
              <Field label="Title" value={fields.suggested_title} onChange={(v) => set('suggested_title', v)} />
              <Field label="Organization" value={fields.suggested_organization} onChange={(v) => set('suggested_organization', v)} />
            </>
          )}

          {type === 'new_opportunity' && (
            <>
              <Field label="Organization" value={fields.suggested_organization} onChange={(v) => set('suggested_organization', v)} />
            </>
          )}

          {type === 'task' && (
            <>
              <Field label="Task Title" value={fields.task_title} onChange={(v) => set('task_title', v)} />
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={fields.task_description ?? ''}
                  onChange={(e) => set('task_description', e.target.value)}
                  rows={3}
                />
              </div>
              <Field label="Due Date" value={fields.task_due_date} onChange={(v) => set('task_due_date', v)} type="date" />
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={fields.task_priority || 'medium'} onValueChange={(v) => set('task_priority', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === 'followup' && (
            <>
              <Field label="Follow-up Reason" value={fields.followup_reason} onChange={(v) => set('followup_reason', v)} />
              <Field label="Due Date" value={fields.task_due_date} onChange={(v) => set('task_due_date', v)} type="date" />
            </>
          )}

          {type === 'activity' && (
            <p className="text-sm text-muted-foreground">Activity suggestions cannot be edited.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending || type === 'activity'}>
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function editableFields(type: string): string[] {
  switch (type) {
    case 'new_contact':
      return ['suggested_name', 'suggested_email', 'suggested_phone', 'suggested_title', 'suggested_organization'];
    case 'new_opportunity':
      return ['suggested_organization'];
    case 'task':
      return ['task_title', 'task_description', 'task_due_date', 'task_priority'];
    case 'followup':
      return ['followup_reason', 'task_due_date'];
    default:
      return [];
  }
}
