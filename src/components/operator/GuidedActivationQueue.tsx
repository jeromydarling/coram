/**
 * GuidedActivationQueue — Operator Console queue for managing Guided Activation sessions.
 *
 * WHAT: Tabbed queue (Pending/Scheduled/Completed) with scheduling modal and session management.
 * WHERE: /operator/scheduling or dedicated section.
 * WHY: Operators need to manage the activation session lifecycle for tenants.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, CheckCircle, Clock, ExternalLink, Loader2, Sparkles, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format, formatDistanceToNow } from 'date-fns';

export function GuidedActivationQueue() {
  const queryClient = useQueryClient();
  const [scheduleModal, setScheduleModal] = useState<any>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [duration, setDuration] = useState(90);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['operator-activation-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_sessions')
        .select('*, tenants!activation_sessions_tenant_id_fkey(name, slug)')
        .order('purchased_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const manageMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('activation-manage', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      const action = variables.action as string;
      toast.success(
        action === 'schedule' ? 'Session scheduled' :
        action === 'complete' ? `Session marked complete (${(data as any).sessions_remaining} remaining)` :
        action === 'cancel' ? 'Session canceled' : 'Updated'
      );
      setScheduleModal(null);
      queryClient.invalidateQueries({ queryKey: ['operator-activation-sessions'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = (sessions ?? []).filter((s: any) => s.status === 'pending');
  const scheduled = (sessions ?? []).filter((s: any) => s.status === 'scheduled');
  const completed = (sessions ?? []).filter((s: any) => s.status === 'completed' || s.status === 'canceled');

  const SessionRow = ({ session }: { session: any }) => {
    const tenantName = (session as any).tenants?.name ?? 'Unknown';
    return (
      <div className="flex items-start justify-between gap-3 p-4 border border-border rounded-lg">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-foreground truncate">{tenantName}</span>
            <Badge variant="outline" className="text-[10px]">
              {session.session_type === 'guided_activation_plus' ? 'Plus' : 'Standard'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>{session.sessions_remaining}/{session.sessions_total} sessions remaining</p>
            <p>Purchased {formatDistanceToNow(new Date(session.purchased_at), { addSuffix: true })}</p>
            {session.requested_times && (
              <p className="text-foreground/70">Preferred: &quot;{session.requested_times}&quot;</p>
            )}
            {session.scheduled_at && (
              <p className="flex items-center gap-1 text-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(session.scheduled_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
            {session.meet_link && (
              <a href={session.meet_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Meet link
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {session.status === 'pending' && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                setScheduleModal(session);
                setScheduledAt('');
                setMeetLink('');
                setDuration(90);
              }}
            >
              <Clock className="mr-1 h-3 w-3" /> Schedule
            </Button>
          )}
          {session.status === 'scheduled' && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => manageMutation.mutate({
                  action: 'complete',
                  activation_session_id: session.id,
                })}
                disabled={manageMutation.isPending}
              >
                <CheckCircle className="mr-1 h-3 w-3" /> Complete 1 Session
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => manageMutation.mutate({
                  action: 'cancel',
                  activation_session_id: session.id,
                  reason: 'Gardener canceled',
                })}
                disabled={manageMutation.isPending}
              >
                <XCircle className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Guided Activation Queue
          </CardTitle>
          <CardDescription>
            {pending.length} pending · {scheduled.length} scheduled · {completed.length} completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending" className="space-y-3 mt-3">
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No pending sessions</p>
              ) : (
                pending.map((s: any) => <SessionRow key={s.id} session={s} />)
              )}
            </TabsContent>
            <TabsContent value="scheduled" className="space-y-3 mt-3">
              {scheduled.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No scheduled sessions</p>
              ) : (
                scheduled.map((s: any) => <SessionRow key={s.id} session={s} />)
              )}
            </TabsContent>
            <TabsContent value="completed" className="space-y-3 mt-3">
              {completed.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No completed sessions yet</p>
              ) : (
                completed.map((s: any) => <SessionRow key={s.id} session={s} />)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Schedule Modal */}
      <Dialog open={!!scheduleModal} onOpenChange={(o) => !o && setScheduleModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Activation Session</DialogTitle>
            <DialogDescription>
              {scheduleModal && (
                <>For {(scheduleModal as any).tenants?.name ?? 'tenant'}</>
              )}
              {scheduleModal?.requested_times && (
                <span className="block mt-1 text-foreground/70">
                  Customer preferred: &quot;{scheduleModal.requested_times}&quot;
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Date & Time</label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Meet Link (optional)</label>
              <Input
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={30}
                max={180}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleModal(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!scheduledAt) {
                  toast.error('Please select a date and time');
                  return;
                }
                manageMutation.mutate({
                  action: 'schedule',
                  activation_session_id: scheduleModal.id,
                  scheduled_at: new Date(scheduledAt).toISOString(),
                  meet_link: meetLink || undefined,
                  duration_minutes: duration,
                });
              }}
              disabled={manageMutation.isPending}
            >
              {manageMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Schedule Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
