import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Shield, Sliders, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { AUTOMATION_WORKFLOW_KEYS } from '@/lib/automationWorkflowKeys';
import { workflowLabel } from '@/lib/automationHealthFormatters';

/**
 * Admin-only ops controls for managing automations.
 * Retry runs, adjust caps, disable workflows.
 */
export function OpsControlsPanel() {
  return (
    <div className="space-y-6">
      <RetryRunCard />
      <CapsControlCard />
      <WorkflowToggleCard />
    </div>
  );
}

function RetryRunCard() {
  const [runId, setRunId] = useState('');
  const [mode, setMode] = useState<'retry' | 'force_crawl'>('retry');
  const [isRetrying, setIsRetrying] = useState(false);
  const queryClient = useQueryClient();

  const handleRetry = async () => {
    if (!runId.trim()) {
      toast.error('Enter a run ID');
      return;
    }
    setIsRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('automation-retry', {
        body: { run_id: runId.trim(), mode },
      });
      if (error) {
        toast.error(`Retry failed: ${error.message}`);
        return;
      }
      const result = data as { ok: boolean; new_run_id?: string; message?: string };
      if (result?.ok && result.new_run_id) {
        toast.success(`Retry dispatched — new run: ${result.new_run_id.slice(0, 8)}…`);
        queryClient.invalidateQueries({ queryKey: ['automation-health'] });
        setRunId('');
      } else {
        toast.error(`Retry failed: ${result?.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(`Retry error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Retry Run
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="retry-run-id" className="text-xs">Run ID</Label>
          <Input
            id="retry-run-id"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={mode} onValueChange={(v) => setMode(v as 'retry' | 'force_crawl')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retry">Standard Retry</SelectItem>
              <SelectItem value="force_crawl">Force Crawl</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying || !runId.trim()}
          >
            {isRetrying ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
            Retry
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          "Force Crawl" bypasses dedup and re-crawls fresh content.
        </p>
      </CardContent>
    </Card>
  );
}

function CapsControlCard() {
  const [dailyCap, setDailyCap] = useState('50');
  const [perOrgCap, setPerOrgCap] = useState('10');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Safety Caps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Global daily cap</Label>
            <Input
              type="number"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Per-org daily cap</Label>
            <Input
              type="number"
              value={perOrgCap}
              onChange={(e) => setPerOrgCap(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Caps are enforced at dispatch time. Changes require an edge function redeployment to take effect.
          Current values are environment defaults.
        </p>
      </CardContent>
    </Card>
  );
}

function WorkflowToggleCard() {
  // UI-only toggles showing current default states.
  // Actual enforcement lives in n8n-dispatch via env vars.
  const [disabledWorkflows, setDisabledWorkflows] = useState<Set<string>>(new Set());

  const toggleWorkflow = (key: string) => {
    setDisabledWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        toast.success(`${workflowLabel(key)} enabled`);
      } else {
        next.add(key);
        toast.info(`${workflowLabel(key)} disabled (UI only — deploy to enforce)`);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Workflow Toggles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {AUTOMATION_WORKFLOW_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{workflowLabel(key)}</span>
              {disabledWorkflows.has(key) && (
                <Badge variant="destructive" className="text-xs">Disabled</Badge>
              )}
            </div>
            <Switch
              checked={!disabledWorkflows.has(key)}
              onCheckedChange={() => toggleWorkflow(key)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Toggles are advisory. Actual enforcement requires deploying updated environment configuration.
        </p>
      </CardContent>
    </Card>
  );
}
