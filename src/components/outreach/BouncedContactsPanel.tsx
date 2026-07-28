import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, ShieldAlert, Trash2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBounceDetect } from '@/hooks/useBounceDetect';
import type { CampaignAudienceMember } from '@/hooks/useCampaignAudience';
import { toast } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const BOUNCE_CATEGORIES = ['bounce', 'invalid_address', 'provider_perm'];

interface BouncedContactsPanelProps {
  campaignId: string;
  audience: CampaignAudienceMember[];
}

export function BouncedContactsPanel({ campaignId, audience }: BouncedContactsPanelProps) {
  // ALL hooks must be called before any early return
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const bounceDetect = useBounceDetect();

  const deleteContacts = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', contactIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', campaignId] });
      setSelected(new Set());
      toast.success('Bounced contacts removed from People');
    },
    onError: (error) => {
      toast.error(`Failed to remove contacts: ${error.message}`);
    },
  });

  const bouncedMembers = audience.filter(
    (m) => m.status === 'failed' && m.failure_category && BOUNCE_CATEGORIES.includes(m.failure_category)
  );

  const sentCount = audience.filter((m) => m.status === 'sent').length;
  const selectableMembers = bouncedMembers.filter((m) => m.contact_id);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === selectableMembers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableMembers.map((m) => m.contact_id!)));
    }
  };

  const handleDelete = () => {
    const ids = Array.from(selected);
    if (ids.length > 0) {
      deleteContacts.mutate(ids);
      setConfirmOpen(false);
    }
  };

  const categoryBadge = (cat: string | null) => {
    if (cat === 'bounce') return <Badge variant="destructive" className="text-xs">Bounced</Badge>;
    if (cat === 'invalid_address') return <Badge variant="destructive" className="text-xs">Invalid</Badge>;
    if (cat === 'provider_perm') return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
    return <Badge variant="destructive" className="text-xs">Failed</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Bounce Detection
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bounceDetect.mutate(campaignId)}
                  disabled={bounceDetect.isPending || sentCount === 0}
                >
                  {bounceDetect.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5 mr-1" />
                  )}
                  Scan Gmail for Bounces
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[200px]">
                  <strong>What:</strong> Searches your Gmail for mailer-daemon bounce-back emails related to this campaign.<br />
                  <strong>Where:</strong> Checks Inbox, Spam, and Trash.<br />
                  <strong>Why:</strong> Identifies contacts whose emails bounced after delivery so you can clean your list.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {bouncedMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {sentCount === 0
              ? 'No sent emails to scan yet.'
              : 'No bounces detected. Click "Scan Gmail for Bounces" to check.'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selected.size === selectableMembers.length && selectableMembers.length > 0}
                  onCheckedChange={toggleAll}
                  disabled={selectableMembers.length === 0}
                />
                <span className="text-sm text-muted-foreground">
                  {bouncedMembers.length} bounced contact{bouncedMembers.length > 1 ? 's' : ''}
                </span>
              </div>
              {selected.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleteContacts.isPending}
                >
                  {deleteContacts.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Remove from People ({selected.size})
                </Button>
              )}
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {bouncedMembers.map((member) => {
                  const hasContact = !!member.contact_id;
                  return (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                      <Checkbox
                        checked={hasContact && selected.has(member.contact_id!)}
                        onCheckedChange={() => hasContact && toggleSelect(member.contact_id!)}
                        disabled={!hasContact}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">
                          {member.name || member.email}
                        </p>
                        {member.name && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                      {categoryBadge(member.failure_category)}
                      {!hasContact && (
                        <Badge variant="outline" className="text-xs">No link</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove bounced contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selected.size} contact{selected.size > 1 ? 's' : ''} from
              your People list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
