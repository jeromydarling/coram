/**
 * StudioCommunioTab — Communio public directory moderation panel.
 *
 * WHAT: Approve/hide Communio group profiles visible in the public directory.
 * WHERE: Studio → Communio Directory tab
 * WHY: Gardener moderates public-facing group descriptions without raw DB access.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { useState } from 'react';
import { Users, Search, Eye, EyeOff, Edit2, Save, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function StudioCommunioTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['studio-communio-groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('communio_groups').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (groups || []).filter((g: any) => {
    if (!search) return true;
    return g.name.toLowerCase().includes(search.toLowerCase()) || (g.description || '').toLowerCase().includes(search.toLowerCase());
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from('communio_groups').update(updates).eq('id', id);
      if (error) throw error;
      await supabase.from('gardener_audit_log').insert({
        actor_id: user!.id, action_type: 'moderate_communio', entity_type: 'communio_group',
        entity_id: id, diff_json: updates,
      });
    },
    onSuccess: () => {
      toast.success('Group updated');
      qc.invalidateQueries({ queryKey: ['studio-communio-groups'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (g: any) => {
    setEditing(g);
    setEditName(g.name);
    setEditDesc(g.description || '');
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Review and moderate Communio group profiles. Only public fields are shown — no private data.
      </p>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input className="pl-8 h-8 text-xs" placeholder="Search groups…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground font-serif italic">
          No Communio groups found.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g: any) => (
            <Card key={g.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-sm font-medium truncate">{g.name}</p>
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{g.description}</p>}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => openEdit(g)}>
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Communio Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Group Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="min-h-[80px] text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate({ id: editing.id, updates: { name: editName, description: editDesc } })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
