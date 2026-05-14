import { useCallback, useEffect, useMemo, useRef } from 'react';

export function useDevProfiler(scope: string) {
  const startedAtRef = useRef(Date.now());
  const lastMarkAtRef = useRef(startedAtRef.current);

  const mark = useCallback((label: string) => {
    if (!__DEV__) return;
    const now = Date.now();
    const total = now - startedAtRef.current;
    const delta = now - lastMarkAtRef.current;
    lastMarkAtRef.current = now;
    console.log(`[profiler] ${scope} ${label} +${total}ms (Δ${delta}ms)`);
  }, [scope]);

  useEffect(() => {
    mark('mount');
    return () => {
      mark('unmount');
    };
  }, [mark]);

  return useMemo(() => ({ mark }), [mark]);
}
