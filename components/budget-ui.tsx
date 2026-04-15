import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, Text } from 'react-native';
import { BottomSheet } from './ui/BottomSheet';
import { HOME_RADIUS } from '../lib/layoutTokens';
import type { AppThemePalette } from '../lib/theme';

export function shiftBudgetMonth(iso: string, delta: number) {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth() + delta, 1, 0, 0, 0, 0).toISOString();
}

export function formatBudgetMonthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function buildBudgetMonthOptions(centerIso: string, before = 12, after = 12) {
  const months: string[] = [];
  for (let offset = before; offset > 0; offset -= 1) {
    months.push(shiftBudgetMonth(centerIso, -offset));
  }
  months.push(new Date(new Date(centerIso).getFullYear(), new Date(centerIso).getMonth(), 1, 0, 0, 0, 0).toISOString());
  for (let offset = 1; offset <= after; offset += 1) {
    months.push(shiftBudgetMonth(centerIso, offset));
  }
  return months;
}

function monthStartForYear(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0).toISOString();
}

function buildBudgetYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, monthIndex) => monthStartForYear(year, monthIndex));
}

export function BudgetMonthField({
  value,
  palette,
  onPress,
  onPrev,
  onNext,
}: {
  value: string;
  palette: AppThemePalette;
  onPress: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 48,
        borderRadius: HOME_RADIUS.pill,
        borderWidth: 1.5,
        borderColor: palette.divider,
        backgroundColor: palette.surface,
        paddingHorizontal: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {onPrev ? (
        <TouchableOpacity
          onPress={onPrev}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: HOME_RADIUS.tab, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={18} color={palette.text} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={{
          flex: 1,
          minHeight: 40,
          paddingHorizontal: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: palette.text, textAlign: 'center' }}>
          {formatBudgetMonthLabel(value)}
        </Text>
        {!onPrev && !onNext ? <Ionicons name="chevron-down" size={15} color={palette.textMuted} /> : null}
      </TouchableOpacity>
      {onNext ? (
        <TouchableOpacity
          onPress={onNext}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: HOME_RADIUS.tab, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={18} color={palette.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function BudgetMonthSheet({
  visible,
  palette,
  selectedMonth,
  onSelect,
  onClose,
  title = 'Select month',
  hasNavBar = false,
}: {
  visible: boolean;
  palette: AppThemePalette;
  selectedMonth: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  title?: string;
  hasNavBar?: boolean;
}) {
  const selectedDate = new Date(selectedMonth);
  const [selectedYear, setSelectedYear] = useState(selectedDate.getFullYear());

  useEffect(() => {
    if (!visible) return;
    setSelectedYear(new Date(selectedMonth).getFullYear());
  }, [selectedMonth, visible]);

  const options = useMemo(() => buildBudgetYearMonths(selectedYear), [selectedYear]);

  if (!visible) return null;

  return (
    <BottomSheet
      title={title}
      palette={palette}
      onClose={onClose}
      hasNavBar={hasNavBar}
      disableModalHeightBoost={!hasNavBar}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
        <View
          style={{
            minHeight: 48,
            borderRadius: HOME_RADIUS.card,
            backgroundColor: palette.inputBg,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedYear((year) => year - 1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 40, height: 40, borderRadius: HOME_RADIUS.tab, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={18} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: palette.text }}>{selectedYear}</Text>
          <TouchableOpacity
            onPress={() => setSelectedYear((year) => year + 1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 40, height: 40, borderRadius: HOME_RADIUS.tab, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-forward" size={18} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {options.map((month) => {
          const isSelected = month === selectedMonth;
          return (
            <TouchableOpacity
              key={month}
              onPress={() => {
                onSelect(month);
                onClose();
              }}
              activeOpacity={0.75}
              style={{
                width: '31%',
                minHeight: 44,
                borderRadius: HOME_RADIUS.tab,
                borderWidth: 1.5,
                borderColor: isSelected ? palette.budget : palette.divider,
                backgroundColor: isSelected ? palette.budgetSoft : palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? palette.budget : palette.text }}>
                {new Date(month).toLocaleDateString('en-IN', { month: 'short' })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}
