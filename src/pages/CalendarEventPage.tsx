import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarEvent, EventAttendee } from '@/hooks/useCalendarData';
import { useCreateContact, useContacts } from '@/hooks/useContacts';
import { useUpdateGoogleCalendarEvent, useGoogleCalendarEventById } from '@/hooks/useGoogleCalendarEvents';
import { useCreateActivity, useUpdateActivity } from '@/hooks/useActivities';
import { useMeetingNoteByCalendarEvent } from '@/hooks/useMeetingNotes';
import { ContactSearchSelect } from '@/components/contacts/ContactSearchSelect';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Calendar,
  User,
  Building2,
  MapPin,
  Cloud,
  ExternalLink,
  Link,
  Users,
  UserPlus,
  Check,
  X,
  HelpCircle,
  UserCheck,
  FileText,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Loader2,
  Save,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sanitizeEventDescription } from '@/lib/sanitizeDescription';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useImpulsusCapture } from '@/hooks/useImpulsusCapture';

type ActivityOutcome = Database['public']['Enums']['activity_outcome'];

const OUTCOMES: { value: ActivityOutcome; label: string; emoji: string }[] = [
  { value: 'Connected', label: 'Connected', emoji: '🤝' },
  { value: 'Moved Stage', label: 'Moved Stage', emoji: '📈' },
  { value: 'Follow-up Needed', label: 'Follow-up Needed', emoji: '📋' },
  { value: 'No Response', label: 'No Response', emoji: '📭' },
  { value: 'Not a Fit', label: 'Not a Fit', emoji: '❌' },
];

function ResponseStatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'accepted':
      return <Check className="w-3.5 h-3.5 text-success" />;
    case 'declined':
      return <X className="w-3.5 h-3.5 text-destructive" />;
    case 'tentative':
      return <HelpCircle className="w-3.5 h-3.5 text-warning" />;
    default:
      return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

/**
 * Full-page calendar event detail with inline editing.
 * Route: /calendar/event/:eventId
 *
 * The eventId in the URL is the google_calendar_events.id (UUID).
 * We load the row directly and derive all the CalendarEvent-like fields we need.
 */
