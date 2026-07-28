/**
 * StudioSwitchesTab — Bounded feature flag toggles for the Gardener.
 *
 * WHAT: Toggle a small set of system features with notes and audit trail.
 * WHERE: Studio → Switches tab
 * WHY: Gardener controls system behaviors without code changes or Lovable credits.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { ToggleLeft } from 'lucide-react';

export default function StudioSwitchesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['gardener-feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gardener_feature_flags').select('*').order('display_name');
      if (error) throw error;
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase.from('gardener_feature_flags').update({
        enabled, updated_by: user!.id, updated_at: new Date().toISOString(),
      }).eq('key', key);
      if (error) throw error;
      await supabase.from('gardener_audit_log').insert({
        actor_id: user!.id, action_type: enabled ? 'enable_flag' : 'disable_flag',
        entity_type: 'feature_flag', entity_id: key,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gardener-feature-flags'] });
      toast.success('Switch updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const notesMutation = useMutation({
    mutationFn: async ({ key, notes }: { key: string; notes: string }) => {
      const { error } = await supabase.from('gardener_feature_flags').update({
        notes, updated_by: user!.id, updated_at: new Date().toISOString(),
      }).eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gardener-feature-flags'] }),
  });

  if (isLoading) return <div className="space-y-3 mt-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        System switches. Each controls a bounded capability. Changes are audited.
      </p>

      <div className="space-y-3">
        {(flags || []).map((f: any) => (
          <Card key={f.key}>
            <CardContent className="py-4 px-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ToggleLeft className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{f.display_name}</span>
                  </div>
                  {f.description && <p className="text-xs text-muted-foreground mb-2">{f.description}</p>}
                  <Input
                    className="text-xs h-7 max-w-md"
                    placeholder="Add notes…"
                    defaultValue={f.notes || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (f.notes || '')) {
                        notesMutation.mutate({ key: f.key, notes: e.target.value });
                      }
                    }}
                  />
                </div>
                <Switch
                  checked={f.enabled}
                  onCheckedChange={(checked) => toggleMutation.mutate({ key: f.key, enabled: checked })}
                  disabled={toggleMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
