import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Sparkles, UsersRound, Radio, Calendar, Plus, HeartPulse, TrendingUp, Shield, MessageCircle } from 'lucide-react';
import { CommunioGroupCard } from '@/components/communio/CommunioGroupCard';
import { CommunioSignalCard } from '@/components/communio/CommunioSignalCard';
import { CommunioNarrativePulse } from '@/components/communio/CommunioNarrativePulse';
import { CommunioNetworkTrends } from '@/components/communio/CommunioNetworkTrends';
import { CommunioPendingInvites } from '@/components/communio/CommunioPendingInvites';
import { CommunioInviteFlow } from '@/components/communio/CommunioInviteFlow';
import { CommunioGroupSettingsPanel } from '@/components/communio/CommunioGroupSettingsPanel';
import { CommunioGovernanceReview } from '@/components/communio/CommunioGovernanceReview';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import CommunioSoftInvite from '@/components/communio/CommunioSoftInvite';
import CommunioRequestsTab from '@/components/communio/CommunioRequestsTab';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';

export default function Communio() {
  const { t } = useTranslation('narrative');
  const { tenant } = useTenant();
  const { tenantPath } = useTenantPath();
  const { isSteward, isAdmin } = useAuth();
  const tenantId = tenant?.id;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: hasProfile } = useQuery({
    queryKey: ['communio-has-profile', tenantId],
    queryFn: async () => {
      if (!tenantId) return false;
      const { data } = await supabase
        .from('communio_public_profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!tenantId,
  });

  // Fetch groups the tenant belongs to
  const { data: memberships, isLoading: groupsLoading } = useQuery({
    queryKey: ['communio-memberships', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('communio_memberships')
        .select(`
          id,
          sharing_level,
          group_id,
          communio_groups (
            id,
            name,
            description,
            created_by_tenant
          )
        `)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch shared signals from joined groups
  const groupIds = memberships?.map(m => m.group_id) || [];
  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['communio-signals', groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data, error } = await supabase
        .from('communio_shared_signals')
        .select('id, signal_type, signal_summary, created_at, metro_id')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: groupIds.length > 0,
  });

  // Fetch shared events
  const { data: sharedEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['communio-events', groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data, error } = await supabase
        .from('communio_shared_events')
        .select('id, event_id, visibility, created_at, tenant_id')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: groupIds.length > 0,
  });

  // Member count per group
  const { data: memberCounts } = useQuery({
    queryKey: ['communio-member-counts', groupIds],
    queryFn: async () => {
      if (!groupIds.length) return {};
      const counts: Record<string, number> = {};
      for (const gid of groupIds) {
        const { count } = await supabase
          .from('communio_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', gid);
        counts[gid] = count || 0;
      }
      return counts;
    },
    enabled: groupIds.length > 0,
  });

  // Group settings for the selected group
  const { data: groupSettings } = useQuery({
    queryKey: ['communio-group-settings', selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return null;
      const { data, error } = await supabase
        .from('communio_group_settings')
        .select('*')
        .eq('group_id', selectedGroupId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGroupId,
  });

  const hasGroups = memberships && memberships.length > 0;

  // Determine if current tenant created the selected group
  const selectedMembership = memberships?.find(m => m.group_id === selectedGroupId);
  const selectedGroup = selectedMembership?.communio_groups as any;
  const isCreator = selectedGroup?.created_by_tenant === tenantId;

  return (
    <MainLayout title={t('communio.title')} subtitle={t('communio.subtitle')} data-testid="communio-root">
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Soft invite banner for stewards */}
      <CommunioSoftInvite isSteward={isSteward || isAdmin} />

      {/* Pending invites */}
      <CommunioPendingInvites />

      {/* Directory profile discovery card */}
      {!hasProfile && (
        <Card className="rounded-xl border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('communio.profileBanner.message')}</p>
              <p className="text-xs text-muted-foreground">
                {t('communio.profileBanner.description')}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={tenantPath('/settings/communio-profile')}>{t('communio.profileBanner.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!hasGroups && !groupsLoading ? (
        <Card className="rounded-xl text-center py-12">
          <CardContent className="space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-accent/50 flex items-center justify-center">
              <UsersRound className="h-7 w-7 text-accent-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{t('communio.noGroups.heading')}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto font-serif leading-relaxed">
                {t('communio.noGroups.description')}
              </p>
            </div>
            <Button className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              {t('communio.noGroups.cta')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="groups">
          <TabsList className="flex-wrap">
            <TabsTrigger value="groups" className="gap-1.5">
              <UsersRound className="h-4 w-4" />
              {t('communio.tabs.myGroups')}
            </TabsTrigger>
            <TabsTrigger value="pulse" className="gap-1.5">
              <HeartPulse className="h-4 w-4" />
              {t('communio.tabs.sharedPulse')}
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              {t('communio.tabs.networkTrends')}
            </TabsTrigger>
            <TabsTrigger value="signals" className="gap-1.5">
              <Radio className="h-4 w-4" />
              {t('communio.tabs.sharedSignals')}
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              {t('communio.tabs.collaboration')}
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-1.5">
              <Shield className="h-4 w-4" />
              {t('communio.tabs.governance')}
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5">
              <MessageCircle className="h-4 w-4" />
              {t('communio.tabs.requests')}
            </TabsTrigger>
          </TabsList>

          {/* Groups Tab */}
          <TabsContent value="groups" className="mt-4 space-y-4">
            {memberships?.map(m => {
              const group = m.communio_groups as any;
              return (
                <div
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedGroupId(prev => prev === m.group_id ? null : m.group_id)}
                >
                  <CommunioGroupCard
                    name={group?.name || 'Unknown Group'}
                    description={group?.description}
                    memberCount={memberCounts?.[m.group_id] || 0}
                    sharingLevel={m.sharing_level}
                  />
                </div>
              );
            })}

            {/* Selected group detail */}
            {selectedGroupId && (
              <div className="space-y-4 pt-2">
                {groupSettings && (
                  <CommunioGroupSettingsPanel
                    settings={groupSettings as any}
                    isCreator={isCreator}
                  />
                )}
                {isCreator && (
                  <CommunioInviteFlow groupId={selectedGroupId} />
                )}
              </div>
            )}
          </TabsContent>

          {/* Shared Pulse Tab */}
          <TabsContent value="pulse" className="mt-4">
            <CommunioNarrativePulse groupIds={groupIds} />
          </TabsContent>

          {/* Network Trends Tab */}
          <TabsContent value="trends" className="mt-4">
            <CommunioNetworkTrends groupIds={groupIds} />
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="mt-4 space-y-3">
            {signalsLoading ? (
              <p className="text-sm text-muted-foreground">{t('communio.signals.loading')}</p>
            ) : signals && signals.length > 0 ? (
              signals.map(s => (
                <CommunioSignalCard
                  key={s.id}
                  signalType={s.signal_type}
                  signalSummary={s.signal_summary}
                  createdAt={s.created_at}
                />
              ))
            ) : (
              <Card className="rounded-xl">
                <CardContent className="py-8 text-center">
                  <Sparkles className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground font-serif">
                    {t('communio.signals.empty')}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Collaboration Tab */}
          <TabsContent value="events" className="mt-4 space-y-3">
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">{t('communio.events.loading')}</p>
            ) : sharedEvents && sharedEvents.length > 0 ? (
              sharedEvents.map(e => (
                <Card key={e.id} className="rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-sm">{t('communio.events.sharedEvent')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('communio.events.visibility', { level: e.visibility })}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="rounded-xl">
                <CardContent className="py-8 text-center">
                  <Calendar className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground font-serif">
                    {t('communio.events.empty')}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance" className="mt-4">
            <CommunioGovernanceReview groupIds={groupIds} />
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="mt-4">
            <CommunioRequestsTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
    </MainLayout>
  );
}
