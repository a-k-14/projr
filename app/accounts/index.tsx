import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/AppText';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';

import { formatAccountDisplayName } from '../../lib/account-utils';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { formatCurrency } from '../../lib/derived';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_TEXT, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { AppIcon } from '../../components/ui/AppIcon';
import { HeaderAddButton, HeaderIconButton, ScreenHeader } from '../../components/ui/ScreenHeader';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { getScrollableBottomPadding, SystemBottomGuard } from '../../components/ui/safeBottom';
import { ChoiceRow } from '../../components/settings-ui';
import type { Account } from '../../types';

type SortOption = { key: SortMode; direction?: SortDirection; title: string };
type SortMode = 'alpha' | 'balance' | 'custom';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: SortOption[] = [
  { key: 'alpha', direction: 'asc', title: 'A-Z' },
  { key: 'alpha', direction: 'desc', title: 'Z-A' },
  { key: 'balance', direction: 'asc', title: 'Balance: Low to High' },
  { key: 'balance', direction: 'desc', title: 'Balance: High to Low' },
  { key: 'custom', title: 'Custom' },
];

function sortAccountsForMode(
  source: Account[],
  mode: SortMode,
  alphaDirection: SortDirection,
  balanceDirection: SortDirection,
) {
  if (mode === 'alpha') {
    const directionMultiplier = alphaDirection === 'asc' ? 1 : -1;
    return source.slice().sort((a, b) => {
      const cmp = directionMultiplier * formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
        formatAccountDisplayName(b.name, b.accountNumber),
        'en',
        { sensitivity: 'base' },
      );
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });
  }
  if (mode === 'balance') {
    return source.slice().sort((a, b) => {
      const cmp = balanceDirection === 'asc' ? a.balance - b.balance : b.balance - a.balance;
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });
  }
  return source;
}

function accountsHaveSameOrder(left: Account[], right: Account[]) {
  return left.length === right.length && left.every((account, index) => account.id === right[index]?.id);
}

export default function AllAccountsScreen() {
  const { palette } = useAppTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const setOrder = useAccountsStore((s) => s.setOrder);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySymbol = showCurrencySymbol ? currencySymbol : '';
  const insets = useSafeAreaInsets();
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const isAlphaAsc = accountsHaveSameOrder(accounts, sortAccountsForMode(accounts, 'alpha', 'asc', 'asc'));
    const isAlphaDesc = accountsHaveSameOrder(accounts, sortAccountsForMode(accounts, 'alpha', 'desc', 'asc'));
    if (isAlphaAsc || isAlphaDesc) return 'alpha';
    const isBalanceAsc = accountsHaveSameOrder(accounts, sortAccountsForMode(accounts, 'balance', 'asc', 'asc'));
    const isBalanceDesc = accountsHaveSameOrder(accounts, sortAccountsForMode(accounts, 'balance', 'asc', 'desc'));
    if (isBalanceAsc || isBalanceDesc) return 'balance';
    return 'custom';
  });
  const [alphaDirection, setAlphaDirection] = useState<SortDirection>(() => {
    return accountsHaveSameOrder(accounts, sortAccountsForMode(accounts, 'alpha', 'desc', 'asc')) ? 'desc' : 'asc';
  });
  const [balanceDirection, setBalanceDirection] = useState<SortDirection>(() => {
    return accountsHaveSameOrder(accounts, sortAccountsForMode(accounts, 'balance', 'asc', 'desc')) ? 'desc' : 'asc';
  });
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [customAccounts, setCustomAccounts] = useState(accounts);
  const [customDirty, setCustomDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    setCustomAccounts(accounts);
  }, [accounts]);

  const displayedAccounts = useMemo(() => {
    return sortMode === 'custom'
      ? customAccounts
      : sortAccountsForMode(accounts, sortMode, alphaDirection, balanceDirection);
  }, [accounts, alphaDirection, balanceDirection, customAccounts, sortMode]);

  const persistSortedOrder = async (mode: SortMode, nextAlphaDirection = alphaDirection, nextBalanceDirection = balanceDirection) => {
    if (mode === 'custom') return;
    const sorted = sortAccountsForMode(accounts, mode, nextAlphaDirection, nextBalanceDirection);
    setCustomAccounts(sorted);
    await setOrder(sorted.map((account) => account.id));
    setCustomDirty(false);
  };

  const saveCustomOrder = async () => {
    setIsSavingOrder(true);
    try {
      await setOrder(customAccounts.map((account) => account.id));
      setCustomDirty(false);
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
              <ScreenHeader
                title="Accounts"
                onBack={() => router.back()}
                palette={palette}
                rightAction={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {sortMode === 'custom' && customDirty ? (
                      <View style={{ opacity: isSavingOrder ? 0.55 : 1 }}>
                        <HeaderIconButton 
                          icon="check" 
                          palette={palette} 
                          onPress={saveCustomOrder} 
                          active={true}
                        />
                      </View>
                    ) : (
                      <HeaderIconButton icon="arrow-up-down" palette={palette} onPress={() => setShowSortSheet(true)} />
                    )}
                    <HeaderAddButton palette={palette} onPress={() => router.push('/settings/account-form')} />
                  </View>
                }
              />
            </View>
          )
        }} 
      />

      <DraggableFlatList
        key={sortMode === 'custom' && customDirty ? 'custom-editing' : `sort-${sortMode}`}
        data={displayedAccounts}
        keyExtractor={(item) => item.id}
        activationDistance={sortMode === 'custom' && customDirty ? 8 : 9999}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: 10,
          paddingBottom: getScrollableBottomPadding(insets, 120),
        }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onDragEnd={({ data }) => {
          setCustomAccounts(data);
          if (sortMode === 'custom') setCustomDirty(true);
        }}
        renderItem={(params) => (
          <AccountCard
            {...params}
            palette={palette}
            currencySymbol={displaySymbol}
            customMode={sortMode === 'custom' && customDirty}
            onPress={() => router.push(`/account/${params.item.id}`)}
          />
        )}
      />

      {showSortSheet ? (
        <BottomSheet title="Sort Accounts" palette={palette} onClose={() => setShowSortSheet(false)}>
          {SORT_OPTIONS.map((option, index) => {
            const isSelected = sortMode === option.key && (option.key === 'custom' || (option.key === 'alpha' ? alphaDirection : balanceDirection) === option.direction);
            return (
              <ChoiceRow
                key={`${option.key}-${option.direction ?? 'custom'}`}
                title={option.title}
                selected={isSelected}
                palette={palette}
                noBorder={index === SORT_OPTIONS.length - 1}
                leftElement={
                  <AppIcon
                    name={getSortOptionIcon(option.key, option.direction ?? 'asc')}
                    size={20}
                    color={palette.brand}
                    strokeWidth={1.8}
                  />
                }
                onPress={() => {
                  if (option.key === 'alpha' && option.direction) {
                    setSortMode('alpha');
                    setAlphaDirection(option.direction);
                    persistSortedOrder('alpha', option.direction, balanceDirection).catch(() => undefined);
                  } else if (option.key === 'balance' && option.direction) {
                    setSortMode('balance');
                    setBalanceDirection(option.direction);
                    persistSortedOrder('balance', alphaDirection, option.direction).catch(() => undefined);
                  } else if (option.key === 'custom') {
                    setSortMode('custom');
                    setCustomDirty(true);
                  }
                  setShowSortSheet(false);
                }}
              />
            );
          })}
        </BottomSheet>
      ) : null}
      <SystemBottomGuard />
    </View>
  );
}

