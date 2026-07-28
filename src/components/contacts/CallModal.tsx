import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/useActivities';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { Phone, Trash2, Loader2 } from 'lucide-react';
import { CallHistoryItem } from '@/hooks/useContactCallHistory';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface CallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  opportunityId?: string | null;
  metroId?: string | null;
  existingCall?: CallHistoryItem | null;
}

const OUTCOMES = ['Positive', 'Neutral', 'Negative', 'No Answer', 'Left a Voicemail', 'Bad Number'] as const;

export function CallModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  opportunityId,
  metroId,
  existingCall
}: CallModalProps) {
  const { t } = useTranslation(['relationships', 'common']);
  const now = new Date();
  const [date, setDate] = useState(format(now, 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(now, 'HH:mm'));
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<string>('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const queryClient = useQueryClient();

  const isEditMode = !!existingCall;

  useEffect(() => {
    if (open) {
      if (existingCall) {
        const callDate = new Date(existingCall.date);
        setDate(format(callDate, 'yyyy-MM-dd'));
        setTime(format(callDate, 'HH:mm'));
        setNotes(existingCall.notes || '');
        setOutcome(existingCall.outcome || '');
        setNextAction(existingCall.next_action || '');
        setNextActionDue(existingCall.next_action_due ? format(new Date(existingCall.next_action_due), 'yyyy-MM-dd') : '');
      } else {
        // Reset to current time for new calls
        const now = new Date();
        setDate(format(now, 'yyyy-MM-dd'));
        setTime(format(now, 'HH:mm'));
        setNotes('');
        setOutcome('');
        setNextAction('');
        setNextActionDue('');
      }
    }
  }, [open, existingCall]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dateTime = new Date(`${date}T${time}`).toISOString();

    try {
      if (isEditMode && existingCall) {
        await updateActivity.mutateAsync({
          id: existingCall.id,
          activity_date_time: dateTime,
          notes: notes || null,
          outcome: outcome as any || null,
          next_action: nextAction || null,
          next_action_due: nextActionDue || null
        });
      } else {
        const activityId = `ACT-${Date.now()}`;
        await createActivity.mutateAsync({
          activity_id: activityId,
          activity_type: 'Call',
          activity_date_time: dateTime,
          contact_id: contactId,
          opportunity_id: opportunityId || null,
          metro_id: metroId || null,
          notes: notes || null,
          outcome: outcome as any || null,
          next_action: nextAction || null,
          next_action_due: nextActionDue || null
        });
      }

      queryClient.invalidateQueries({ queryKey: ['contact-call-history', contactId] });
      queryClient.invalidateQueries({ queryKey: ['unified-activities'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save call:', error);
    }
  };

  const handleDelete = async () => {
    if (!existingCall) return;

    try {
      await deleteActivity.mutateAsync(existingCall.id);
      queryClient.invalidateQueries({ queryKey: ['contact-call-history', contactId] });
      queryClient.invalidateQueries({ queryKey: ['unified-activities'] });
      setIsDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete call:', error);
    }
  };

  const isPending = createActivity.isPending || updateActivity.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {isEditMode ? t('relationships:interactions.calls.editCall') : t('relationships:interactions.calls.logCall')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contact display */}
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
              {t('relationships:interactions.calls.callWith')} <span className="font-medium text-foreground">{contactName}</span>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="call-date">{t('relationships:interactions.calls.fields.date')}</Label>
                <Input
                  id="call-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="call-time">{t('relationships:interactions.calls.fields.time')}</Label>
                <Input
                  id="call-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Outcome */}
            <div className="space-y-2">
              <Label htmlFor="outcome">{t('relationships:interactions.calls.fields.outcome')}</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder={t('relationships:interactions.calls.fields.outcomePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('relationships:interactions.calls.fields.notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('relationships:interactions.calls.fields.notesPlaceholder')}
                rows={3}
              />
            </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="next-action">{t('relationships:interactions.calls.fields.nextAction')}</Label>
              <Input
                id="next-action"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder={t('relationships:interactions.calls.fields.nextActionPlaceholder')}
              />
            </div>

            {/* Next Action Due */}
            <div className="space-y-2">
              <Label htmlFor="next-action-due">{t('relationships:interactions.calls.fields.nextActionDue')}</Label>
              <Input
                id="next-action-due"
                type="date"
                value={nextActionDue}
                onChange={(e) => setNextActionDue(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common:buttons.delete')}
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common:buttons.cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common:loading.saving')}
                    </>
                  ) : (
                    isEditMode ? t('relationships:interactions.calls.saveChanges') : t('relationships:interactions.calls.logCall')
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('relationships:interactions.calls.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('relationships:interactions.calls.confirmDeleteMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteActivity.isPending}
            >
              {deleteActivity.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('relationships:interactions.calls.deleteCall')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
