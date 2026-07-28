import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface CommunioMembershipSettingsProps {
  enabled: boolean;
  sharingLevel: string;
  onToggle: (enabled: boolean) => void;
  onSharingChange: (level: string) => void;
  isAdmin: boolean;
}

const sharingOptions = [
  { value: 'none', label: 'None', description: 'Joined but not sharing anything' },
  { value: 'signals', label: 'Signals', description: 'Share anonymized narrative signals' },
  { value: 'reflections', label: 'Reflections', description: 'Share opt-in reflections tagged shareable' },
  { value: 'collaboration', label: 'Collaboration', description: 'Full sharing including event collaboration' },
];

export function CommunioMembershipSettings({
  enabled,
  sharingLevel,
  onToggle,
  onSharingChange,
  isAdmin,
}: CommunioMembershipSettingsProps) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Communio Preferences</CardTitle>
        </div>
        <CardDescription>
          Control how your workspace participates in the shared narrative network.
          Only anonymized signals are ever shared — never contacts, emails, or private data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="communio-toggle" className="text-sm font-medium">
              Join Communio Network
            </Label>
            <p className="text-xs text-muted-foreground">
              Opt in to receive shared signals from neighboring organizations
            </p>
          </div>
          <Switch
            id="communio-toggle"
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={!isAdmin}
          />
        </div>

        {enabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium">Sharing Level</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Controls what your workspace contributes to the network.
                      Private data (contacts, emails, financials) is never shared regardless of level.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={sharingLevel} onValueChange={onSharingChange} disabled={!isAdmin}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sharingOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isAdmin && (
          <p className="text-xs text-muted-foreground italic">
            Only workspace administrators can change Communio settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
