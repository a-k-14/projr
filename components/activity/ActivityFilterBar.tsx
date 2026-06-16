import { AppIcon } from '@/components/ui/AppIcon';
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ACTIVITY_LAYOUT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import { TransactionType } from '../../types';
import { AccountPickerButton } from '../ui/AccountPickerButton';
import { FilterChip } from '../ui/FilterChip';
import { FilterMoreButton } from '../ui/FilterMoreButton';

interface ActivityFilterBarProps {
  accountLabel: string;
  setShowAccountSheet: (show: boolean) => void;
  viewMode: 'date' | 'category';
  setViewMode: (mode: 'date' | 'category') => void;
  typeFilter: TransactionType | 'all';
  setTypeFilter: (type: TransactionType | 'all') => void;
  cashflowBucket: 'all' | 'in' | 'out' | 'net';
  setCashflowBucket: (bucket: 'all' | 'in' | 'out' | 'net') => void;
  setShowMoreSheet: (show: boolean) => void;
  moreActiveCount: number;
  palette: AppThemePalette;
  periodNavigation: React.ReactNode;
  chipScrollResetToken?: number;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function ActivityFilterBar({
  accountLabel,
  setShowAccountSheet,
  viewMode,
  setViewMode,
  typeFilter,
  setTypeFilter,
  cashflowBucket,
  setCashflowBucket,
  setShowMoreSheet,
  moreActiveCount,
  palette,
  periodNavigation,
  chipScrollResetToken = 0,
  isExpanded,
  setIsExpanded }: ActivityFilterBarProps) {
  const chipScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    chipScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [chipScrollResetToken]);

  const hasActiveFiltersOnLine2 =
    accountLabel !== 'All Accounts' ||
    typeFilter !== 'all' ||
    cashflowBucket !== 'all' ||
    moreActiveCount > 0;

  const expansion = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    expansion.value = withTiming(isExpanded ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isExpanded]);

  const prevHasActiveFilters = useRef(hasActiveFiltersOnLine2);

  useEffect(() => {
    if (prevHasActiveFilters.current && !hasActiveFiltersOnLine2 && isExpanded) {
      setIsExpanded(false);
    }
    prevHasActiveFilters.current = hasActiveFiltersOnLine2;
  }, [hasActiveFiltersOnLine2, isExpanded, setIsExpanded]);

  const animStyle = useAnimatedStyle(() => ({
    // Row 2 (36) + gap (8) + Row 3 (52) = 96
    height: expansion.value * 96,
    opacity: expansion.value,
  }));

  const outerStyle = useAnimatedStyle(() => ({
    paddingBottom: (1 - expansion.value) * 6,
  }));

  const row1Style = useAnimatedStyle(() => ({
    marginBottom: expansion.value * ACTIVITY_LAYOUT.headerRowGap,
  }));

  return (
    <Animated.View style={outerStyle}>
      {/* Row 1: Period navigation centered */}
      <Animated.View
        style={[
          styles.row,
          row1Style,
          { 
            paddingHorizontal: 10,
            justifyContent: 'center',
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          {periodNavigation}
        </View>
      </Animated.View>

      {/* Rows 2 + 3 — collapse together */}
      <Animated.View style={[animStyle, { overflow: 'hidden' }]}>
        {/* Row 2: List/Group toggle | Account picker | More filters */}
        <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, height: ACTIVITY_LAYOUT.controlHeight, marginBottom: ACTIVITY_LAYOUT.headerRowGap }]}>
          <ActivityViewModeToggle
            mode={viewMode}
            palette={palette}
            onChange={setViewMode}
          />

          <View style={{ flex: 1, marginLeft: ACTIVITY_LAYOUT.controlChipGap, marginRight: ACTIVITY_LAYOUT.controlChipGap }}>
            <AccountPickerButton
              label={accountLabel}
              onPress={() => setShowAccountSheet(true)}
              palette={palette}
              compact
            />
          </View>

          <FilterMoreButton
            palette={palette}
            moreActiveCount={moreActiveCount}
            onPress={() => setShowMoreSheet(true)}
            iconOnly
          />
        </View>

        {/* Row 3: Type filter chips */}
        <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, height: 40, marginBottom: 12 }]}>
          <ScrollView
            ref={chipScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingRight: ACTIVITY_LAYOUT.controlChipGap, paddingBottom: 2 }}
          >
            <View style={styles.chipRow}>
              {(() => {
                const typeOptions = [
                  { label: 'All', key: 'all' },
                  { label: 'Income', key: 'in' },
                  { label: 'Expense', key: 'out' },
                  { label: 'Transfer', key: 'transfer' },
                  { label: 'Deposit', key: 'deposit' },
                  { label: 'Loan', key: 'loan' },
                ] as const;

                return typeOptions.map((option) => {
                  let isActive = false;
                  if (option.key === 'all') {
                    isActive = typeFilter === 'all' && cashflowBucket === 'all';
                  } else if (option.key === 'in') {
                    isActive = typeFilter === 'in' && cashflowBucket === 'all';
                  } else if (option.key === 'out') {
                    isActive = typeFilter === 'out' && cashflowBucket === 'all';
                  } else {
                    isActive = typeFilter === option.key;
                  }

                  return (
                    <FilterChip
                      key={option.key}
                      label={option.label}
                      isActive={isActive}
                      onPress={() => {
                        if (option.key === 'all') {
                          setTypeFilter('all');
                          setCashflowBucket('all');
                        } else {
                          setTypeFilter(option.key);
                          setCashflowBucket('all');
                        }
                      }}
                      palette={palette}
                    />
                  );
                });
              })()}
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </Animated.View>
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
    <View style={[styles.viewModeToggle, { borderColor: palette.divider, backgroundColor: palette.states.activitySegmentedBg }]}>
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
              color={selected ? palette.brand : palette.iconTint}
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap
  },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    height: ACTIVITY_LAYOUT.controlHeight,
  },
  viewModeButton: {
    width: 42,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  expandButton: {
    height: ACTIVITY_LAYOUT.controlHeight,
    width: 48,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
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
