/**
 * OperatorActivationPage — Unified Guided Activation hub.
 *
 * WHAT: Tenant readiness, checklists, impersonation, sessions, and offers.
 * WHERE: /operator/activation
 * WHY: Single pane of glass for all activation workflows.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVigiliaActivation } from '@/hooks/useVigilia';
import { VigiliaCard } from '@/components/operator/vigilia/VigiliaCard';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  ClipboardList,
  Eye,
  Loader2,
  LogIn,
  Mail,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { format, formatDistanceToNow } from 'date-fns';

type TenantActivation = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  archetype: string | null;
  tier: string;
  offer_status: string | null;
  consent_granted: boolean;
  checklist_status: string | null;
  readiness_score: number;
  sessions_total: number;
  sessions_remaining: number;
  session_status: string | null;
  scheduled_at: string | null;
};

export default function OperatorActivationPage() {
  const queryClient = useQueryClient();
  const { startImpersonation } = useImpersonation();
  const { data: activationWatch, isLoading: watchLoading } = useVigiliaActivation();
  const { activeTab, setActiveTab } = useTabPersistence('tenants');
  const [impersonateModal, setImpersonateModal] = useState<TenantActivation | null>(null);
  const [reason, setReason] = useState('Guided Activation session');
  const [checklistModal, setChecklistModal] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState<string | null>(null);

  // Aggregate view of all tenants with activation data
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['operator-activation-tenants'],
    queryFn: async () => {
      const { data: allTenants, error } = await supabase
        .from('tenants')
        .select('id, name, slug, archetype, tier')
        .order('name');
      if (error) throw error;

      const { data: offers } = await supabase.from('activation_offers').select('tenant_id, status, consent_granted');
      const { data: checklists } = await supabase.from('activation_checklists').select('tenant_id, status, readiness_score');
      const { data: sessions } = await supabase
        .from('activation_sessions')
        .select('tenant_id, sessions_total, sessions_remaining, status, scheduled_at')
        .in('status', ['pending', 'scheduled']);

      const offerMap = new Map((offers ?? []).map((o: any) => [o.tenant_id, o]));
      const checklistMap = new Map((checklists ?? []).map((c: any) => [c.tenant_id, c]));
      const sessionMap = new Map((sessions ?? []).map((s: any) => [s.tenant_id, s]));

      return (allTenants ?? [])
        .filter((t: any) => offerMap.has(t.id) || checklistMap.has(t.id) || sessionMap.has(t.id))
        .map((t: any) => {
          const offer = offerMap.get(t.id);
          const cl = checklistMap.get(t.id);
          const sess = sessionMap.get(t.id);
          return {
            tenant_id: t.id, tenant_name: t.name, tenant_slug: t.slug,
            archetype: t.archetype, tier: t.tier,
            offer_status: offer?.status ?? null, consent_granted: offer?.consent_granted ?? false,
            checklist_status: cl?.status ?? null, readiness_score: cl?.readiness_score ?? 0,
            sessions_total: sess?.sessions_total ?? 0, sessions_remaining: sess?.sessions_remaining ?? 0,
            session_status: sess?.status ?? null, scheduled_at: sess?.scheduled_at ?? null,
          } as TenantActivation;
        });
    },
  });

  // Sessions (from ActivationManager)
  const { data: allSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['nexus-activation-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_sessions')
        .select('*, tenants:tenant_id(name)')
        .order('scheduled_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Offers (from ActivationManager)
  const { data: allOffers, isLoading: offersLoading } = useQuery({
    queryKey: ['nexus-activation-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_offers')
        .select('*, tenants:tenant_id(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Checklist items
  const { data: checklistItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['operator-checklist-items', checklistModal],
    enabled: !!checklistModal,
    queryFn: async () => {
      const { data: cl } = await supabase.from('activation_checklists').select('id').eq('tenant_id', checklistModal!).maybeSingle();
      if (!cl) return [];
      const { data } = await supabase.from('activation_checklist_items').select('*').eq('checklist_id', cl.id).order('category').order('required', { ascending: false });
      return data ?? [];
    },
  });

  // Audit log
  const { data: auditLog } = useQuery({
    queryKey: ['operator-impersonation-audit'],
    queryFn: async () => {
      const { data } = await supabase
        .from('impersonation_sessions')
        .select('*, profiles!impersonation_sessions_admin_user_id_fkey(display_name)')
        .order('started_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const handleBootstrap = async (tenantId: string) => {
    setBootstrapLoading(tenantId);
    try {
      const { data, error } = await supabase.functions.invoke('activation-bootstrap', { body: { tenant_id: tenantId } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Bootstrap failed');
      toast.success(`Checklist created (${data.item_count} items, ${data.readiness_score}% ready)`);
      queryClient.invalidateQueries({ queryKey: ['operator-activation-tenants'] });
    } catch (e: any) { toast.error(e.message); }
    setBootstrapLoading(null);
  };

  const handleImpersonate = async () => {
    if (!impersonateModal) return;
    const ok = await startImpersonation(impersonateModal.tenant_id, '', reason);
    if (ok) setImpersonateModal(null);
  };

  const pending = (tenants ?? []).filter(t => t.checklist_status === 'not_started' || t.checklist_status === 'in_progress' || t.checklist_status === 'blocked');
  const ready = (tenants ?? []).filter(t => t.checklist_status === 'ready');
  const all = tenants ?? [];

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'ready': return <Badge variant="default" className="text-[10px]">Ready</Badge>;
      case 'blocked': return <Badge variant="destructive" className="text-[10px]">Needs Help</Badge>;
      case 'in_progress': return <Badge variant="secondary" className="text-[10px]">In Progress</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Not Started</Badge>;
    }
  };

  const sessionStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      complete: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      cancelled: 'bg-muted text-muted-foreground',
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    };
    return <Badge variant="outline" className={`text-xs capitalize ${colors[status] || ''}`}>{status}</Badge>;
  };

  const TenantRow = ({ t }: { t: TenantActivation }) => (
    <div className="flex items-start justify-between gap-3 p-4 border border-border rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm truncate">{t.tenant_name}</span>
          {statusBadge(t.checklist_status)}
          {t.consent_granted && (
            <Badge variant="outline" className="text-[9px] text-green-600 border-green-300">
              <Eye className="h-2.5 w-2.5 mr-0.5" /> Consent
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>{t.tier} · {t.archetype?.replace(/_/g, ' ') ?? 'No archetype'}</p>
          {t.readiness_score > 0 && (
            <div className="flex items-center gap-2">
              <Progress value={t.readiness_score} className="h-1.5 w-20" />
              <span>{t.readiness_score}%</span>
            </div>
          )}
          {t.scheduled_at && (
            <p className="flex items-center gap-1 text-foreground">
              <Clock className="h-3 w-3" />
              Scheduled: {format(new Date(t.scheduled_at), 'MMM d, h:mm a')}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {!t.checklist_status && (
          <Button size="sm" variant="outline" onClick={() => handleBootstrap(t.tenant_id)} disabled={bootstrapLoading === t.tenant_id}>
            {bootstrapLoading === t.tenant_id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ClipboardList className="mr-1 h-3 w-3" />}
            Create Checklist
          </Button>
        )}
        {t.checklist_status && (
          <Button size="sm" variant="outline" onClick={() => setChecklistModal(t.tenant_id)}>
            <ClipboardList className="mr-1 h-3 w-3" /> View Checklist
          </Button>
        )}
        {t.consent_granted && (
          <Button size="sm" variant="default" onClick={() => { setImpersonateModal(t); setReason('Guided Activation session'); }}>
            <LogIn className="mr-1 h-3 w-3" /> Enter Tenant
          </Button>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Guided Activation</h1>
        <p className="text-sm text-muted-foreground">
          Track tenant readiness, manage sessions and offers, and enter tenants for setup.
        </p>
      </div>

      <VigiliaCard
        title="Communities Needing Care"
        highlights={[{ text: activationWatch?.highlight ?? 'Checking on communities…', category: 'activation' as const }]}
        isLoading={watchLoading}
        compact
        helpText="Vigilia watches for quiet tenants who may benefit from a gentle check-in."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="py-4 text-center"><div className="text-2xl font-bold">{all.length}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><div className="text-2xl font-bold text-amber-600">{pending.length}</div><div className="text-xs text-muted-foreground">Preparing</div></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><div className="text-2xl font-bold text-green-600">{ready.length}</div><div className="text-xs text-muted-foreground">Ready</div></CardContent></Card>
        <Card><CardContent className="py-4 text-center"><div className="text-2xl font-bold">{all.filter(t => t.consent_granted).length}</div><div className="text-xs text-muted-foreground">Consent Granted</div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="tenants" className="whitespace-nowrap">Tenants ({all.length})</TabsTrigger>
            <TabsTrigger value="sessions" className="whitespace-nowrap">Sessions</TabsTrigger>
            <TabsTrigger value="offers" className="whitespace-nowrap">Offers</TabsTrigger>
            <TabsTrigger value="audit" className="whitespace-nowrap">Audit Log</TabsTrigger>
          </TabsList>
        </div>

        {/* Tenants (original sub-tabs as sections) */}
        <TabsContent value="tenants" className="space-y-4 mt-3">
          <Tabs defaultValue="preparing">
            <TabsList>
              <TabsTrigger value="preparing">Preparing ({pending.length})</TabsTrigger>
              <TabsTrigger value="ready">Ready ({ready.length})</TabsTrigger>
              <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="preparing" className="space-y-3 mt-3">
              {pending.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No tenants currently preparing</p> : pending.map(t => <TenantRow key={t.tenant_id} t={t} />)}
            </TabsContent>
            <TabsContent value="ready" className="space-y-3 mt-3">
              {ready.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No tenants ready yet</p> : ready.map(t => <TenantRow key={t.tenant_id} t={t} />)}
            </TabsContent>
            <TabsContent value="all" className="space-y-3 mt-3">
              {all.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No activation data yet</p> : all.map(t => <TenantRow key={t.tenant_id} t={t} />)}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Sessions (from ActivationManager) */}
        <TabsContent value="sessions" className="mt-4">
          {sessionsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !allSessions?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No activation sessions found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {allSessions.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5"><Calendar className="w-4 h-4 text-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{(s as any).tenants?.name || 'Unknown tenant'}</p>
                          {sessionStatusBadge(s.status)}
                          <Badge variant="outline" className="text-xs">{s.session_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.scheduled_at ? `Scheduled: ${new Date(s.scheduled_at).toLocaleString()}` : 'Not yet scheduled'}
                          {s.duration_minutes && ` · ${s.duration_minutes} min`}
                        </p>
                        {s.meet_link && <a href={s.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">Join Meeting →</a>}
                        {s.operator_notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.operator_notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Offers (from ActivationManager) */}
        <TabsContent value="offers" className="mt-4">
          {offersLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !allOffers?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No activation offers found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {allOffers.map((o: any) => (
                <Card key={o.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5"><Sparkles className="w-4 h-4 text-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{(o as any).tenants?.name || 'Unknown tenant'}</p>
                          {sessionStatusBadge(o.status)}
                          {o.consent_granted && <Badge variant="outline" className="text-xs text-green-700 dark:text-green-300">Consent Granted</Badge>}
                        </div>
                        {o.scheduled_start && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(o.scheduled_start).toLocaleString()}
                            {o.scheduled_end && ` — ${new Date(o.scheduled_end).toLocaleTimeString()}`}
                          </p>
                        )}
                        {o.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Gardener Sessions</CardTitle>
              <CardDescription>Last 20 impersonation sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {!auditLog?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No sessions yet</p>
              ) : (
                <div className="space-y-2">
                  {auditLog.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between text-xs border rounded-md p-2">
                      <div>
                        <span className="font-medium">{(log.profiles as any)?.display_name ?? 'Admin'}</span>
                        <span className="text-muted-foreground"> → tenant </span>
                        <span className="font-mono text-[10px]">{log.tenant_id?.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === 'active' ? 'default' : 'outline'} className="text-[9px]">{log.status}</Badge>
                        <span className="text-muted-foreground">{formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Checklist Detail Modal */}
      <Dialog open={!!checklistModal} onOpenChange={(o) => !o && setChecklistModal(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Checklist Detail</DialogTitle></DialogHeader>
          {itemsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {(checklistItems ?? []).map((item: any) => (
                <div key={item.id} className="flex items-start gap-2 text-sm p-2 border rounded">
                  {item.completed ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> : item.required ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" /> : <div className="h-4 w-4 border rounded mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className={item.completed ? 'text-muted-foreground line-through' : ''}>{item.label}</p>
                    {item.notes && <p className="text-xs text-amber-600 mt-0.5">Note: {item.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Impersonation Modal */}
      <Dialog open={!!impersonateModal} onOpenChange={(o) => !o && setImpersonateModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-primary" /> Enter Tenant as Admin</DialogTitle>
            <DialogDescription>You will view <strong>{impersonateModal?.tenant_name}</strong> as their admin. This session is fully audited and time-limited to 60 minutes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Reason (required)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why are you entering this tenant?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateModal(null)}>Cancel</Button>
            <Button onClick={handleImpersonate} disabled={!reason.trim()}>
              <LogIn className="mr-2 h-4 w-4" /> Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
