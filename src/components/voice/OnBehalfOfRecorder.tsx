/**
 * OnBehalfOfRecorder — Voice note recording on behalf of a volunteer.
 *
 * WHAT: Pre-select volunteer + contact, record, show thank-you with "next volunteer" option.
 * WHERE: Visits page, visit detail.
 * WHY: Volunteers without logins can leave voice notes on a borrowed device.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mic, ArrowRight, Check, Heart, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { VoiceRecorder } from './VoiceRecorder';

interface OnBehalfOfRecorderProps {
  /** The activity (visit) ID */
  activityId: string;
  /** Pre-loaded participants on this visit */
  participants?: Array<{ id: string; display_name: string; volunteer_id: string | null }>;
  /** Pre-loaded contacts on this visit */
  contacts?: Array<{ id: string; name: string }>;
  onDone?: () => void;
}

type Phase = 'select' | 'record' | 'thankyou';

export function OnBehalfOfRecorder({
  activityId,
  participants = [],
  contacts = [],
  onDone,
}: OnBehalfOfRecorderProps) {
  const { tenantId } = useTenant();
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedVolunteer, setSelectedVolunteer] = useState<{ id: string; name: string } | null>(null);
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string } | null>(null);
  const [lastRecordedFor, setLastRecordedFor] = useState<string | null>(null);

  // If contacts aren't pre-loaded, fetch from activity
  const { data: visitContacts = contacts } = useQuery({
    queryKey: ['visit-contacts', activityId],
    enabled: contacts.length === 0 && !!activityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('subject_contact_id')
        .eq('id', activityId)
        .single();
      if (error || !data?.subject_contact_id) return [];
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('id', data.subject_contact_id)
        .single();
      return contact ? [contact] : [];
    },
  });

  const handleStartRecording = () => {
    if (!selectedVolunteer || !selectedContact) return;
    setPhase('record');
  };

  const handleRecordingComplete = () => {
    setLastRecordedFor(selectedVolunteer?.name || null);
    setPhase('thankyou');
  };

  const handleNextVolunteer = () => {
    setSelectedVolunteer(null);
    // Keep the same contact selected if there's only one
    if (visitContacts.length > 1) {
      setSelectedContact(null);
    }
    setPhase('select');
  };

  const handleFinish = () => {
    onDone?.();
  };

  // Selection phase
  if (phase === 'select') {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <Users className="h-6 w-6 text-primary mx-auto" />
            <h3 className="font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Record for a Volunteer
            </h3>
            <p className="text-sm text-muted-foreground">
              Select who is speaking and who they visited.
            </p>
          </div>

          {/* Volunteer picker */}
          <div className="space-y-1.5">
            <Label>Who is speaking?</Label>
            {participants.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {participants.map(p => (
                  <Button
                    key={p.id}
                    variant={selectedVolunteer?.id === (p.volunteer_id || p.id) ? 'default' : 'outline'}
                    className="justify-start h-12 text-base"
                    onClick={() => setSelectedVolunteer({ id: p.volunteer_id || p.id, name: p.display_name })}
                  >
                    {p.display_name}
                    {selectedVolunteer?.id === (p.volunteer_id || p.id) && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No participants assigned to this visit yet.</p>
            )}
          </div>

          {/* Contact picker */}
          <div className="space-y-1.5">
            <Label>Who are they visiting?</Label>
            {visitContacts.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {visitContacts.map((c: any) => (
                  <Button
                    key={c.id}
                    variant={selectedContact?.id === c.id ? 'default' : 'outline'}
                    className="justify-start h-12 text-base"
                    onClick={() => setSelectedContact({ id: c.id, name: c.name })}
                  >
                    {c.name}
                    {selectedContact?.id === c.id && (
                      <Check className="h-4 w-4 ml-auto" />
                    )}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No contacts linked to this visit yet.</p>
            )}
          </div>

          <Button
            className="w-full h-14 text-base gap-2"
            disabled={!selectedVolunteer || !selectedContact}
            onClick={handleStartRecording}
          >
            <Mic className="h-5 w-5" />
            Record for {selectedVolunteer?.name || '…'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Recording phase — reuse VoiceRecorder with contact + volunteer context
  if (phase === 'record') {
    return (
      <div className="space-y-3">
        <div className="text-center space-y-1 pb-2">
          <Badge variant="secondary" className="text-sm">
            Recording for: {selectedVolunteer?.name}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Visiting: {selectedContact?.name}
          </p>
        </div>
        <VoiceRecorder
          subjectType="contact"
          subjectId={selectedContact!.id}
          onBehalfOf={{
            volunteerId: selectedVolunteer!.id,
            volunteerName: selectedVolunteer!.name,
            activityId,
          }}
          onTranscriptSaved={() => handleRecordingComplete()}
        />
      </div>
    );
  }

  // Thank you phase
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Heart className="h-7 w-7 text-primary/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Thank you{lastRecordedFor ? `, ${lastRecordedFor}` : ''}
        </h3>
        <p className="text-sm text-muted-foreground">
          Your note has been saved. It will be part of the story.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleNextVolunteer}
          >
            <ArrowRight className="h-4 w-4" />
            Next Volunteer
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleFinish}
          >
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
