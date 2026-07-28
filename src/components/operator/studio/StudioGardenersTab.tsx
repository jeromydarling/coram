/**
 * StudioGardenersTab — Manage the Gardener team.
 *
 * WHAT: Add gardeners, assign scopes (metros/archetypes/specialties), toggle on-call.
 * WHERE: Studio → Gardeners tab (MACHINA zone)
 * WHY: The Master Gardener needs to build their team without complex admin panels.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { UserPlus, MapPin, Sprout, Wrench, X, Crown, Phone } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import {
  useGardeners, useGardenerScopes, useAllGardenerScopes,
  useAddGardener, useUpdateGardener, useAddGardenerScope, useRemoveGardenerScope
} from '@/hooks/useGardenerTeam';

function SectionTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

const SCOPE_ICONS: Record<string, React.ElementType> = {
  metro: MapPin,
  archetype: Sprout,
  specialty: Wrench,
};

export default function StudioGardenersTab() {
  const { data: gardeners, isLoading } = useGardeners();
  const { data: allScopes } = useAllGardenerScopes();
  const addGardener = useAddGardener();
  const updateGardener = useUpdateGardener();
  const addScope = useAddGardenerScope();
  const removeScope = useRemoveGardenerScope();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newName, setNewName] = useState('');
  const [scopeGardenerId, setScopeGardenerId] = useState<string | null>(null);
  const [newScopeType, setNewScopeType] = useState<string>('metro');
  const [newScopeKey, setNewScopeKey] = useState('');

  // Get profiles that could be gardeners (admin role users)
  const { data: adminProfiles } = useQuery({
    queryKey: ['admin-profiles-for-gardener'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles:user_id(display_name, user_id)')
        .eq('role', 'admin');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Get metros for scope assignment
  const { data: metros } = useQuery({
    queryKey: ['metros-for-scope'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metros')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Get archetypes
  const { data: archetypes } = useQuery({
    queryKey: ['archetypes-for-scope'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('archetypes')
        .select('key, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleAddGardener = async () => {
    if (!selectedUserId || !newName.trim()) return;
    try {
      await addGardener.mutateAsync({ id: selectedUserId, display_name: newName.trim() });
      toast.success('Gardener added to the team');
      setAddOpen(false);
      setSelectedUserId('');
      setNewName('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddScope = async () => {
    if (!scopeGardenerId || !newScopeKey) return;
    try {
      await addScope.mutateAsync({ gardener_id: scopeGardenerId, scope_type: newScopeType, scope_key: newScopeKey });
      toast.success('Scope assigned');
      setNewScopeKey('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="space-y-3 mt-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  const existingGardenerIds = new Set((gardeners ?? []).map(g => g.id));
  const availableAdmins = (adminProfiles ?? []).filter(
    (a: any) => !existingGardenerIds.has(a.user_id)
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Your team of gardeners who tend the ecosystem. Each can be assigned to metros, archetypes, or specialties.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Add Gardener
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Welcome a New Gardener</DialogTitle>
              <DialogDescription>Choose an admin-role user to become a gardener.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={selectedUserId} onValueChange={(v) => {
                setSelectedUserId(v);
                const match = availableAdmins.find((a: any) => a.user_id === v);
                if (match && (match as any).profiles?.display_name) {
                  setNewName((match as any).profiles.display_name);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select a user..." /></SelectTrigger>
                <SelectContent>
                  {availableAdmins.map((a: any) => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {(a as any).profiles?.display_name || a.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Display name" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleAddGardener} disabled={!selectedUserId || !newName.trim() || addGardener.isPending}>
                Add to Team
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!gardeners || gardeners.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No gardeners yet. You are the first. Add yourself or another admin to begin.
          </CardContent>
        </Card>
      )}

      {(gardeners ?? []).map((g: any) => {
        const gScopes = (allScopes ?? []).filter((s: any) => s.gardener_id === g.id);
        return (
          <Card key={g.id} className={!g.is_active ? 'opacity-60' : ''}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{g.display_name}</span>
                  {g.is_primary && <Badge variant="outline" className="gap-1 text-xs"><Crown className="h-3 w-3" /> Primary</Badge>}
                  {g.is_on_call && <Badge variant="secondary" className="gap-1 text-xs"><Phone className="h-3 w-3" /> On-Call</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Active</span>
                    <Switch checked={g.is_active} onCheckedChange={v => updateGardener.mutate({ id: g.id, is_active: v })} />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">On-Call</span>
                    <Switch checked={g.is_on_call} onCheckedChange={v => updateGardener.mutate({ id: g.id, is_on_call: v })} />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Primary</span>
                    <Switch checked={g.is_primary} onCheckedChange={v => updateGardener.mutate({ id: g.id, is_primary: v })} />
                  </label>
                </div>
              </div>

              {/* Scopes */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {gScopes.map((s: any) => {
                  const Icon = SCOPE_ICONS[s.scope_type] || Wrench;
                  return (
                    <Badge key={s.id} variant="outline" className="gap-1 text-xs">
                      <Icon className="h-3 w-3" />
                      {s.scope_type}: {s.scope_key}
                      <button onClick={() => removeScope.mutate(s.id)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>

              {/* Add scope inline */}
              {scopeGardenerId === g.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <Select value={newScopeType} onValueChange={setNewScopeType}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metro">Metro</SelectItem>
                      <SelectItem value="archetype">Archetype</SelectItem>
                      <SelectItem value="specialty">Specialty</SelectItem>
                    </SelectContent>
                  </Select>
                  {newScopeType === 'metro' ? (
                    <Select value={newScopeKey} onValueChange={setNewScopeKey}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Select metro..." /></SelectTrigger>
                      <SelectContent>
                        {(metros ?? []).map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : newScopeType === 'archetype' ? (
                    <Select value={newScopeKey} onValueChange={setNewScopeKey}>
                      <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Select archetype..." /></SelectTrigger>
                      <SelectContent>
                        {(archetypes ?? []).map((a: any) => (
                          <SelectItem key={a.key} value={a.key}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="w-40 h-8 text-xs" placeholder="e.g. integrations, billing" value={newScopeKey} onChange={e => setNewScopeKey(e.target.value)} />
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddScope} disabled={!newScopeKey}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setScopeGardenerId(null)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => setScopeGardenerId(g.id)}>
                  + Add scope
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
