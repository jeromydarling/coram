import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Link2, Unlink, ArrowUpDown, Building2, GitBranch, RefreshCw, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, SkipForward, AlertTriangle, Download, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useHubSpotStatus,
  useHubSpotConnect,
  useHubSpotDisconnect,
  useHubSpotUpdateSettings,
  useHubSpotPush,
  useHubSpotSyncLog,
  useHubSpotPullPreview,
  useHubSpotPullApply,
} from '@/hooks/useHubSpot';
import { format } from 'date-fns';

const JOURNEY_STAGES = [
  'Target Identified', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Agreement Pending', 'Agreement Signed', 'First Volume',
  'Stable Producer', 'Closed - Not a Fit',
];

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline-block ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SyncLogSection({ connectionId }: { connectionId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: logs, isLoading } = useHubSpotSyncLog(connectionId);

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  const displayLogs = expanded ? logs : logs?.slice(0, 5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Recent Sync Activity</Label>
        {(logs?.length || 0) > 5 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {expanded ? 'Show less' : `Show all ${logs?.length}`}
          </Button>
        )}
      </div>
      {!displayLogs?.length ? (
        <p className="text-xs text-muted-foreground">No sync activity yet</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {displayLogs.map((log) => (
            <div key={log.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/50">
              {log.status === 'ok' && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />}
              {log.status === 'skipped' && <SkipForward className="h-3 w-3 text-muted-foreground shrink-0" />}
              {log.status === 'failed' && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
              <Badge variant="outline" className="text-[10px] shrink-0">
                {log.direction === 'push' ? '↑' : '↓'} {log.entity}
              </Badge>
              <span className="text-muted-foreground truncate">{log.message || log.profunda_id?.slice(0, 8)}</span>
              <span className="text-muted-foreground ml-auto shrink-0">
                {format(new Date(log.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HubSpotSettingsCard() {
  const { data: status, isLoading } = useHubSpotStatus();
  const connect = useHubSpotConnect();
  const disconnect = useHubSpotDisconnect();
  const updateSettings = useHubSpotUpdateSettings();
  const push = useHubSpotPush();
  const pullPreview = useHubSpotPullPreview();
  const pullApply = useHubSpotPullApply();

  const [localMode, setLocalMode] = useState<string>('');
  const [localDirection, setLocalDirection] = useState<string>('');
  const [localScope, setLocalScope] = useState<Record<string, boolean>>({});
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Initialize local state from connection
  const conn = status?.connection;
  const isConnected = status?.isConnected ?? false;

  const mode = localMode || conn?.hubspot_mode || 'company';
  const direction = localDirection || conn?.sync_direction || 'push';
  const scope = Object.keys(localScope).length > 0 ? localScope : (conn?.sync_scope || { partners: false, contacts: false, journey_stage: true });

  const handleModeChange = (val: string) => {
    setLocalMode(val);
    setSettingsChanged(true);
  };

  const handleDirectionChange = (checked: boolean) => {
    const val = checked ? 'push_pull' : 'push';
    setLocalDirection(val);
    setSettingsChanged(true);
  };

  const handleScopeToggle = (key: string, checked: boolean) => {
    const newScope = { ...scope, [key]: checked };
    setLocalScope(newScope);
    setSettingsChanged(true);
  };

  const handleSaveSettings = () => {
    const updates: Record<string, unknown> = {};
    if (localMode) updates.hubspot_mode = localMode;
    if (localDirection) updates.sync_direction = localDirection;
    if (Object.keys(localScope).length > 0) updates.sync_scope = localScope;
    updateSettings.mutate(updates, {
      onSuccess: () => setSettingsChanged(false),
    });
  };

  const handleRunPush = () => {
    // Push all opportunities — the edge function will handle scoping
    push.mutate({ opportunity_ids: [] });
  };

  const handlePreview = async () => {
    const result = await pullPreview.mutateAsync();
    setPreviewData(result);
  };

  const handleApplyPull = () => {
    if (!previewData?.diffs) return;
    const items = previewData.diffs
      .filter((d: any) => d.profundaId && d.fieldDiffs.length > 0)
      .map((d: any) => ({
        hubspotId: d.hubspotId,
        profundaId: d.profundaId,
        fields: d.fieldDiffs,
      }));
    pullApply.mutate(items, {
      onSuccess: () => setPreviewData(null),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            HubSpot Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          HubSpot Integration
          <HelpTip text="Sync your partners and contacts with HubSpot. Push your Profunda data, or optionally pull from HubSpot during migration." />
        </CardTitle>
        <CardDescription>
          Keep your partner records in sync with HubSpot
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Connection</Label>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? `Connected to portal ${conn?.hubspot_portal_id || 'HubSpot'}`
                : 'Not connected'}
            </p>
          </div>
          {isConnected ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect HubSpot?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Syncing will stop. Your existing data in both systems will remain unchanged. You can reconnect anytime.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => disconnect.mutate()}>Disconnect</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
              {connect.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
              Connect HubSpot
            </Button>
          )}
        </div>

        {isConnected && (
          <>
            <Separator />

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>
                Sync Mode
                <HelpTip text="Company-first: each partner maps to a HubSpot Company. Deal-first: each partner maps to a Deal in a specific pipeline." />
              </Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      Company-first (recommended)
                    </div>
                  </SelectItem>
                  <SelectItem value="deal">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5" />
                      Deal-first (pipeline)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sync Direction */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>
                  Two-way Sync
                  <HelpTip text="Enable pulling data from HubSpot into Profunda. Useful when migrating away from HubSpot. Always requires preview before applying." />
                </Label>
                <p className="text-xs text-muted-foreground">
                  {direction === 'push_pull' ? 'Push + Pull enabled (migration mode)' : 'Push only (default, safe)'}
                </p>
              </div>
              <Switch
                checked={direction === 'push_pull'}
                onCheckedChange={handleDirectionChange}
              />
            </div>

            {direction === 'push_pull' && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Pull mode is designed for migration. It always requires a preview before any data is written to Profunda.</span>
              </div>
            )}

            <Separator />

            {/* Sync Scope */}
            <div className="space-y-3">
              <Label>
                What to Sync
                <HelpTip text="Choose which types of data are included in the sync. You can change this at any time." />
              </Label>
              {[
                { key: 'partners', label: 'Partners', desc: 'Organization records and journey stage' },
                { key: 'contacts', label: 'People', desc: 'Contact names, emails, titles' },
                { key: 'reflections', label: 'Reflections', desc: 'Safe summaries only (private notes are never shared)' },
                { key: 'tasks', label: 'Tasks', desc: 'Action items linked to contacts' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{label}</Label>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={scope[key] !== false}
                    onCheckedChange={(checked) => handleScopeToggle(key, checked)}
                  />
                </div>
              ))}
            </div>

            {settingsChanged && (
              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending} className="w-full">
                {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Settings
              </Button>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <Label>Sync Actions</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleRunPush} disabled={push.isPending}>
                  {push.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />}
                  Push to HubSpot
                </Button>

                {direction === 'push_pull' && (
                  <Button variant="outline" size="sm" onClick={handlePreview} disabled={pullPreview.isPending}>
                    {pullPreview.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                    Preview Pull
                  </Button>
                )}
              </div>
            </div>

            {/* Pull Preview Results */}
            {previewData && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label>Pull Preview</Label>
                  <Badge variant="outline">{previewData.summary?.total || 0} records</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    High match: {previewData.summary?.matched_high || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-yellow-600" />
                    Medium match: {previewData.summary?.matched_medium || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    Ambiguous: {previewData.summary?.ambiguous || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-blue-600" />
                    New: {previewData.summary?.new_records || 0}
                  </div>
                </div>
                {(previewData.summary?.fields_would_overwrite || 0) > 0 && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    ⚠ {previewData.summary.fields_would_overwrite} field(s) would overwrite existing Profunda data
                  </p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApplyPull} disabled={pullApply.isPending}>
                    {pullApply.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    Apply Changes
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewData(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Sync Log */}
            {conn?.id && <SyncLogSection connectionId={conn.id} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
