import { useState, useCallback, useEffect } from 'react';

interface UseUnsavedChangesOptions {
  initialData?: Record<string, unknown>;
}

export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}) {
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(
    options.initialData || null
  );
  const [currentData, setCurrentData] = useState<Record<string, unknown> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Compare two values deeply (handles arrays and objects)
  const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (a === undefined || b === undefined) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => deepEqual(val, b[i]));
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      const aKeys = Object.keys(a as object);
      const bKeys = Object.keys(b as object);
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(key => 
        deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    }
    
    return false;
  };

  // Update current data and check for changes
  const updateData = useCallback((data: Record<string, unknown>) => {
    setCurrentData(data);
    
    if (!initialData) {
      // If no initial data, check if any fields have non-empty values
      const hasNonEmptyValues = Object.values(data).some(value => {
        if (value === null || value === undefined || value === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'boolean') return false; // Don't count defaults
        return true;
      });
      setHasChanges(hasNonEmptyValues);
    } else {
      // Compare with initial data
      setHasChanges(!deepEqual(initialData, data));
    }
  }, [initialData]);

  // Reset tracking (e.g., after save)
  const reset = useCallback((newInitialData?: Record<string, unknown>) => {
    setInitialData(newInitialData || null);
    setCurrentData(newInitialData || null);
    setHasChanges(false);
  }, []);

  // Set initial data (for edit mode)
  const setInitial = useCallback((data: Record<string, unknown>) => {
    setInitialData(data);
    setCurrentData(data);
    setHasChanges(false);
  }, []);

  return {
    hasChanges,
    updateData,
    reset,
    setInitial,
    currentData,
    initialData
  };
}

// Simple hook for tracking if form is dirty based on manual flag
export function useFormDirty() {
  const [isDirty, setIsDirty] = useState(false);
  
  const markDirty = useCallback(() => setIsDirty(true), []);
  const reset = useCallback(() => setIsDirty(false), []);
  
  return { isDirty, markDirty, reset };
}
