import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppDonutChart } from '@/components/ui/AppDonutChart';
import { SegmentedPillSwitch } from '@/components/ui/SegmentedPillSwitch';
import { formatAccountDisplayName } from '../lib/account-utils';
import { formatCurrency } from '../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER, SPACING, TYPE } from '../lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_SURFACE, HOME_TEXT, SCREEN_HEADER } from '../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../lib/settings-shared';
import { AppThemePalette } from '../lib/theme';
import { Account, AccountType } from '../types';
import { CARD_PADDING } from '../lib/design';

export const NW_ASSET_LIGHT = '#0D9488';
export const NW_ASSET_DARK = '#00FAD9';
export const NW_HERO_PROGRESS_LABEL_GAP = 8;

export const NW_ACCOUNT_COLORS = [
  '#00A7A5',
  '#F2B84B',
  '#4E8EF7',
  '#EF476F',
  '#8B5CF6',
  '#2DCB73',
  '#FF8A4C',
  '#38BDF8',
  '#B565D9',
  '#7C8A9E',
] as const;

export const ACCOUNT_TYPE_SORT_ORDER: Record<AccountType, number> = {
  savings: 0,
  cash: 1,
  wallet: 2,
  investment: 3,
  credit: 4,
  other: 5,
};

const NW_BALANCE_BY_OPTIONS = [
  { key: 'type', label: 'Type' },
  { key: 'account', label: 'Account' },
] as const;

export function NetWorthBalanceByToggle({
  mode,
  onChange,
}: {
  mode: 'account' | 'type';
  onChange: (mode: 'account' | 'type') => void;
}) {
  return (
    <SegmentedPillSwitch
      options={NW_BALANCE_BY_OPTIONS}
      value={mode}
      onChange={(key: string) => onChange(key as 'account' | 'type')}
      backgroundColor="#EEF2F8"
      pillColor="#FFFFFF"
      borderColor="#DFE5EF"
      activeTextColor="#1F2A44"
      inactiveTextColor="#7C8498"
      height={32}
      radius={HOME_RADIUS.button}
      fontSize={11}
      itemMinWidth={70}
      style={{ alignSelf: 'flex-start', minWidth: 144 }}
    />
  );
}

export function NetWorthRingMarker({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: HOME_RADIUS.xs,
        borderWidth: 2.5,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
  );
}

export function NetWorthDonut({
  mode,
  groups,
  accounts,
  accountColorsById,
  palette,
  currencySymbol,
  selectedType,
  onSelectType,
  selectedAccountId,
  onSelectAccount,
}: {
  mode: 'account' | 'type';
  groups: Array<{ type: AccountType; accounts: Account[]; balance: number }>;
  accounts: Account[];
  accountColorsById: Map<string, string>;
  palette: AppThemePalette;
  currencySymbol: string;
  selectedType: AccountType | null;
  onSelectType: (type: AccountType | null) => void;
  selectedAccountId: string | null;
  onSelectAccount: (id: string | null) => void;
}) {
  const size = 292;
  const chartItems = mode === 'type'
    ? groups.map((group) => ({
      id: group.type,
      label: getAccountTypeLabel(group.type),
      amount: Math.abs(group.balance),
      value: group.balance,
      color: ACCOUNT_TYPE_META[group.type].color,
    }))
    : accounts.map((account) => ({
      id: account.id,
      label: formatAccountDisplayName(account.name, account.accountNumber),
      amount: Math.abs(account.balance),
      value: account.balance,
      color: accountColorsById.get(account.id) ?? NW_ACCOUNT_COLORS[0],
    }));
  const slices = chartItems.filter((item) => item.amount > 0);
  const total = slices.reduce((sum, item) => sum + item.amount, 0) || 1;
  const selectedId = mode === 'type' ? selectedType : selectedAccountId;
  const selectedItem = selectedId ? slices.find((item) => item.id === selectedId) ?? null : null;
  const selectedAmount = selectedItem ? selectedItem.amount : total;
  const selectedValue = selectedItem ? selectedItem.value : total;
  const donutSlices = slices.map((item) => ({
    id: item.id,
    percent: item.amount / total,
    color: item.color,
  }));

  return (
    <View style={{ height: 284, alignItems: 'center', justifyContent: 'center', marginTop: -12, marginBottom: -16 }}>
      <AppDonutChart
        slices={donutSlices}
        size={size}
        selectedId={selectedId}
        onSelect={(id) => {
          if (mode === 'type') {
            onSelectType(selectedType === id ? null : id as AccountType);
            return;
          }
          onSelectAccount(selectedAccountId === id ? null : id);
        }}
        bgHex={palette.card}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: (!selectedItem && mode === 'account') ? -4 : 0 }] }}>
        {selectedItem ? (
          <View style={{ minHeight: 28, marginBottom: 4, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: selectedItem.color }} />
          </View>
        ) : null}
        <Text numberOfLines={2} style={{ maxWidth: 112, fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', color: palette.text }}>
          {selectedItem ? selectedItem.label : mode === 'type' ? 'All Types' : 'All'}
        </Text>
        <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.subhead, fontWeight: FONT_WEIGHT.heavy, color: palette.text, marginTop: 4, textAlign: 'center' }}>
          {selectedAmount === 0 ? '—' : `${selectedValue < 0 ? '-' : ''}${formatCurrency(Math.abs(selectedValue), currencySymbol)}`}
        </Text>
      </View>
    </View>
  );
}

