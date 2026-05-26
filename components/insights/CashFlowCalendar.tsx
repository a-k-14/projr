import React, { useState } from 'react';
import { View, useWindowDimensions, Pressable } from 'react-native';
import { Text } from '../ui/AppText';
import type { AppThemePalette } from '../../lib/theme';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { CARD_PADDING, HOME_TEXT, FONT_WEIGHT } from '../../lib/design';
import { formatCurrency } from '../../lib/derived';
import { formatDate, toLocalDateKey } from '../../lib/dateUtils';

const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface Props {
  data: { date: string; amount: number }[];
  fromDate: string;
  toDate: string;
  palette: AppThemePalette;
  sym: string;
  title: string;
  subtitle?: string;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const alphaByte = Math.round(clamped * 255).toString(16).padStart(2, '0');
  const base = hex.length === 9 ? hex.slice(0, 7) : hex;
  return `${base}${alphaByte}`;
}

function parseDateNoon(dateStr: string): Date {
  if (!dateStr || !dateStr.includes('-')) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CashFlowCalendar({ data, fromDate, toDate, palette, sym, title, subtitle }: Props): React.ReactElement | null {
  const { width } = useWindowDimensions();
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const chartWidth = width - SCREEN_GUTTER * 2 - CARD_PADDING * 2;
  const cellGap = 6;
  const cellSize = Math.floor((chartWidth - cellGap * 6) / 7);

  const spendingByDay = new Map<string, number>(data.map((d) => [d.date, d.amount]));
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  // Timezone-safe local date key parsing
  const fromKey = toLocalDateKey(fromDate);
  const toKey = toLocalDateKey(toDate);

  const start = parseDateNoon(fromKey);
  const startMon = new Date(start);
  startMon.setDate(start.getDate() - mondayIndex(start));

  const end = parseDateNoon(toKey);
  const endSun = new Date(end);
  endSun.setDate(end.getDate() + (6 - mondayIndex(end)));

  const diffMs = endSun.getTime() - startMon.getTime();
  const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  type CalCell = { key: string; inRange: boolean; amount: number };
  const cells: CalCell[] = [];
  const cur = new Date(startMon);
  
  for (let dIdx = 0; dIdx < totalDays; dIdx++) {
    const key = toDateKey(cur);
    const inRange = key >= fromKey && key <= toKey;
    cells.push({ key, inRange, amount: spendingByDay.get(key) ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  // Chunk into 7-day weeks
  const weeks: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const headerDate = parseDateNoon(fromKey);
  const monthLabel = headerDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const selectedAmount = selectedDayKey ? (spendingByDay.get(selectedDayKey) ?? 0) : 0;

  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        padding: CARD_PADDING,
        borderWidth: 1,
        borderColor: palette.divider,
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, minHeight: 52 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            {title}
          </Text>
          {subtitle && (
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
          {selectedDayKey ? (
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, marginTop: 6, fontWeight: '500' }}>
              Date: {formatDate(selectedDayKey + 'T00:00:00')}
            </Text>
          ) : (
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, marginTop: 6, fontWeight: '500' }}>
              Month: {monthLabel}
            </Text>
          )}
        </View>
        {selectedDayKey && (
          <View style={{ alignItems: 'flex-end', minWidth: 120 }}>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
              {formatCurrency(selectedAmount, sym)}
            </Text>
            <Text style={{ fontSize: HOME_TEXT.tiny + 0.5, color: palette.textMuted, marginTop: 2 }}>
              Spending
            </Text>
          </View>
        )}
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: 'row', marginBottom: cellGap }}>
        {DAY_HEADERS.map((day, i) => (
          <View key={day} style={{ width: cellSize, marginRight: i < 6 ? cellGap : 0, alignItems: 'center' }}>
            <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted }}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row', marginBottom: cellGap }}>
          {week.map((cell, di) => {
            const isSelected = selectedDayKey === cell.key;
            let bgColor: string;
            let borderWidth = 0;
            let borderColor = 'transparent';

            if (!cell.inRange) {
              bgColor = palette.isDark ? '#1F2937' : '#F1F5F9';
              borderWidth = 1;
              borderColor = palette.divider + '40';
            } else if (cell.amount === 0) {
              bgColor = palette.isDark ? '#374151' : '#E2E8F0';
            } else {
              const alpha = 0.25 + 0.75 * (cell.amount / maxAmount);
              bgColor = hexWithAlpha(palette.brand, alpha);
            }

            return (
              <Pressable
                key={`${wi}-${di}`}
                onPress={() => {
                  if (cell.inRange) {
                    setSelectedDayKey(selectedDayKey === cell.key ? null : cell.key);
                  }
                }}
                style={({ pressed }) => ({
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 4,
                  backgroundColor: bgColor,
                  marginRight: di < 6 ? cellGap : 0,
                  borderWidth: isSelected ? 2 : borderWidth,
                  borderColor: isSelected ? palette.text : borderColor,
                  opacity: pressed ? 0.7 : 1,
                  transform: isSelected ? [{ scale: 1.08 }] : undefined,
                  zIndex: isSelected ? 10 : 1,
                })}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
