import { useContactMeetingHistory, MeetingHistoryItem } from '@/hooks/useContactMeetingHistory';
import { useMeetingNotesForContact, MeetingNote } from '@/hooks/useMeetingNotes';
import { useUpdateActivity } from '@/hooks/useActivities';
import { useUpdateGoogleCalendarEvent } from '@/hooks/useGoogleCalendarEvents';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Calendar, Check, X, HelpCircle, Loader2, FileText, ExternalLink, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { useTranslation } from 'react-i18next';

interface ContactMeetingHistoryProps {
  contactId: string;
  contactEmail?: string | null;
  className?: string;
}

/** Try to find a matching meeting note for a meeting history item */
function findMatchingNote(meeting: MeetingHistoryItem, notes: MeetingNote[]): MeetingNote | null {
  if (!notes || notes.length === 0) return null;

  // Match by google_calendar_event_id if available
  if (meeting.source === 'google') {
    const byId = notes.find(n => n.google_calendar_event_id === meeting.id);
    if (byId) return byId;
  }

  // Fuzzy match by title similarity and date proximity (within 24h)
  const meetingDate = new Date(meeting.date).getTime();
  for (const note of notes) {
    const noteDate = note.meeting_start_time
      ? new Date(note.meeting_start_time).getTime()
      : new Date(note.created_at).getTime();
    const timeDiff = Math.abs(meetingDate - noteDate);
    const within24h = timeDiff < 24 * 60 * 60 * 1000;

    if (within24h) {
      // Check title overlap (case-insensitive, partial match)
      const meetingWords = meeting.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const noteWords = note.meeting_title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = meetingWords.filter(w => noteWords.some(nw => nw.includes(w) || w.includes(nw)));
      if (overlap.length >= 1) return note;
    }
  }

  return null;
}

