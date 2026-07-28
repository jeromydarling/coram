/**
 * SectorSelectionStep — Multi-select sector tagging during onboarding.
 *
 * WHAT: Lets tenants tag the domains their work touches (1–5 selections).
 * WHERE: Onboarding wizard, after archetype selection.
 * WHY: Enriches discovery relevance scoring and narrative context without altering core logic.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Check } from 'lucide-react';
import { useSectorCatalog, type Sector } from '@/hooks/useTenantSectors';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  selected: string[];
  onChange: (sectorIds: string[]) => void;
}

export default function SectorSelectionStep({ selected, onChange }: Props) {
  const { data: sectors = [], isLoading } = useSectorCatalog();

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < 5) {
      onChange([...selected, id]);
    }
  };

  // Group by category
  const grouped = sectors.reduce<Record<string, Sector[]>>((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <Card data-testid="onboarding-step-sectors">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>What domains does your work most often touch?</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
              <p><strong>What:</strong> Sector tags that describe the domains your organization serves.</p>
              <p><strong>Where:</strong> Used in discovery weighting, narrative context, and movement filtering.</p>
              <p><strong>Why:</strong> Helps CROS surface more relevant community signals without limiting what you see.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          Select 1–5 sectors. These help CROS prioritize discoveries that match your mission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([category, catSectors]) => (
              <div key={category}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{category}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catSectors.map((sector) => {
                    const isSelected = selected.includes(sector.id);
                    const isDisabled = !isSelected && selected.length >= 5;
                    return (
                      <button
                        key={sector.id}
                        onClick={() => !isDisabled && toggle(sector.id)}
                        disabled={isDisabled}
                        className={`relative text-left p-3 rounded-lg border-2 transition-all text-sm
                          ${isSelected
                            ? 'border-primary bg-primary/5'
                            : isDisabled
                              ? 'border-border opacity-40 cursor-not-allowed'
                              : 'border-border hover:border-primary/40 cursor-pointer'}`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {sector.color && (
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: sector.color }}
                            />
                          )}
                          <span className="font-medium text-foreground leading-tight">{sector.name}</span>
                        </div>
                        {sector.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{sector.description}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {selected.map((id) => {
              const s = sectors.find((sec) => sec.id === id);
              return s ? (
                <Badge key={id} variant="secondary" className="text-xs">
                  {s.name}
                </Badge>
              ) : null;
            })}
            <span className="text-xs text-muted-foreground self-center ml-1">
              {selected.length}/5
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
