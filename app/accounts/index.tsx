import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/AppText';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';

import { formatAccountDisplayName } from '../../lib/account-utils';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { formatCurrency } from '../../lib/derived';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { AppIcon } from '../../components/ui/AppIcon';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { ChoiceRow } from '../../components/settings-ui';
import type { Account } from '../../types';

type SortMode = 'custom' | 'alpha' | 'balance';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: Array<{ key: SortMode; title: string }> = [
  { key: 'alpha', title: 'Alphabetical' },
  { key: 'balance', title: 'Balance' },
  { key: 'custom', title: 'Custom' },
];

export default function AllAccountsScreen() {
  const { palette } = useAppTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const setOrder = useAccountsStore((s) => s.setOrder);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const displaySymbol = showCurrencySymbol ? currencySymbol : '';
  const insets = useSafeAreaInsets();
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [alphaDirection, setAlphaDirection] = useState<SortDirection>('asc');
  const [balanceDirection, setBalanceDirection] = useState<SortDirection>('asc');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [customAccounts, setCustomAccounts] = useState(accounts);
  const [customDirty, setCustomDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    setCustomAccounts(accounts);
  }, [accounts]);

  const displayedAccounts = useMemo(() => {
    if (sortMode === 'alpha') {
      const directionMultiplier = alphaDirection === 'asc' ? 1 : -1;
      return accounts.slice().sort((a, b) => directionMultiplier * formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
          formatAccountDisplayName(b.name, b.accountNumber),
          'en',
          { sensitivity: 'base' },
        )
      );
    }
    if (sortMode === 'balance') {
      return accounts.slice().sort((a, b) => balanceDirection === 'asc' ? a.balance - b.balance : b.balance - a.balance);
    }
    return customAccounts;
  }, [accounts, alphaDirection, balanceDirection, customAccounts, sortMode]);

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
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
        <ScreenHeader
          title="Accounts"
          onBack={() => router.back()}
          palette={palette}
          rightAction={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {sortMode === 'custom' && customDirty ? (
                <TouchableOpacity
                  delayPressIn={0}
                  activeOpacity={0.7}
                  onPress={saveCustomOrder}
                  disabled={isSavingOrder}
                  style={{ paddingHorizontal: 2, paddingVertical: 6, opacity: isSavingOrder ? 0.55 : 1 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '500', color: palette.brand }}>
                    {isSavingOrder ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                delayPressIn={0}
                onPress={() => setShowSortSheet(true)}
                activeOpacity={0.72}
                style={{
                  width: 34,
                  height: 34,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="arrow-up-down" size={18} color={palette.text} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity
                delayPressIn={0}
                activeOpacity={0.72}
                onPress={() => router.push('/settings/account-form')}
                style={{
                  width: 42,
                  height: 34,
                  borderRadius: 17,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: palette.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="plus" size={18} color={palette.text} strokeWidth={1.9} />
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      <DraggableFlatList
        key={sortMode === 'custom' && customDirty ? 'custom-editing' : `sort-${sortMode}`}
        data={displayedAccounts}
        keyExtractor={(item) => item.id}
        activationDistance={sortMode === 'custom' && customDirty ? 8 : 9999}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: 10,
          paddingBottom: insets.bottom + 64,
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
        <BottomSheet title="Sort accounts" palette={palette} onClose={() => setShowSortSheet(false)}>
          {SORT_OPTIONS.map((option, index) => (
            <ChoiceRow
              key={option.key}
              title={option.title}
              selected={sortMode === option.key}
              palette={palette}
              noBorder={index === SORT_OPTIONS.length - 1}
              leftElement={
                <AppIcon
                  name={getSortOptionIcon(option.key, option.key === 'alpha' ? alphaDirection : balanceDirection)}
                  size={20}
                  color={palette.brand}
                  strokeWidth={1.8}
                />
              }
              onPress={() => {
                if (option.key === 'alpha' && sortMode === 'alpha') {
                  setAlphaDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
                  setShowSortSheet(false);
                  return;
                }
                if (option.key === 'balance' && sortMode === 'balance') {
                  setBalanceDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
                  setShowSortSheet(false);
                  return;
                }
                if (option.key === 'alpha') setAlphaDirection('asc');
                if (option.key === 'balance') setBalanceDirection('asc');
                if (option.key === 'custom') setCustomDirty(true);
                setSortMode(option.key);
                setShowSortSheet(false);
              }}
            />
          ))}
        </BottomSheet>
      ) : null}
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
  palette: ReturnType<typeof useAppTheme>['palette'];
  onPress: () => void;
}) {
  const typeLabel = getAccountTypeLabel(item.type);
  const isNegative = item.balance < 0;
  const typeMeta = ACCOUNT_TYPE_META[item.type];

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.72}
      onPress={onPress}
      onLongPress={customMode ? drag : undefined}
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
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
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.isDark ? 'rgba(255,255,255,0.055)' : 'rgba(31,42,68,0.045)',
            borderWidth: 1,
            borderColor: palette.isDark ? 'rgba(255,255,255,0.075)' : 'rgba(31,42,68,0.075)',
            marginRight: 13,
          }}
        >
          <AppIcon name={typeMeta.icon} size={20} color={palette.brand} strokeWidth={1.5} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '500', color: palette.text }}>
            {formatAccountDisplayName(item.name, item.accountNumber)}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted, marginTop: 2, fontWeight: '400' }}>
            {typeLabel}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          maxWidth: 128,
          fontSize: 16,
          fontWeight: '500',
          color: isNegative ? palette.negative : palette.text,
          textAlign: 'right',
        }}
      >
        {isNegative ? '-' : ''}{formatCurrency(Math.abs(item.balance), currencySymbol)}
      </Text>
    </TouchableOpacity>
  );
}