function getSortOptionIcon(mode: SortMode, direction: SortDirection) {
  if (mode === 'alpha') return direction === 'asc' ? 'arrow-down-a-z' : 'arrow-down-z-a';
  if (mode === 'balance') return direction === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow';
  return 'grip-vertical';
}

function AccountCard({
  item,
  drag,
  customMode,
  currencySymbol,
  palette,
  onPress,
}: RenderItemParams<Account> & {
  customMode: boolean;
  currencySymbol: string;
  palette: AppThemePalette;
  onPress: (accountId: string) => void;
}) {
  const typeLabel = getAccountTypeLabel(item.type);
  const isNegative = item.balance < 0;
  const typeMeta = ACCOUNT_TYPE_META[item.type];

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.72}
      onPress={() => onPress(item.id)}
      onLongPress={customMode ? drag : undefined}
      style={{
        backgroundColor: palette.surface,
        borderRadius: HOME_RADIUS.cardSm,
        borderWidth: 1,
        borderColor: palette.isDark ? 'rgba(255,255,255,0.10)' : '#E2E7F0',
        paddingHorizontal: 16,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 84,
      }}
    >
      {customMode ? (
        <TouchableOpacity
          delayLongPress={120}
          onLongPress={drag}
          activeOpacity={0.7}
          style={{
            width: 32,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            marginLeft: -8,
            marginRight: 8,
          }}
        >
          <AppIcon name="grip-vertical" size={18} color={palette.textSoft} strokeWidth={1.7} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: HOME_RADIUS.chip,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: typeMeta.bg ?? `${typeMeta.color}18`,
            borderWidth: 1,
            borderColor: typeMeta.bg ? `${typeMeta.color}20` : `${typeMeta.color}30`,
            marginRight: 13,
          }}
        >
          <AppIcon name={typeMeta.icon} size={20} color={typeMeta.color} strokeWidth={1.5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
            {formatAccountDisplayName(item.name, item.accountNumber)}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginTop: 2, fontWeight: FONT_WEIGHT.regular }}>
            {typeLabel}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          maxWidth: 128,
          fontSize: HOME_TEXT.rowLabel,
          fontWeight: FONT_WEIGHT.medium,
          color: isNegative ? palette.negative : palette.text,
          textAlign: 'right',
        }}
      >
        {isNegative ? '-' : ''}{formatCurrency(Math.abs(item.balance), currencySymbol)}
      </Text>
    </TouchableOpacity>
  );
}
