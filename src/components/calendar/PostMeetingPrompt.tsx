import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateActivity, useUpdateActivity } from '@/hooks/useActivities';
import { Loader2, CheckCircle2, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

type ActivityOutcome = Database['public']['Enums']['activity_outcome'];

interface OutcomeOption {
  value: ActivityOutcome;
  label: string;
  emoji: string;
}

interface PostMeetingPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventData: {
    title: string;
    date: Date;
    contactId?: string | null;
    contactName?: string;
    googleCalendarEventId?: string | null;
  };
  onActivityCreated?: () => void;
}

export function PostMeetingPrompt({
  open,
  onOpenChange,
  eventData,
  onActivityCreated
}: PostMeetingPromptProps) {
  const { t } = useTranslation(['relationships', 'common']);
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const OUTCOMES: OutcomeOption[] = [
    { value: 'Connected', label: t('relationships:calendar.postMeeting.outcomes.connected'), emoji: '🤝' },
    { value: 'Moved Stage', label: t('relationships:calendar.postMeeting.outcomes.movedStage'), emoji: '📈' },
    { value: 'Follow-up Needed', label: t('relationships:calendar.postMeeting.outcomes.followUpNeeded'), emoji: '📋' },
    { value: 'No Response', label: t('relationships:calendar.postMeeting.outcomes.noResponse'), emoji: '📭' },
    { value: 'Not a Fit', label: t('relationships:calendar.postMeeting.outcomes.notAFit'), emoji: '❌' },
  ];

  // Check if an activity already exists for this google calendar event
  const { data: existingActivity } = useQuery({
    queryKey: ['existing-activity-for-event', eventData.googleCalendarEventId, eventData.date.toISOString(), eventData.contactId],
    queryFn: async () => {
      // Try matching by google_calendar_event_id first
      if (eventData.googleCalendarEventId) {
        const { data } = await supabase
          .from('activities')
          .select('id, notes, outcome, next_action, next_action_due')
          .eq('google_calendar_event_id', eventData.googleCalendarEventId)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      // Fallback: match by contact + date + type
      if (eventData.contactId) {
        const dateStr = eventData.date.toISOString().slice(0, 10);
        const { data } = await supabase
          .from('activities')
          .select('id, notes, outcome, next_action, next_action_due')
          .eq('contact_id', eventData.contactId)
          .eq('activity_type', 'Meeting')
          .gte('activity_date_time', `${dateStr}T00:00:00`)
          .lte('activity_date_time', `${dateStr}T23:59:59`)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      return null;
    },
    enabled: open,
  });

  // Pre-fill form with existing activity data
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Re-fetch current state right before saving to avoid race conditions / stale caches
    const fetchCurrentActivity = async () => {
      // Try matching by google_calendar_event_id first
      if (eventData.googleCalendarEventId) {
        const { data } = await supabase
          .from('activities')
          .select('id, notes, outcome, next_action, next_action_due')
          .eq('google_calendar_event_id', eventData.googleCalendarEventId)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      // Fallback: match by contact + date + type
      if (eventData.contactId) {
        const dateStr = eventData.date.toISOString().slice(0, 10);
        const { data } = await supabase
          .from('activities')
          .select('id, notes, outcome, next_action, next_action_due')
          .eq('contact_id', eventData.contactId)
          .eq('activity_type', 'Meeting')
          .gte('activity_date_time', `${dateStr}T00:00:00`)
          .lte('activity_date_time', `${dateStr}T23:59:59`)
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      return null;
    };

    const currentActivity = (await fetchCurrentActivity()) ?? existingActivity;

    if (currentActivity) {
      // Update existing activity instead of creating a duplicate
      await updateActivity.mutateAsync({
        id: currentActivity.id,
        outcome: outcome || null,
        notes: notes || currentActivity.notes,
        next_action: nextAction || null,
        next_action_due: nextActionDue || null,
        attended: true,
        google_calendar_event_id: eventData.googleCalendarEventId || null,
      });
    } else {
      await createActivity.mutateAsync({
        activity_id: `ACT-${Date.now()}`,
        activity_type: 'Meeting',
        activity_date_time: eventData.date.toISOString(),
        contact_id: eventData.contactId || null,
        outcome: outcome || null,
        notes: notes || `Meeting: ${eventData.title}`,
        next_action: nextAction || null,
        next_action_due: nextActionDue || null,
        attended: true,
        google_calendar_event_id: eventData.googleCalendarEventId || null,
      });
    }

    // Reset form
    setOutcome('');
    setNotes('');
    setNextAction('');
    setNextActionDue('');

    onActivityCreated?.();
    onOpenChange(false);
  };

  const handleSkip = () => {
    setOutcome('');
    setNotes('');
    setNextAction('');
    setNextActionDue('');
    onOpenChange(false);
  };

  const isSaving = createActivity.isPending || updateActivity.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            {existingActivity
              ? t('relationships:calendar.postMeeting.updateOutcome')
              : t('relationships:calendar.postMeeting.logOutcome')}
          </DialogTitle>
          <DialogDescription>
            {existingActivity
              ? t('relationships:calendar.postMeeting.descriptionUpdate')
              : t('relationships:calendar.postMeeting.descriptionNew')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meeting info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{eventData.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(eventData.date, 'EEEE, MMMM d, yyyy')}
                {eventData.contactName && ` • ${eventData.contactName}`}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Quick Outcome Selection */}
            <div className="space-y-2">
              <Label>{t('relationships:calendar.postMeeting.howDidItGo')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map((o) => (
                  <Button
                    key={o.value}
                    type="button"
                    variant={outcome === o.value ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => setOutcome(o.value)}
                  >
                    <span>{o.emoji}</span>
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('relationships:calendar.postMeeting.quickNotes')}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={existingActivity?.notes
                  ? t('relationships:calendar.postMeeting.notesPlaceholderExisting')
                  : t('relationships:calendar.postMeeting.notesPlaceholder')}
                rows={2}
              />
            </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="nextAction">{t('relationships:calendar.postMeeting.nextStep')}</Label>
              <div className="flex gap-2">
                <Input
                  id="nextAction"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder={t('relationships:calendar.postMeeting.nextStepPlaceholder')}
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={nextActionDue}
                  onChange={(e) => setNextActionDue(e.target.value)}
                  className="w-36"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                className="flex-1"
              >
                {t('relationships:calendar.postMeeting.skip')}
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('common:loading.saving')}
                  </>
                ) : (
                  <>
                    {existingActivity
                      ? t('relationships:calendar.postMeeting.updateActivity')
                      : t('relationships:calendar.postMeeting.logActivity')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
