/**
 * CommunioInviteFlow — Invite other organizations to a Communio group.
 *
 * WHAT: Search for a tenant by slug and send a group invitation.
 * WHERE: Displayed in Communio group details for group creators.
 * WHY: Enables cooperative network building while maintaining privacy boundaries.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Search, UserPlus } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props {
  groupId: string;
}

export function CommunioInviteFlow({ groupId }: Props) {
  const [slug, setSlug] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundTenant, setFoundTenant] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();

  const searchTenant = async () => {
    if (!slug.trim()) return;
    setSearching(true);
    setFoundTenant(null);

    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug')
      .eq('slug', slug.trim().toLowerCase())
      .maybeSingle();

    setSearching(false);

    if (error || !data) {
      toast.error('Organization not found');
      return;
    }

    // Check not already member
    const { data: existing } = await supabase
      .from('communio_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('tenant_id', data.id)
      .maybeSingle();

    if (existing) {
      toast.info('This organization is already a member');
      return;
    }

    // Check not already invited
    const { data: pendingInvite } = await supabase
      .from('communio_invites')
      .select('id')
      .eq('group_id', groupId)
      .eq('invited_tenant_id', data.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingInvite) {
      toast.info('An invitation is already pending for this organization');
      return;
    }

    setFoundTenant(data);
  };

  const sendInvite = async () => {
    if (!foundTenant) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('communio_invites')
      .insert({
        group_id: groupId,
        invited_tenant_id: foundTenant.id,
        invited_by: user!.id,
        status: 'pending',
      });

    setSending(false);

    if (error) {
      toast.error('Failed to send invitation');
    } else {
      // Notify the invited tenant's users
      try {
        const { data: targetUsers } = await supabase
          .from('tenant_users')
          .select('user_id')
          .eq('tenant_id', foundTenant.id)
          .limit(10);

        if (targetUsers && targetUsers.length > 0) {
          const notifications = targetUsers.map((tu: any) => ({
            user_id: tu.user_id,
            notification_type: 'communio_invite_received',
            payload: {
              dedupe_key: `communio_invite:${groupId}:${foundTenant.id}`,
              title: 'A neighboring organization has invited you',
              why: 'A Communio group invitation is waiting for you — ready when you are.',
              group_id: groupId,
            },
          }));

          await supabase.from('proactive_notifications').insert(notifications);
        }
      } catch (_) {
        // Silent — notification never blocks invite flow
      }

      toast.success(`Invitation sent to ${foundTenant.name}`);
      setFoundTenant(null);
      setSlug('');
      qc.invalidateQueries({ queryKey: ['communio-invites'] });
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Invite an Organization</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>What:</strong> Send a Communio group invitation to another organization.<br />
                  <strong>Where:</strong> They'll see it in their Communio page.<br />
                  <strong>Why:</strong> Grow your cooperative network with trusted partners.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Enter organization slug…"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchTenant()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={searchTenant}
            disabled={searching || !slug.trim()}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {foundTenant && (
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">{foundTenant.name}</p>
              <p className="text-xs text-muted-foreground">/{foundTenant.slug}</p>
            </div>
            <Button size="sm" onClick={sendInvite} disabled={sending}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send Invite
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
