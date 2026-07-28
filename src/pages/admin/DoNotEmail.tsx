/**
 * DoNotEmail — Admin page for managing email suppressions.
 *
 * WHAT: View, add, and remove suppressed emails for the tenant.
 * WHERE: /:tenantSlug/admin/do-not-email
 * WHY: Compliance visibility and manual suppression management.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/sonner';
import { ShieldBan, Plus, Trash2, Loader2, MailX } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { HelpCircle } from 'lucide-react';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const REASON_COLORS: Record<string, string> = {
  unsubscribed: 'bg-amber-100 text-amber-800 border-amber-200',
  complaint: 'bg-destructive/15 text-destructive',
  bounce: 'bg-orange-100 text-orange-800 border-orange-200',
  manual: 'bg-muted text-muted-foreground',
};

export default function DoNotEmail() {
  const { tenantId } = useTenant();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{ id: string; email: string } | null>(null);

  const { data: suppressions, isLoading } = useQuery({
    queryKey: ['email-suppressions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('email_suppressions')
        .select('id, email, reason, source, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase
        .from('email_suppressions')
        .insert({
          tenant_id: tenantId,
          email: email.toLowerCase().trim(),
          reason: 'manual',
          source: 'admin',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
      if (error) {
        if (error.code === '23505') throw new Error('Email already suppressed');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-suppressions'] });
      setNewEmail('');
      toast.success('Email added to Do Not Email list.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_suppressions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-suppressions'] });
      setRemoveTarget(null);
      toast.success('Email removed from suppression list.');
    },
    onError: () => toast.error('Failed to remove suppression.'),
  });

  const handleAdd = () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }
    addMutation.mutate(email);
  };

  return (
    <MainLayout
      title="Do Not Email"
      subtitle="Manage email suppressions for your organization"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldBan className="h-5 w-5 text-destructive" />
              Suppression List
              <HelpTip text="Emails on this list will never receive campaign emails. Ensures compliance with unsubscribe requests." />
            </CardTitle>
            <CardDescription>
              Emails are automatically added when recipients unsubscribe. You can also manually add or remove entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add email form — admin only */}
            {isAdmin && (
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  className="max-w-sm"
                />
                <Button
                  onClick={handleAdd}
                  disabled={addMutation.isPending || !newEmail.trim()}
                  size="sm"
                  className="gap-1"
                >
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !suppressions?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <MailX className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No suppressed emails yet.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      {isAdmin && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppressions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">{s.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={REASON_COLORS[s.reason] || ''}>
                            {s.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">
                          {s.source.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(s.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setRemoveTarget({ id: s.id, email: s.email })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove suppression?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow <strong>{removeTarget?.email}</strong> to receive campaign emails again. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
