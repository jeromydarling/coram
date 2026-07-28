/**
 * CareCompletionDialog — Dignified companion completion ritual for a person.
 *
 * WHAT: Dialog for archiving a person with optional closing reflection + date of passing.
 * WHERE: PersonDetail page, triggered by "Complete Accompaniment" action.
 * WHY: Honors the relationship with a closing ritual, not a cold "archive" button.
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Heart, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface CareCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  onCompleted: () => void;
}

export function CareCompletionDialog({ open, onOpenChange, contactId, contactName, onCompleted }: CareCompletionDialogProps) {
  const [reflection, setReflection] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateOfPassing, setDateOfPassing] = useState('');
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          care_status: 'care_completed',
          completion_date: completionDate || null,
          date_of_passing: dateOfPassing || null,
          closing_reflection: reflection || null,
        })
        .eq('id', contactId);

      if (error) throw error;
      toast.success(`Season of accompaniment for ${contactName} has been gently closed.`);
      onCompleted();
      onOpenChange(false);
    } catch (e) {
      toast.error('Could not complete care. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Complete Accompaniment for {contactName}
          </DialogTitle>
          <DialogDescription>
            A moment to honor this relationship. Take your time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="completion-date">Completion date</Label>
            <Input
              id="completion-date"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date-of-passing" className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Date of passing <span className="text-xs text-muted-foreground">(optional, private)</span>
            </Label>
            <Input
              id="date-of-passing"
              type="date"
              value={dateOfPassing}
              onChange={(e) => setDateOfPassing(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="closing-reflection">Closing reflection <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="closing-reflection"
              placeholder="What would you like to remember about this person and your time together?"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Not yet
          </Button>
          <Button onClick={handleComplete} disabled={saving}>
            {saving ? 'Completing…' : 'Close this season gently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
