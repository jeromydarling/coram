/**
 * useDebouncedValue — generic debounce hook.
 *
 * WHAT: Returns a debounced copy of a value that updates after `delay` ms of inactivity.
 * WHERE: Used by Impulsus search to prevent spamming queries on every keystroke.
 * WHY: Keeps the hook generic for reuse across any component that needs input debouncing.
 */
import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
