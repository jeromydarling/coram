/**
 * SyncDirectionToggle — Shepherd-only control for connector sync direction.
 *
 * WHAT: Inline toggle to switch between inbound-only and bi-directional sync.
 * WHERE: ConnectorCard and SyncSettingsPanel.
 * WHY: Shepherds control whether CROS writes back to the external CRM.
 */

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeftRight, ArrowDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

interface SyncDirectionToggleProps {
  connectorKey: string;
  currentDirection: 'inbound' | 'outbound' | 'bidirectional';
  supportsTwoWay: boolean;
  onDirectionChange?: (direction: 'inbound' | 'bidirectional') => void;
  compact?: boolean;
}

const TWO_WAY_CONNECTORS = ['salesforce', 'dynamics365', 'hubspot', 'blackbaud'];

export function SyncDirectionToggle({
  connectorKey,
  currentDirection,
  supportsTwoWay,
  onDirectionChange,
  compact = false,
}: SyncDirectionToggleProps) {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  const isBidirectional = currentDirection === 'bidirectional';
  const canToggle = supportsTwoWay && TWO_WAY_CONNECTORS.includes(connectorKey);
  const isShepherd = profile?.ministry_role === 'shepherd' || profile?.ministry_role === 'steward';

  if (!canToggle) return null;

  const handleToggle = async (checked: boolean) => {
    if (!tenant?.id || !isShepherd) return;
    setSaving(true);
    const newDirection = checked ? 'bidirectional' : 'inbound';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('relatio_sync_config')
      .upsert(
        {
          tenant_id: tenant.id,
          connector_key: connectorKey,
          sync_direction: newDirection,
          updated_by: profile?.id,
        },
        { onConflict: 'tenant_id,connector_key' }
      );

    setSaving(false);
    if (error) {
      toast.error('Could not update sync direction');
      return;
    }
    toast.success(
      checked
        ? 'Two-way sync enabled — CROS will write back to this system'
        : 'Returned to read-only — CROS will only listen'
    );
    onDirectionChange?.(newDirection);
  };

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              {isBidirectional ? (
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {isShepherd && (
                <Switch
                  checked={isBidirectional}
                  onCheckedChange={handleToggle}
                  disabled={saving}
                  className="scale-75"
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs max-w-48">
            {isBidirectional
              ? 'Two-way sync active — CROS writes back'
              : 'Read-only — CROS listens only'}
            {!isShepherd && <p className="text-muted-foreground mt-1">Only Shepherds can change this.</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2 min-w-0">
        {isBidirectional ? (
          <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <ArrowDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0">
          <Label className="text-sm font-medium">
            {isBidirectional ? 'Two-way sync' : 'Read-only'}
          </Label>
          <p className="text-xs text-muted-foreground truncate">
            {isBidirectional
              ? 'Changes in CROS flow back to this system'
              : 'CROS reads from this system but never writes back'}
          </p>
        </div>
      </div>
      {isShepherd ? (
        <Switch
          checked={isBidirectional}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      ) : (
        <span className="text-xs text-muted-foreground italic whitespace-nowrap">Shepherd only</span>
      )}
    </div>
  );
}
