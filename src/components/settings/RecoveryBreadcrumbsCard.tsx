/**
 * RecoveryBreadcrumbsCard — Privacy toggle for assistant action breadcrumbs.
 *
 * WHAT: Big, clear toggle for enable_recent_actions_for_assistant.
 * WHERE: Settings page, near privacy-related cards.
 * WHY: Default-ON transparency — tenants can opt out at any time.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export function RecoveryBreadcrumbsCard() {
  const { tenantId } = useTenant();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('tenant_privacy_settings')
      .select('enable_recent_actions_for_assistant')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => {
        // Default ON if no row exists
        setEnabled(data ? data.enable_recent_actions_for_assistant : true);
      });
  }, [tenantId]);

  const handleToggle = async (checked: boolean) => {
    if (!tenantId) return;
    setEnabled(checked);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_privacy_settings')
        .upsert(
          { tenant_id: tenantId, enable_recent_actions_for_assistant: checked },
          { onConflict: 'tenant_id' }
        );
      if (error) throw error;
      toast.success(checked
        ? 'Action breadcrumbs enabled — the assistant can help you undo mistakes.'
        : 'Action breadcrumbs disabled. The assistant will no longer see recent actions.');
    } catch {
      setEnabled(!checked);
      toast.error('Could not save preference. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!tenantId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Recovery Breadcrumbs
          <HelpTooltip contentKey="card.recovery-breadcrumbs" />
        </CardTitle>
        <CardDescription>
          Help the assistant help you undo mistakes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enabled === null ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <Label htmlFor="breadcrumbs-toggle" className="text-sm font-medium cursor-pointer">
                Help me undo mistakes (private action breadcrumbs)
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CROS stores a short list of recent actions (like "deleted a contact") so the assistant can help you restore work.
                It does not store message content, notes, names, or private details. Breadcrumbs are kept for 30 days and then permanently removed.
              </p>
            </div>
            <Switch
              id="breadcrumbs-toggle"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={saving}
              className="mt-0.5 flex-shrink-0"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
