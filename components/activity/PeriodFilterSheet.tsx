import { Text } from '@/components/ui/AppText';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { BottomSheet } from '../ui/BottomSheet';
import { ChoiceRow } from '../settings-ui';
import { ListHeading } from '../ui/ListHeading';
import { AppIcon } from '../ui/AppIcon';
import { CARD_PADDING, FONT_WEIGHT } from '../../lib/design';
import { BOTTOM_SHEET_TOKENS, HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { getNavigableDateRange, getPeriodNavLabel, toLocalDayEndISO, toLocalDayStartISO } from '../../lib/dateUtils';
import { formatDateFull } from '../../lib/ui-format';
import { type AppThemePalette } from '../../lib/theme';

export type FilterPeriod = 'all' | 'day' | 'week' | 'month' | 'year' | 'custom';

function rangeLabel(period: 'week' | 'month' | 'year', yearStart: number, offset: number) {
  const range = getNavigableDateRange(period, offset, yearStart);
  return getPeriodNavLabel(period, range.from, range.to);
}

interface PeriodFilterSheetProps {
  period: FilterPeriod;
  periodOffset: number;
  customFrom?: string;
  customTo?: string;
  yearStart: number;
  palette: AppThemePalette;
  /** Quick options (All Time / Today / Yesterday / This Week|Month|Year). */
  onSelectPeriod: (period: FilterPeriod, offset: number) => void;
  /** Custom range Apply (both dates chosen). */
  onApplyCustom: (from: string, to: string) => void;
  onClose: () => void;
}

/** Period selector shared by the Activity filter bar and the Export screen. */
export function PeriodFilterSheet({
  period,
  periodOffset,
  customFrom,
  customTo,
  yearStart,
  palette,
  onSelectPeriod,
  onApplyCustom,
  onClose,
}: PeriodFilterSheetProps) {
  const [pendingFrom, setPendingFrom] = useState<string | undefined>(customFrom);
  const [pendingTo, setPendingTo] = useState<string | undefined>(customTo);

  const openFromPicker = () => {
    DateTimePickerAndroid.open({
      value: pendingFrom ? new Date(pendingFrom) : new Date(),
      mode: 'date',
      display: 'calendar',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        setPendingFrom(toLocalDayStartISO(date));
      },
    });
  };

  const openToPicker = () => {
    DateTimePickerAndroid.open({
      value: pendingTo ? new Date(pendingTo) : new Date(),
      mode: 'date',
      display: 'calendar',
      minimumDate: pendingFrom ? new Date(pendingFrom) : undefined,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        setPendingTo(toLocalDayEndISO(date));
      },
    });
  };

  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  })();

  return (
    <BottomSheet title="Period" palette={palette} onClose={onClose} hasNavBar maxHeightRatio={BOTTOM_SHEET_TOKENS.filterWithNavBarMaxHeight}>
      <ChoiceRow title="All Time" selected={period === 'all'} palette={palette} onPress={() => onSelectPeriod('all', 0)} />
      <ChoiceRow
        title="Today"
        subtitle={formatDateFull(new Date().toISOString())}
        selected={period === 'day' && periodOffset === 0}
        palette={palette}
        onPress={() => onSelectPeriod('day', 0)}
      />
      <ChoiceRow
        title="Yesterday"
        subtitle={formatDateFull(yesterday)}
        selected={period === 'day' && periodOffset === -1}
        palette={palette}
        onPress={() => onSelectPeriod('day', -1)}
      />
      <ChoiceRow
        title="This Week"
        subtitle={rangeLabel('week', yearStart, 0)}
        selected={period === 'week'}
        palette={palette}
        onPress={() => onSelectPeriod('week', 0)}
      />
      <ChoiceRow
        title="This Month"
        subtitle={rangeLabel('month', yearStart, 0)}
        selected={period === 'month'}
        palette={palette}
        onPress={() => onSelectPeriod('month', 0)}
      />
      <ChoiceRow
        title="This Year"
        subtitle={rangeLabel('year', yearStart, 0)}
        selected={period === 'year'}
        palette={palette}
        onPress={() => onSelectPeriod('year', 0)}
      />
      <View style={{ backgroundColor: palette.background, paddingHorizontal: CARD_PADDING, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderTopColor: palette.divider }}>
        <ListHeading label="Custom Range" palette={palette} paddingHorizontal={0} paddingTop={0} paddingBottom={10} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <TouchableOpacity
            delayPressIn={0}
            onPress={openFromPicker}
            style={[styles.dateField, { borderColor: pendingFrom ? palette.brand : palette.divider, backgroundColor: palette.surface, justifyContent: 'center' }]}
          >
            <Text style={{ fontSize: HOME_TEXT.body, color: pendingFrom ? palette.text : palette.textSoft }}>
              {pendingFrom ? formatDateFull(pendingFrom) : 'From'}
            </Text>
          </TouchableOpacity>
          <AppIcon name="arrow-right" size={18} color={palette.textSoft} />
          <TouchableOpacity
            delayPressIn={0}
            onPress={openToPicker}
            style={[styles.dateField, { borderColor: pendingTo ? palette.brand : palette.divider, backgroundColor: palette.surface, justifyContent: 'center' }]}
          >
            <Text style={{ fontSize: HOME_TEXT.body, color: pendingTo ? palette.text : palette.textSoft }}>
              {pendingTo ? formatDateFull(pendingTo) : 'To'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          delayPressIn={0}
          onPress={() => { if (pendingFrom && pendingTo) onApplyCustom(pendingFrom, pendingTo); }}
          style={[styles.applyBtn, { height: 48, borderRadius: HOME_RADIUS.pill, backgroundColor: pendingFrom && pendingTo ? palette.brand : palette.borderSoft }]}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.bold, color: palette.onBrand }}>Apply</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  dateField: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  applyBtn: { alignItems: 'center', justifyContent: 'center' },
});
