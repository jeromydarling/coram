/**
 * OperatorAnnouncementsPage — Platform-wide announcements CRUD.
 *
 * WHAT: Create/manage announcements visible to all tenants.
 * WHERE: /operator/announcements
 * WHY: Reduce support tickets by communicating changes proactively.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Megaphone, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format } from 'date-fns';

export default function OperatorAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [activeUntil, setActiveUntil] = useState('');

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['operator-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('operator_announcements')
        .insert({
          title,
          body,
          active_until: activeUntil || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Announcement published');
      queryClient.invalidateQueries({ queryKey: ['operator-announcements'] });
      setOpen(false);
      setTitle('');
      setBody('');
      setActiveUntil('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Announcement removed');
      queryClient.invalidateQueries({ queryKey: ['operator-announcements'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isActive = (a: any) =>
    !a.active_until || new Date(a.active_until) > new Date();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Announcements</h1>
            <p className="text-sm text-muted-foreground">Broadcast to all tenants.</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Platform-wide announcements shown to all users.</p>
                <p><strong>Where:</strong> Operator → Announcements.</p>
                <p><strong>Why:</strong> Communicate changes to reduce support load.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance tonight" />
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details about the announcement…" rows={4} />
              </div>
              <div className="space-y-1">
                <Label>Active Until (optional)</Label>
                <Input type="datetime-local" value={activeUntil} onChange={(e) => setActiveUntil(e.target.value)} />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!title || !body || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : announcements?.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {announcements?.map((a) => (
            <Card key={a.id} className={!isActive(a) ? 'opacity-50' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-foreground">{a.title}</p>
                      {isActive(a) ? (
                        <Badge variant="default" className="text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Expired</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Created {format(new Date(a.created_at), 'MMM d, yyyy')}
                      {a.active_until && ` · Expires ${format(new Date(a.active_until), 'MMM d, yyyy HH:mm')}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive"
                    onClick={() => deleteMutation.mutate(a.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
