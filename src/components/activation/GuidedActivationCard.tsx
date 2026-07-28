/**
 * GuidedActivationCard — Tenant-facing card showing Guided Activation session status.
 *
 * WHAT: Displays session status, allows requesting scheduling times.
 * WHERE: Tenant settings / billing page.
 * WHY: Post-purchase, tenants need a calm way to schedule their activation session.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import ActivationReflectionCard from '@/components/activation/ActivationReflectionCard';
import { format } from 'date-fns';


interface Props {
  tenantId: string;
}

export function GuidedActivationCard({ tenantId }: Props) {
  const queryClient = useQueryClient();
  const [requestedTimes, setRequestedTimes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['activation-sessions', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('purchased_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const requestScheduling = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke('activation-manage', {
        body: {
          action: 'request_scheduling',
          activation_session_id: sessionId,
          requested_times: requestedTimes,
          customer_notes: customerNotes,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Scheduling request sent');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['activation-sessions', tenantId] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!sessions || sessions.length === 0) return null;

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pending': return <Badge variant="secondary">Awaiting Scheduling</Badge>;
      case 'scheduled': return <Badge variant="default">Scheduled</Badge>;
      case 'completed': return <Badge variant="outline">Completed</Badge>;
      case 'canceled': return <Badge variant="destructive">Canceled</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {sessions.map((session: any) => (
        <Card key={session.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {session.session_type === 'guided_activation_plus'
                ? 'Guided Activation Plus\u2122'
                : 'Guided Activation\u2122'}
            </CardTitle>
            <CardDescription>
              {session.sessions_total === 2 ? 'Two 90-minute sessions' : 'One 90-minute session'}
              {' \u2014 '}
              {session.sessions_remaining} remaining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {statusBadge(session.status)}
            </div>

            {session.status === 'pending' && (
              <div className="space-y-3">
                <p
                  className="text-sm text-muted-foreground leading-relaxed"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  Tell us what times work for you, and we will find the right moment.
                </p>
                {!showForm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRequestedTimes(session.requested_times ?? '');
                      setCustomerNotes(session.customer_notes ?? '');
                      setShowForm(true);
                    }}
                  >
                    <Calendar className="mr-1.5 h-4 w-4" />
                    {session.requested_times ? 'Update Availability' : 'Request Scheduling'}
                  </Button>
                ) : (
                  <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        What times work for you?
                      </label>
                      <Textarea
                        value={requestedTimes}
                        onChange={(e) => setRequestedTimes(e.target.value)}
                        placeholder="e.g., Mornings Tue/Thu, or any afternoon next week"
                        className="text-sm"
                        maxLength={1000}
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        Anything we should know? (optional)
                      </label>
                      <Textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="e.g., We use HubSpot currently, 3 team members joining"
                        className="text-sm"
                        maxLength={2000}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => requestScheduling.mutate(session.id)}
                        disabled={requestScheduling.isPending || !requestedTimes.trim()}
                      >
                        {requestScheduling.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        Send Request
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {session.requested_times && !showForm && (
                  <p className="text-xs text-muted-foreground">
                    You requested: &quot;{session.requested_times}&quot;
                  </p>
                )}
              </div>
            )}

            {session.status === 'scheduled' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {format(new Date(session.scheduled_at), 'EEEE, MMMM d \'at\' h:mm a')}
                  </span>
                </div>
                {session.meet_link && (
                  <a
                    href={session.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Join Meeting
                  </a>
                )}
              </div>
            )}

            {session.status === 'completed' && (
              <p
                className="text-sm text-muted-foreground italic"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                Your activation is complete. Your narrative is already forming.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Flywheel: show reflection card if any session is completed */}
      {sessions?.some(s => s.status === 'completed') && (
        <ActivationReflectionCard />
      )}
    </div>
  );
}
