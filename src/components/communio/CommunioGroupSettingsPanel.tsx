/**
 * CommunioGroupSettingsPanel — Governance controls for a Communio group.
 *
 * WHAT: Toggle sharing levels & visibility for a group.
 * WHERE: Displayed in the group detail view on the Communio page.
 * WHY: Gives group creators fine-grained control over what gets shared.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface GroupSettings {
  group_id: string;
  visibility: string;
  allow_event_sharing: boolean;
  allow_signal_sharing: boolean;
  allow_reflection_sharing: boolean;
  allow_story_heatmap: boolean;
}

interface Props {
  settings: GroupSettings;
  isCreator: boolean;
}

export function CommunioGroupSettingsPanel({ settings, isCreator }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const update = async (patch: Partial<GroupSettings>) => {
    setSaving(true);
    const { error } = await supabase
      .from('communio_group_settings')
      .update(patch as any)
      .eq('group_id', settings.group_id);
    setSaving(false);
    if (error) {
      toast.error('Failed to update settings');
    } else {
      toast.success('Settings updated');
      qc.invalidateQueries({ queryKey: ['communio-group-settings'] });
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Group Governance</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>What:</strong> Controls what this group shares between organizations.<br />
                  <strong>Where:</strong> Applies to all members of this group.<br />
                  <strong>Why:</strong> Ensures privacy while enabling meaningful narrative sharing.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="text-xs">
          Only anonymized narrative signals are shared — never contacts, emails, or private data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Visibility */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Visibility</Label>
          <Select
            value={settings.visibility}
            onValueChange={(v) => update({ visibility: v })}
            disabled={!isCreator || saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="invite_only">Invite Only</SelectItem>
              <SelectItem value="open_discovery">Open Discovery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggle switches */}
        <SettingToggle
          label="Signal Sharing"
          description="Share anonymized momentum and trend signals"
          checked={settings.allow_signal_sharing}
          onChange={(v) => update({ allow_signal_sharing: v })}
          disabled={!isCreator || saving}
        />
        <SettingToggle
          label="Event Sharing"
          description="Allow community events to be visible across organizations"
          checked={settings.allow_event_sharing}
          onChange={(v) => update({ allow_event_sharing: v })}
          disabled={!isCreator || saving}
        />
        <SettingToggle
          label="Reflection Sharing"
          description="Share opt-in reflections tagged as shareable"
          checked={settings.allow_reflection_sharing}
          onChange={(v) => update({ allow_reflection_sharing: v })}
          disabled={!isCreator || saving}
        />
        <SettingToggle
          label="Story Heatmap"
          description="Allow anonymized narrative heatmap overlays"
          checked={settings.allow_story_heatmap}
          onChange={(v) => update({ allow_story_heatmap: v })}
          disabled={!isCreator || saving}
        />

        {!isCreator && (
          <p className="text-xs text-muted-foreground italic">
            Only the group creator can change these settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
