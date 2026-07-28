/**
 * StudioVoiceTab — Voice & Tone calibration editor.
 *
 * WHAT: Manage voice profiles with Do/Don't rules, transformation examples, sector variants.
 * WHERE: Studio → Voice & Tone tab
 * WHY: Gardener shapes NRI's editorial voice without code changes.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { Mic2, Plus, Save, Loader2, Check, X, ArrowRight, Trash2 } from 'lucide-react';

interface VoiceProfile {
  id: string;
  profile_key: string;
  display_name: string;
  sector: string;
  do_rules: string[];
  dont_rules: string[];
  tone_description: string | null;
  ignatian_mode: boolean;
  created_at: string;
  updated_at: string;
}

interface VoiceExample {
  id: string;
  profile_id: string;
  before_text: string;
  after_text: string;
  notes: string | null;
}

export default function StudioVoiceTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<VoiceProfile | null>(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['voice-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_calibration_profiles').select('*').order('display_name');
      if (error) throw error;
      return (data || []) as VoiceProfile[];
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Shape how NRI speaks. Each profile defines the tone, rules, and examples that guide narrative generation.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : (
        <div className="space-y-3">
          {(profiles || []).map(p => (
            <Card key={p.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setEditing(p)}>
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Mic2 className="h-4 w-4 text-primary" />
                    <span className="font-medium font-serif">{p.display_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{p.sector}</Badge>
                    {p.ignatian_mode && <Badge variant="default" className="text-xs">Ignatian</Badge>}
                  </div>
                </div>
                {p.tone_description && <p className="text-xs text-muted-foreground line-clamp-2">{p.tone_description}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> {p.do_rules.length} do rules</span>
                  <span className="flex items-center gap-1"><X className="h-3 w-3 text-destructive" /> {p.dont_rules.length} don't rules</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <VoiceProfileEditor
          profile={editing}
          onClose={() => setEditing(null)}
          userId={user!.id}
        />
      )}
    </div>
  );
}

function VoiceProfileEditor({ profile, onClose, userId }: { profile: VoiceProfile; onClose: () => void; userId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile.display_name);
  const [tone, setTone] = useState(profile.tone_description || '');
  const [doRules, setDoRules] = useState(profile.do_rules);
  const [dontRules, setDontRules] = useState(profile.dont_rules);
  const [ignatian, setIgnatian] = useState(profile.ignatian_mode);
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');

  // Examples
  const { data: examples } = useQuery({
    queryKey: ['voice-examples', profile.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_calibration_examples').select('*').eq('profile_id', profile.id);
      if (error) throw error;
      return (data || []) as VoiceExample[];
    },
  });

  const [newBefore, setNewBefore] = useState('');
  const [newAfter, setNewAfter] = useState('');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('voice_calibration_profiles').update({
        display_name: name, tone_description: tone, do_rules: doRules,
        dont_rules: dontRules, ignatian_mode: ignatian, updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (error) throw error;
      await supabase.from('gardener_audit_log').insert({
        actor_id: userId, action_type: 'update', entity_type: 'voice_profile',
        entity_id: profile.id, entity_name: name,
      });
    },
    onSuccess: () => { toast.success('Voice profile saved'); qc.invalidateQueries({ queryKey: ['voice-profiles'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addExampleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('voice_calibration_examples').insert({
        profile_id: profile.id, before_text: newBefore, after_text: newAfter,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Example added');
      setNewBefore(''); setNewAfter('');
      qc.invalidateQueries({ queryKey: ['voice-examples', profile.id] });
    },
  });

  const deleteExampleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('voice_calibration_examples').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voice-examples', profile.id] }),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit Voice Profile: {profile.display_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Display Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={ignatian} onCheckedChange={setIgnatian} />
              <Label className="text-xs">Ignatian Editing Mode</Label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Tone Description</Label>
            <Textarea value={tone} onChange={e => setTone(e.target.value)} className="min-h-[60px] text-sm" />
          </div>

          {/* Do Rules */}
          <div>
            <Label className="text-xs flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Do Rules</Label>
            <div className="space-y-1 mt-1">
              {doRules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-xs bg-muted/30 rounded px-2 py-1">{r}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDoRules(doRules.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newDo} onChange={e => setNewDo(e.target.value)} placeholder="Add a 'do' rule…" className="text-xs h-7" />
                <Button size="sm" className="h-7 text-xs" disabled={!newDo.trim()} onClick={() => { setDoRules([...doRules, newDo.trim()]); setNewDo(''); }}>Add</Button>
              </div>
            </div>
          </div>

          {/* Don't Rules */}
          <div>
            <Label className="text-xs flex items-center gap-1"><X className="h-3 w-3 text-destructive" /> Don't Rules</Label>
            <div className="space-y-1 mt-1">
              {dontRules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-xs bg-destructive/5 rounded px-2 py-1">{r}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDontRules(dontRules.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newDont} onChange={e => setNewDont(e.target.value)} placeholder="Add a 'don't' rule…" className="text-xs h-7" />
                <Button size="sm" className="h-7 text-xs" disabled={!newDont.trim()} onClick={() => { setDontRules([...dontRules, newDont.trim()]); setNewDont(''); }}>Add</Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Examples */}
          <div>
            <Label className="text-xs flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Transformation Examples</Label>
            <div className="space-y-2 mt-2">
              {(examples || []).map(ex => (
                <div key={ex.id} className="p-2 rounded border border-border/50 text-xs space-y-1">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">Before</Badge>
                    <p className="text-muted-foreground">{ex.before_text}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="default" className="text-[10px] shrink-0">After</Badge>
                    <p>{ex.after_text}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] text-destructive" onClick={() => deleteExampleMutation.mutate(ex.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              ))}
              <div className="space-y-1 p-2 rounded bg-muted/20">
                <Input value={newBefore} onChange={e => setNewBefore(e.target.value)} placeholder="Before text…" className="text-xs h-7" />
                <Input value={newAfter} onChange={e => setNewAfter(e.target.value)} placeholder="After text…" className="text-xs h-7" />
                <Button size="sm" className="h-7 text-xs" disabled={!newBefore.trim() || !newAfter.trim() || addExampleMutation.isPending} onClick={() => addExampleMutation.mutate()}>
                  Add Example
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
