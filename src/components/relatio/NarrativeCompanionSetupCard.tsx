/**
 * NarrativeCompanionSetupCard — Setup card for Narrative Companion Mode.
 *
 * WHAT: Guides tenant through connecting their ChMS as a silent companion.
 * WHERE: Guided Activation flow, Settings → Integrations.
 * WHY: CROS listens alongside existing systems — never replaces them.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Headphones, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { getCompanionCopy } from '@/content/narrativeCompanionCopy';
import { CHMS_CONNECTORS, getConnectorsForArchetype, type ChmsConnectorConfig } from '@/lib/connectors/chmsRegistry';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface NarrativeCompanionSetupCardProps {
  archetype?: string | null;
  onDismiss?: () => void;
  compact?: boolean;
}

export function NarrativeCompanionSetupCard({
  archetype,
  onDismiss,
  compact = false,
}: NarrativeCompanionSetupCardProps) {
  const { tenant } = useTenant();
  const copy = getCompanionCopy(archetype);
  const availableKeys = getConnectorsForArchetype(archetype);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Fetch existing connections
  const { data: connections } = useQuery({
    queryKey: ['companion-connections', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_companion_connections')
        .select('connector_key, status')
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
      return (data ?? []) as { connector_key: string; status: string }[];
    },
  });

  const connectedKeys = new Set(connections?.filter(c => c.status === 'listening').map(c => c.connector_key) ?? []);

  const handleConnect = async (key: string) => {
    if (!tenant?.id) return;
    const connector = CHMS_CONNECTORS[key];
    if (!connector) return;

    // For now, create the connection record in "listening" state
    // Real API key collection would happen via secrets flow
    const { error } = await supabase
      .from('relatio_companion_connections')
      .upsert({
        tenant_id: tenant.id,
        connector_key: key,
        status: 'listening',
        auth_method: connector.auth,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        config: {},
      }, { onConflict: 'tenant_id,connector_key' });

    if (error) {
      toast.error('Could not connect — please try again.');
      return;
    }
    toast.success(`${connector.label} is now listening quietly.`);
    setSelectedKey(null);
  };

  if (compact) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Headphones className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{copy.headline}</p>
              <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={() => setSelectedKey('show')}>
              Connect <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{copy.headline}</CardTitle>
            <CardDescription>{copy.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground italic">
          {copy.setupPrompt}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {availableKeys.map((key) => {
            const connector = CHMS_CONNECTORS[key];
            if (!connector) return null;
            const isConnected = connectedKeys.has(key);

            return (
              <div
                key={key}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{connector.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{connector.description}</p>
                </div>
                {isConnected ? (
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    {copy.listeningLabel}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 rounded-full"
                    onClick={() => handleConnect(key)}
                  >
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {onDismiss && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onDismiss} className="text-muted-foreground">
              <Clock className="mr-1 h-3 w-3" />
              Maybe Later
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
