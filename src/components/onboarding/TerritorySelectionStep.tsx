/**
 * TerritorySelectionStep — Archetype-aware "Where do you serve?" onboarding step.
 *
 * WHAT: Replaces the metro-only selector with metro/county/state/country options.
 * WHERE: Onboarding wizard, territory activation step.
 * WHY: Supports rural orgs (county bundles), missionary orgs (countries), and metro orgs.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, MapPin, Globe, Map } from 'lucide-react';
import { useTerritories, calculateActivationSlots, type TerritoryRow } from '@/hooks/useTerritories';
import type { TerritoryType } from '@/types/cros';

/** ISO country list — short subset for onboarding; full list can be expanded */
const COMMON_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'HT', name: 'Haiti' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'CO', name: 'Colombia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'PE', name: 'Peru' },
  { code: 'KE', name: 'Kenya' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'IN', name: 'India' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'RO', name: 'Romania' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
];

type TerritoryMode = 'metro' | 'county' | 'state' | 'country';

export interface TerritorySelection {
  mode: TerritoryMode;
  territory_id: string | null;
  territory_ids: string[];      // for county multi-select
  country_code: string | null;
  mission_city: string;
  mission_region: string;
  state_code_filter: string;    // for county grouping
}

interface Props {
  archetype: string | null;
  value: TerritorySelection;
  onChange: (val: TerritorySelection) => void;
}

const INITIAL_SELECTION: TerritorySelection = {
  mode: 'metro',
  territory_id: null,
  territory_ids: [],
  country_code: null,
  mission_city: '',
  mission_region: '',
  state_code_filter: '',
};

export { INITIAL_SELECTION as initialTerritorySelection };

export default function TerritorySelectionStep({ archetype, value, onChange }: Props) {
  const isMissionary = archetype === 'missionary_org';
  const isSoloCare = archetype === 'caregiver_solo';

  // Fetch territories
  const { data: metros = [] } = useTerritories('metro');
  const { data: states = [] } = useTerritories('state');
  const { data: counties = [] } = useTerritories('county');

  // Unique state codes from counties for grouping
  const countyStates = useMemo((): string[] => {
    const seen = new Set<string>();
    counties.forEach(c => {
      if (c.state_code) seen.add(c.state_code);
    });
    return Array.from(seen).sort();
  }, [counties]);

  const filteredCounties = useMemo(() => {
    if (!value.state_code_filter) return [];
    return counties.filter(c => c.state_code === value.state_code_filter);
  }, [counties, value.state_code_filter]);

  // Activation slot calculation
  const slots = useMemo(() => {
    if (isSoloCare) return 0;
    switch (value.mode) {
      case 'metro': return value.territory_id ? 1 : 0;
      case 'county': return calculateActivationSlots([{ type: 'county', count: value.territory_ids.length }]);
      case 'state': return value.territory_id ? 2 : 0;
      case 'country': return value.country_code ? 1 : 0;
      default: return 0;
    }
  }, [value, isSoloCare]);

  const hasSelection = value.mode === 'metro' ? !!value.territory_id
    : value.mode === 'county' ? value.territory_ids.length > 0
    : value.mode === 'state' ? !!value.territory_id
    : value.mode === 'country' ? !!value.country_code
    : false;

  // Solo caregivers skip this step entirely (handled by parent)
  if (isSoloCare) return null;

  // Missionary orgs default to country mode
  const availableModes: TerritoryMode[] = isMissionary
    ? ['country']
    : ['metro', 'county', 'state'];

  return (
    <Card data-testid="onboarding-step-territory">
      <CardHeader>
        <CardTitle style={{ fontFamily: "'Playfair Display', serif" }}>
          Where do you serve?
        </CardTitle>
        <CardDescription>
          {isMissionary
            ? 'Select the country where your mission is based. You can add mission fields later.'
            : 'Choose how to define your service area. This determines your community lens and discovery signals.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Mode selector — only shown for non-missionary */}
        {availableModes.length > 1 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Service area type</Label>
            <div className="grid grid-cols-3 gap-2">
              {availableModes.map(mode => (
                <button
                  key={mode}
                  onClick={() => onChange({ ...INITIAL_SELECTION, mode })}
                  className={`p-3 rounded-lg border-2 text-center transition-all text-sm
                    ${value.mode === mode
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {mode === 'metro' && <MapPin className="h-4 w-4" />}
                    {mode === 'county' && <Map className="h-4 w-4" />}
                    {mode === 'state' && <Map className="h-4 w-4" />}
                    <span className="capitalize">{mode === 'county' ? 'County Bundle' : mode}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Metro selection */}
        {value.mode === 'metro' && (
          <div className="space-y-2">
            <Label>Home metro</Label>
            <Select value={value.territory_id ?? ''} onValueChange={(id) => onChange({ ...value, territory_id: id })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a metro area" />
              </SelectTrigger>
              <SelectContent>
                {metros.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}{m.state_code ? `, ${m.state_code}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* County bundle */}
        {value.mode === 'county' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={value.state_code_filter} onValueChange={(sc) => onChange({ ...value, state_code_filter: sc, territory_ids: [] })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a state first" />
                </SelectTrigger>
                <SelectContent>
                  {countyStates.map(sc => (
                    <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {value.state_code_filter && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Counties (up to 5 per slot)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                      <p><strong>What:</strong> Bundle up to 5 counties in one state into 1 activation slot.</p>
                      <p><strong>Why:</strong> Fair pricing for rural organizations.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {filteredCounties.map(c => {
                    const selected = value.territory_ids.includes(c.id);
                    const atLimit = value.territory_ids.length >= 5 && !selected;
                    return (
                      <button
                        key={c.id}
                        disabled={atLimit}
                        onClick={() => {
                          const ids = selected
                            ? value.territory_ids.filter(id => id !== c.id)
                            : [...value.territory_ids, c.id];
                          onChange({ ...value, territory_ids: ids });
                        }}
                        className={`text-left text-xs px-2 py-1.5 rounded transition-colors
                          ${selected ? 'bg-primary/10 text-primary font-medium' : atLimit ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                  {filteredCounties.length === 0 && (
                    <p className="col-span-2 text-xs text-muted-foreground text-center py-3">
                      No counties available for {value.state_code_filter}. They may need to be added by the operator.
                    </p>
                  )}
                </div>
                {value.territory_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {value.territory_ids.length} of 5 counties selected
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* State selection */}
        {value.mode === 'state' && (
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={value.territory_id ?? ''} onValueChange={(id) => onChange({ ...value, territory_id: id })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {states.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">1 state = 2 activation slots</p>
          </div>
        )}

        {/* Country selection (missionary) */}
        {value.mode === 'country' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={value.country_code ?? ''} onValueChange={(cc) => onChange({ ...value, country_code: cc })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMissionary && value.country_code && (
              <>
                <div className="space-y-2">
                  <Label>City <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    value={value.mission_city}
                    onChange={(e) => onChange({ ...value, mission_city: e.target.value })}
                    placeholder="e.g. Nairobi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region / Province <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    value={value.mission_region}
                    onChange={(e) => onChange({ ...value, mission_region: e.target.value })}
                    placeholder="e.g. Rift Valley"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Slot indicator */}
        {hasSelection && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {slots === 0 ? 'No activation slots used' : `${slots} activation slot${slots > 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
