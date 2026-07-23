import { useState, useEffect } from 'react';

/**
 * Debounces a value by the specified delay.
 * Useful for throttling API requests triggered by user text input.
 *
 * @param value - the value to debounce
 * @param delay - delay in milliseconds (default 500ms)
 * @returns the debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
