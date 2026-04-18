import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View , TouchableOpacity} from 'react-native';
import { FilterChip } from '../ui/FilterChip';
import { ACTIVITY_LAYOUT, CARD_PADDING, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import { TransactionType } from '../../types';

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
            marginBottom: ACTIVITY_LAYOUT.headerRowGap },
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
              marginRight: ACTIVITY_LAYOUT.controlChipGap },
          ]}
        >
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text, flex: 1 }}>
            {accountLabel}
          </Text>
          <Ionicons name="chevron-down" size={13} color={palette.textMuted} />
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
        <TouchableOpacity delayPressIn={0}
          onPress={() => setShowMoreSheet(true)}
          activeOpacity={0.75}
          style={[
            styles.moreChip,
            {
              backgroundColor: moreActiveCount > 0 ? moreActiveBg : palette.surface,
              borderColor: moreActiveCount > 0 ? moreActiveBorder : palette.divider,
              marginLeft: ACTIVITY_LAYOUT.moreButtonGap },
          ]}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: moreActiveCount > 0 ? palette.brand : palette.textMuted }}
          >
            {moreActiveCount > 0 ? `More ${moreActiveCount}` : 'More'}
          </Text>
          <MaterialIcons name="filter-list" size={17} color={moreActiveCount > 0 ? palette.brand : palette.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center' },
  accountPicker: {
    height: ACTIVITY_LAYOUT.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ACTIVITY_LAYOUT.accountChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1.5 },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap },
  moreChip: {
    height: ACTIVITY_LAYOUT.controlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    minWidth: 84,
    gap: 6 } });
