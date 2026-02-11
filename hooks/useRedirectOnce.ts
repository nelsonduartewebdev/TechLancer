import { useCallback, useRef } from 'react';

/**
 * Returns a function that runs the given callback at most once when condition is true.
 * Use for redirects in useEffect to prevent infinite loops when effect deps re-run
 * (e.g. auth state or router identity changing).
 */
export function useRedirectOnce() {
  const done = useRef(false);
  return useCallback((condition: boolean, redirect: () => void) => {
    if (!condition || done.current) return;
    done.current = true;
    redirect();
  }, []);
}
