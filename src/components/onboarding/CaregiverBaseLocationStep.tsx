/**
 * CaregiverBaseLocationStep — Private base location for solo caregivers.
 *
 * WHAT: Collects country, state, city for solo caregivers (no territory activation).
 * WHERE: Onboarding wizard, replaces territory step for caregiver_solo archetype.
 * WHY: Private analytics data — never displayed publicly, never consumes activation slots.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Heart, Shield } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export interface CaregiverBaseLocation {
  country_code: string;
  state_code: string;
  city: string;
  network_opt_in: boolean;
}

interface Props {
  value: CaregiverBaseLocation;
  onChange: (val: CaregiverBaseLocation) => void;
}

export const initialCaregiverBase: CaregiverBaseLocation = {
  country_code: 'US',
  state_code: '',
  city: '',
  network_opt_in: false,
};

export default function CaregiverBaseLocationStep({ value, onChange }: Props) {
  return (
    <Card data-testid="onboarding-step-base-location">
      <CardHeader className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
          Where are you based?
        </CardTitle>
        <CardDescription className="max-w-md mx-auto">
          This is completely private — it's never shown publicly and doesn't activate any territory.
          It helps us understand where caregivers are, so we can build better support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>State</Label>
          <Select value={value.state_code} onValueChange={(sc) => onChange({ ...value, state_code: sc })}>
            <SelectTrigger>
              <SelectValue placeholder="Select your state" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>City <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="e.g. Portland"
          />
        </div>

        {/* Privacy assurance */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground mb-0.5">Your location stays private</p>
            <p>This information is never shared with other users, never appears on any map, and never consumes an activation slot.</p>
          </div>
        </div>

        {/* Network opt-in */}
        <div className="p-3 rounded-lg border space-y-2">
          <div className="flex items-center gap-3">
            <Switch
              id="caregiver-network"
              checked={value.network_opt_in}
              onCheckedChange={(checked) => onChange({ ...value, network_opt_in: checked })}
            />
            <Label htmlFor="caregiver-network" className="text-sm cursor-pointer">
              Join the future Caregiver Network
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs">
                <p><strong>What:</strong> When the Caregiver Network launches, you'll appear in an approximate regional listing.</p>
                <p><strong>Where:</strong> Only your state/region — never your exact city or address.</p>
                <p><strong>Why:</strong> Connect with nearby caregivers for mutual support.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground pl-[2.75rem]">
            When enabled, your approximate region may be visible to other caregivers in the future. You can change this anytime.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
