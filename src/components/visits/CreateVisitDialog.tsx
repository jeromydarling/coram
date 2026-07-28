/**
 * CreateVisitDialog — Create a Visit event with contact + participant assignment.
 *
 * WHAT: Dialog for Stewards/Shepherds/Companions to schedule visit activities.
 * WHERE: Visits page and Events page.
 * WHY: A Visit requires at least one contact (person being visited) and optional volunteer/user participants.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, Users, User, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';

interface CreateVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SelectedPerson {
  id: string;
  name: string;
  type: 'contact' | 'volunteer';
}

export function CreateVisitDialog({ open, onOpenChange }: CreateVisitDialogProps) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [visitName, setVisitName] = useState('');
  const [visitDate, setVisitDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<SelectedPerson[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<SelectedPerson[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');

  // Fetch contacts for selection
  const { data: contacts = [] } = useQuery({
    queryKey: ['visit-contacts-search', tenantId, contactSearch],
    enabled: !!tenantId && contactSearch.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .is('deleted_at', null)
        .ilike('name', `%${contactSearch}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch volunteers for participant assignment
  const { data: rawVolunteers = [] } = useQuery({
    queryKey: ['visit-volunteers-search', tenantId, participantSearch],
    enabled: !!tenantId && participantSearch.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteers')
        .select('id, first_name, last_name')
        .eq('tenant_id', tenantId!)
        .is('deleted_at', null)
        .or(`first_name.ilike.%${participantSearch}%,last_name.ilike.%${participantSearch}%`)
        .limit(10);
      if (error) throw error;
      return (data ?? []).map(v => ({ id: v.id, name: `${v.first_name} ${v.last_name}`.trim() }));
    },
  });
  const volunteers = rawVolunteers;

  const addContact = (contact: { id: string; name: string }) => {
    if (selectedContacts.some(c => c.id === contact.id)) return;
    setSelectedContacts(prev => [...prev, { ...contact, type: 'contact' }]);
    setContactSearch('');
    // Auto-generate visit name if empty
    if (!visitName) {
      const names = [...selectedContacts.map(c => c.name), contact.name];
      setVisitName(`Visit with ${names.join(', ')}`);
    }
  };

  const removeContact = (id: string) => {
    setSelectedContacts(prev => prev.filter(c => c.id !== id));
  };

  const addParticipant = (vol: { id: string; name: string }) => {
    if (selectedParticipants.some(p => p.id === vol.id)) return;
    setSelectedParticipants(prev => [...prev, { ...vol, type: 'volunteer' }]);
    setParticipantSearch('');
  };

  const removeParticipant = (id: string) => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== id));
  };

  const createVisit = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');
      if (selectedContacts.length === 0) throw new Error('At least one person to visit is required');

      // 1. Create the activity (Visit type)
      const activityId = `visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { data: activity, error: actError } = await supabase
        .from('activities')
        .insert({
          activity_id: activityId,
          activity_type: 'Visit' as any,
          activity_date_time: new Date(visitDate).toISOString(),
          notes: notes || null,
          tenant_id: tenantId,
          subject_contact_id: selectedContacts[0]?.id || null,
        })
        .select('id')
        .single();

      if (actError) throw actError;

      // 2. Add participants (the volunteers/users doing the visiting)
      if (selectedParticipants.length > 0) {
        const participantRows = selectedParticipants.map(p => ({
          tenant_id: tenantId,
          activity_id: activity.id,
          volunteer_id: p.type === 'volunteer' ? p.id : null,
          display_name: p.name,
          role: 'visitor',
          created_by: user.id,
        }));

        const { error: partError } = await supabase
          .from('activity_participants')
          .insert(participantRows);
        if (partError) throw partError;
      }

      // 3. Also create an event record for the Visits page calendar
      const { error: evError } = await supabase
        .from('events')
        .insert({
          event_name: visitName || `Visit with ${selectedContacts.map(c => c.name).join(', ')}`,
          event_date: new Date(visitDate).toISOString(),
          location: location || null,
          tenant_id: tenantId,
          status: 'Planned',
          attended: false,
          notes: notes || null,
        } as any);

      if (evError) console.warn('Event creation note:', evError.message);

      return activity.id;
    },
    onSuccess: () => {
      toast.success('Visit created');
      queryClient.invalidateQueries({ queryKey: ['visitor-today-events'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`Failed to create visit: ${err.message}`);
    },
  });

  const resetForm = () => {
    setVisitName('');
    setVisitDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setLocation('');
    setNotes('');
    setSelectedContacts([]);
    setSelectedParticipants([]);
    setContactSearch('');
    setParticipantSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }}>
            Schedule a Visit
          </DialogTitle>
          <DialogDescription>
            Choose who you're visiting and who is going.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Who are you visiting? (required) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              Who are you visiting? <span className="text-destructive">*</span>
            </Label>
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedContacts.map(c => (
                  <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                    {c.name}
                    <button onClick={() => removeContact(c.id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              placeholder="Search people…"
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              className="text-base"
            />
            {contacts.length > 0 && contactSearch.length >= 2 && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {contacts
                  .filter(c => !selectedContacts.some(sc => sc.id === c.id))
                  .map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0"
                      onClick={() => addContact(c)}
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Who is going? (volunteers/participants) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Who is going? <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedParticipants.map(p => (
                  <Badge key={p.id} variant="outline" className="gap-1 pr-1">
                    {p.name}
                    <button onClick={() => removeParticipant(p.id)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              placeholder="Search volunteers…"
              value={participantSearch}
              onChange={e => setParticipantSearch(e.target.value)}
              className="text-base"
            />
            {volunteers.length > 0 && participantSearch.length >= 2 && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {volunteers
                  .filter(v => !selectedParticipants.some(sp => sp.id === v.id))
                  .map(v => (
                    <button
                      key={v.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0"
                      onClick={() => addParticipant(v)}
                    >
                      {v.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Visit details */}
          <div className="space-y-3">
            <div>
              <Label>Visit name</Label>
              <Input
                value={visitName}
                onChange={e => setVisitName(e.target.value)}
                placeholder="Auto-generated from contacts"
                className="text-base"
              />
            </div>
            <div>
              <Label>When</Label>
              <Input
                type="datetime-local"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                className="text-base"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Address or description"
                className="text-base"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any context for the visit…"
                rows={2}
                className="text-base"
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full h-12 text-base"
            disabled={selectedContacts.length === 0 || createVisit.isPending}
            onClick={() => createVisit.mutate()}
          >
            {createVisit.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Create Visit</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
