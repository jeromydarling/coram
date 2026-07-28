/**
 * DemoLabConnectorTab — Connector-specific migration panel.
 *
 * WHAT: Shows sandbox checklist, connection status, and migration actions per connector.
 * WHERE: Admin Demo Lab → Migration Harness tab.
 * WHY: Guided, human-first connector setup experience.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Play, RotateCcw, Upload, Zap, HelpCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SimulationControls } from '@/components/demo-lab/SimulationControls';

interface Connector {
  key: string;
  display_name: string;
  direction: string;
  supports_oauth: boolean;
  supports_csv: boolean;
  supports_api: boolean;
  notes: string | null;
}

const SANDBOX_CHECKLISTS: Record<string, Array<{ id: string; label: string }>> = {
  hubspot: [
    { id: 'dev_account', label: 'Create HubSpot Developer Account' },
    { id: 'test_app', label: 'Create test app (OAuth) with required scopes' },
    { id: 'sandbox_portal', label: 'Create Sandbox Portal' },
    { id: 'seed_data', label: 'Seed test Companies/Contacts/Deals/Notes' },
    { id: 'connected', label: 'Connect from CROS (sandbox)' },
    { id: 'smoke_test', label: 'Run Smoke Test' },
  ],
  salesforce: [
    { id: 'dev_org', label: 'Create Salesforce Developer Org' },
    { id: 'connected_app', label: 'Create Connected App or enable data export' },
    { id: 'seed_data', label: 'Ensure Accounts/Contacts/Opportunities/Tasks exist' },
    { id: 'choose_method', label: 'Choose method: OAuth API or CSV export' },
    { id: 'connected', label: 'Connect/import into demo tenant' },
    { id: 'smoke_test', label: 'Run Smoke Test' },
  ],
  bloomerang: [
    { id: 'access', label: 'Obtain sandbox/demo account access' },
    { id: 'api_or_csv', label: 'Configure API key or prepare CSV export' },
    { id: 'mapping', label: 'Verify mapping (constituents → people, orgs → opportunities)' },
    { id: 'smoke_test', label: 'Run Smoke Test' },
  ],
};

// Generic checklist for CRMs without a specific one
const GENERIC_CHECKLIST = [
  { id: 'access', label: 'Obtain sandbox or demo account access' },
  { id: 'export', label: 'Export data as CSV (organizations, contacts, activities)' },
  { id: 'upload', label: 'Upload CSV files into CROS' },
  { id: 'smoke_test', label: 'Run Smoke Test' },
];

interface Props {
  connector: Connector;
  tenantId: string | null;
}

export function DemoLabConnectorTab({ connector, tenantId }: Props) {
  const queryClient = useQueryClient();
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const checklist = SANDBOX_CHECKLISTS[connector.key] || GENERIC_CHECKLIST;

  // Smoke test
  const smokeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('integration-smoke-test', {
        body: { tenant_id: tenantId, connector_key: connector.key, environment: 'sandbox' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.ok) {
        toast.success('Smoke test passed!');
      } else {
        toast.error('Smoke test has failures.');
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Dry run (CSV-based)
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('migration-dry-run', {
        body: {
          tenant_id: tenantId,
          connector_key: connector.key,
          environment: 'sandbox',
          source: { type: 'csv', data: {} },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Dry run complete. ${data?.warnings?.length || 0} warnings.`);
      queryClient.invalidateQueries({ queryKey: ['migration-runs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Simulation Controls */}
      <SimulationControls connectorKey={connector.key} tenantId={tenantId} isDemoTenant={true} />

      {/* Connector info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{connector.display_name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={connector.direction === 'two_way' ? 'default' : 'secondary'} className="text-xs">
                {connector.direction === 'two_way' ? 'Two-way' : 'Import only'}
              </Badge>
              {connector.supports_oauth && <Badge variant="outline" className="text-xs">OAuth</Badge>}
              {connector.supports_csv && <Badge variant="outline" className="text-xs">CSV</Badge>}
              {connector.supports_api && <Badge variant="outline" className="text-xs">API</Badge>}
            </div>
          </div>
          {connector.notes && (
            <CardDescription className="text-xs">{connector.notes}</CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Sandbox checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Sandbox Setup Checklist
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Follow these steps to set up a sandbox environment for testing.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <Checkbox
                id={`${connector.key}-${item.id}`}
                checked={checklistState[item.id] || false}
                onCheckedChange={(checked) =>
                  setChecklistState((prev) => ({ ...prev, [item.id]: !!checked }))
                }
              />
              <Label htmlFor={`${connector.key}-${item.id}`} className="text-sm cursor-pointer">
                {item.label}
              </Label>
            </div>
          ))}
          <div className="text-xs text-muted-foreground pt-2">
            {Object.values(checklistState).filter(Boolean).length} / {checklist.length} completed
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Migration Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => smokeMutation.mutate()}
            disabled={smokeMutation.isPending}
          >
            {smokeMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
            Smoke Test
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => dryRunMutation.mutate()}
            disabled={dryRunMutation.isPending}
          >
            {dryRunMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
            Dry Run
          </Button>
        </CardContent>
      </Card>

      {/* Smoke test results */}
      {smokeMutation.data?.checks && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Smoke Test Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {smokeMutation.data.checks.map((check: { name: string; status: string; detail: string }, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {check.status === 'pass' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : check.status === 'fail' ? (
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                )}
                <span className="font-medium">{check.name.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground text-xs">{check.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
