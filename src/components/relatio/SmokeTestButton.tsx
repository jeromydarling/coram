/**
 * SmokeTestButton — Runs a connectivity check for a connector.
 *
 * WHAT: Button that runs relatio-smoke-test and shows results.
 * WHERE: Connector detail views, admin.
 * WHY: Verify integration health before importing.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Stethoscope, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

interface Check {
  name: string;
  status: 'pass' | 'fail';
  detail?: string;
}

interface SmokeTestButtonProps {
  connectorKey: string;
}

export function SmokeTestButton({ connectorKey }: SmokeTestButtonProps) {
  const { tenantId } = useTenant();
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);

  const run = async () => {
    if (!tenantId) return;
    setRunning(true);
    setChecks(null);

    try {
      const { data, error } = await supabase.functions.invoke('relatio-smoke-test', {
        body: { tenant_id: tenantId, connector_key: connectorKey },
      });

      if (error) throw error;

      setChecks(data.checks || []);
      if (data.ok) {
        toast.success('All checks passed.');
      } else {
        toast.error('Some checks failed.');
      }
    } catch (err) {
      toast.error('Smoke test failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={run}
        disabled={running}
        className="rounded-full"
      >
        {running ? (
          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testing…</>
        ) : (
          <><Stethoscope className="h-3 w-3 mr-1" /> Health check</>
        )}
      </Button>

      {checks && (
        <div className="space-y-1">
          {checks.map((c) => (
            <div key={c.name} className="flex items-center gap-2 text-xs">
              {c.status === 'pass' ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
              <span className="font-medium">{c.name.replace(/_/g, ' ')}</span>
              {c.detail && <span className="text-muted-foreground">— {c.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
