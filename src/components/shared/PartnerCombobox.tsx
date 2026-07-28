/**
 * PartnerCombobox — searchable partner selector with free-text fallback.
 *
 * WHAT: A combobox that searches tenant Partners (opportunities) and Gardener Partners (operator_opportunities), allowing free typing.
 * WHERE: Used in EventModal for the host organization field.
 * WHY: Links events to known partners for relationship intelligence, while still allowing free-text for unknown orgs.
 *      Only opportunities IDs can be stored in host_opportunity_id (FK constraint). Gardener partners set name only.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface PartnerOption {
  id: string;
  organization: string;
  metroLabel?: string;
  /** 'tenant' = opportunities table (FK-safe), 'operator' = operator_opportunities (name only) */
  source: 'tenant' | 'operator';
}

interface PartnerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  selectedPartnerId: string | null;
  onPartnerSelected: (id: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function PartnerCombobox({
  value,
  onChange,
  selectedPartnerId,
  onPartnerSelected,
  placeholder = 'Search partners or type a name…',
  className,
}: PartnerComboboxProps) {
  // Fetch tenant partners (opportunities) — these can be stored as host_opportunity_id
  const { data: tenantPartners, isLoading: loadingTenant } = useQuery({
    queryKey: ['opportunities-combobox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, organization, metros(metro)')
        .order('organization');
      if (error) throw error;
      return (data ?? []).map(o => ({
        id: o.id,
        organization: o.organization,
        metroLabel: (o.metros as any)?.metro ?? undefined,
        source: 'tenant' as const,
      }));
    },
    staleTime: 60_000,
  });

  // Fetch Gardener partners (operator_opportunities) — name only, no FK
  const { data: operatorPartners, isLoading: loadingOp } = useQuery({
    queryKey: ['operator-opportunities-combobox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_opportunities')
        .select('id, organization, metro')
        .order('organization');
      if (error) throw error;
      return (data ?? []).map(o => ({
        id: o.id,
        organization: o.organization,
        metroLabel: o.metro ?? undefined,
        source: 'operator' as const,
      }));
    },
    staleTime: 60_000,
  });

  const allPartners = useMemo(() => [
    ...(tenantPartners ?? []),
    ...(operatorPartners ?? []),
  ], [tenantPartners, operatorPartners]);

  const isLoading = loadingTenant || loadingOp;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);

  const debouncedQuery = useDebouncedValue(value, 200);

  const filtered = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2 || allPartners.length === 0) return [];
    const q = debouncedQuery.toLowerCase();
    // Deduplicate by name (prefer tenant source for FK linkability)
    const seen = new Set<string>();
    const results: PartnerOption[] = [];
    for (const o of allPartners) {
      const key = o.organization?.toLowerCase();
      if (!key || !key.includes(q) || seen.has(key)) continue;
      seen.add(key);
      results.push(o);
      if (results.length >= 8) break;
    }
    return results;
  }, [allPartners, debouncedQuery]);

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    if (filtered.length > 0 && debouncedQuery.length >= 2) {
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setIsOpen(false);
    }
  }, [filtered, debouncedQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPartner = (opp: PartnerOption) => {
    suppressRef.current = true;
    onChange(opp.organization);
    // Only set the FK ID if this is a tenant partner (opportunities table)
    onPartnerSelected(opp.source === 'tenant' ? opp.id : null);
    setIsOpen(false);
  };

  const handleChange = (val: string) => {
    onChange(val);
    if (selectedPartnerId) {
      const linkedOp = allPartners.find(o => o.id === selectedPartnerId);
      if (linkedOp && linkedOp.organization !== val) {
        onPartnerSelected(null);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectPartner(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (filtered.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pr-8", className)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : selectedPartnerId ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <Building2 className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {selectedPartnerId && (
        <p className="text-[11px] text-primary mt-0.5 flex items-center gap-1">
          <Check className="w-3 h-3" />
          Linked to partner record
        </p>
      )}

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opp, i) => (
            <button
              key={`${opp.source}-${opp.id}`}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                i === selectedIndex && "bg-accent",
                opp.id === selectedPartnerId && "text-primary font-medium"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPartner(opp)}
            >
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium">{opp.organization}</span>
                {opp.metroLabel && (
                  <span className="text-muted-foreground ml-2 text-xs">({opp.metroLabel})</span>
                )}
                {opp.source === 'operator' && (
                  <span className="text-muted-foreground ml-1 text-[10px]">· Gardener</span>
                )}
              </div>
              {opp.id === selectedPartnerId && (
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
