import { AppIcon } from '@/components/ui/AppIcon';
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ACTIVITY_LAYOUT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';
import { TransactionType } from '../../types';
import { FilterChip } from '../ui/FilterChip';
import { AccountPickerButton } from '../ui/AccountPickerButton';
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
  chipScrollResetToken = 0 }: ActivityFilterBarProps) {
  const chipScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    chipScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [chipScrollResetToken]);

  const hasActiveFiltersOnLine2 =
    accountLabel !== 'All Accounts' ||
    typeFilter !== 'all' ||
    cashflowBucket !== 'all' ||
    moreActiveCount > 0;

  const [isExpanded, setIsExpanded] = React.useState(hasActiveFiltersOnLine2);

  const expansion = useSharedValue(hasActiveFiltersOnLine2 ? 1 : 0);

  useEffect(() => {
    expansion.value = withTiming(isExpanded ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isExpanded]);

  useEffect(() => {
    if (!hasActiveFiltersOnLine2 && isExpanded) {
      setIsExpanded(false);
    }
  }, [hasActiveFiltersOnLine2]);

  const toggleExpand = () => {
    setIsExpanded(prev => !prev);
  };

  const animStyle = useAnimatedStyle(() => ({
    height: expansion.value * 52,
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
      <Animated.View
        style={[
          styles.row,
          row1Style,
          {
            paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
          },
        ]}
      >
        <View style={{ flex: 1, marginRight: ACTIVITY_LAYOUT.controlChipGap }}>
          {periodNavigation}
        </View>

        <ActivityViewModeToggle
          mode={viewMode}
          palette={palette}
          onChange={setViewMode}
        />

        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.75}
          onPress={toggleExpand}
          style={[
            styles.expandButton,
            {
              backgroundColor: 'transparent',
            }
          ]}
        >
          <AppIcon
            name="sliders-horizontal"
            size={18}
            color={isExpanded ? palette.textSecondary : palette.textMuted}
          />
          {hasActiveFiltersOnLine2 && !isExpanded && (
            <View
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: palette.brand,
              }}
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[animStyle, { overflow: 'hidden' }]}>
        <View style={[styles.row, { paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, height: 40, marginBottom: 12 }]}>
          <AccountPickerButton
            label={accountLabel}
            onPress={() => setShowAccountSheet(true)}
            palette={palette}
            compact
            width={122}
            style={{ marginRight: 8 }}
          />
          <ScrollView
            ref={chipScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingLeft: ACTIVITY_LAYOUT.controlChipGap, paddingRight: ACTIVITY_LAYOUT.controlChipGap, paddingBottom: 2 }}
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
          <FilterMoreButton
            palette={palette}
            moreActiveCount={moreActiveCount}
            onPress={() => setShowMoreSheet(true)}
            iconOnly
          />
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
    width: ACTIVITY_LAYOUT.controlHeight,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: ACTIVITY_LAYOUT.controlChipGap,
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
