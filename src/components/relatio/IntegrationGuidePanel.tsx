/**
 * IntegrationGuidePanel — TurboTax-style guided setup for ChMS connectors.
 *
 * WHAT: Step-by-step panel with progress tracker, copy buttons, encouragement.
 * WHERE: /:tenantSlug/relatio/companion/:connectorKey
 * WHY: Makes ChMS integration feel empowering, not technical.
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Copy, Heart, Loader2, HelpCircle, Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { supabase } from '@/integrations/supabase/client';
import { CHMS_CONNECTORS } from '@/lib/connectors/chmsRegistry';
import { SETUP_GUIDES, getDifficultyLabel, getDifficultyColor } from '@/lib/relatio/setupGuides';
import { getIntegrationVoice } from '@/lib/relatio/integrationVoice';
import { GuidedSetupHandRaise } from './GuidedSetupHandRaise';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function IntegrationGuidePanel() {
  const { connectorKey } = useParams<{ connectorKey: string }>();
  const { tenant, tenantId } = useTenant();
  const { user } = useAuth();
  const { tenantPath } = useTenantPath();
  const navigate = useNavigate();
  const voice = getIntegrationVoice(tenant?.archetype);

  const connector = connectorKey ? CHMS_CONNECTORS[connectorKey] : null;
  const guide = connectorKey ? SETUP_GUIDES[connectorKey] : null;

  const [currentStep, setCurrentStep] = useState(0);
  const [credentials, setCredentials] = useState({ key: '', secret: '', url: '', churchCode: '', portalUser: '', portalPass: '', baseId: '', tableName: '', portalId: '', orgId: '', authCode: '' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  if (!connector || !guide || !connectorKey) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Connector not found.</p>
            <Button variant="outline" onClick={() => navigate(tenantPath('/relatio'))} className="mt-4 rounded-full">
              Back to Relatio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = guide.steps.length;
  const step = guide.steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isCredentialStep = currentStep === totalSteps - 2; // Step before confirm
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleConnect = async () => {
    if (!tenantId) return;
    setIsConnecting(true);
    try {
      const { error } = await supabase.from('relatio_companion_connections').upsert([{
        tenant_id: tenantId,
        connector_key: connectorKey,
        status: 'connected',
        created_by: user?.id ?? '',
        config: {
          api_key: credentials.key || undefined,
          client_secret: credentials.secret || undefined,
          base_url: credentials.url || undefined,
          base_id: credentials.baseId || undefined,
          table_name: credentials.tableName || undefined,
          portal_id: credentials.portalId || undefined,
          church_code: credentials.churchCode || undefined,
          org_id: credentials.orgId || undefined,
          auth_code: credentials.authCode || undefined,
        },
      }], { onConflict: 'tenant_id,connector_key' });

      if (error) throw error;
      setConnected(true);
      toast.success(`${connector.label} is now listening alongside CROS.`);
    } catch {
      toast.error('Could not connect. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {currentStep + 1} of {totalSteps}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getDifficultyColor(guide.difficulty)}`}>
              {getDifficultyLabel(guide.difficulty)}
            </span>
            <span>~{guide.estimatedTime}</span>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Connector label */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Narrative Companion — {connector.label}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{voice.companionMessage}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Step card */}
      {!connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{step.title}</CardTitle>
            <CardDescription>{step.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Screenshot */}
            {step.screenshotPath && (
              <div className="rounded-xl border overflow-hidden bg-muted/20">
                <img
                  src={step.screenshotPath}
                  alt={step.screenshotCaption || `${connector.label} setup screenshot`}
                  className="w-full object-contain max-h-[360px]"
                  loading="lazy"
                />
                {step.screenshotCaption && (
                  <p className="text-xs text-muted-foreground p-3 border-t bg-muted/30 italic">
                    {step.screenshotCaption}
                  </p>
                )}
              </div>
            )}

            {/* Tip callout */}
            {step.tip && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{step.tip}</p>
              </div>
            )}

            {/* Note / warning callout */}
            {step.note && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{step.note}</p>
              </div>
            )}

            {/* Copyable text */}
            {step.copyableText && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border">
                <code className="text-sm flex-1 min-w-0 truncate">{step.copyableText}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(step.copyableText!)}
                  className="flex-shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Credential inputs (on credential step) */}
            {isCredentialStep && (
              <div className="space-y-3">
                {/* Salesforce: Consumer Key + Consumer Secret + Instance URL */}
                {connectorKey === 'salesforce' && (
                  <>
                    <Input
                      placeholder="Consumer Key (Client ID)"
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                    <Input
                      placeholder="Consumer Secret (Client Secret)"
                      type="password"
                      value={credentials.secret}
                      onChange={e => setCredentials(p => ({ ...p, secret: e.target.value }))}
                    />
                    <Input
                      placeholder="Instance URL (e.g. https://mychurch.my.salesforce.com)"
                      value={credentials.url}
                      onChange={e => setCredentials(p => ({ ...p, url: e.target.value }))}
                    />
                  </>
                )}

                {/* HubSpot: Access Token + Portal ID */}
                {connectorKey === 'hubspot' && (
                  <>
                    <Input
                      placeholder="Access Token (starts with pat-na-)"
                      type="password"
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                    <Input
                      placeholder="Portal ID (optional — 8-digit number from URL)"
                      value={credentials.portalId}
                      onChange={e => setCredentials(p => ({ ...p, portalId: e.target.value }))}
                    />
                  </>
                )}

                {/* Airtable: PAT + Base ID + Table Name */}
                {connectorKey === 'airtable' && (
                  <>
                    <Input
                      placeholder="Personal Access Token (starts with pat...)"
                      type="password"
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                    <Input
                      placeholder="Base ID (starts with app...)"
                      value={credentials.baseId}
                      onChange={e => setCredentials(p => ({ ...p, baseId: e.target.value }))}
                    />
                    <Input
                      placeholder="Table Name (e.g. Contacts)"
                      value={credentials.tableName}
                      onChange={e => setCredentials(p => ({ ...p, tableName: e.target.value }))}
                    />
                  </>
                )}

                {/* Generic ChMS connectors (existing logic) */}
                {!['salesforce', 'hubspot', 'airtable', 'bloomerang', 'neoncrm', 'lgl', 'donorperfect', 'kindful', 'zoho'].includes(connectorKey) && (
                  <>
                    <Input
                      placeholder={connector.auth === 'oauth2' ? 'Client ID' : connector.auth === 'oauth1' ? 'Consumer Key' : 'API Key'}
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                    {(connector.auth === 'oauth2' || connector.auth === 'oauth1') && (
                      <Input
                        placeholder={connector.auth === 'oauth1' ? 'Consumer Secret' : 'Client Secret'}
                        type="password"
                        value={credentials.secret}
                        onChange={e => setCredentials(p => ({ ...p, secret: e.target.value }))}
                      />
                    )}
                    {(connectorKey === 'rock' || connectorKey === 'ministryplatform') && (
                      <Input
                        placeholder={connectorKey === 'rock' ? 'Rock RMS URL (e.g. https://rock.mychurch.org)' : 'API URL (e.g. https://mychurch.ministryplatform.com/ministryplatformapi)'}
                        value={credentials.url}
                        onChange={e => setCredentials(p => ({ ...p, url: e.target.value }))}
                      />
                    )}
                    {connectorKey === 'fellowshipone' && (
                      <>
                        <Input
                          placeholder="Church Code (e.g. mychurch)"
                          value={credentials.churchCode}
                          onChange={e => setCredentials(p => ({ ...p, churchCode: e.target.value }))}
                        />
                        <Input
                          placeholder="Portal Username"
                          value={credentials.portalUser}
                          onChange={e => setCredentials(p => ({ ...p, portalUser: e.target.value }))}
                        />
                        <Input
                          placeholder="Portal Password"
                          type="password"
                          value={credentials.portalPass}
                          onChange={e => setCredentials(p => ({ ...p, portalPass: e.target.value }))}
                        />
                      </>
                    )}
                    {connectorKey === 'breeze' && (
                      <Input
                        placeholder="Subdomain (e.g. calvary)"
                        value={credentials.url}
                        onChange={e => setCredentials(p => ({ ...p, url: e.target.value }))}
                      />
                    )}
                  </>
                )}

                {/* Bloomerang: just API Key */}
                {connectorKey === 'bloomerang' && (
                  <Input
                    placeholder="Private API Key"
                    type="password"
                    value={credentials.key}
                    onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                  />
                )}

                {/* NeonCRM: Org ID + API Key */}
                {connectorKey === 'neoncrm' && (
                  <>
                    <Input
                      placeholder="Organization ID"
                      value={credentials.orgId}
                      onChange={e => setCredentials(p => ({ ...p, orgId: e.target.value }))}
                    />
                    <Input
                      placeholder="API Key"
                      type="password"
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                  </>
                )}

                {/* Little Green Light: just API Key */}
                {connectorKey === 'lgl' && (
                  <Input
                    placeholder="API Key"
                    type="password"
                    value={credentials.key}
                    onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                  />
                )}

                {/* DonorPerfect: just API Key */}
                {connectorKey === 'donorperfect' && (
                  <Input
                    placeholder="API Key"
                    type="password"
                    value={credentials.key}
                    onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                  />
                )}

                {/* Kindful: App Token + Subdomain */}
                {connectorKey === 'kindful' && (
                  <>
                    <Input
                      placeholder="Application Token"
                      type="password"
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                    <Input
                      placeholder="Subdomain (e.g. yourorg)"
                      value={credentials.url}
                      onChange={e => setCredentials(p => ({ ...p, url: e.target.value }))}
                    />
                  </>
                )}

                {/* Zoho CRM: Client ID + Client Secret + Auth Code */}
                {connectorKey === 'zoho' && (
                  <>
                    <Input
                      placeholder="Client ID"
                      value={credentials.key}
                      onChange={e => setCredentials(p => ({ ...p, key: e.target.value }))}
                    />
                    <Input
                      placeholder="Client Secret"
                      type="password"
                      value={credentials.secret}
                      onChange={e => setCredentials(p => ({ ...p, secret: e.target.value }))}
                    />
                    <Input
                      placeholder="Authorization Code (from API Console)"
                      value={credentials.authCode}
                      onChange={e => setCredentials(p => ({ ...p, authCode: e.target.value }))}
                    />
                  </>
                )}
              </div>
            )}

            {/* Confirm + Connect on last step */}
            {isLastStep && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <Heart className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm">{voice.companionMessage}</p>
              </div>
            )}

            {/* Encouragement */}
            {step.encouragement && (
              <p className="text-sm italic text-muted-foreground">{step.encouragement}</p>
            )}

            {/* Navigation */}
            <div className="flex gap-2 pt-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)} className="rounded-full">
                  <ArrowLeft className="mr-1 h-3 w-3" /> Back
                </Button>
              )}
              {currentStep === 0 && (
                <Button variant="outline" onClick={() => navigate(tenantPath('/relatio'))} className="rounded-full">
                  <ArrowLeft className="mr-1 h-3 w-3" /> Back
                </Button>
              )}

              {isLastStep ? (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || !credentials.key}
                  className="rounded-full"
                >
                  {isConnecting ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Connecting…</>
                  ) : (
                    <>Connect</>
                  )}
                </Button>
              ) : (
                <Button onClick={() => setCurrentStep(s => s + 1)} className="rounded-full">
                  Continue <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Success state */
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{connector.label} Connected</CardTitle>
                <CardDescription>
                  CROS is now listening alongside your system.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-muted/50">
                <p className="text-muted-foreground text-xs">Status</p>
                <p className="font-medium text-primary">Listening</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50">
                <p className="text-muted-foreground text-xs">Polling</p>
                <p className="font-medium capitalize">{connector.polling}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Domains</p>
              <div className="flex flex-wrap gap-1">
                {connector.domains.map(d => (
                  <span key={d} className="bg-background px-2 py-0.5 rounded text-xs capitalize">{d.replace('_', ' ')}</span>
                ))}
              </div>
            </div>
            <Button onClick={() => navigate(tenantPath('/relatio'))} className="rounded-full">
              Back to Relatio
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hand-raise */}
      <GuidedSetupHandRaise connectorLabel={connector.label} />
    </div>
  );
}
