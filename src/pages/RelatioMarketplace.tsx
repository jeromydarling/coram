/**
 * RelatioMarketplace — Narrative Companion integration hub for CROS.
 *
 * WHAT: Hero card, ChMS companion cards, CRM bridge cards, sync history.
 * WHERE: /:tenantSlug/relatio
 * WHY: Human-first integration — "bring your ministry memory with you."
 */

import { useTranslation } from 'react-i18next';
import { useTenant } from '@/contexts/TenantContext';
import { canUse } from '@/lib/features';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight, Plug, Loader2, History, Heart, HelpCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ConnectorCard } from '@/components/relatio/ConnectorCard';
import { SyncHistoryPanel } from '@/components/relatio/SyncHistoryPanel';
import { useTenantPath } from '@/hooks/useTenantPath';
import { CHMS_CONNECTORS, getConnectorsForArchetype } from '@/lib/connectors/chmsRegistry';
import { getIntegrationVoice } from '@/lib/relatio/integrationVoice';
import { SETUP_GUIDES, getDifficultyLabel, getDifficultyColor } from '@/lib/relatio/setupGuides';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Connector {
  id: string;
  key: string;
  name: string;
  mode: 'one_way' | 'two_way';
  description: string;
  active: boolean;
  category?: string;
  direction?: string;
  icon?: string;
}

interface Connection {
  connector_key: string;
  status: 'connected' | 'disconnected' | 'error';
  updated_at: string;
}

export default function RelatioMarketplace() {
  const { t } = useTranslation('marketing');
  const { tenant, featureFlags, tenantId } = useTenant();
  const { tenantPath } = useTenantPath();
  const navigate = useNavigate();
  const plan = tenant?.tier ?? 'core';
  const hasAccess = canUse('relatio_marketplace', plan, featureFlags['relatio_marketplace'] ?? null);
  const voice = getIntegrationVoice(tenant?.archetype);
  const archetype = tenant?.archetype;

  // ChMS companion connectors for this archetype
  const chmsKeys = getConnectorsForArchetype(archetype);

  // Fetch CRM bridge connectors
  const { data: connectors, isLoading } = useQuery({
    queryKey: ['relatio-connectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_connectors')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data as Connector[];
    },
    enabled: hasAccess,
  });

  // Fetch tenant connections (CRM bridges)
  const { data: connections } = useQuery({
    queryKey: ['relatio-connections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('relatio_connections')
        .select('connector_key, status, updated_at')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data as Connection[];
    },
    enabled: hasAccess && !!tenantId,
  });

  // Fetch companion connections
  const { data: companionConnections } = useQuery({
    queryKey: ['relatio-companion-connections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('relatio_companion_connections')
        .select('connector_key, status, updated_at')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const getConnectionStatus = (key: string) =>
    connections?.find(c => c.connector_key === key)?.status ?? null;

  const getLastImport = (key: string) =>
    connections?.find(c => c.connector_key === key)?.updated_at ?? null;

  const getCompanionStatus = (key: string) => {
    const conn = companionConnections?.find((c: any) => c.connector_key === key);
    return conn?.status ?? null;
  };

  // Gate check
  if (!hasAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle>{t('relatioMarketplace.gate.title')}</CardTitle>
            <CardDescription>
              {t('relatioMarketplace.gate.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/pricing">
              <Button variant="outline" className="rounded-full">
                {t('relatioMarketplace.gate.viewPlans')} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Split CRM connectors
  const connectedKeys = new Set(
    connections?.filter(c => c.status === 'connected').map(c => c.connector_key) ?? []
  );
  const connectedConnectors = connectors?.filter(c => connectedKeys.has(c.key)) ?? [];
  const crmConnectors = connectors?.filter(c => !connectedKeys.has(c.key) && (c.category === 'crm' || !c.category)) ?? [];
  const dataConnectors = connectors?.filter(c => !connectedKeys.has(c.key) && c.category === 'data') ?? [];

  return (
    <div className="p-6 space-y-8">
      {/* Hero Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
        <CardContent className="py-8 px-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-serif">{voice.heroTitle}</h1>
              <p className="text-muted-foreground max-w-xl">{voice.heroSubtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Narrative Companion — ChMS Connectors */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold font-serif">{t('relatioMarketplace.narrativeCompanions')}</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                {t('relatioMarketplace.companionTooltip')}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chmsKeys.map(key => {
            const config = CHMS_CONNECTORS[key];
            if (!config) return null;
            const guide = SETUP_GUIDES[key];
            const status = getCompanionStatus(key);
            const iconKey = config.icon.replace(/-./g, x => x[1].toUpperCase()).replace(/^./, x => x.toUpperCase());
            const IconComponent = (iconKey in LucideIcons
              ? (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconKey]
              : LucideIcons.Plug) || LucideIcons.Plug;

            return (
              <Card key={key} className="relative overflow-hidden transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {guide && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(guide.difficulty)}`}>
                              {getDifficultyLabel(guide.difficulty)}
                            </span>
                          )}
                          {guide && (
                            <span className="text-xs text-muted-foreground">~{guide.estimatedTime}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="text-sm">{config.description}</CardDescription>
                  {status === 'connected' ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        {t('relatioMarketplace.listening')}
                      </span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => navigate(tenantPath(`/relatio/companion/${key}`))}
                      className="rounded-full"
                    >
                      {t('relatioMarketplace.startSetup')} <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Connected CRM Bridges */}
          {connectedConnectors.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold font-serif">{t('relatioMarketplace.connectedBridges')}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {connectedConnectors.map((c) => (
                  <ConnectorCard
                    key={c.key}
                    name={c.name}
                    description={c.description || ''}
                    mode={c.mode}
                    connectorKey={c.key}
                    status={getConnectionStatus(c.key)}
                    lastImportAt={getLastImport(c.key)}
                    onImport={() => navigate(tenantPath(`/relatio/setup/${c.key}`))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* CRM Bridges */}
          {crmConnectors.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold font-serif">{t('relatioMarketplace.crmBridges')}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {crmConnectors.map((c) => (
                  <ConnectorCard
                    key={c.key}
                    name={c.name}
                    description={c.description || ''}
                    mode={c.mode}
                    connectorKey={c.key}
                    status={null}
                    onSetup={() => navigate(tenantPath(`/relatio/setup/${c.key}`))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Data Bridges */}
          {dataConnectors.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold font-serif">{t('relatioMarketplace.dataBridges')}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dataConnectors.map((c) => (
                  <ConnectorCard
                    key={c.key}
                    name={c.name}
                    description={c.description || ''}
                    mode={c.mode}
                    connectorKey={c.key}
                    status={null}
                    onSetup={() => navigate(tenantPath(`/relatio/setup/${c.key}`))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sync History */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold font-serif flex items-center gap-2">
              <History className="h-5 w-5" /> {t('relatioMarketplace.syncHistory')}
            </h2>
            <SyncHistoryPanel limit={10} />
          </section>
        </>
      )}
    </div>
  );
}
