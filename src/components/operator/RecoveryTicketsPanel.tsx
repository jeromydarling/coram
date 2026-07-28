/**
 * RecoveryTicketsPanel — Gardener surface for reviewing recovery tickets.
 *
 * WHAT: Lists open/in_progress recovery tickets filed by tenants via the NRI Guide.
 * WHERE: CURA zone — accessible from Gardener Nexus.
 * WHY: Without this, recovery tickets go into the database but no one can see them.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchOperatorRecoveryTickets } from '@/lib/safeOperatorQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { LifeBuoy, CheckCircle2, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface RecoveryTicket {
  id: string;
  user_id: string;
  tenant_id: string | null;
  type: string;
  status: string;
  subject: string;
  suspected_entity_type: string | null;
  suspected_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

function useRecoveryTickets() {
  return useQuery({
    queryKey: ['recovery-tickets-gardener'],
    queryFn: async () => {
      const data = await fetchOperatorRecoveryTickets({ limit: 50 });
      return data as unknown as RecoveryTicket[];
    },
  });
}

function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('recovery_tickets')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recovery-tickets-gardener'] });
      toast.success('Ticket updated.');
    },
    onError: () => toast.error('Failed to update ticket.'),
  });
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  open: { label: 'Open', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'secondary' },
  resolved: { label: 'Resolved', variant: 'outline' },
  closed: { label: 'Closed', variant: 'outline' },
};

const TYPE_LABELS: Record<string, string> = {
  recovery_emergency: 'Emergency',
  data_loss: 'Data Loss',
  undo_request: 'Undo Request',
  general: 'General',
};

export default function RecoveryTicketsPanel() {
  const { data: tickets, isLoading } = useRecoveryTickets();
  const updateStatus = useUpdateTicketStatus();

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <LifeBuoy className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-serif font-bold text-foreground">Recovery Requests</h2>
        <HelpTooltip
          what="Recovery tickets filed by community members through the NRI Guide."
          where="Gardener Nexus → Recovery"
          why="Ensures no request for help goes unnoticed."
        />
      </div>
      <p className="text-sm text-muted-foreground">
        When someone needs help undoing a mistake or recovering lost work, their request appears here.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !tickets?.length ? (
        <Card className="border-border/30">
          <CardContent className="py-8 text-center">
            <p className="text-sm font-serif italic text-muted-foreground">
              No open recovery requests. All is well.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3">
            {tickets.map(ticket => {
              const statusInfo = STATUS_BADGES[ticket.status] ?? STATUS_BADGES.open;
              return (
                <Card key={ticket.id} className="border-border/30">
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                        {ticket.suspected_entity_type && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Related to: {ticket.suspected_entity_type} record
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[ticket.type] ?? ticket.type}
                        </Badge>
                        <Badge variant={statusInfo.variant} className="text-[10px]">
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </p>
                      <div className="flex gap-1.5">
                        {ticket.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => updateStatus.mutate({ id: ticket.id, status: 'in_progress' })}
                            disabled={updateStatus.isPending}
                          >
                            <Clock className="w-3 h-3" /> Begin
                          </Button>
                        )}
                        {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => updateStatus.mutate({ id: ticket.id, status: 'resolved' })}
                            disabled={updateStatus.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3" /> Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
