/**
 * RequestsPanel — View and manage incoming/outgoing caregiver network requests.
 *
 * WHAT: Accept, decline, or block incoming connection requests.
 * WHERE: CaregiverNetworkPage "Requests" tab.
 * WHY: Mediated connection — both parties must consent.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ShieldBan, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useMyRequests, useUpdateRequestStatus } from '@/hooks/useCaregiverNetwork';
import { formatDistanceToNow } from 'date-fns';

export default function RequestsPanel() {
  const { data, isLoading } = useMyRequests();
  const updateStatus = useUpdateRequestStatus();

  const handleAction = async (id: string, status: 'accepted' | 'declined' | 'blocked') => {
    try {
      await updateStatus.mutateAsync({ id, status });
      const labels = { accepted: 'accepted', declined: 'declined', blocked: 'blocked' };
      toast.success(`Request ${labels[status]}.`);
    } catch {
      toast.error('Could not update this request right now.');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>;
  }

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  return (
    <div className="space-y-6">
      {/* Incoming */}
      <div>
        <h3 className="text-sm font-medium mb-3">Received</h3>
        {incoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">No incoming requests right now.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((req: any) => (
              <Card key={req.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* FIX #2: Show sender's display name, not "Someone" */}
                    <p className="text-sm font-medium truncate">
                      {req.sender_display_name || 'A caregiver'} reached out
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {req.status === 'pending' ? (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAction(req.id, 'accepted')}>
                        <Check className="h-3 w-3" /> Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleAction(req.id, 'declined')}>
                        <X className="h-3 w-3" /> Decline
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1" onClick={() => handleAction(req.id, 'blocked')}>
                        <ShieldBan className="h-3 w-3" /> Block
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {req.status}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing */}
      <div>
        <h3 className="text-sm font-medium mb-3">Sent</h3>
        {outgoing.length === 0 ? (
          <p className="text-xs text-muted-foreground">You haven't sent any requests yet.</p>
        ) : (
          <div className="space-y-2">
            {outgoing.map((req: any) => (
              <Card key={req.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      Note to {req.caregiver_profiles?.display_name || 'a caregiver'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant={req.status === 'accepted' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                    {req.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
