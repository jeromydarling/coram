/**
 * CaregiverNetworkPage — Opt-in caregiver companion network.
 *
 * WHAT: Privacy-first network for caregivers to discover and message each other.
 * WHERE: /:tenantSlug/communio/caregiver-network
 * WHY: Companionship and practical support between caregivers, mediated by platform.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Heart } from 'lucide-react';
import NetworkPresenceCard from '@/components/caregiver-network/NetworkPresenceCard';
import BrowsePanel from '@/components/caregiver-network/BrowsePanel';
import RequestsPanel from '@/components/caregiver-network/RequestsPanel';
import MessagesPanel from '@/components/caregiver-network/MessagesPanel';
import { useCaregiverProfile } from '@/hooks/useCaregiverNetwork';
import { useTenant } from '@/contexts/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';

export default function CaregiverNetworkPage() {
  const { t } = useTranslation('narrative');
  const { tenant } = useTenant();
  const { tenantPath } = useTenantPath();
  const { data: profile } = useCaregiverProfile();
  const isOptedIn = profile?.network_opt_in && !profile?.hidden_at;
  const [activeTab, setActiveTab] = useState('presence');

  // Gate: only caregiver archetypes may access
  const isCaregiverTenant = tenant?.archetype === 'caregiver_solo' || tenant?.archetype === 'caregiver_agency';
  if (!isCaregiverTenant) {
    return <Navigate to={tenantPath('/communio')} replace />;
  }

  return (
    <MainLayout title={t('caregiverNetwork.title')} subtitle={t('caregiverNetwork.subtitle')}>
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Safety notice */}
      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground border">
        <p className="font-medium text-foreground mb-0.5">🤝 {t('caregiverNetwork.safetyTitle')}</p>
        <p>{t('caregiverNetwork.safetyMessage')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="presence">{t('caregiverNetwork.tabs.presence')}</TabsTrigger>
          <TabsTrigger value="browse" disabled={!isOptedIn}>{t('caregiverNetwork.tabs.browse')}</TabsTrigger>
          <TabsTrigger value="requests" disabled={!isOptedIn}>{t('caregiverNetwork.tabs.requests')}</TabsTrigger>
          <TabsTrigger value="messages" disabled={!isOptedIn}>{t('caregiverNetwork.tabs.messages')}</TabsTrigger>
        </TabsList>

        <TabsContent value="presence">
          <NetworkPresenceCard />
        </TabsContent>

        <TabsContent value="browse">
          <BrowsePanel />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsPanel />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesPanel />
        </TabsContent>
      </Tabs>
    </div>
    </MainLayout>
  );
}
