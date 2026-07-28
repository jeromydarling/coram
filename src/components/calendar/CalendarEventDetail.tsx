import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CalendarEvent, EventAttendee } from '@/hooks/useCalendarData';
import { useCreateContact, useContacts } from '@/hooks/useContacts';
import { useUpdateGoogleCalendarEvent, useGoogleCalendarEventById } from '@/hooks/useGoogleCalendarEvents';
import { useMeetingNoteByCalendarEvent } from '@/hooks/useMeetingNotes';
import { PostMeetingPrompt } from './PostMeetingPrompt';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  User, 
  Building2, 
  MapPin, 
  Cloud,
  Pencil,
  ExternalLink,
  Link,
  Users,
  UserPlus,
  Check,
  X,
  HelpCircle,
  UserCheck,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sanitizeEventDescription } from '@/lib/sanitizeDescription';
import { ContactSearchSelect } from '@/components/contacts/ContactSearchSelect';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { ActivityEditModal } from '@/components/activities/ActivityEditModal';

interface CalendarEventDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEdit?: () => void;
}

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

export function CalendarEventDetail({ 
  open, 
  onOpenChange, 
  event,
  onEdit 
}: CalendarEventDetailProps) {
  const [creatingContact, setCreatingContact] = useState<string | null>(null);
  const [localAttended, setLocalAttended] = useState<boolean>(false);
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  const [showPostMeetingPrompt, setShowPostMeetingPrompt] = useState(false);
  const [editActivityOpen, setEditActivityOpen] = useState(false);
  
  const createContact = useCreateContact();
  const updateGoogleEvent = useUpdateGoogleCalendarEvent();
  const { data: googleEventData } = useGoogleCalendarEventById(
    event?.type === 'external' ? event?.id : undefined
  );
  // Fetch meeting notes linked to this calendar event's google_event_id
  const { data: meetingNote } = useMeetingNoteByCalendarEvent(
    event?.type === 'external' ? googleEventData?.google_event_id : undefined
  );

  // Fetch the linked CRM Meeting activity (notes + next action), even if no Read.ai note exists
  const { data: linkedMeetingActivity } = useQuery({
    queryKey: ['calendar-linked-meeting-activity', googleEventData?.google_event_id, linkedContactId, event?.date?.toISOString()],
    queryFn: async () => {
      const googleId = googleEventData?.google_event_id;

      // 1) Prefer a hard link via google_calendar_event_id
      if (googleId) {
        const { data, error } = await supabase
          .from('activities')
          .select('id, activity_type, activity_date_time, attended, notes, outcome, next_action, next_action_due, contact_id, metro_id, opportunity_id')
          .eq('activity_type', 'Meeting')
          .eq('google_calendar_event_id', googleId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      // 2) Fallback: same contact + same calendar day (best effort)
      if (linkedContactId && event?.date) {
        const day = new Date(event.date);
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        const end = new Date(day);
        end.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from('activities')
          .select('id, activity_type, activity_date_time, attended, notes, outcome, next_action, next_action_due, contact_id, metro_id, opportunity_id')
          .eq('activity_type', 'Meeting')
          .eq('contact_id', linkedContactId)
          .gte('activity_date_time', start.toISOString())
          .lte('activity_date_time', end.toISOString())
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data ?? null;
      }

      return null;
    },
    enabled: event?.type === 'external' && !!event && (!!googleEventData?.google_event_id || !!linkedContactId),
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Sync local state when google event data loads
  useEffect(() => {
    if (googleEventData) {
      setLocalAttended(googleEventData.attended ?? false);
      setLinkedContactId(googleEventData.contact_id ?? null);
    }
  }, [googleEventData]);
  
  if (!event) return null;
  
  const typeLabels = {
    event: 'Distribution Event',
    meeting: 'Meeting',
    activity: 'Activity',
    external: 'Google Calendar'
  };
  
  const handleAttendedToggle = async (checked: boolean) => {
    setLocalAttended(checked);
    try {
      await updateGoogleEvent.mutateAsync({
        id: event.id,
        attended: checked
      });
      toast.success(checked ? 'Marked as attended' : 'Marked as not attended');
      
      // Show post-meeting prompt when marking as attended
      if (checked) {
        setShowPostMeetingPrompt(true);
      }
    } catch (error) {
      setLocalAttended(!checked); // Revert on error
    }
  };
  
  const handleLinkContact = async (contactId: string | null) => {
    setLinkedContactId(contactId);
    try {
      await updateGoogleEvent.mutateAsync({
        id: event.id,
        contact_id: contactId
      });
      toast.success(contactId ? 'Contact linked to meeting' : 'Contact unlinked from meeting');
    } catch (error) {
      setLinkedContactId(googleEventData?.contact_id ?? null); // Revert on error
    }
  };
  
  const handleCreateContact = async (attendee: EventAttendee) => {
    setCreatingContact(attendee.email);
    try {
      await createContact.mutateAsync({
        contact_id: `CONT-${Date.now()}`,
        name: attendee.displayName || attendee.email.split('@')[0],
        email: attendee.email
      });
      // Invalidate calendar data to refresh attendee matching
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
    } catch (error) {
      // Error handled by hook
    } finally {
      setCreatingContact(null);
    }
  };
  
  // Find matching contact from attendees for auto-suggest
  const matchedAttendeeContact = event.metadata.attendees?.find(a => a.existsAsContact && a.contactId);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="overflow-hidden flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: event.color }}
            />
            <span className="break-words">{event.title}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Calendar event details
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-y-auto pr-4 -mr-4">
        <div className="space-y-4 w-full overflow-hidden pb-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {typeLabels[event.type]}
            </Badge>
            {event.metadata.isExternal ? (
              <Badge variant="outline" className="gap-1">
                <span className="text-xs font-bold">G</span>
                External
              </Badge>
            ) : event.metadata.googleSynced && (
              <Badge variant="outline" className="gap-1">
                <Cloud className="w-3 h-3" />
                Synced
              </Badge>
            )}
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{format(event.date, 'EEEE, MMMM d, yyyy')}</span>
              {event.type !== 'event' && !event.metadata.isExternal && (
                <span className="text-muted-foreground">
                  at {format(event.date, 'h:mm a')}
                </span>
              )}
              {event.metadata.isExternal && (
                <span className="text-muted-foreground">
                  {format(event.date, 'h:mm a')}
                  {event.endDate && ` - ${format(event.endDate, 'h:mm a')}`}
                </span>
              )}
            </div>
            
            {event.metadata.contactName && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{event.metadata.contactName}</span>
              </div>
            )}
            
            {event.metadata.organization && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{event.metadata.organization}</span>
              </div>
            )}
            
            {event.metadata.metro && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{event.metadata.metro}</span>
              </div>
            )}
            
            {event.metadata.location && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{event.metadata.location}</span>
              </div>
            )}
            
            {event.metadata.url && (
              <div className="flex items-center gap-3">
                <Link className="w-4 h-4 text-muted-foreground" />
                <a 
                  href={event.metadata.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Event Page
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            
            {event.metadata.description && (() => {
              const cleanDescription = sanitizeEventDescription(event.metadata.description);
              return cleanDescription ? (
                <div className="pt-2 border-t border-border">
                  <div className="max-h-32 overflow-y-auto border rounded-md bg-muted/30 p-2">
                    <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                      {cleanDescription}
                    </p>
                  </div>
                </div>
              ) : null;
            })()}
            
            {event.metadata.eventType && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4" />
                <Badge variant="outline">{event.metadata.eventType}</Badge>
              </div>
            )}
            
            {event.metadata.activityType && event.type !== 'meeting' && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4" />
                <Badge variant="outline">{event.metadata.activityType}</Badge>
              </div>
            )}
          </div>
          
          {/* Attendance toggle for external Google events */}
          {event.type === 'external' && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="attended"
                    checked={localAttended}
                    onCheckedChange={handleAttendedToggle}
                    disabled={updateGoogleEvent.isPending}
                  />
                  <Label htmlFor="attended" className="text-sm cursor-pointer">
                    {localAttended ? (
                      <span className="text-success font-medium">Attended</span>
                    ) : (
                      <span className="text-muted-foreground">Mark as Attended</span>
                    )}
                  </Label>
                </div>

                {localAttended && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setShowPostMeetingPrompt(true)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Notes / Next Action
                  </Button>
                )}
              </div>
              
              {/* Link to Contact */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Link to Contact</span>
                </div>
                <ContactSearchSelect
                  value={linkedContactId}
                  onChange={handleLinkContact}
                  placeholder={matchedAttendeeContact ? "Auto-suggested from attendees" : "Select a contact..."}
                />
                {matchedAttendeeContact && !linkedContactId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => handleLinkContact(matchedAttendeeContact.contactId!)}
                  >
                    Link to {matchedAttendeeContact.displayName || matchedAttendeeContact.email}
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Attendees section for external events */}
          {event.type === 'external' && event.metadata.attendees && event.metadata.attendees.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-4 h-4" />
                Attendees ({event.metadata.attendees.length})
              </div>
              <ScrollArea className="h-[160px] w-full">
                <div className="space-y-1 pr-4">
                  {event.metadata.attendees.map((attendee) => (
                    <div 
                      key={attendee.id} 
                      className="flex flex-col gap-0.5 text-sm py-1.5 px-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ResponseStatusIcon status={attendee.responseStatus} />
                        <div className="truncate">
                          <span className="font-medium">
                            {attendee.displayName || attendee.email}
                          </span>
                          {attendee.displayName && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({attendee.email})
                            </span>
                          )}
                          {attendee.isOrganizer && (
                            <Badge variant="outline" className="ml-2 text-xs py-0">
                              Organizer
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="pl-5">
                        {attendee.existsAsContact ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Check className="w-3 h-3" />
                            Contact
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs h-6 px-2"
                            onClick={() => handleCreateContact(attendee)}
                            disabled={creatingContact === attendee.email}
                          >
                            <UserPlus className="w-3 h-3" />
                            {creatingContact === attendee.email ? 'Creating...' : 'Create Contact'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          
           {/* CRM Meeting Notes + Next Action (from Activities) */}
           {(linkedMeetingActivity?.notes || linkedMeetingActivity?.next_action) && (
             <Collapsible defaultOpen>
               <div className="space-y-2 pt-2 border-t border-border">
                 <div className="flex items-center justify-between gap-2">
                   <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
                     <FileText className="w-4 h-4" />
                     <span>Meeting Notes</span>
                     <Badge variant="secondary" className="text-xs ml-1">CRM</Badge>
                   </CollapsibleTrigger>

                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="h-7 text-xs"
                     onClick={() => setEditActivityOpen(true)}
                   >
                     <Pencil className="w-3.5 h-3.5 mr-1" />
                     Edit
                   </Button>
                 </div>

                 <CollapsibleContent className="space-y-3">
                   {linkedMeetingActivity?.notes && (
                     <div>
                       <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</h5>
                       <p className="text-sm whitespace-pre-wrap">{linkedMeetingActivity.notes}</p>
                     </div>
                   )}

                   {linkedMeetingActivity?.next_action && (
                     <div>
                       <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Next action</h5>
                       <p className="text-sm">
                         {linkedMeetingActivity.next_action}
                         {linkedMeetingActivity.next_action_due && (
                           <span className="text-muted-foreground">{' '}(due {format(new Date(linkedMeetingActivity.next_action_due), 'MMM d, yyyy')})</span>
                         )}
                       </p>
                     </div>
                   )}
                 </CollapsibleContent>
               </div>
             </Collapsible>
           )}

           {/* Meeting Notes from Read.ai */}
           {meetingNote && (
             <Collapsible defaultOpen>
               <div className="space-y-2 pt-2 border-t border-border">
                 <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                   <FileText className="w-4 h-4 text-primary" />
                   <span>AI Meeting Notes</span>
                   <Badge variant="outline" className="text-xs ml-1">Read.ai</Badge>
                 </CollapsibleTrigger>
                 <CollapsibleContent className="space-y-3">
                   {meetingNote.summary && (
                     <div>
                       <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Summary</h5>
                       <p className="text-sm">{meetingNote.summary}</p>
                     </div>
                   )}
                   {meetingNote.action_items && meetingNote.action_items.length > 0 && (
                     <div>
                       <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Action Items</h5>
                       <ul className="space-y-1">
                         {meetingNote.action_items.map((item, i) => {
                           const isYours = meetingNote.matched_action_items?.includes(item);
                           return (
                             <li key={i} className={cn("flex items-start gap-2 text-sm", isYours && "font-medium")}>
                               {isYours ? (
                                 <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                               ) : (
                                 <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                               )}
                               <span className={cn(!isYours && "text-muted-foreground")}>
                                 {item}
                                 {isYours && <Badge variant="secondary" className="ml-1.5 text-xs">Yours</Badge>}
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
                         Watch Recording
                       </a>
                     </Button>
                   )}
                 </CollapsibleContent>
               </div>
             </Collapsible>
           )}

           {/* Edit modal for linked CRM activity */}
           {linkedMeetingActivity && (
             <ActivityEditModal
               open={editActivityOpen}
               onOpenChange={setEditActivityOpen}
               existingActivity={linkedMeetingActivity}
               defaultType="Meeting"
             />
           )}
          
        </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t border-border flex-shrink-0">
          {event.type === 'meeting' && onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
      
      {/* Post-meeting prompt when marking as attended */}
      {event && (
        <PostMeetingPrompt
          open={showPostMeetingPrompt}
          onOpenChange={setShowPostMeetingPrompt}
          eventData={{
            title: event.title,
            date: event.date,
            contactId: linkedContactId,
            contactName: event.metadata.contactName,
            googleCalendarEventId: googleEventData?.google_event_id || null,
          }}
          onActivityCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['activities'] });
            queryClient.invalidateQueries({
              queryKey: ['calendar-linked-meeting-activity'],
              exact: false,
            });
          }}
        />
      )}
    </Dialog>
  );
}