import { useState, useCallback, useMemo } from 'react';
import {
  getNavigableDateRange,
  toLocalDayStartISO,
  toLocalDayEndISO,
  getPeriodNavLabel,
  getLast30DaysRange,
} from './dateUtils';
import { useUIStore } from '../stores/useUIStore';

export type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom' | 'preset' | 'last30';

export interface DateFilterOptions {
  initialPeriod?: FilterPeriod;
  initialOffset?: number;
  initialCustomRange?: { from: string; to: string } | null;
}

export function useDateFilter(options: DateFilterOptions = {}) {
  const { initialPeriod = 'month', initialOffset = 0, initialCustomRange = null } = options;
  const settingsYearStart = useUIStore((s: any) => s.settings.yearStart);

  const [period, setPeriod] = useState<FilterPeriod>(initialPeriod);
  const [offset, setOffset] = useState<number>(initialOffset);
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(initialCustomRange);
  
  // Explicit bounds for 'preset' or 'all' if we want to override
  const [presetBounds, setPresetBounds] = useState<{ from: string; to: string } | null>(null);

  const handleSetPeriod = useCallback((newPeriod: FilterPeriod) => {
    setPeriod(newPeriod);
    setOffset(0);
    if (newPeriod !== 'custom') setCustomRange(null);
    if (newPeriod !== 'preset') setPresetBounds(null);
  }, []);

  const { from, to } = useMemo(() => {
    if (period === 'all') {
      return { from: '1970-01-01T00:00:00.000Z', to: toLocalDayEndISO(new Date()) };
    }
    
    if (period === 'last30') {
      return getLast30DaysRange();
    }
    
    if (period === 'preset' && presetBounds) {
      return presetBounds;
    }

    if (period === 'custom' && customRange) {
      return customRange;
    }

    if (period === 'today') {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return {
        from: toLocalDayStartISO(d),
        to: toLocalDayEndISO(d),
      };
    }

    // Default to navigable types: week, month, year
    const navPeriod = (period === 'week' || period === 'month' || period === 'year') ? period : 'month';
    return getNavigableDateRange(navPeriod, offset, settingsYearStart);
  }, [period, offset, customRange, presetBounds, settingsYearStart]);

  const label = useMemo(() => {
    if (period === 'all') return 'All Time';
    if (period === 'last30') return 'Last 30 Days';
    if (period === 'preset') {
      // In the future, we could pass a preset label state, but usually presets have their own UI tabs.
      return 'Selected Range';
    }
    // Handle 'today' offset explicitly to show 'Yesterday', 'Tomorrow', etc.
    if (period === 'today') {
      if (offset === 0) return 'Today';
      if (offset === -1) return 'Yesterday';
      if (offset === 1) return 'Tomorrow';
      return new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const mapPeriod = 
      period === 'custom' ? 'custom' : 
      (period === 'week' || period === 'month' || period === 'year') ? period : 'month';

    return getPeriodNavLabel(mapPeriod, from, to);
  }, [period, from, to, offset]);

  const navigatePrevious = useCallback(() => {
    if (period !== 'custom' && period !== 'all' && period !== 'preset' && period !== 'last30') {
      setOffset((o) => o - 1);
    }
  }, [period]);

  const navigateNext = useCallback(() => {
    if (period !== 'custom' && period !== 'all' && period !== 'preset' && period !== 'last30') {
      setOffset((o) => o + 1);
    }
  }, [period]);

  const canNavigateNext = period !== 'custom' && period !== 'all' && period !== 'preset' && period !== 'last30' && offset < 0;

  return {
    period,
    setPeriod: handleSetPeriod,
    offset,
    setOffset,
    customRange,
    setCustomRange,
    presetBounds,
    setPresetBounds,
    from,
    to,
    label,
    navigatePrevious,
    navigateNext,
    canNavigateNext,
  };
}
