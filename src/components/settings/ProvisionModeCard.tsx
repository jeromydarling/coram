/**
 * ProvisionModeCard — Settings surface for Prōvīsiō mode selection.
 *
 * WHAT: Allows tenant admins to choose how shared resources are tracked.
 * WHERE: Settings page, under organization section.
 * WHY: Different archetypes need different levels of resource tracking —
 *      from simple care logging to cost-aware stewardship.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Heart, DollarSign, Package } from 'lucide-react';
import { useProvisionMode, useProvisionSettingsMutation, ProvisionMode } from '@/hooks/useProvisionMode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const MODE_OPTIONS: { value: ProvisionMode; label: string; description: string; icon: typeof Heart }[] = [
  {
    value: 'care',
    label: 'Care Tracking',
    description: 'Simply log how you\'ve helped people — meals, clothing, support.',
    icon: Heart,
  },
  {
    value: 'stewardship',
    label: 'Stewardship',
    description: 'Track expenses and costs tied to the care you provide.',
    icon: DollarSign,
  },
  {
    value: 'enterprise',
    label: 'Social Enterprise',
    description: 'Manage items with pricing, categories, and a resource catalog.',
    icon: Package,
  },
];

export function ProvisionModeCard() {
  const { mode, catalog_enabled, pricing_enabled, isLoading } = useProvisionMode();
  const mutation = useProvisionSettingsMutation();

  if (isLoading) return null;

  const handleModeChange = (newMode: ProvisionMode) => {
    const updates: any = { mode: newMode };
    if (newMode === 'enterprise') {
      updates.catalog_enabled = true;
      updates.pricing_enabled = true;
    } else if (newMode === 'care') {
      updates.pricing_enabled = false;
    }
    mutation.mutate(updates);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Shared Resources
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-sm">
                  Choose how your organization tracks shared resources. This affects what fields appear
                  when logging care, visits, and projects.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          How do you want to track shared resources in your work?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={mode}
          onValueChange={(v) => handleModeChange(v as ProvisionMode)}
          className="space-y-3"
          disabled={mutation.isPending}
        >
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <div key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={opt.value} id={`mode-${opt.value}`} className="mt-1" />
                <Label htmlFor={`mode-${opt.value}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{opt.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        {mode !== 'care' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Catalog</Label>
                <p className="text-xs text-muted-foreground">Organize resources into categories and items</p>
              </div>
              <Switch
                checked={catalog_enabled}
                onCheckedChange={(v) => mutation.mutate({ catalog_enabled: v })}
                disabled={mutation.isPending}
              />
            </div>
            {mode === 'stewardship' && (
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Cost Fields</Label>
                  <p className="text-xs text-muted-foreground">Track cost awareness for stewardship reporting</p>
                </div>
                <Switch
                  checked={pricing_enabled}
                  onCheckedChange={(v) => mutation.mutate({ pricing_enabled: v })}
                  disabled={mutation.isPending}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
