import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContacts } from '@/hooks/useContacts';
import { useMetros } from '@/hooks/useMetros';
import { useCreateActivity, useUpdateActivity } from '@/hooks/useActivities';
import { Loader2, Calendar, User, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface MeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  preSelectedContactId?: string;
  existingMeeting?: {
    id: string;
    activity_date_time: string;
    contact_id?: string | null;
    metro_id?: string | null;
    notes?: string | null;
    next_action?: string | null;
    attended?: boolean | null;
  };
}

export function MeetingModal({
  open,
  onOpenChange,
  selectedDate,
  preSelectedContactId,
  existingMeeting
}: MeetingModalProps) {
  const { t } = useTranslation(['relationships', 'common']);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [contactId, setContactId] = useState('');
  const [metroId, setMetroId] = useState('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [attended, setAttended] = useState(false);

  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const { data: metros, isLoading: metrosLoading } = useMetros();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const isEditing = !!existingMeeting;
  const isLoading = contactsLoading || metrosLoading;
  const isSaving = createActivity.isPending || updateActivity.isPending;

  // Reset form when modal opens with new data — do NOT include `open` to avoid infinite loop
  useEffect(() => {
    if (!open) return;
    if (existingMeeting) {
      const meetingDate = new Date(existingMeeting.activity_date_time);
      setDate(format(meetingDate, 'yyyy-MM-dd'));
      setTime(format(meetingDate, 'HH:mm'));
      setContactId(existingMeeting.contact_id || '');
      setMetroId(existingMeeting.metro_id || '');
      setNotes(existingMeeting.notes || '');
      setNextAction(existingMeeting.next_action || '');
      setAttended(existingMeeting.attended || false);
    } else if (selectedDate) {
      setDate(format(selectedDate, 'yyyy-MM-dd'));
      setTime('10:00');
      setContactId(preSelectedContactId || '');
      setMetroId('');
      setNotes('');
      setNextAction('');
      setAttended(false);
    } else {
      setContactId(preSelectedContactId || '');
      setAttended(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activityDateTime = `${date}T${time}:00`;

    if (isEditing && existingMeeting) {
      await updateActivity.mutateAsync({
        id: existingMeeting.id,
        activity_date_time: activityDateTime,
        contact_id: contactId || null,
        metro_id: metroId || null,
        notes: notes || null,
        next_action: nextAction || null,
        attended: attended
      });
    } else {
      await createActivity.mutateAsync({
        activity_id: `ACT-${Date.now()}`,
        activity_type: 'Meeting',
        activity_date_time: activityDateTime,
        contact_id: contactId || null,
        metro_id: metroId || null,
        notes: notes || null,
        next_action: nextAction || null,
        outcome: null,
        attended: attended
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {isEditing
              ? t('relationships:calendar.meetingModal.editMeeting')
              : t('relationships:calendar.meetingModal.scheduleMeeting')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Attended Banner */}
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors",
                attended
                  ? "bg-success/10 border-success/50"
                  : "bg-destructive/10 border-destructive/50 hover:bg-destructive/15"
              )}
              onClick={() => setAttended(!attended)}
            >
              <Checkbox
                checked={attended}
                onCheckedChange={(checked) => setAttended(checked === true)}
                className={cn(
                  "h-6 w-6",
                  attended
                    ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                    : "border-destructive"
                )}
              />
              <span className={cn(
                "font-semibold text-lg",
                attended ? "text-success" : "text-destructive"
              )}>
                {attended
                  ? t('relationships:calendar.meetingModal.attended')
                  : t('relationships:calendar.meetingModal.notAttendedYet')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">{t('relationships:calendar.meetingModal.fields.date')}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">{t('relationships:calendar.meetingModal.fields.time')}</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('relationships:calendar.meetingModal.fields.contact')}
              </Label>
              <Select value={contactId || "__none__"} onValueChange={(val) => setContactId(val === "__none__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('relationships:calendar.meetingModal.fields.selectContact')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('relationships:calendar.meetingModal.fields.noContact')}</SelectItem>
                  {contacts?.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.opportunities?.organization ? `(${contact.opportunities.organization})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metro" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t('relationships:calendar.meetingModal.fields.metro')}
              </Label>
              <Select value={metroId || "__none__"} onValueChange={(val) => setMetroId(val === "__none__" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('relationships:calendar.meetingModal.fields.selectMetro')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('relationships:calendar.meetingModal.fields.noMetro')}</SelectItem>
                  {metros?.map(metro => (
                    <SelectItem key={metro.id} value={metro.id}>
                      {metro.metro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('relationships:calendar.meetingModal.fields.notes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('relationships:calendar.meetingModal.fields.notesPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextAction">{t('relationships:calendar.meetingModal.fields.followUpAction')}</Label>
              <Input
                id="nextAction"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder={t('relationships:calendar.meetingModal.fields.followUpPlaceholder')}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common:buttons.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing
                  ? t('relationships:calendar.meetingModal.updateMeeting')
                  : t('relationships:calendar.meetingModal.scheduleMeeting')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