export default function CalendarEventPage() {
  const { t } = useTranslation('calendar');
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Google Calendar event row ──
  const { data: googleEventData, isLoading: eventLoading } = useGoogleCalendarEventById(eventId);

  // ── Local UI state ──
  const [localAttended, setLocalAttended] = useState(false);
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);

  // Inline editing state
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDue, setNextActionDue] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const updateGoogleEvent = useUpdateGoogleCalendarEvent();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const createContact = useCreateContact();
  const { captureImpulsus } = useImpulsusCapture();

  // ── Meeting note from Read.ai ──
  const { data: meetingNote } = useMeetingNoteByCalendarEvent(
    googleEventData?.google_event_id
  );

  // ── Linked CRM Activity ──
  const { data: linkedMeetingActivity, refetch: refetchLinked } = useQuery({
    queryKey: ['calendar-linked-meeting-activity', googleEventData?.google_event_id, linkedContactId],
    queryFn: async () => {
      const googleId = googleEventData?.google_event_id;
      if (googleId) {
        const { data } = await supabase
          .from('activities')
          .select('id, activity_type, activity_date_time, attended, notes, outcome, next_action, next_action_due, contact_id, metro_id, opportunity_id, google_calendar_event_id')
          .eq('activity_type', 'Meeting')
          .eq('google_calendar_event_id', googleId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      if (linkedContactId && googleEventData?.start_time) {
        const day = new Date(googleEventData.start_time);
        const start = new Date(day); start.setHours(0, 0, 0, 0);
        const end = new Date(day); end.setHours(23, 59, 59, 999);
        const { data } = await supabase
          .from('activities')
          .select('id, activity_type, activity_date_time, attended, notes, outcome, next_action, next_action_due, contact_id, metro_id, opportunity_id, google_calendar_event_id')
          .eq('activity_type', 'Meeting')
          .eq('contact_id', linkedContactId)
          .gte('activity_date_time', start.toISOString())
          .lte('activity_date_time', end.toISOString())
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data ?? null;
      }
      return null;
    },
    enabled: !!googleEventData,
  });

  // ── Sync local state from loaded data ──
  useEffect(() => {
    if (googleEventData) {
      setLocalAttended(googleEventData.attended ?? false);
      setLinkedContactId(googleEventData.contact_id ?? null);
    }
  }, [googleEventData]);

  useEffect(() => {
    if (linkedMeetingActivity) {
      setOutcome((linkedMeetingActivity.outcome as ActivityOutcome) || '');
      setNotes(linkedMeetingActivity.notes || '');
      setNextAction(linkedMeetingActivity.next_action || '');
      setNextActionDue(linkedMeetingActivity.next_action_due ? format(new Date(linkedMeetingActivity.next_action_due), 'yyyy-MM-dd') : '');
      setIsDirty(false);
    }
  }, [linkedMeetingActivity]);

  // ── Handlers ──
  const handleAttendedToggle = async (checked: boolean) => {
    if (!eventId) return;
    setLocalAttended(checked);
    try {
      await updateGoogleEvent.mutateAsync({ id: eventId, attended: checked });
      toast.success(checked ? t('eventDetail.markedAttended') : t('eventDetail.markedNotAttended'));

      if (checked) {
        const ts = new Date().toISOString();
        captureImpulsus({
          kind: 'event',
          dedupeKey: `event:${eventId}:${ts}`,
          source: { event_id: eventId },
          context: { eventName: googleEventData?.title || undefined },
        });
      }
    } catch {
      setLocalAttended(!checked);
    }
  };

  const handleLinkContact = async (contactId: string | null) => {
    if (!eventId) return;
    setLinkedContactId(contactId);
    try {
      await updateGoogleEvent.mutateAsync({ id: eventId, contact_id: contactId });
      toast.success(contactId ? t('eventDetail.contactLinked') : t('eventDetail.contactUnlinked'));
    } catch {
      setLinkedContactId(googleEventData?.contact_id ?? null);
    }
  };

  const handleCreateContact = async (attendee: { email: string; displayName?: string }) => {
    try {
      await createContact.mutateAsync({
        contact_id: `CONT-${Date.now()}`,
        name: attendee.displayName || attendee.email.split('@')[0],
        email: attendee.email,
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
    } catch {
      // handled by hook
    }
  };

  const handleSave = async () => {
    if (!googleEventData) return;

    const googleId = googleEventData.google_event_id;

    if (linkedMeetingActivity) {
      await updateActivity.mutateAsync({
        id: linkedMeetingActivity.id,
        outcome: outcome || null,
        notes: notes || null,
        next_action: nextAction || null,
        next_action_due: nextActionDue || null,
        attended: localAttended,
        google_calendar_event_id: googleId || null,
      });
    } else {
      await createActivity.mutateAsync({
        activity_id: `ACT-${Date.now()}`,
        activity_type: 'Meeting',
        activity_date_time: googleEventData.start_time,
        contact_id: linkedContactId || null,
        outcome: outcome || null,
        notes: notes || `Meeting: ${googleEventData.title || 'Untitled'}`,
        next_action: nextAction || null,
        next_action_due: nextActionDue || null,
        attended: localAttended,
        google_calendar_event_id: googleId || null,
      });
    }

    setIsDirty(false);
    await refetchLinked();
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    toast.success(t('eventDetail.meetingSaved'));
  };

  const isSaving = createActivity.isPending || updateActivity.isPending;

  // Derive attendees from the google event data (stored as JSON)
  const attendees: EventAttendee[] = (googleEventData as any)?.attendees_json || [];

  // ── Loading state ──
  if (eventLoading) {
    return (
      <MainLayout title={t('eventDetail.title')} subtitle={t('eventDetail.loading')}>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!googleEventData) {
    return (
      <MainLayout title={t('eventDetail.notFound')} subtitle="">
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{t('eventDetail.notFoundMessage')}</p>
          <Button variant="outline" onClick={() => navigate('/calendar')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('eventDetail.backToCalendar')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const eventDate = new Date(googleEventData.start_time);
  const endDate = googleEventData.end_time ? new Date(googleEventData.end_time) : undefined;

  return (
    <MainLayout title={t('eventDetail.title')} subtitle={googleEventData.title || t('eventDetail.untitledMeeting')}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('eventDetail.back')}
        </Button>

        {/* Title + badges */}
        <div>
          <h1 className="text-2xl font-bold break-words">{googleEventData.title || t('eventDetail.untitledMeeting')}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{t('googleSync.googleCalendar')}</Badge>
            {localAttended && <Badge className="bg-success/20 text-success border-success/30">{t('eventDetail.attended')}</Badge>}
          </div>
        </div>

        {/* Date / time / location */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>
              {format(eventDate, 'EEEE, MMMM d, yyyy')} &middot; {format(eventDate, 'h:mm a')}
              {endDate && ` – ${format(endDate, 'h:mm a')}`}
            </span>
          </div>
          {(googleEventData as any)?.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{(googleEventData as any).location}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {(googleEventData as any)?.description && (() => {
          const clean = sanitizeEventDescription((googleEventData as any).description);
          return clean ? (
            <div className="border rounded-lg bg-muted/30 p-3 max-h-32 overflow-y-auto">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{clean}</p>
            </div>
          ) : null;
        })()}

        {/* ─── Attendance + Contact link ─── */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="attended"
                checked={localAttended}
                onCheckedChange={handleAttendedToggle}
                disabled={updateGoogleEvent.isPending}
              />
              <Label htmlFor="attended" className="cursor-pointer text-sm">
                {localAttended ? (
                  <span className="text-success font-medium">{t('eventDetail.attended')}</span>
                ) : (
                  <span className="text-muted-foreground">{t('eventDetail.markAsAttended')}</span>
                )}
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{t('eventDetail.linkToContact')}</span>
            </div>
            <ContactSearchSelect
              value={linkedContactId}
              onChange={handleLinkContact}
              placeholder={t('eventDetail.selectContact')}
            />
          </div>
        </div>

        {/* ─── Inline CRM editing ─── */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4" />
            {t('eventDetail.meetingNotesOutcome')}
          </div>

          {/* Outcome chips */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('eventDetail.outcome')}</Label>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  variant={outcome === o.value ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setOutcome(outcome === o.value ? '' : o.value);
                    setIsDirty(true);
                  }}
                >
                  <span>{o.emoji}</span>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">{t('eventDetail.notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
              placeholder={t('eventDetail.notesPlaceholder')}
              rows={4}
            />
          </div>

          {/* Next action */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t('eventDetail.nextAction')}</Label>
            <div className="flex gap-2">
              <Input
                value={nextAction}
                onChange={(e) => { setNextAction(e.target.value); setIsDirty(true); }}
                placeholder={t('eventDetail.nextActionPlaceholder')}
                className="flex-1"
              />
              <Input
                type="date"
                value={nextActionDue}
                onChange={(e) => { setNextActionDue(e.target.value); setIsDirty(true); }}
                className="w-40"
              />
            </div>
          </div>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={isSaving || (!isDirty && !!linkedMeetingActivity)}
            className="w-full gap-2"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t('eventDetail.saving')}</>
            ) : (
              <><Save className="w-4 h-4" /> {linkedMeetingActivity ? t('eventDetail.updateMeeting') : t('eventDetail.saveMeeting')}</>
            )}
          </Button>
        </div>

        {/* ─── Meeting Notes (Read.ai) ─── */}
        {meetingNote && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-primary" />
              {t('eventDetail.meetingNotes')}
              <Badge variant="outline" className="text-xs">Read.ai</Badge>
            </div>
            {meetingNote.summary && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('eventDetail.summary')}</h5>
                <p className="text-sm">{meetingNote.summary}</p>
              </div>
            )}
            {meetingNote.action_items && meetingNote.action_items.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('eventDetail.actionItems')}</h5>
                <ul className="space-y-1">
                  {meetingNote.action_items.map((item: string, i: number) => {
                    const isYours = meetingNote.matched_action_items?.includes(item);
                    return (
                      <li key={i} className={cn('flex items-start gap-2 text-sm', isYours && 'font-medium')}>
                        {isYours ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span className={cn(!isYours && 'text-muted-foreground')}>
                          {item}
                          {isYours && <Badge variant="secondary" className="ml-1.5 text-xs">{t('eventDetail.yours')}</Badge>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {meetingNote.recording_url && (
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={meetingNote.recording_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  {t('eventDetail.watchRecording')}
                </a>
              </Button>
            )}
          </div>
        )}

        {/* ─── Attendees ─── */}
        {attendees.length > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4" />
              {t('eventDetail.attendees', { count: attendees.length })}
            </div>
            <div className="space-y-1">
              {attendees.map((attendee) => (
                <div
                  key={attendee.id || attendee.email}
                  className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/50"
                >
                  <ResponseStatusIcon status={attendee.responseStatus} />
                  <span className="font-medium truncate">{attendee.displayName || attendee.email}</span>
                  {attendee.isOrganizer && <Badge variant="outline" className="text-xs py-0">{t('eventDetail.organizer')}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
