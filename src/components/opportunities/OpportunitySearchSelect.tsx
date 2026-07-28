import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useOpportunities } from '@/hooks/useOpportunities';

interface OpportunitySearchSelectProps {
  value: string | null;
  onChange: (opportunityId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function OpportunitySearchSelect({
  value,
  onChange,
  placeholder = 'Search organizations...',
  disabled = false,
}: OpportunitySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: opportunities, isLoading } = useOpportunities();

  const selectedOpp = useMemo(() => {
    if (!value || !opportunities) return null;
    return opportunities.find((o) => o.id === value) || null;
  }, [value, opportunities]);

  const handleSelect = (oppId: string) => {
    onChange(oppId === value ? null : oppId);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedOpp ? (
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedOpp.organization}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {selectedOpp && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by organization name..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Loading organizations...' : 'No organizations found.'}
            </CommandEmpty>
            <CommandGroup>
              {opportunities?.map((opp) => (
                <CommandItem
                  key={opp.id}
                  value={opp.organization}
                  onSelect={() => handleSelect(opp.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opp.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{opp.organization}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
