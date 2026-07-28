import { useState } from 'react';
import { savePendingCall } from '@/utils/pendingCallStorage';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail,
  Phone,
  Building2,
  Pencil,
  Star,
  Calendar,
  CalendarPlus,
  Trash2,
  Loader2
} from 'lucide-react';
import { NoteHistoryPanel } from '@/components/notes/NoteHistoryPanel';
import { ContactTasksPanel } from '@/components/contacts/ContactTasksPanel';
import { ContactMeetingHistory } from '@/components/contacts/ContactMeetingHistory';
import { ContactCallsPanel } from '@/components/contacts/ContactCallsPanel';
import { CallModal } from '@/components/contacts/CallModal';
import { MeetingModal } from '@/components/calendar/MeetingModal';
import { DocumentAttachmentsPanel } from '@/components/documents/DocumentAttachmentsPanel';
import { ContactEmailsPanel } from '@/components/contacts/ContactEmailsPanel';
import { useDeleteWithUndo } from '@/hooks/useDeleteWithUndo';

interface Contact {
  id: string;
  contact_id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  opportunity_id?: string | null;
  is_primary?: boolean | null;
  notes?: string | null;
  met_at_event_id?: string | null;
  opportunities?: { 
    organization: string;
    metro_id?: string | null;
  } | null;
  events?: { id: string; event_name: string; event_date: string } | null;
}

interface ContactDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onEdit: () => void;
}

export function ContactDetailModal({ 
  open, 
  onOpenChange, 
  contact, 
  onEdit 
}: ContactDetailModalProps) {
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { deleteRecord, isDeleting } = useDeleteWithUndo();

  if (!contact) return null;

  const handleOrganizationClick = () => {
    onOpenChange(false);
    navigate(`/contacts?org=${encodeURIComponent(contact.opportunities!.organization)}`);
  };

  const handleDelete = async () => {
    await deleteRecord(contact.id, 'contact');
    setIsDeleteDialogOpen(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <User className="w-5 h-5" />
                {contact.name}
                {contact.is_primary && (
                  <Star className="w-4 h-4 text-warning fill-warning" />
                )}
              </DialogTitle>
              {contact.title && (
                <p className="text-sm text-muted-foreground mt-1">{contact.title}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Contact Info */}
          <div className="space-y-3">
            {contact.email && (
              <a 
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Mail className="w-4 h-4" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <button 
                type="button"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
                onClick={() => {
                  savePendingCall({
                    contactId: contact.id,
                    contactName: contact.name,
                    opportunityId: contact.opportunity_id,
                    metroId: contact.opportunities?.metro_id,
                  });
                  const a = document.createElement('a');
                  a.href = `tel:${contact.phone}`;
                  a.click();
                  setTimeout(() => setIsCallModalOpen(true), 500);
                }}
              >
                <Phone className="w-4 h-4" />
                {contact.phone}
              </button>
            )}
          </div>

          {/* Organization */}
          {contact.opportunities?.organization && (
            <div 
              className="flex flex-col gap-2 text-sm bg-muted/30 rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={handleOrganizationClick}
              title="View all contacts at this organization"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-primary hover:underline">{contact.opportunities.organization}</span>
              </div>
              {contact.is_primary && (
                <Badge variant="outline" className="text-xs w-fit">Primary Contact</Badge>
              )}
            </div>
          )}

          {/* Met at Event */}
          {contact.events && (
            <div className="flex items-center gap-2 text-sm bg-primary/5 rounded-lg p-3">
              <Calendar className="w-4 h-4 text-primary" />
              <div>
                <span className="text-muted-foreground">Met at: </span>
                <span className="font-medium text-foreground">{contact.events.event_name}</span>
                <span className="text-muted-foreground ml-1">
                  ({new Date(contact.events.event_date).toLocaleDateString()})
                </span>
              </div>
            </div>
          )}

          {/* Tasks */}
          <ContactTasksPanel 
            contactId={contact.id}
            className="pt-4 border-t border-border"
          />

          {/* Meeting History */}
          <ContactMeetingHistory 
            contactId={contact.id}
            contactEmail={contact.email}
            className="pt-4 border-t border-border"
          />

          {/* Call History */}
          <ContactCallsPanel 
            contactId={contact.id}
            contactName={contact.name}
            opportunityId={contact.opportunity_id}
            metroId={contact.opportunities?.metro_id}
            className="pt-4 border-t border-border"
          />

          {/* Email History */}
          <ContactEmailsPanel 
            contactId={contact.id}
            contactEmail={contact.email}
            className="pt-4 border-t border-border"
          />

          {/* Documents */}
          <div className="pt-4 border-t border-border overflow-hidden min-w-0">
            <DocumentAttachmentsPanel 
              entityType="contact"
              entityId={contact.id}
              entityName={contact.name}
            />
          </div>

          {/* Note History */}
          <NoteHistoryPanel 
            entityType="contact" 
            entityId={contact.id} 
            className="pt-4 border-t border-border"
          />

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setIsMeetingModalOpen(true)}>
                <CalendarPlus className="w-4 h-4" />
                Schedule Meeting
              </Button>
              <Button className="gap-2" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
                Edit Contact
              </Button>
            </div>
          </div>
        </div>

        <MeetingModal
          open={isMeetingModalOpen}
          onOpenChange={setIsMeetingModalOpen}
          selectedDate={new Date()}
          preSelectedContactId={contact.id}
        />

        <CallModal
          open={isCallModalOpen}
          onOpenChange={setIsCallModalOpen}
          contactId={contact.id}
          contactName={contact.name}
          opportunityId={contact.opportunity_id}
          metroId={contact.opportunities?.metro_id}
        />
      </DialogContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{contact.name}</strong>? 
              All associated tasks, meeting links, and email history will be removed.
              You'll have 8 seconds to undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
