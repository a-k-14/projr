import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Text } from '../ui/AppText';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT, FONT_WEIGHT } from '../../lib/design';

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface Props {
  data: { date: string; amount: number }[];
  fromDate: string;
  toDate: string;
  palette: AppThemePalette;
  sym: string;
}

/** Convert hex color + 0–1 alpha to a hex color string with alpha byte appended */
function hexWithAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const alphaByte = Math.round(clamped * 255).toString(16).padStart(2, '0');
  // Strip existing alpha if present (8-char hex)
  const base = hex.length === 9 ? hex.slice(0, 7) : hex;
  return `${base}${alphaByte}`;
}

/** Parse 'YYYY-MM-DD' as noon local time to avoid DST issues */
function parseDateNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday-first day index: 0 = Mon … 6 = Sun */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CashFlowCalendar({ data, fromDate, toDate, palette }: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();

  const chartWidth = width - SCREEN_GUTTER * 2 - CARD_PADDING * 2;
  const cellGap = 5;
  const cellSize = Math.floor((chartWidth - cellGap * 6) / 7);

  const spendingByDay = new Map<string, number>(data.map((d) => [d.date, d.amount]));
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  const fromKey = fromDate.split('T')[0];
  const toKey = toDate.split('T')[0];

  // Pad to the Monday on or before fromDate
  const start = parseDateNoon(fromKey);
  const startMon = parseDateNoon(toDateKey(start));
  startMon.setDate(startMon.getDate() - mondayIndex(startMon));

  // Pad to the Sunday on or after toDate
  const end = parseDateNoon(toKey);
  const endSun = parseDateNoon(toDateKey(end));
  endSun.setDate(endSun.getDate() + (6 - mondayIndex(endSun)));

  // Build weeks array
  type CalCell = { key: string; inRange: boolean; amount: number };
  const weeks: CalCell[][] = [];
  const cur = new Date(startMon);
  while (cur <= endSun) {
    const week: CalCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = toDateKey(cur);
      const inRange = key >= fromKey && key <= toKey;
      week.push({ key, inRange, amount: spendingByDay.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Header month/year label
  const headerDate = parseDateNoon(fromKey);
  const monthLabel = headerDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        padding: CARD_PADDING,
        borderWidth: 1,
        borderColor: palette.divider,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>Daily Spending</Text>
        <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>
          {monthLabel}
        </Text>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: 'row', marginBottom: cellGap }}>
        {DAY_HEADERS.map((day) => (
          <View key={day} style={{ width: cellSize, marginRight: cellGap, alignItems: 'center' }}>
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted }}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', marginBottom: cellGap }}>
          {week.map((cell, di) => {
            let bgColor: string;
            if (!cell.inRange) {
              bgColor = hexWithAlpha(palette.divider, 0.25);
            } else if (cell.amount === 0) {
              bgColor = hexWithAlpha(palette.brand, 0.08);
            } else {
              const alpha = 0.1 + 0.9 * (cell.amount / maxAmount);
              bgColor = hexWithAlpha(palette.brand, alpha);
            }
            return (
              <View
                key={`${wi}-${di}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 4,
                  backgroundColor: bgColor,
                  marginRight: di < 6 ? cellGap : 0,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
