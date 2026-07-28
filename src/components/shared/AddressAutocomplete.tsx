/**
 * AddressAutocomplete — Google Places-powered address search.
 *
 * WHAT: A text input that queries Google Places Autocomplete and lets users pick a result.
 * WHERE: Used in EventModal for the address/city field.
 * WHY: Replaces freeform typing with structured, verified addresses.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Prediction {
  place_id: string;
  description: string;
  structured?: { main_text: string; secondary_text: string };
}

interface PlaceDetail {
  name: string;
  formatted_address: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (detail: PlaceDetail) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Search for an address or venue…',
  className,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const sessionTokenRef = useRef(crypto.randomUUID());
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSearchRef = useRef(false);

  const debouncedQuery = useDebouncedValue(value, 300);

  // Fetch predictions
  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
          body: { query: debouncedQuery, sessionToken: sessionTokenRef.current },
        });
        if (!cancelled && !error && data?.predictions) {
          setPredictions(data.predictions);
          setIsOpen(data.predictions.length > 0);
          setSelectedIndex(-1);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPrediction = useCallback(async (prediction: Prediction) => {
    suppressSearchRef.current = true;
    setIsOpen(false);
    setPredictions([]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('google-places-detail', {
        body: { placeId: prediction.place_id, sessionToken: sessionTokenRef.current },
      });

      // Reset session token after detail fetch (billing best practice)
      sessionTokenRef.current = crypto.randomUUID();

      if (!error && data) {
        // Build a nice display: "Name\nFormatted Address"
        const displayParts: string[] = [];
        if (data.name && !data.formatted_address?.startsWith(data.name)) {
          displayParts.push(data.name);
        }
        displayParts.push(data.formatted_address || prediction.description);
        const display = displayParts.join('\n');

        onChange(display);
        onPlaceSelected?.({
          name: data.name,
          formatted_address: data.formatted_address,
          lat: data.lat,
          lng: data.lng,
        });
      } else {
        onChange(prediction.description);
      }
    } catch {
      onChange(prediction.description);
    } finally {
      setIsLoading(false);
    }
  }, [onChange, onPlaceSelected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (predictions.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pr-8", className)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((p, i) => (
            <button
              key={p.place_id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-accent transition-colors",
                i === selectedIndex && "bg-accent"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPrediction(p)}
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                {p.structured ? (
                  <>
                    <span className="font-medium text-foreground">{p.structured.main_text}</span>
                    <span className="text-muted-foreground ml-1">{p.structured.secondary_text}</span>
                  </>
                ) : (
                  <span>{p.description}</span>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-muted-foreground/60 text-right">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
