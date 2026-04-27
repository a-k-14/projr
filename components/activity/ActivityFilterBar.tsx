import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ACTIVITY_LAYOUT, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import { FilterMoreButton } from '../ui/FilterMoreButton';
import { TransactionType } from '../../types';
import { FilterChip } from '../ui/FilterChip';

interface ActivityFilterBarProps {
  accountLabel: string;
  setShowAccountSheet: (show: boolean) => void;
  typeFilter: TransactionType | 'all';
  setTypeFilter: (type: TransactionType | 'all') => void;
  setCashflowBucket: (bucket: 'all' | 'in' | 'out' | 'net') => void;
  setShowMoreSheet: (show: boolean) => void;
  moreActiveCount: number;
  palette: AppThemePalette;
  periodNavigation: React.ReactNode;
}

const TYPE_OPTIONS: { label: string; value: TransactionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'In', value: 'in' },
  { label: 'Out', value: 'out' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Loan', value: 'loan' },
];

export function ActivityFilterBar({
  accountLabel,
  setShowAccountSheet,
  typeFilter,
  setTypeFilter,
  setCashflowBucket,
  setShowMoreSheet,
  moreActiveCount,
  palette,
  periodNavigation }: ActivityFilterBarProps) {
  const moreActiveBg = palette.brandSoft;
  const moreActiveBorder = palette.brand;

  return (
    <View>
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
            marginBottom: ACTIVITY_LAYOUT.headerRowGap
          },
        ]}
      >
        <TouchableOpacity delayPressIn={0}
          onPress={() => setShowAccountSheet(true)}
          style={[
            styles.accountPicker,
            {
              backgroundColor: palette.surface,
              borderColor: palette.divider,
              width: ACTIVITY_LAYOUT.accountPickerWidth,
              marginRight: ACTIVITY_LAYOUT.controlChipGap
            },
          ]}
        >
          <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text, flex: 1 }}>
            {accountLabel}
          </Text>
          <Feather name="chevron-down" size={13} color={palette.textMuted} />
        </TouchableOpacity>

        {periodNavigation}
      </View>

      <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingRight: ACTIVITY_LAYOUT.controlChipGap, paddingBottom: 2 }}
        >
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                isActive={typeFilter === option.value}
                onPress={() => {
                  setTypeFilter(option.value);
                  setCashflowBucket(
                    option.value === 'in' || option.value === 'out' ? option.value : 'all',
                  );
                }}
                palette={palette}
              />
            ))}
          </View>
        </ScrollView>
        <FilterMoreButton
          palette={palette}
          moreActiveCount={moreActiveCount}
          onPress={() => setShowMoreSheet(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  accountPicker: {
    height: ACTIVITY_LAYOUT.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ACTIVITY_LAYOUT.accountChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap
  },
  moreChip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    minWidth: 84,
    flexShrink: 0,
    gap: 6
  }
});
