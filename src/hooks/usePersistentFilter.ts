import { useState, useCallback, useEffect } from 'react';

/**
 * Hook that persists a filter value to localStorage
 * @param key The localStorage key
 * @param defaultValue The default value if nothing is stored
 * @returns [value, setValue, resetValue]
 */
export function usePersistentFilter<T>(
  key: string, 
  defaultValue: T
): [T, (value: T) => void, () => void] {
  // Initialize state from localStorage or use default
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.warn(`Failed to parse localStorage key "${key}":`, e);
    }
    return defaultValue;
  });

  // Persist to localStorage when value changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed to save to localStorage key "${key}":`, e);
    }
  }, [key, value]);

  // Reset to default
  const resetValue = useCallback(() => {
    setValue(defaultValue);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to remove localStorage key "${key}":`, e);
    }
  }, [key, defaultValue]);

  return [value, setValue, resetValue];
}

/**
 * Hook for persisting multiple filter values as an object
 */
export function usePersistentFilters<T extends Record<string, unknown>>(
  storageKey: string,
  defaultFilters: T
): {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (newFilters: Partial<T>) => void;
  resetFilters: () => void;
  isDefault: boolean;
} {
  const [filters, setFiltersState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultFilters;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        return { ...defaultFilters, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn(`Failed to parse localStorage key "${storageKey}":`, e);
    }
    return defaultFilters;
  });

  // Persist to localStorage when filters change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (e) {
      console.warn(`Failed to save to localStorage key "${storageKey}":`, e);
    }
  }, [storageKey, filters]);

  // Set a single filter
  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);

  // Set multiple filters
  const setFilters = useCallback((newFilters: Partial<T>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn(`Failed to remove localStorage key "${storageKey}":`, e);
    }
  }, [storageKey, defaultFilters]);

  // Check if current filters match defaults
  const isDefault = JSON.stringify(filters) === JSON.stringify(defaultFilters);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    isDefault,
  };
}
