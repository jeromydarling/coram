/**
 * OperatorSupportInbox — Centralized support thread viewer.
 *
 * WHAT: Shows feedback_requests with tenant context, QA links, and self-healing prompt generation.
 * WHERE: /operator/nexus/support
 * WHY: Replaces scattered bug routing with a unified operator support view.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Inbox, Bug, Lightbulb, MessageSquare, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useTabPersistence } from '@/hooks/useTabPersistence';

const statusIcons: Record<string, React.ElementType> = {
  open: Clock,
  in_progress: AlertTriangle,
  resolved: CheckCircle2,
  declined: CheckCircle2,
};

const typeIcons: Record<string, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
};

export default function OperatorSupportInbox() {
  const { activeTab, setActiveTab } = useTabPersistence('open');
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data: threads, isLoading } = useQuery({
    queryKey: ['nexus-support-threads', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('feedback_requests')
        .select('*, profiles:user_id(display_name, email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeTab === 'open') {
        query = query.in('status', ['open', 'in_progress']);
      } else if (activeTab === 'resolved') {
        query = query.in('status', ['resolved', 'declined']);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const update: Record<string, any> = { status };
      if (notes) update.admin_notes = notes;
      const { error } = await supabase.from('feedback_requests').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nexus-support-threads'] });
      toast.success('Status updated');
      setExpandedId(null);
    },
  });

  const expand = (id: string, currentNotes?: string) => {
    setExpandedId(expandedId === id ? null : id);
    setAdminNotes(currentNotes || '');
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Support & Care</h1>
        <p className="text-sm text-muted-foreground">Listening when communities raise their hand.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open" className="whitespace-nowrap">Open</TabsTrigger>
          <TabsTrigger value="resolved" className="whitespace-nowrap">Resolved</TabsTrigger>
          <TabsTrigger value="all" className="whitespace-nowrap">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !threads?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No threads in this category.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {threads.map((t: any) => {
                const TypeIcon = typeIcons[t.type] || MessageSquare;
                const StatusIcon = statusIcons[t.status] || Clock;
                const isExpanded = expandedId === t.id;
                const profile = t.profiles;

                return (
                  <Card key={t.id} className={isExpanded ? 'border-primary/30' : ''}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3 cursor-pointer" onClick={() => expand(t.id, t.admin_notes)}>
                        <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
                          <TypeIcon className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                            <Badge variant="outline" className="text-xs capitalize">{t.type}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{t.status}</Badge>
                            <Badge variant="outline" className="text-xs">{t.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {profile?.display_name || profile?.email || 'Unknown user'} · {new Date(t.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-border space-y-3">
                          <div>
                            <p className="text-xs font-medium text-foreground mb-1">Full Description</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-foreground mb-1">Gardener Notes</p>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add notes for internal tracking..."
                              className="text-sm min-h-[80px]"
                            />
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {t.status !== 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'in_progress', notes: adminNotes })}
                              >
                                Mark Triaged
                              </Button>
                            )}
                            {t.status !== 'resolved' && (
                              <Button
                                size="sm"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'resolved', notes: adminNotes })}
                              >
                                Tend to This
                              </Button>
                            )}
                            {t.status !== 'declined' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                disabled={updateStatusMutation.isPending}
                                onClick={() => updateStatusMutation.mutate({ id: t.id, status: 'declined', notes: adminNotes })}
                              >
                                Decline
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
