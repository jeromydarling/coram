/**
 * FieldNotesPage — Human intention space for planning and ideas.
 *
 * WHAT: CRUD list of free-form field notes with metro tagging.
 * WHERE: /field-notes route.
 * WHY: Separate from Expansion Canvas — this is brainstorming, not tracking.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { FieldNoteCard, type FieldNote } from './FieldNoteCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, StickyNote } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { toast } from '@/components/ui/sonner';

export default function FieldNotesPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedMetro, setSelectedMetro] = useState<string>('none');

  const { data: metros } = useQuery({
    queryKey: ['metros-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metros')
        .select('id, metro')
        .order('metro');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ['field-notes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_notes')
        .select('*, metros!field_notes_metro_id_fkey(metro)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((n: any) => ({
        ...n,
        metro_name: n.metros?.metro ?? null,
        tags: n.tags ?? [],
      })) as FieldNote[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      const { error } = await supabase
        .from('field_notes')
        .insert({
          user_id: user!.id,
          tenant_id: tenant?.id || null,
          title: title.trim(),
          body: body.trim(),
          metro_id: selectedMetro !== 'none' ? selectedMetro : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-notes'] });
      setShowCreate(false);
      setTitle('');
      setBody('');
      setSelectedMetro('none');
      toast.success('Field note created');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create note'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-serif font-medium text-foreground">Field Notes</h2>
          <HelpTooltip content="Your personal planning space. Capture ideas, observations, and intentions. Notes referencing a metro can be converted into structured expansion plans." />
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Note
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map(note => (
            <FieldNoteCard
              key={note.id}
              note={note}
              tenantId={tenant?.id}
              onDelete={() => queryClient.invalidateQueries({ queryKey: ['field-notes'] })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-serif">No field notes yet.</p>
          <p className="text-sm mt-1">Capture ideas and planning thoughts here.</p>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setTitle(''); setBody(''); setSelectedMetro('none'); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">New Field Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What's on your mind?" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Describe your idea, observation, or intention..."
                className="min-h-[120px] font-serif leading-relaxed"
                maxLength={4000}
              />
            </div>
            <div className="space-y-2">
              <Label>Metro (optional)</Label>
              <Select value={selectedMetro} onValueChange={setSelectedMetro}>
                <SelectTrigger>
                  <SelectValue placeholder="No metro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No metro</SelectItem>
                  {metros?.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.metro}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !title.trim()} size="sm">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