export function NetWorthTypeRows({
  groups,
  palette,
  currencySymbol,
}: {
  groups: Array<{ type: AccountType; accounts: Account[]; balance: number }>;
  palette: AppThemePalette;
  currencySymbol: string;
}) {
  const total = groups.reduce((sum, group) => sum + Math.abs(group.balance), 0) || 1;

  return (
    <>
      {groups.filter((group) => Math.abs(group.balance) > 0).map((group) => {
        const isNegative = group.balance < 0;
        return (
          <View
            key={group.type}
            style={{ minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: palette.divider }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center' }}>
                <NetWorthRingMarker color={ACCOUNT_TYPE_META[group.type].color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.cardContent, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                      {getAccountTypeLabel(group.type)}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginTop: 3 }}>
                      {group.accounts.length} {group.accounts.length === 1 ? 'account' : 'accounts'} · {Math.round((Math.abs(group.balance) / total) * 100)}%
                    </Text>
                  </View>
                  <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.heavy, color: group.balance === 0 ? palette.textMuted : isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                    {group.balance === 0 ? '—' : `${isNegative ? '-' : ''}${formatCurrency(Math.abs(group.balance), currencySymbol)}`}
                  </Text>
                </View>
                <View style={{ height: 4, borderRadius: HOME_RADIUS.full, overflow: 'hidden', backgroundColor: palette.inputBg, marginTop: 10 }}>
                  <View style={{ height: 4, borderRadius: HOME_RADIUS.full, width: `${(Math.abs(group.balance) / total) * 100}%`, backgroundColor: ACCOUNT_TYPE_META[group.type].color }} />
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

export function HomeNetWorthPage({
  pageHeight,
  palette,
  currencySymbol,
  accounts,
  loanSummary,
  depositSummary,
  assetsValue = 0,
  netWorth,
  pageIndex,
  verticalScrolls,
  indicatorY,
  isSelected,
  compactTop = false,
  hideTitle = false,
  onOpenAccount,
  bottomPadding,
}: {
  pageHeight: number;
  palette: AppThemePalette;
  currencySymbol: string;
  accounts: Account[];
  loanSummary: { youLent: number; youOwe: number; net: number };
  depositSummary?: { activeMaturityValue: number; activeInvestedValue: number; deposits: Array<{ status: string }> };
  assetsValue?: number;
  netWorth: number;
  pageIndex: number;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  isSelected: boolean;
  compactTop?: boolean;
  hideTitle?: boolean;
  onOpenAccount: (accountId: string | 'all') => void;
  bottomPadding?: number;
}) {
  const [accountViewMode, setAccountViewMode] = useState<'account' | 'type'>('type');
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [selectedChartAccountId, setSelectedChartAccountId] = useState<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const positiveAccountTotal = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const negativeAccountTotal = accounts.reduce((sum, account) => sum + Math.abs(Math.min(account.balance, 0)), 0);
  const activeDepositCount = depositSummary?.deposits.filter((d) => d.status === 'active').length ?? 0;
  const activeDepositValue = depositSummary?.activeInvestedValue ?? 0;
  const assetTotal = positiveAccountTotal + loanSummary.youLent + activeDepositValue + assetsValue;
  const liabilityTotal = negativeAccountTotal + loanSummary.youOwe;
  const nwAssetColor = palette.isDark ? NW_ASSET_DARK : NW_ASSET_LIGHT;
  const nwLiabilityColor = palette.negative;
  const totalExposure = Math.max(assetTotal + liabilityTotal, 1);
  const assetShare = assetTotal / totalExposure;
  const liabilityShare = liabilityTotal / totalExposure;
  const sortedAccounts = useMemo(() => {
    return accounts.slice().sort((a, b) => {
      const balanceDiff = b.balance - a.balance;
      if (balanceDiff !== 0) return balanceDiff;
      return formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
        formatAccountDisplayName(b.name, b.accountNumber),
        'en',
        { sensitivity: 'base' },
      );
    });
  }, [accounts]);
  const groupedAccounts = useMemo(() => {
    const groups = new Map<AccountType, Account[]>();
    sortedAccounts.forEach((account) => {
      const next = groups.get(account.type) ?? [];
      next.push(account);
      groups.set(account.type, next);
    });
    return Array.from(groups.entries())
      .map(([type, group]) => ({
        type,
        accounts: group,
        balance: group.reduce((sum, account) => sum + account.balance, 0),
      }))
      .sort((a, b) => ACCOUNT_TYPE_SORT_ORDER[a.type] - ACCOUNT_TYPE_SORT_ORDER[b.type]);
  }, [sortedAccounts]);
  const accountColorsById = useMemo(() => new Map(sortedAccounts.map((account, index) => [
    account.id,
    NW_ACCOUNT_COLORS[index % NW_ACCOUNT_COLORS.length],
  ])), [sortedAccounts]);
  const largestAccountBalance = Math.max(...accounts.map((account) => Math.abs(account.balance)), 1);
  const displayedAccounts = selectedType
    ? sortedAccounts.filter((account) => account.type === selectedType)
    : sortedAccounts;
  const assetPercent = Math.round(assetShare * 100);
  const liabilityPercent = Math.round(liabilityShare * 100);
  const dominantPosition = liabilityShare > assetShare
    ? { label: 'Liabilities', percent: liabilityPercent, color: nwLiabilityColor, share: liabilityShare }
    : { label: 'Assets', percent: assetPercent, color: nwAssetColor, share: assetShare };
  const positionRows = [
    {
      key: 'assets',
      label: 'Liquid assets',
      note: `${accounts.filter((account) => account.balance > 0).length} funded accounts`,
      value: positiveAccountTotal,
      color: nwAssetColor,
      icon: 'wallet' as any,
      visible: true,
    },
    {
      key: 'deposits',
      label: 'Fixed deposits',
      note: activeDepositCount === 0
        ? 'No active deposits'
        : `${activeDepositCount} active ${activeDepositCount === 1 ? 'deposit' : 'deposits'} · Invested value`,
      value: activeDepositValue,
      color: '#76506A',
      icon: 'vault' as any,
      visible: activeDepositValue > 0,
    },
    {
      key: 'receivable',
      label: 'Receivables',
      note: 'Money you should receive',
      value: loanSummary.youLent,
      color: palette.brand,
      icon: 'arrow-down-left' as any,
      visible: loanSummary.youLent > 0,
    },
    {
      key: 'other_assets',
      label: 'Other assets',
      note: 'Tracked non-liquid assets',
      value: assetsValue,
      color: '#9A7440',
      icon: 'gem' as any,
      visible: assetsValue > 0,
    },
    {
      key: 'liability',
      label: 'Liabilities',
      note: 'Borrowed and negative balances',
      value: liabilityTotal,
      color: nwLiabilityColor,
      icon: 'arrow-up-right' as any,
      visible: true,
    },
  ].filter((row) => row.visible);

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    if (!verticalScrolls) return;
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = event.contentOffset.y;
    verticalScrolls.value = arr;
  });

  const renderAccountRow = (account: Account, isFirstInSection: boolean) => {
    const isNegative = account.balance < 0;
    const accountColor = accountColorsById.get(account.id) ?? NW_ACCOUNT_COLORS[0];
    const isSelected = selectedChartAccountId === account.id;
    return (
      <TouchableOpacity
        key={account.id}
        delayPressIn={0}
        activeOpacity={0.75}
        onPress={() => onOpenAccount(account.id)}
        style={{
          minHeight: 72,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: isFirstInSection ? 0 : 1,
          borderTopColor: palette.divider,
          opacity: selectedChartAccountId && !isSelected ? 0.48 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center' }}>
            <NetWorthRingMarker color={accountColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.cardContent, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                  {formatAccountDisplayName(account.name, account.accountNumber)}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginTop: 3 }}>
                  {getAccountTypeLabel(account.type)}
                </Text>
              </View>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.heavy, color: account.balance === 0 ? palette.textMuted : isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                {account.balance === 0 ? '—' : `${isNegative ? '-' : ''}${formatCurrency(Math.abs(account.balance), currencySymbol)}`}
              </Text>
            </View>
            <View style={{ height: 4, borderRadius: HOME_RADIUS.full, backgroundColor: palette.inputBg, overflow: 'hidden', marginTop: 10 }}>
              {account.balance !== 0 ? <View style={{ width: `${(Math.abs(account.balance) / largestAccountBalance) * 100}%`, height: '100%', borderRadius: HOME_RADIUS.full, backgroundColor: accountColor }} /> : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ flex: 1, height: pageHeight }}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: 0,
        paddingBottom: bottomPadding ?? HOME_LAYOUT.fabContentBottomPadding,
      }}
      onScroll={verticalScrollHandler}
      scrollEventThrottle={1}
      showsVerticalScrollIndicator={false}
    >
      {hideTitle ? null : (
        <View style={{ paddingTop: compactTop ? 0 : 8, paddingBottom: compactTop ? 8 : SPACING.md }}>
          <View style={{ paddingHorizontal: 14 - SCREEN_GUTTER }}>
            <Text style={{ fontSize: compactTop ? SCREEN_HEADER.titleSize : TYPE.title, fontWeight: compactTop ? SCREEN_HEADER.titleWeight : '400', color: palette.text, letterSpacing: 0 }}>
              Net Worth
            </Text>
          </View>
        </View>
      )}
      <View
        style={{
          paddingTop: compactTop ? 12 : HOME_SURFACE.heroTop,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.divider,
          backgroundColor: palette.card,
          padding: CARD_PADDING,
          minHeight: 184,
          overflow: 'hidden',
          justifyContent: 'space-between',
          ...(!palette.isDark ? {
            elevation: 6,
            shadowColor: '#94A3B8',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.13,
            shadowRadius: 10,
          } : {}),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: HOME_SPACE.lg }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
              Net Worth
            </Text>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.heroValue + 2, lineHeight: 38, fontWeight: FONT_WEIGHT.heavy, color: netWorth < 0 ? palette.negative : palette.text, marginTop: HOME_SPACE.xs + 2 }}>
              {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth), currencySymbol)}
            </Text>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: HOME_RADIUS.button, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFD' }}>
            <AppIcon name="landmark" size={22} color={palette.brand} />
          </View>
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: NW_HERO_PROGRESS_LABEL_GAP }}>
            <View style={{ flex: 1, height: 6, borderRadius: HOME_RADIUS.full, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.10)' : '#E7ECF3', overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${dominantPosition.share * 100}%`, borderRadius: HOME_RADIUS.full, backgroundColor: dominantPosition.color }} />
            </View>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ minWidth: 60, fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.heavy, color: dominantPosition.color, textAlign: 'right' }}>
              {dominantPosition.percent}% {dominantPosition.label}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Assets</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.heavy, color: nwAssetColor, marginTop: 5 }}>
                {formatCurrency(assetTotal, currencySymbol)}{assetPercent < 100 ? ` · ${assetPercent}%` : ''}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Liabilities</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.heavy, color: liabilityTotal > 0 ? nwLiabilityColor : palette.textMuted, marginTop: 5, textAlign: 'right' }}>
                {liabilityTotal > 0 ? `${formatCurrency(liabilityTotal, currencySymbol)} · ${liabilityPercent}%` : 'None'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        onLayout={(event) => {
          const newY = event.nativeEvent.layout.y;
          if (isSelected && newY > 0 && indicatorY?.value !== newY) {
            indicatorY.value = newY;
          }
        }}
        style={{ height: 32 }}
      />

      <View style={{ gap: 10 }}>
        {positionRows.map((row) => (
          <View key={row.key} style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name={row.icon} size={16} color={row.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                {row.label}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 3 }}>
                {row.note}
              </Text>
            </View>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.heavy, color: row.color, textAlign: 'right' }}>
              {formatCurrency(row.value, currencySymbol)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 16, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 10, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <NetWorthBalanceByToggle
            mode={accountViewMode}
            onChange={(nextMode) => {
              setAccountViewMode(nextMode);
              setSelectedType(null);
              setSelectedChartAccountId(null);
            }}
          />
        </View>
        <NetWorthDonut
          mode={accountViewMode}
          groups={groupedAccounts}
          accounts={sortedAccounts}
          accountColorsById={accountColorsById}
          palette={palette}
          currencySymbol={currencySymbol}
          selectedType={selectedType}
          onSelectType={(type) => {
            setSelectedType(type);
            setSelectedChartAccountId(null);
          }}
          selectedAccountId={selectedChartAccountId}
          onSelectAccount={(accountId) => {
            setSelectedChartAccountId(accountId);
            setSelectedType(null);
          }}
        />
        <View style={{ height: 1, backgroundColor: palette.divider, marginTop: 8 }} />
        {accountViewMode === 'type'
          ? displayedAccounts.map((account, index) => renderAccountRow(account, index === 0))
          : (
            <NetWorthTypeRows
              groups={groupedAccounts}
              palette={palette}
              currencySymbol={currencySymbol}
            />
          )}
      </View>
    </Animated.ScrollView>
  );
}