function AttendedToggle({
  meeting,
  onToggle,
  isUpdating
}: {
  meeting: MeetingHistoryItem;
  onToggle: (meeting: MeetingHistoryItem) => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation('relationships');
  const attended = meeting.attended;

  if (isUpdating) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(meeting);
      }}
      className={cn(
        "p-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
        attended === true && "bg-success/20 hover:bg-success/30",
        attended === false && "bg-destructive/20 hover:bg-destructive/30",
        attended === null && "bg-muted hover:bg-muted/80"
      )}
      title={
        attended === true
          ? t('interactions.meetings.attended.attendedTooltip')
          : attended === false
            ? t('interactions.meetings.attended.notAttendedTooltip')
            : t('interactions.meetings.attended.unknownTooltip')
      }
    >
      {attended === true && <Check className="w-3.5 h-3.5 text-success" />}
      {attended === false && <X className="w-3.5 h-3.5 text-destructive" />}
      {attended === null && <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

function InlineMeetingNote({ note }: { note: MeetingNote }) {
  const { t } = useTranslation('relationships');
  const hasActionItems = note.action_items && note.action_items.length > 0;

  return (
    <div className="mt-2 ml-8 space-y-2 border-l-2 border-primary/20 pl-3">
      {note.summary && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {t('interactions.meetingNotes.summary')}
          </h5>
          <p className="text-sm">{note.summary}</p>
        </div>
      )}
      {hasActionItems && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {t('interactions.meetingNotes.actionItems')}
          </h5>
          <ul className="space-y-1">
            {note.action_items.map((item, i) => {
              const isYours = note.matched_action_items?.includes(item);
              return (
                <li key={i} className={cn("flex items-start gap-2 text-sm", isYours && "font-medium")}>
                  {isYours ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className={cn(!isYours && "text-muted-foreground")}>
                    {item}
                    {isYours && (
                      <Badge variant="secondary" className="ml-1.5 text-xs">
                        {t('interactions.meetingNotes.yours')}
                      </Badge>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {note.recording_url && (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={note.recording_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            {t('interactions.meetingNotes.watchRecording')}
          </a>
        </Button>
      )}
    </div>
  );
}

function MeetingItem({
  meeting,
  onToggleAttended,
  isUpdating,
  matchingNote
}: {
  meeting: MeetingHistoryItem;
  onToggleAttended: (meeting: MeetingHistoryItem) => void;
  isUpdating: boolean;
  matchingNote: MeetingNote | null;
}) {
  const { t } = useTranslation('relationships');
  const [expanded, setExpanded] = useState(false);
  const isPast = new Date(meeting.date) < new Date();
  const hasNote = !!matchingNote;
  const hasLongNotes = meeting.notes && meeting.notes.length > 60;
  const isExpandable = hasNote || hasLongNotes;

  const content = (
    <div className={cn(
      "flex items-start gap-3 py-2 px-3 rounded-md bg-muted/30 min-w-0 overflow-hidden transition-colors",
      isExpandable ? "hover:bg-muted/50 cursor-pointer" : "hover:bg-muted/50"
    )}>
      <div className="mt-0.5 shrink-0">
        <AttendedToggle meeting={meeting} onToggle={onToggleAttended} isUpdating={isUpdating} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate min-w-0" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{meeting.title}</span>
          <Badge
            variant={meeting.source === 'google' ? 'outline' : 'secondary'}
            className="text-xs shrink-0"
          >
            {meeting.source === 'google' ? 'G' : 'CRM'}
          </Badge>
          {hasNote && (
            <Badge variant="outline" className="text-xs shrink-0 gap-1 text-primary border-primary/30">
              <FileText className="h-3 w-3" />
              {t('interactions.meetings.meetingNotes')}
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Badge>
          )}
          {!hasNote && hasLongNotes && (
            <Badge variant="outline" className="text-xs shrink-0 gap-1">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {t('interactions.meetings.details')}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {format(new Date(meeting.date), 'MMM d, yyyy')} at {format(new Date(meeting.date), 'h:mm a')}
          {!isPast && <span className="ml-2 text-primary">{t('interactions.meetings.upcoming')}</span>}
        </div>
      </div>
    </div>
  );

  if (!isExpandable) return content;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="w-full text-left">{content}</CollapsibleTrigger>
      <CollapsibleContent>
        {hasNote ? (
          <InlineMeetingNote note={matchingNote} />
        ) : hasLongNotes ? (
          <div className="mt-2 ml-8 border-l-2 border-muted-foreground/20 pl-3">
            <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ContactMeetingHistory({ contactId, contactEmail, className }: ContactMeetingHistoryProps) {
  const { t } = useTranslation('relationships');
  const { data: meetings, isLoading, error } = useContactMeetingHistory(contactId, contactEmail);
  const { data: meetingNotes } = useMeetingNotesForContact(contactId);
  const updateActivity = useUpdateActivity();
  const updateGoogleEvent = useUpdateGoogleCalendarEvent();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const actionInProgressRef = useRef(false);

  const handleToggleAttended = async (meeting: MeetingHistoryItem) => {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;

    let newAttended: boolean | null;
    if (meeting.attended === null) {
      newAttended = true;
    } else if (meeting.attended === true) {
      newAttended = false;
    } else {
      newAttended = null;
    }

    setUpdatingId(meeting.id);

    try {
      if (meeting.source === 'crm') {
        await updateActivity.mutateAsync({
          id: meeting.id,
          attended: newAttended
        });
      } else {
        await updateGoogleEvent.mutateAsync({
          id: meeting.id,
          attended: newAttended ?? undefined
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contact-meeting-history', contactId] }),
        queryClient.invalidateQueries({ queryKey: ['unified-activities'] }),
      ]);

      toast.success(
        newAttended === true
          ? t('interactions.meetings.attended.markedAttended')
          : newAttended === false
            ? t('interactions.meetings.attended.markedNotAttended')
            : t('interactions.meetings.attended.cleared')
      );
    } catch (error) {
      console.error('Failed to update attended status:', error);
    } finally {
      setUpdatingId(null);
      actionInProgressRef.current = false;
    }
  };

  // Find unmatched meeting notes (notes that don't correspond to any meeting history item)
  const matchedNoteIds = new Set<string>();
  const meetingNoteMap = new Map<string, MeetingNote>();

  if (meetings && meetingNotes) {
    for (const meeting of meetings) {
      const note = findMatchingNote(meeting, meetingNotes);
      if (note) {
        meetingNoteMap.set(`${meeting.source}-${meeting.id}`, note);
        matchedNoteIds.add(note.id);
      }
    }
  }

  const unmatchedNotes = (meetingNotes || []).filter(n => !matchedNoteIds.has(n.id));
  const noteCount = meetingNotes?.length || 0;

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="w-4 h-4" />
          {t('interactions.meetings.title')}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="w-4 h-4" />
          {t('interactions.meetings.title')}
        </div>
        <p className="text-sm text-muted-foreground">{t('interactions.meetings.failedToLoad')}</p>
      </div>
    );
  }

  const totalCount = (meetings?.length || 0) + unmatchedNotes.length;

  return (
    <div className={cn("space-y-3 min-w-0 overflow-hidden", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calendar className="w-4 h-4 shrink-0" />
        <span className="truncate">{t('interactions.meetings.title')}</span>
        {totalCount > 0 && (
          <span className="text-muted-foreground shrink-0">({totalCount})</span>
        )}
        {noteCount > 0 && (
          <Badge variant="outline" className="text-xs shrink-0 gap-1 text-primary border-primary/30">
            <FileText className="h-3 w-3" />
            {t('interactions.meetings.withNotes', { count: noteCount })}
          </Badge>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {t('interactions.meetings.noMeetings')}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {meetings?.map((meeting) => (
            <MeetingItem
              key={`${meeting.source}-${meeting.id}`}
              meeting={meeting}
              onToggleAttended={handleToggleAttended}
              isUpdating={updatingId === meeting.id}
              matchingNote={meetingNoteMap.get(`${meeting.source}-${meeting.id}`) || null}
            />
          ))}
          {/* Unmatched meeting notes shown as standalone entries */}
          {unmatchedNotes.map((note) => (
            <Collapsible key={`note-${note.id}`}>
              <CollapsibleTrigger className="w-full text-left">
                <div className="flex items-start gap-3 py-2 px-3 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors min-w-0 overflow-hidden cursor-pointer">
                  <div className="mt-0.5 shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate min-w-0">{note.meeting_title}</span>
                      <Badge variant="outline" className="text-xs shrink-0 gap-1 text-primary border-primary/30">
                        <FileText className="h-3 w-3" />
                        {t('interactions.meetings.notes')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {note.meeting_start_time
                        ? `${format(new Date(note.meeting_start_time), 'MMM d, yyyy')} at ${format(new Date(note.meeting_start_time), 'h:mm a')}`
                        : format(new Date(note.created_at), 'MMM d, yyyy')
                      }
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <InlineMeetingNote note={note} />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('interactions.meetings.attendanceHint')}
      </p>
    </div>
  );
}
