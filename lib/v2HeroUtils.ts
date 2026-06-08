/**
 * v2HeroUtils — utility functions and hooks for the V2 account-detail layout.
 *
 * These were previously inline at the top of `AccountDetailsV2Hero.tsx` (~70
 * lines of helpers + a hook). Pulled out so the main file is shorter and the
 * helpers can be unit-tested in isolation if needed.
 *
 * Nothing in here is V2-architecture-specific in a deep sense — `useMetricSprings`
 * and `splitTickAmount` are just generic display utilities. They live under a
 * `v2Hero` prefix because that's where they're used today; if another surface
 * adopts them, generalize the file name.
 */

import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SCREEN_GUTTER } from './design';
import { formatCurrency } from './derived';

// ── Tick chart geometry ────────────────────────────────────────────────────
export const TICK_W = 2.3;
export const TICK_GAP = 4;

/**
 * Given the current window width, compute the tick chart's container width,
 * total tick count, content width, and the leftover pixels between content
 * and container (for the right-aligned expense overlay).
 *
 * Call inside a component with `useWindowDimensions().width` so the geometry
 * updates on orientation change / split-screen — using `Dimensions.get()` at
 * module load froze these values at app launch.
 */
export function computeTickGeom(winW: number) {
  const containerW = Math.max(80, winW - 2 * SCREEN_GUTTER - 2 * 14);
  const total = Math.floor((containerW + TICK_GAP) / (TICK_W + TICK_GAP));
  const contentW = total * (TICK_W + TICK_GAP) - TICK_GAP;
  const remainder = containerW - contentW;
  return { containerW, total, contentW, remainder };
}

// ── Number formatting ──────────────────────────────────────────────────────

/** Split "12,345.67" → { int: "12,345", dec: ".67" }. */
export function splitTickAmount(amount: number): { int: string; dec: string } {
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
  const dotIdx = formatted.indexOf('.');
  if (dotIdx === -1) return { int: formatted, dec: '' };
  return { int: formatted.slice(0, dotIdx), dec: formatted.slice(dotIdx) };
}

/** Format a number with the currency symbol and a leading sign for negatives. */
export function signedCurrency(value: number, sym: string) {
  const abs = Math.abs(value);
  const formatted = formatCurrency(abs, sym);
  return value < 0 ? `-${formatted}` : formatted;
}

export type HierarchyFamily = 'in' | 'out' | 'transfer' | 'deposit' | 'loan';

/**
 * "in" and "out" buckets are stored as positive totals — present the natural
 * direction (out → leading "-"). Other families just defer to signedCurrency.
 */
export function familyAwareCurrency(familyKey: HierarchyFamily, total: number, sym: string) {
  if (familyKey === 'in' || familyKey === 'out') {
    const naturalValue = familyKey === 'out' ? -total : total;
    const prefix = naturalValue < 0 ? '-' : '';
    return `${prefix}${formatCurrency(Math.abs(total), sym)}`;
  }
  return signedCurrency(total, sym);
}

// ── Metric spring (slide-on-change) ────────────────────────────────────────

const METRIC_ARM_WINDOW_MS = 750;

/**
 * Animates left + right metric values with a brief slide-up spring when either
 * value changes, but only within `METRIC_ARM_WINDOW_MS` of a `tweenTrigger`
 * bump (typically a transaction mutation). Keeps the income/expense strip
 * subtly responsive without animating on every cashflow/period switch.
 */
export function useMetricSprings(
  tweenTrigger: number,
  leftAmount: number,
  rightAmount: number,
) {
  const leftSpring = useSharedValue(0);
  const rightSpring = useSharedValue(0);
  const lastTweenTriggerRef = useRef(tweenTrigger);
  const armedStampRef = useRef(0);
  const lastLeftAmountRef = useRef(leftAmount);
  const lastRightAmountRef = useRef(rightAmount);

  useEffect(() => {
    if (tweenTrigger !== lastTweenTriggerRef.current) {
      lastTweenTriggerRef.current = tweenTrigger;
      armedStampRef.current = performance.now();
    }

    const leftChanged = leftAmount !== lastLeftAmountRef.current;
    const rightChanged = rightAmount !== lastRightAmountRef.current;
    lastLeftAmountRef.current = leftAmount;
    lastRightAmountRef.current = rightAmount;

    if (armedStampRef.current === 0) return;
    if (performance.now() - armedStampRef.current > METRIC_ARM_WINDOW_MS) {
      armedStampRef.current = 0;
      return;
    }

    const springUp = (sv: typeof leftSpring) => {
      sv.value = -4;
      sv.value = withSpring(0, { damping: 12, stiffness: 220, mass: 0.6 });
    };

    if (leftChanged) springUp(leftSpring);
    if (rightChanged) springUp(rightSpring);
    if (leftChanged || rightChanged) armedStampRef.current = 0;
  }, [tweenTrigger, leftAmount, rightAmount, leftSpring, rightSpring]);

  const leftSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: leftSpring.value }] }));
  const rightSpringStyle = useAnimatedStyle(() => ({ transform: [{ translateY: rightSpring.value }] }));

  return { leftSpringStyle, rightSpringStyle };
}

// ── Balance splitting (₹1,23,456.78 → { int: "1,23,456", dec: ".78" }) ─────

export function splitBalance(balance: number) {
  const formatted = Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const dotIdx = formatted.indexOf('.');
  return {
    int: dotIdx === -1 ? formatted : formatted.slice(0, dotIdx),
    dec: dotIdx === -1 ? '' : formatted.slice(dotIdx),
  };
}

// ── Account-type gradient (used by V2 hero) ────────────────────────────────

/**
 * Builds a 2-stop vertical gradient from an account type's color:
 *   top: the type color
 *   bottom: same color darkened ~32% (multiplied by 0.68)
 * Falls back to a neutral dark navy if the color isn't a hex string.
 */
export function buildAccountTypeGradient(
  accountType: string | undefined,
  typeColor: string,
): [string, string] {
  if (!accountType || !typeColor.startsWith('#') || typeColor.length < 7) {
    return ['#16192A', '#1A1E30'];
  }
  const r = parseInt(typeColor.slice(1, 3), 16);
  const g = parseInt(typeColor.slice(3, 5), 16);
  const b = parseInt(typeColor.slice(5, 7), 16);
  const darkFactor = 0.68;
  const dr = Math.round(r * darkFactor);
  const dg = Math.round(g * darkFactor);
  const db = Math.round(b * darkFactor);
  const darker = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  return [typeColor, darker];
}
