/**
 * OperatorActivationManager — Guided Activation session management.
 *
 * WHAT: Schedule onboarding sessions, manage checklists, track activation progress.
 * WHERE: /operator/nexus/activation
 * WHY: Centralizes all activation workflows in the Nexus cockpit.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { Calendar, CheckCircle2, Clock, Mail, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OperatorActivationManager() {
  const { activeTab, setActiveTab } = useTabPersistence('sessions');

  // Activation sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
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

  // Activation checklists
  const { data: checklists, isLoading: checklistsLoading } = useQuery({
    queryKey: ['nexus-activation-checklists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activation_checklists')
        .select('*, tenants:tenant_id(name)')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Activation offers
  const { data: offers, isLoading: offersLoading } = useQuery({
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

  const statusBadge = (status: string) => {
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

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">Activation Manager</h1>
        <p className="text-sm text-muted-foreground">
          Schedule onboarding sessions, track checklists, and manage Guided Activation™ workflows.
        </p>
      </div>

      {/* Simple Intake suggestion for early-stage tenants */}
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground font-serif">Simple Intake Suggestion</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                If parts of this organization work primarily by email, enable Simple Intake so notes
                can flow in without new training. Stewards can enable this in their Settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="sessions" className="whitespace-nowrap">Sessions</TabsTrigger>
            <TabsTrigger value="checklists" className="whitespace-nowrap">Checklists</TabsTrigger>
            <TabsTrigger value="offers" className="whitespace-nowrap">Offers</TabsTrigger>
          </TabsList>
        </div>

        {/* Sessions */}
        <TabsContent value="sessions" className="mt-4">
          {sessionsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !sessions?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No activation sessions found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
                        <Calendar className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{(s as any).tenants?.name || 'Unknown tenant'}</p>
                          {statusBadge(s.status)}
                          <Badge variant="outline" className="text-xs">{s.session_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {s.scheduled_at ? `Scheduled: ${new Date(s.scheduled_at).toLocaleString()}` : 'Not yet scheduled'}
                          {s.duration_minutes && ` · ${s.duration_minutes} min`}
                        </p>
                        {s.meet_link && (
                          <a href={s.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                            Join Meeting →
                          </a>
                        )}
                        {s.operator_notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.operator_notes}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Checklists */}
        <TabsContent value="checklists" className="mt-4">
          {checklistsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !checklists?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No checklists found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {checklists.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{(c as any).tenants?.name || 'Unknown tenant'}</p>
                          {statusBadge(c.status)}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground">Readiness: {c.readiness_score}%</p>
                          <div className="flex-1 max-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${c.readiness_score}%` }} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Templates: {(c.template_keys || []).join(', ')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Offers */}
        <TabsContent value="offers" className="mt-4">
          {offersLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : !offers?.length ? (
            <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No activation offers found.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {offers.map((o: any) => (
                <Card key={o.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{(o as any).tenants?.name || 'Unknown tenant'}</p>
                          {statusBadge(o.status)}
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
      </Tabs>
    </div>
  );
}
