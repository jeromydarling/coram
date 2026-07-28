/**
 * CommunioPendingInvites — Shows pending invitations for the current tenant.
 *
 * WHAT: Lists invites to Communio groups the tenant hasn't responded to yet.
 * WHERE: Displayed at the top of the Communio page.
 * WHY: Gives organizations clear, cooperative invitation flow.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Check, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export function CommunioPendingInvites() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const qc = useQueryClient();

  const { data: invites } = useQuery({
    queryKey: ['communio-pending-invites', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('communio_invites')
        .select(`
          id,
          group_id,
          status,
          created_at,
          communio_groups (name, description)
        `)
        .eq('invited_tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const respond = async (inviteId: string, groupId: string, accept: boolean) => {
    if (accept && tenantId) {
      // Accept: create membership + update invite
      const { error: memberError } = await supabase
        .from('communio_memberships')
        .insert({
          group_id: groupId,
          tenant_id: tenantId,
          sharing_level: 'signals',
        });

      if (memberError) {
        toast.error('Failed to join group');
        return;
      }
    }

    const { error } = await supabase
      .from('communio_invites')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', inviteId);

    if (error) {
      toast.error('Failed to respond to invitation');
    } else {
      // Notify the inviter about the response
      try {
        const { data: invite } = await supabase
          .from('communio_invites')
          .select('invited_by, communio_groups(name)')
          .eq('id', inviteId)
          .single();

        if (invite?.invited_by) {
          const groupData = invite.communio_groups as any;
          await supabase.from('proactive_notifications').insert({
            user_id: invite.invited_by,
            notification_type: accept ? 'communio_invite_accepted' : 'communio_invite_declined',
            payload: {
              dedupe_key: `communio_resp:${inviteId}`,
              title: accept
                ? 'A new organization has joined your group'
                : 'An invitation was declined',
              why: accept
                ? `Your invitation to ${groupData?.name || 'the group'} was accepted — your network is growing.`
                : `An organization chose not to join ${groupData?.name || 'the group'} at this time.`,
              group_id: groupId,
            },
          });
        }
      } catch (_) {
        // Silent — notification never blocks response flow
      }

      toast.success(accept ? 'Welcome to the group!' : 'Invitation declined');
      qc.invalidateQueries({ queryKey: ['communio-pending-invites'] });
      qc.invalidateQueries({ queryKey: ['communio-memberships'] });
    }
  };

  if (!invites?.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Mail className="h-4 w-4" />
        Pending Invitations
      </h3>
      {invites.map((inv) => {
        const group = inv.communio_groups as any;
        return (
          <Card key={inv.id} className="rounded-xl border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{group?.name || 'Unknown Group'}</p>
                {group?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{group.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => respond(inv.id, inv.group_id, false)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => respond(inv.id, inv.group_id, true)}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
