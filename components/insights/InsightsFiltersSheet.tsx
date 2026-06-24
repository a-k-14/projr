import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ChoiceRow } from '@/components/settings-ui';
import { FilterChip } from '@/components/ui/FilterChip';
import { AccountTypeBadge } from '@/components/activity/ActivityUI';
import { ListHeading } from '@/components/ui/ListHeading';

import { FONT_WEIGHT } from '../../lib/design';
import { BOTTOM_SHEET_TOKENS, HELP_TEXTS, HOME_TEXT, SPACING } from '../../lib/layoutTokens';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import { type AppThemePalette } from '../../lib/theme';
import type { Account } from '../../types';

export type RangePresetKey = 'last7' | 'last30' | 'last90' | 'ytd' | 'prevMonth' | 'prevYear';

interface RangePreset {
  key: RangePresetKey;
  label: string;
}

interface InsightsFiltersSheetProps {
  palette: AppThemePalette;
  onClose: () => void;

  cashflowMode: 'incomeExpense' | 'total';
  onCashflowModeChange: (mode: 'incomeExpense' | 'total') => void;

  rangePresets: RangePreset[];
  selectedRangeKey: RangePresetKey | null;
  onSelectRange: (key: RangePresetKey) => void;

  accounts: Account[];
  selectedAccountId: string | 'all';
  onSelectAccount: (id: string | 'all') => void;
}

const NOTE_HEIGHT = 30;

export function InsightsFiltersSheet({
  palette,
  onClose,
  cashflowMode,
  onCashflowModeChange,
  rangePresets,
  selectedRangeKey,
  onSelectRange,
  accounts,
  selectedAccountId,
  onSelectAccount,
}: InsightsFiltersSheetProps) {
  const isCashflow = cashflowMode === 'total';
  const noteProgress = useSharedValue(isCashflow ? 1 : 0);

  useEffect(() => {
    noteProgress.value = withTiming(isCashflow ? 1 : 0, { duration: 220 });
  }, [isCashflow]); // eslint-disable-line react-hooks/exhaustive-deps

  const noteStyle = useAnimatedStyle(() => ({
    height: noteProgress.value * NOTE_HEIGHT,
    opacity: noteProgress.value,
  }));

  return (
    <BottomSheet
      title="Filters"
      palette={palette}
      onClose={onClose}
      hasNavBar
      maxHeightRatio={BOTTOM_SHEET_TOKENS.filterWithNavBarMaxHeight}
    >
      {/* Cashflow toggle row */}
      <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            Cashflow
          </Text>
          <AppSwitch
            value={isCashflow}
            onValueChange={(v) => onCashflowModeChange(v ? 'total' : 'incomeExpense')}
            palette={palette}
            width={36}
            height={21}
            thumbSize={15}
            padding={3}
          />
        </View>
        <Animated.View style={noteStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 }}>
            <AppIcon name="info" size={11} color={palette.textMuted} strokeWidth={1.8} />
            <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, letterSpacing: 0.1 }}>
              {HELP_TEXTS.cashflowNote}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Range presets — complement the inline period switcher with rolling windows */}
      <ListHeading label="Range" palette={palette} />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.md,
          gap: 8,
        }}
      >
        {rangePresets.map((preset) => (
          <FilterChip
            key={preset.key}
            palette={palette}
            label={preset.label}
            isActive={preset.key === selectedRangeKey}
            onPress={() => onSelectRange(preset.key)}
          />
        ))}
      </View>

      {/* Accounts */}
      <ListHeading label="Account" palette={palette} />
      <ChoiceRow
        title="All Accounts"
        selected={selectedAccountId === 'all'}
        palette={palette}
        leftElement={<AccountTypeBadge palette={palette} />}
        onPress={() => onSelectAccount('all')}
        noBorder={accounts.length === 0}
      />
      {accounts.map((account, index) => (
        <ChoiceRow
          key={account.id}
          title={account.name}
          subtitle={getAccountTypeLabel(account.type)}
          selected={selectedAccountId === account.id}
          palette={palette}
          leftElement={<AccountTypeBadge account={account} palette={palette} />}
          onPress={() => onSelectAccount(account.id)}
          noBorder={index === accounts.length - 1}
        />
      ))}
    </BottomSheet>
  );
}
