/**
 * ImpulsusFilters — horizontal filter chips + search input.
 *
 * WHAT: Lets users filter Impulsus entries by kind and search text.
 * WHERE: Rendered at the top of the Impulsus page.
 * WHY: Keeps the timeline navigable as entries grow.
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImpulsusKind } from '@/lib/impulsusTemplates';

const CHIPS: { label: string; value: ImpulsusKind | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Reflections', value: 'reflection' },
  { label: 'Emails', value: 'email' },
  { label: 'Campaigns', value: 'campaign' },
  { label: 'Events', value: 'event' },
  { label: 'Journey', value: 'journey' },
  { label: 'Tasks', value: 'task' },
  { label: 'AI Nudges', value: 'ai_suggestion' },
];

interface ImpulsusFiltersProps {
  activeKind: ImpulsusKind | undefined;
  onKindChange: (kind: ImpulsusKind | undefined) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function ImpulsusFilters({
  activeKind,
  onKindChange,
  search,
  onSearchChange,
}: ImpulsusFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <Button
            key={chip.label}
            variant={activeKind === chip.value ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'rounded-full text-xs h-7',
              activeKind === chip.value && 'shadow-sm',
            )}
            onClick={() => onKindChange(chip.value)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search entries..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
    </div>
  );
}
