/**
 * RelationalFocusCard — Settings card for changing relational orientation.
 *
 * WHAT: Radio group for orientation with auto_manage toggle and calm warning.
 * WHERE: Settings page.
 * WHY: Stewards/Shepherds may recalibrate orientation as their mission evolves.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Building2, Blend } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useRelationalOrientation } from '@/hooks/useRelationalOrientation';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { toast } from '@/components/ui/sonner';

const ORIENTATIONS = [
  { value: 'human_focused', label: 'Human-Focused', icon: Users },
  { value: 'institution_focused', label: 'Institution-Focused', icon: Building2 },
  { value: 'hybrid', label: 'Hybrid', icon: Blend },
] as const;

export function RelationalFocusCard() {
  const { tenantId, refreshFlags } = useTenant();
  const { orientation, autoManageRichness } = useRelationalOrientation();
  const [pendingOrientation, setPendingOrientation] = useState<string | null>(null);
  const [autoManage, setAutoManage] = useState(autoManageRichness);
  const [isSaving, setIsSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleOrientationChange = (value: string) => {
    if (value !== orientation) {
      setPendingOrientation(value);
      setShowWarning(true);
    }
  };

  const confirmChange = async () => {
    if (!tenantId || !pendingOrientation) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('set_relational_orientation', {
        p_tenant_id: tenantId,
        p_orientation: pendingOrientation,
        p_auto_manage: autoManage,
      });
      if (error) throw error;
      toast.success('Relational focus updated');
      setShowWarning(false);
      setPendingOrientation(null);
      // Reload tenant context so orientation reflects immediately
      await refreshFlags();
    } catch (err) {
      toast.error('Could not update orientation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Relational Focus
            <HelpTooltip
              what="Controls whether your workspace emphasizes people, organizations, or both in its narrative detail."
              where="Settings page"
              why="Orientation drives entity page richness, compass weighting, and narrative density."
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={orientation} onValueChange={handleOrientationChange}>
            {ORIENTATIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <div key={opt.value} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <RadioGroupItem value={opt.value} id={`orientation-${opt.value}`} />
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor={`orientation-${opt.value}`} className="cursor-pointer text-sm">
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-manage richness</p>
              <p className="text-xs text-muted-foreground">When on, richness levels follow orientation defaults</p>
            </div>
            <Switch checked={autoManage} onCheckedChange={setAutoManage} />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change relational focus?</AlertDialogTitle>
            <AlertDialogDescription>
              This adjusts how your workspace emphasizes people vs. organizations. 
              No data is lost — only the narrative density and compass weighting will change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingOrientation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
