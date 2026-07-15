import { useEffect, useState } from "react";

/**
 * Return a debounced copy of `value` that only updates after `delayMs` of
 * quiet time. A `delayMs` of 0 disables debouncing and returns `value` as-is.
 */
export function useDebouncedValue<V>(value: V, delayMs: number): V {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs === 0) {
      setDebounced(value);
      return;
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return delayMs === 0 ? value : debounced;
}
