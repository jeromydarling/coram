/**
 * StudioNotificationsTab — Gardener notification preferences editor.
 *
 * WHAT: Manage operator_notification_settings with clear toggles and human language.
 * WHERE: Studio → Notifications tab
 * WHY: Gardener controls what signals reach them without technical settings pages.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Bell, Send, Loader2 } from 'lucide-react';

export default function StudioNotificationsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['operator-notif-settings'],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('operator_notification_settings')
        .select('*').eq('operator_user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const payload = { operator_user_id: user!.id, ...updates, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('operator_notification_settings')
        .upsert(payload as any, { onConflict: 'operator_user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-notif-settings'] });
      toast.success('Preferences saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (key: string, currentValue: boolean) => {
    upsertMutation.mutate({ [key]: !currentValue });
  };

  if (isLoading) return <div className="space-y-3 mt-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  const s = settings ?? ({} as Partial<NonNullable<typeof settings>>);

  const items = [
    { key: 'push_enabled', label: 'Push Notifications', desc: 'Receive browser notifications for important garden signals.', value: s.push_enabled ?? true },
    { key: 'email_enabled', label: 'Email Digest', desc: 'Receive a daily morning email summarizing ecosystem movement.', value: s.email_enabled ?? true },
    { key: 'notify_on_draft_ready', label: 'Essay Drafts Ready', desc: 'Be notified when NRI has prepared a new essay for your review.', value: s.notify_on_draft_ready ?? true },
    { key: 'notify_on_critical_error', label: 'Critical System Events', desc: 'Only the most important system events that need your presence.', value: s.notify_on_critical_error ?? true },
    { key: 'notify_on_error_spike', label: 'Error Pattern Detection', desc: 'When the system notices repeated friction patterns across the garden.', value: s.notify_on_error_spike ?? true },
    { key: 'notify_on_qa_fail', label: 'Quality Signals', desc: 'When automated quality checks detect something worth reviewing.', value: s.notify_on_qa_fail ?? false },
    { key: 'notify_on_activation_stuck', label: 'Activation Stalls', desc: 'When a new tenant appears to be stuck during their first steps.', value: s.notify_on_activation_stuck ?? true },
  ];

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        You decide what signals reach you. Each toggle shapes how the garden speaks into your day.
      </p>

      <Card>
        <CardContent className="py-4 space-y-4">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={item.value}
                onCheckedChange={() => toggle(item.key, item.value)}
                disabled={upsertMutation.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daily Digest Time</p>
              <p className="text-xs text-muted-foreground">When should your morning reflection email arrive?</p>
            </div>
            <Input
              type="time"
              className="w-32 text-sm"
              defaultValue={s.daily_digest_time || '07:00'}
              onBlur={(e) => upsertMutation.mutate({ daily_digest_time: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Test notification would be sent here.')}>
        <Send className="h-3.5 w-3.5" /> Send Test Notification
      </Button>
    </div>
  );
}
