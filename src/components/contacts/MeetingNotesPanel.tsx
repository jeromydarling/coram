import { useMeetingNotesForContact, MeetingNote } from '@/hooks/useMeetingNotes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MeetingNotesPanelProps {
  contactId: string;
  className?: string;
}

function MeetingNoteCard({ note }: { note: MeetingNote }) {
  const { t } = useTranslation('relationships');
  const [isOpen, setIsOpen] = useState(false);
  const hasActionItems = note.action_items && note.action_items.length > 0;
  const matchedCount = note.matched_action_items?.length || 0;
  const totalCount = note.action_items?.length || 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-start gap-2 text-left">
            <div className="mt-0.5">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{note.meeting_title}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  Read.ai
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {note.meeting_start_time
                  ? format(new Date(note.meeting_start_time), 'MMM d, yyyy • h:mm a')
                  : format(new Date(note.created_at), 'MMM d, yyyy')
                }
                {hasActionItems && (
                  <span className="ml-2">
                    • {t('interactions.meetingNotes.actionItemsCount', { matched: matchedCount, total: totalCount })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-2">
          {/* Summary */}
          {note.summary && (
            <div className="space-y-1">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('interactions.meetingNotes.summary')}
              </h5>
              <p className="text-sm">{note.summary}</p>
            </div>
          )}

          {/* Action Items */}
          {hasActionItems && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('interactions.meetingNotes.actionItems')}
              </h5>
              <ul className="space-y-1.5">
                {note.action_items.map((item, index) => {
                  const isYours = note.matched_action_items?.includes(item);
                  return (
                    <li
                      key={index}
                      className={cn(
                        "flex items-start gap-2 text-sm",
                        isYours && "font-medium"
                      )}
                    >
                      {isYours ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span className={cn(!isYours && "text-muted-foreground")}>
                        {item}
                        {isYours && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {t('interactions.meetingNotes.yourTask')}
                          </Badge>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Recording Link */}
          {note.recording_url && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <a href={note.recording_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('interactions.meetingNotes.watchRecording')}
              </a>
            </Button>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function MeetingNotesPanel({ contactId, className }: MeetingNotesPanelProps) {
  const { t } = useTranslation('relationships');
  const { data: notes, isLoading, error } = useMeetingNotesForContact(contactId);

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4" />
          {t('interactions.meetingNotes.title')}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="w-4 h-4" />
          {t('interactions.meetingNotes.title')}
        </div>
        <p className="text-sm text-muted-foreground">{t('interactions.meetingNotes.failedToLoad')}</p>
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return null; // Don't show section if no notes
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate">{t('interactions.meetingNotes.title')}</span>
        <span className="text-muted-foreground shrink-0">({notes.length})</span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {notes.map((note) => (
          <MeetingNoteCard key={note.id} note={note} />
        ))}
      </div>
    </div>
  );
}
