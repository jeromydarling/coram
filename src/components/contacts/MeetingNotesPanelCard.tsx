import { useMeetingNotesForContact } from '@/hooks/useMeetingNotes';
import { Card, CardContent } from '@/components/ui/card';
import { MeetingNotesPanel } from './MeetingNotesPanel';

interface MeetingNotesPanelCardProps {
  contactId: string;
}

/**
 * Wrapper that only renders the Card if there are meeting notes.
 * Prevents empty card boxes from showing on the PersonDetail page.
 */
export function MeetingNotesPanelCard({ contactId }: MeetingNotesPanelCardProps) {
  const { data: notes, isLoading } = useMeetingNotesForContact(contactId);

  // Don't render anything if no notes and not loading
  if (!isLoading && (!notes || notes.length === 0)) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <MeetingNotesPanel contactId={contactId} />
      </CardContent>
    </Card>
  );
}
