import { AppChevron } from '@/components/ui/AppChevron';
import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ACTIVITY_LAYOUT, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import { TransactionType } from '../../types';
import { FilterChip } from '../ui/FilterChip';
import { FilterMoreButton } from '../ui/FilterMoreButton';

interface ActivityFilterBarProps {
  accountLabel: string;
  setShowAccountSheet: (show: boolean) => void;
  viewMode: 'date' | 'category';
  setViewMode: (mode: 'date' | 'category') => void;
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
  { label: 'Income', value: 'in' },
  { label: 'Expense', value: 'out' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Loan', value: 'loan' },
];

export function ActivityFilterBar({
  accountLabel,
  setShowAccountSheet,
  viewMode,
  setViewMode,
  typeFilter,
  setTypeFilter,
  setCashflowBucket,
  setShowMoreSheet,
  moreActiveCount,
  palette,
  periodNavigation }: ActivityFilterBarProps) {
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
          <AppChevron direction="down" size={15} tone="secondary" palette={palette} />
        </TouchableOpacity>

        {periodNavigation}
      </View>

      <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }]}>
        <ActivityViewModeToggle
          mode={viewMode}
          palette={palette}
          onChange={setViewMode}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingLeft: ACTIVITY_LAYOUT.controlChipGap, paddingRight: ACTIVITY_LAYOUT.controlChipGap, paddingBottom: 2 }}
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
          iconOnly
        />
      </View>
    </View>
  );
}

function ActivityViewModeToggle({
  mode,
  palette,
  onChange,
}: {
  mode: 'date' | 'category';
  palette: AppThemePalette;
  onChange: (mode: 'date' | 'category') => void;
}) {
  return (
    <View style={[styles.viewModeToggle, { borderColor: palette.divider }]}>
      {([
        { key: 'date', icon: 'list' },
        { key: 'category', icon: 'layout-grid' },
      ] as const).map((item) => {
        const selected = mode === item.key;
        return (
          <TouchableOpacity
            delayPressIn={0}
            key={item.key}
            activeOpacity={0.8}
            onPress={() => onChange(item.key)}
            style={[
              styles.viewModeButton,
              { backgroundColor: selected ? palette.surface : 'transparent' },
            ]}
          >
            <AppIcon
              name={item.icon}
              size={18}
              color={selected ? palette.brand : '#8C94AF'}
            />
          </TouchableOpacity>
        );
      })}
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
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F3F9',
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  viewModeButton: {
    width: 42,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
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
