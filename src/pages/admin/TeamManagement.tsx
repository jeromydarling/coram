/**
 * TeamManagement — Steward user management page.
 *
 * WHAT: View team members, change roles, remove users, send/bulk-import invites.
 * WHERE: /:tenantSlug/admin/team (MACHINA zone — system configuration).
 * WHY: Stewards need to manage who has access and what role they hold.
 */
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { Loader2, UserPlus, Users, Mail, Copy, Clock, CheckCircle, XCircle, Upload, HelpCircle, Heart } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

const ROLE_OPTIONS = [
  { value: 'shepherd', label: 'Shepherd', description: 'Leadership — full visibility' },
  { value: 'companion', label: 'Companion', description: 'Staff — task and people focused' },
  { value: 'visitor', label: 'Visitor', description: 'Volunteer — simplified mobile experience' },
] as const;

export default function TeamManagement() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('visitor');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRole, setBulkRole] = useState<string>('visitor');

  const tenantId = tenant?.id;

  // Fetch team members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data: tenantUsers } = await supabase
        .from('tenant_users')
        .select('user_id, joined_from_companion')
        .eq('tenant_id', tenantId);

      if (!tenantUsers?.length) return [];

      const userIds = tenantUsers.map(tu => tu.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, gmail_email_address, ministry_role, created_at')
        .in('user_id', userIds);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      return (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.gmail_email_address,
        ministry_role: p.ministry_role,
        created_at: p.created_at,
        system_roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
        joined_from_companion: tenantUsers?.find(tu => tu.user_id === p.user_id)?.joined_from_companion || false,
      }));
    },
    enabled: !!tenantId,
  });

  // Fetch pending invites
  const { data: invites, isLoading: invitesLoading } = useQuery({
    queryKey: ['tenant-invites', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('tenant_invites')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Send single invite
  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error('Missing context');
      const email = inviteEmail.trim().toLowerCase();
      if (!email) throw new Error('Email required');

      const { data, error } = await supabase.rpc('bulk_create_invites', {
        p_tenant_id: tenantId,
        p_invites: JSON.stringify([{ email, ministry_role: inviteRole }]),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenant-invites', tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Bulk invite
  const bulkInvite = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Missing tenant');
      const emails = bulkText
        .split(/[\n,;]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e && e.includes('@'));

      if (emails.length === 0) throw new Error('No valid emails found');
      if (emails.length > 50) throw new Error('Maximum 50 invites per batch. Please split into smaller groups.');

      const invitePayload = emails.map(email => ({ email, ministry_role: bulkRole }));

      const { data, error } = await supabase.rpc('bulk_create_invites', {
        p_tenant_id: tenantId,
        p_invites: JSON.stringify(invitePayload),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const result = data as { ok: boolean; created: number; skipped: number; already_member?: number };
      const parts = [`${result.created} invitation(s) created`];
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (duplicate invites)`);
      if (result.already_member && result.already_member > 0) parts.push(`${result.already_member} already members`);
      toast.success(parts.join(', '));
      setBulkText('');
      setBulkDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenant-invites', tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Change ministry role
  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ministry_role: newRole })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['team-members', tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Remove user from tenant (with last-steward protection)
  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('remove_tenant_user', {
        p_tenant_id: tenantId!,
        p_target_user_id: userId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) throw new Error(result?.message || 'Cannot remove user');
      return result;
    },
    onSuccess: () => {
      toast.success('User removed from organization');
      queryClient.invalidateQueries({ queryKey: ['team-members', tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Revoke invite
  const revokeInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('tenant_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invitation revoked');
      queryClient.invalidateQueries({ queryKey: ['tenant-invites', tenantId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/join?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  };

  const pendingInvites = (invites || []).filter(i => new Date(i.expires_at) > new Date());

  return (
    <MainLayout title="Team Management">
      <div className="space-y-6 max-w-4xl mx-auto" data-testid="team-management-root">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Team
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage who has access to your organization's workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-1" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a team member</DialogTitle>
                  <DialogDescription>
                    Send an invitation link. It will expire after 30 days.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email address</Label>
                    <Input
                      type="email"
                      placeholder="colleague@organization.org"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label} — {r.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => sendInvite.mutate()} disabled={sendInvite.isPending || !inviteEmail.trim()}>
                    {sendInvite.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-1" /> Bulk Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk invite</DialogTitle>
                  <DialogDescription>
                    Paste up to 50 email addresses (one per line, or comma-separated). All will receive the same role.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Email addresses</Label>
                    <Textarea
                      placeholder={"alice@org.com\nbob@org.com\ncharlie@org.com"}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      {bulkText.split(/[\n,;]+/).filter(e => e.trim() && e.includes('@')).length} valid email(s) detected
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Role for all</Label>
                    <Select value={bulkRole} onValueChange={setBulkRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label} — {r.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => bulkInvite.mutate()} disabled={bulkInvite.isPending}>
                    {bulkInvite.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Send All Invitations
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Active Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Members</CardTitle>
            <CardDescription>People who have joined your organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !members?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No team members yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Experience Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const isSelf = m.user_id === user?.id;
                    const isSteward = m.system_roles.includes('steward');
                    return (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-medium">
                          {m.display_name || '—'}
                          {isSelf && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                          {isSteward && <Badge className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">Steward</Badge>}
                          {m.joined_from_companion && <Badge variant="secondary" className="ml-2 text-xs gap-0.5"><Heart className="h-2.5 w-2.5" />Companion</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.email}</TableCell>
                        <TableCell>
                          <Select
                            value={m.ministry_role || 'visitor'}
                            onValueChange={(val) => changeRole.mutate({ userId: m.user_id, newRole: val })}
                            disabled={isSelf}
                          >
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isSelf && !isSteward && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove {m.display_name || m.email}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    They will lose access to this organization. You can re-invite them later.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeUser.mutate(m.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations</CardTitle>
            <CardDescription>Invitations awaiting acceptance. Links expire after 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !pendingInvites.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending invitations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{inv.ministry_role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {format(new Date(inv.expires_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv.token)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy invite link</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => {
                                revokeInvite.mutate(inv.id, {
                                  onSuccess: () => {
                                    // Re-invite with same email/role
                                    supabase.rpc('bulk_create_invites', {
                                      p_tenant_id: tenantId!,
                                      p_invites: JSON.stringify([{ email: inv.email, ministry_role: inv.ministry_role }]),
                                    }).then(() => {
                                      toast.success(`New invitation sent to ${inv.email}`);
                                      queryClient.invalidateQueries({ queryKey: ['tenant-invites', tenantId] });
                                    });
                                  },
                                });
                              }}>
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Resend invite</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revokeInvite.mutate(inv.id)}>
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Help tooltip */}
        <div className="text-xs text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-muted/30">
          <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground mb-1">About Team Management</p>
            <p><strong>What:</strong> Manage who has access to your CROS workspace and what experience they see.</p>
            <p><strong>Where:</strong> This page is available to Stewards from Admin → Team.</p>
            <p><strong>Why:</strong> CROS is invite-only. Only stewards can add or remove team members, ensuring your community data stays protected.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
