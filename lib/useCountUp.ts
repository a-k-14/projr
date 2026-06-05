/**
 * useCountUp — tween a number from 0 (or a previous value) to `target` on mount/change.
 *
 * Returns a plain `number` rerendered on each animation frame, suitable for piping
 * straight through `formatCurrency`. Subtle by default (450ms ease-out); pass 0 to
 * disable. Skips animation when the value doesn't change.
 */
import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  durationMs?: number;
  /** When false, returns target immediately (no tween). */
  enabled?: boolean;
}

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { durationMs = 450, enabled = true } = options;
  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(enabled ? 0 : target);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || durationMs <= 0) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    if (Number.isNaN(target) || !Number.isFinite(target)) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;

    startedAtRef.current = null;
    const tick = (ts: number) => {
      if (startedAtRef.current === null) startedAtRef.current = ts;
      const elapsed = ts - startedAtRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, enabled]);

  return value;
}
