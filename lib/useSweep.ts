import { useEffect, useRef } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

/**
 * Returns an animated style that sweeps from `from` to `to` whenever `trackValue`
 * changes to a non-zero / non-empty value. Drop a SweepOverlay inside an
 * overflow:hidden container to get the gleam effect.
 */
export function useSweep(
  trackValue: string | number,
  { duration = 900, from = -120, to = 500 }: { duration?: number; from?: number; to?: number } = {}
) {
  const x = useSharedValue(from);
  const prevRef = useRef(trackValue);

  useEffect(() => {
    const changed = trackValue !== prevRef.current;
    prevRef.current = trackValue;
    const active =
      typeof trackValue === 'number'
        ? trackValue !== 0
        : Boolean(trackValue) && trackValue !== '—' && trackValue !== '0';
    if (changed && active) {
      x.value = from;
      x.value = withTiming(to, { duration });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackValue]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}
