/**
 * AdminImpersonateModal — Modal for selecting a user to impersonate in a tenant.
 *
 * WHAT: Lets admin pick a user from a tenant and start impersonation.
 * WHERE: Opened from Demo Lab tenant list.
 * WHY: Safe, audited entry point for "view as" functionality.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye } from 'lucide-react';

interface AdminImpersonateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export function AdminImpersonateModal({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  tenantSlug,
}: AdminImpersonateModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { startImpersonation } = useImpersonation();
  const navigate = useNavigate();

  // Fetch users for this tenant
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['tenant-users-for-impersonation', tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_users')
        .select('user_id, profiles!inner(display_name, nickname)')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return (data ?? []).map((tu: any) => ({
        userId: tu.user_id,
        displayName: tu.profiles?.nickname || tu.profiles?.display_name || tu.user_id.slice(0, 8),
      }));
    },
  });

  const handleStart = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    const ok = await startImpersonation(tenantId, selectedUserId, reason || undefined);
    setLoading(false);
    if (ok) {
      onOpenChange(false);
      setSelectedUserId('');
      setReason('');
      // Navigate to the tenant's dashboard as the impersonated user
      navigate(`/${tenantSlug}/`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            View as User
          </DialogTitle>
          <DialogDescription>
            Impersonate a user in <strong>{tenantName}</strong>. This action is fully audited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>User</Label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
              </div>
            ) : !users?.length ? (
              <p className="text-sm text-muted-foreground">No users found in this tenant.</p>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              placeholder="Why are you impersonating this user?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleStart}
            disabled={!selectedUserId || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Impersonation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
