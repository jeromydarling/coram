/**
 * CreateProjectDialog — Calm dialog for creating a Good Work project.
 *
 * WHAT: Collects title, date, location, optional contacts/participants.
 * WHERE: Projects list page.
 * WHY: Lightweight creation under 60 seconds — no PM bloat.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { useCreateProject } from '@/hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Loader2, Heart } from 'lucide-react';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const { tenantId } = useTenant();
  const createProject = useCreateProject();

  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [contactId, setContactId] = useState('');
  const [showOnCalendar, setShowOnCalendar] = useState(true);

  // Contacts for optional linking
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-for-project', tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .is('deleted_at', null)
        .order('name')
        .limit(200);
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateTime) return;

    await createProject.mutateAsync({
      title: title.trim(),
      activityDateTime: new Date(dateTime).toISOString(),
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      subjectContactId: contactId || undefined,
      showOnCalendar,
    });

    // Reset
    setTitle('');
    setDateTime('');
    setLocation('');
    setNotes('');
    setContactId('');
    setShowOnCalendar(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Heart className="h-5 w-5 text-primary" />
            New Project
          </DialogTitle>
          <DialogDescription>
            Good work in motion. What are you organizing?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-title">Project title *</Label>
            <Input
              id="project-title"
              placeholder="e.g. Paint Mrs. Johnson's house"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              data-testid="project-title-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-datetime">When *</Label>
            <Input
              id="project-datetime"
              type="datetime-local"
              value={dateTime}
              onChange={e => setDateTime(e.target.value)}
              required
              data-testid="project-datetime-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-location">Location</Label>
            <Input
              id="project-location"
              placeholder="Address or description"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-contact">Person being served</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Optional — link a person" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-notes">Notes</Label>
            <Textarea
              id="project-notes"
              placeholder="What's the plan?"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="show-on-cal" className="text-sm">Show on calendar</Label>
            <Switch
              id="show-on-cal"
              checked={showOnCalendar}
              onCheckedChange={setShowOnCalendar}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createProject.isPending || !title.trim() || !dateTime}
            data-testid="create-project-submit"
          >
            {createProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
