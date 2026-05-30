import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { SegmentedPillSwitch } from '@/components/ui/SegmentedPillSwitch';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { formatAccountDisplayName } from '../lib/account-utils';
import { ASSET_TONE } from '../lib/assetVisuals';
import { toLocalDateKey, toLocalDayEndISO, toLocalDayStartISO } from '../lib/dateUtils';
import { DEPOSIT_VISUAL } from '../lib/depositVisuals';
import { formatCurrency, getTransactionCashflowImpact } from '../lib/derived';
import { CARD_PADDING, FONT_WEIGHT, SCREEN_GUTTER, SPACING, TYPE } from '../lib/design';
import { CARD_TEXT, HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT, SCREEN_HEADER, getNetWorthChangeTheme } from '../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../lib/settings-shared';
import { AppThemePalette } from '../lib/theme';
import { getTransactions } from '../services/transactions';
import { useTransactionsStore } from '../stores/useTransactionsStore';
import { Account, Asset, Transaction } from '../types';
import { TrendLineChart } from './insights/TrendLineChart';


export function NetWorthDetailBlock({
  pageHeight,
  palette,
  currencySymbol,
  accounts,
  loanSummary,
  depositSummary,
  assetsValue = 0,
  assets = [],
  netWorth,
  pageIndex,
  verticalScrolls,
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
  assets?: Asset[];
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
  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);
  const [period, setPeriod] = useState<'today' | 'month'>('month');
  const [chartInteracting, setChartInteracting] = useState(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const tableYRef = React.useRef(0);

  const openBreakdownActivity = (kind: 'in' | 'out') => {
    const fromVal = period === 'today' ? todayStart : monthStart;
    const toVal = period === 'today' ? todayEnd : monthEnd;
    router.push({
      pathname: '/(tabs)/activity',
      params: {
        source: period === 'today' ? 'nw-today' : 'nw-period',
        period: period === 'today' ? 'day' : period,
        accountId: 'all',
        type: 'all',
        cashflowBucket: kind,
        cashflowMode: 'incomeExpense',
        from: fromVal,
        to: toVal,
        ts: String(Date.now()),
      },
    });
  };

  const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);

  // Grouped sections expand/collapse state
  const [assetsAccountsExpanded, setAssetsAccountsExpanded] = useState(false);
  const [liabilitiesAccountsExpanded, setLiabilitiesAccountsExpanded] = useState(false);


  // Load 30d transaction history
  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const rangeFrom = toLocalDayStartISO(thirtyDaysAgo);
        const txs = await getTransactions({
          fromDate: rangeFrom,
          limit: 5000,
        });
        if (active) {
          setHistoryTransactions(txs);
        }
      } catch (err) {
        console.error("Failed to load net worth history transactions", err);
      }
    }
    loadHistory();
    return () => {
      active = false;
    };
  }, [mutationVersion]);

  // Today and Month ranges
  const today = new Date();
  const todayStart = toLocalDayStartISO(today);
  const todayEnd = toLocalDayEndISO(today);

  const monthStartObj = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStart = toLocalDayStartISO(monthStartObj);
  const monthEnd = toLocalDayEndISO(today);

  // Calculate change values for a period
  const getPeriodValues = (start: string, end: string) => {
    let income = 0;
    let expense = 0;
    historyTransactions.forEach((tx) => {
      if (tx.date >= start && tx.date <= end) {
        const impact = getTransactionCashflowImpact(tx, { includeLoans: false, includeDeposits: false });
        if (impact === 'in') income += tx.amount;
        else if (impact === 'out') expense += tx.amount;
      }
    });

    const assetAdditions = assets
      .filter((a) => a.createdAt >= start && a.createdAt <= end)
      .reduce((sum, a) => sum + a.value, 0);

    return {
      income,
      expense,
      assetAdditions,
      netChange: (income - expense) + assetAdditions,
    };
  };

  const todayVals = useMemo(() => getPeriodValues(todayStart, todayEnd), [historyTransactions, assets, todayStart, todayEnd]);
  const monthVals = useMemo(() => getPeriodValues(monthStart, monthEnd), [historyTransactions, assets, monthStart, monthEnd]);

  const activeVals = useMemo(() => {
    return period === 'today' ? todayVals : monthVals;
  }, [period, todayVals, monthVals]);

  const { tone: nwChangeTone, bg: nwChangeBg, ink: nwChangeInk } = getNetWorthChangeTheme(activeVals.netChange);

  // Historical 30-day net worth trend points
  const points = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(toLocalDateKey(d.toISOString())); // "YYYY-MM-DD" in local time
    }

    const dailyChange = new Map<string, number>();
    days.forEach(k => dailyChange.set(k, 0));

    historyTransactions.forEach((tx) => {
      const key = toLocalDateKey(tx.date);
      if (dailyChange.has(key)) {
        const impact = getTransactionCashflowImpact(tx, { includeLoans: false, includeDeposits: false });
        if (impact === 'in') {
          dailyChange.set(key, (dailyChange.get(key) ?? 0) + tx.amount);
        } else if (impact === 'out') {
          dailyChange.set(key, (dailyChange.get(key) ?? 0) - tx.amount);
        }
      }
    });

    assets.forEach((asset) => {
      const key = asset.createdAt.slice(0, 10);
      if (dailyChange.has(key)) {
        dailyChange.set(key, (dailyChange.get(key) ?? 0) + asset.value);
      }
    });

    let currentVal = netWorth;
    const pts = [];
    for (let i = 29; i >= 0; i--) {
      const key = days[i];
      pts.push({ date: key, val: currentVal });
      const dayChange = dailyChange.get(key) ?? 0;
      currentVal -= dayChange;
    }

    return pts.reverse();
  }, [historyTransactions, assets, netWorth]);

  // Aggregates & breakdown definitions
  const positiveAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.balance >= 0)
      .sort((a, b) => {
        const diff = b.balance - a.balance;
        if (diff !== 0) return diff;
        return formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
          formatAccountDisplayName(b.name, b.accountNumber),
          'en',
          { sensitivity: 'base' }
        );
      });
  }, [accounts]);

  const negativeAccounts = useMemo(() => {
    return accounts
      .filter((a) => a.balance < 0)
      .sort((a, b) => {
        const diff = Math.abs(b.balance) - Math.abs(a.balance);
        if (diff !== 0) return diff;
        return formatAccountDisplayName(a.name, a.accountNumber).localeCompare(
          formatAccountDisplayName(b.name, b.accountNumber),
          'en',
          { sensitivity: 'base' }
        );
      });
  }, [accounts]);

  const positiveAccountTotal = useMemo(() => positiveAccounts.reduce((sum, account) => sum + account.balance, 0), [positiveAccounts]);
  const negativeAccountTotal = useMemo(() => negativeAccounts.reduce((sum, account) => sum + Math.abs(account.balance), 0), [negativeAccounts]);
  const activeDepositValue = depositSummary?.activeInvestedValue ?? 0;

  const assetTotal = positiveAccountTotal + loanSummary.youLent + activeDepositValue + assetsValue;
  const liabilityTotal = negativeAccountTotal + loanSummary.youOwe;

  const nwLiabilityColor = palette.negative;

  const totalExposure = Math.max(assetTotal + liabilityTotal, 1);
  const assetShare = assetTotal / totalExposure;
  const liabilityShare = liabilityTotal / totalExposure;

  const assetPercent = Math.round(assetShare * 100);
  const liabilityPercent = Math.round(liabilityShare * 100);

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    if (!verticalScrolls) return;
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = event.contentOffset.y;
    verticalScrolls.value = arr;
  });

  // Balance formatting for hero card
  const balanceFormatted = formatCurrency(Math.abs(netWorth), currencySymbol);
  const dotIdx = balanceFormatted ? balanceFormatted.indexOf('.') : -1;
  const balanceInt = dotIdx >= 0 ? balanceFormatted.slice(0, dotIdx) : (balanceFormatted ?? '');
  const balanceDec = dotIdx >= 0 ? balanceFormatted.slice(dotIdx) : '';

  const heroBalanceFontSize = HOME_TEXT.rowLabel;
  const heroDecimalFontSize = HOME_TEXT.rowLabel - 4;

  // (renderSectionHeader moved to SectionHeaderCard component below)

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
      scrollEnabled={!chartInteracting}
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

      {/* Redesigned Hero Card */}
      <View
        style={{
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderColor: palette.divider,
          backgroundColor: palette.card,
          padding: CARD_PADDING,
          overflow: 'hidden',
          ...palette.states.cardShadow,
          marginTop: compactTop ? 4 : 0,
        }}
      >
        {/* Top section: Icon + Label & Value + Change chip */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: HOME_SPACE.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <View style={{
              width: 42,
              height: 42,
              borderRadius: HOME_RADIUS.chip,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${palette.brand}18`,
            }}>
              <AppIcon name="land-plot" size={22} color={palette.brand} strokeWidth={1.6} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                Net Worth
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                <Text style={{ fontSize: heroBalanceFontSize, fontWeight: FONT_WEIGHT.medium, color: netWorth < 0 ? palette.negative : palette.text }}>
                  {netWorth < 0 ? '-' : ''}{balanceInt}
                </Text>
                {balanceDec ? (
                  <Text style={{ fontSize: heroDecimalFontSize, fontWeight: FONT_WEIGHT.medium, color: netWorth < 0 ? palette.negative : palette.textMuted }}>
                    {balanceDec}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Change badge */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              if (tableYRef.current > 0) {
                scrollRef.current?.scrollTo({ y: tableYRef.current - 12, animated: true });
              }
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              backgroundColor: nwChangeBg,
              borderRadius: HOME_RADIUS.full,
              paddingHorizontal: 7,
              paddingVertical: 3.5,
              marginTop: 2,
            }}
          >
            {nwChangeTone !== 'neutral' && (
              <AppIcon name={nwChangeTone === 'positive' ? 'trending-up' : 'trending-down'} size={11} color={nwChangeInk} strokeWidth={2.4} />
            )}
            <Text style={{ fontSize: HOME_TEXT.label, fontWeight: FONT_WEIGHT.bold, color: nwChangeInk, fontFamily: 'monospace' }}>
              {nwChangeTone === 'neutral' ? '—' : `${activeVals.netChange > 0 ? '+' : ''}${formatCurrency(Math.abs(activeVals.netChange), currencySymbol)}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom section: Progress bar & Asset/Liability split */}
        <View style={{ marginTop: 20 }}>
          <View style={{ height: 4, borderRadius: HOME_RADIUS.full, backgroundColor: palette.states.progressBarTrackBg, overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ height: '100%', width: `${assetShare * 100}%`, backgroundColor: palette.chartIncome }} />
            <View style={{ height: '100%', width: `${liabilityShare * 100}%`, backgroundColor: palette.chartExpense }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.text }}>
              Assets · {assetPercent}%
            </Text>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.text }}>
              Liabilities · {liabilityPercent}%
            </Text>
          </View>
        </View>
      </View>

      {/* Historical Trend Chart */}
      <TrendLineChart
        points={points}
        palette={palette}
        currencySymbol={currencySymbol}
        title="Net Worth Trend"
        subtitle="(Last 30 Days)"
        onInteractionStateChange={setChartInteracting}
        containerStyle={{ marginTop: 28 }}
      />

      {/* Unified Assets & Liabilities Card */}
      <View style={{
        marginTop: 28,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        padding: 16,
        overflow: 'hidden',
      }}>
        {/* Details Section */}
        <View style={{ gap: 14 }}>
          {/* Assets Breakdown */}
          {(positiveAccountTotal > 0 || activeDepositValue > 0 || loanSummary.youLent > 0 || assetsValue > 0) && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  Assets
                </Text>
                <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatCurrency(assetTotal, currencySymbol)}
                </Text>
              </View>

              {/* Accounts Card under Assets */}
              {positiveAccountTotal > 0 && (
                <View style={{ overflow: 'hidden' }}>
                  <SectionHeaderCard
                    title="Accounts"
                    icon="building-2"
                    iconColor={palette.brand}
                    iconBg={`${palette.brand}12`}
                    value={positiveAccountTotal}
                    isExpanded={assetsAccountsExpanded}
                    onToggle={() => setAssetsAccountsExpanded(!assetsAccountsExpanded)}
                    palette={palette}
                    currencySymbol={currencySymbol}
                  />
                  {assetsAccountsExpanded && (
                    <View style={{
                      borderWidth: 1,
                      borderTopWidth: 0,
                      borderColor: palette.border,
                      borderBottomLeftRadius: HOME_RADIUS.card,
                      borderBottomRightRadius: HOME_RADIUS.card,
                      backgroundColor: palette.background,
                      overflow: 'hidden',
                    }}>
                      {positiveAccounts.map((account, idx) => {
                        const typeMeta = ACCOUNT_TYPE_META[account.type];
                        return (
                          <TouchableOpacity
                            key={account.id}
                            activeOpacity={0.7}
                            onPress={() => onOpenAccount(account.id)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              borderTopWidth: idx === 0 ? 0 : 1,
                              borderTopColor: palette.border,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                              <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: HOME_RADIUS.small,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: typeMeta.bg ?? `${typeMeta.color}12`,
                                marginRight: 12,
                              }}>
                                <AppIcon name={typeMeta.icon as any} size={16} color={typeMeta.color} strokeWidth={1.5} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
                                  {formatAccountDisplayName(account.name, account.accountNumber)}
                                </Text>
                                <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, marginTop: 2 }}>
                                  {getAccountTypeLabel(account.type)}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                              {formatCurrency(account.balance, currencySymbol)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Deposits Card under Assets */}
              {activeDepositValue > 0 && (
                <View style={{ overflow: 'hidden' }}>
                  <SectionHeaderCard
                    title="Deposits"
                    icon="vault"
                    iconColor={DEPOSIT_VISUAL.tone}
                    iconBg={`${DEPOSIT_VISUAL.tone}12`}
                    value={activeDepositValue}
                    isExpanded={false}
                    onToggle={() => router.push('/deposits')}
                    palette={palette}
                    currencySymbol={currencySymbol}
                    isRedirect
                  />
                </View>
              )}

              {/* Loans Card under Assets */}
              {loanSummary.youLent > 0 && (
                <View style={{ overflow: 'hidden' }}>
                  <SectionHeaderCard
                    title={'Loans \u203A lent'}
                    icon="hand-coins"
                    iconColor={palette.loan}
                    iconBg={`${palette.loan}12`}
                    value={loanSummary.youLent}
                    isExpanded={false}
                    onToggle={() => router.push('/loans?direction=lent&status=open')}
                    palette={palette}
                    currencySymbol={currencySymbol}
                    valueColor={palette.text}
                    isRedirect
                  />
                </View>
              )}

              {/* Assets Card under Assets */}
              {assetsValue > 0 && (
                <View style={{ overflow: 'hidden' }}>
                  <SectionHeaderCard
                    title="Assets"
                    icon="gem"
                    iconColor={ASSET_TONE}
                    iconBg={`${ASSET_TONE}12`}
                    value={assetsValue}
                    isExpanded={false}
                    onToggle={() => router.push('/assets')}
                    palette={palette}
                    currencySymbol={currencySymbol}
                    isRedirect
                  />
                </View>
              )}
            </View>
          )}

          {/* Liabilities Breakdown */}
          {(negativeAccountTotal > 0 || loanSummary.youOwe > 0) && (
            <View style={{ gap: 10, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  Liabilities
                </Text>
                <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatCurrency(liabilityTotal, currencySymbol)}
                </Text>
              </View>

              {/* Accounts Card under Liabilities */}
              {negativeAccountTotal > 0 && (
                <View style={{ overflow: 'hidden' }}>
                  <SectionHeaderCard
                    title="Accounts"
                    icon="building-2"
                    iconColor={nwLiabilityColor}
                    iconBg={`${nwLiabilityColor}12`}
                    value={negativeAccountTotal}
                    isExpanded={liabilitiesAccountsExpanded}
                    onToggle={() => setLiabilitiesAccountsExpanded(!liabilitiesAccountsExpanded)}
                    palette={palette}
                    currencySymbol={currencySymbol}
                    valueColor={nwLiabilityColor}
                  />
                  {liabilitiesAccountsExpanded && (
                    <View style={{
                      borderWidth: 1,
                      borderTopWidth: 0,
                      borderColor: palette.border,
                      borderBottomLeftRadius: HOME_RADIUS.card,
                      borderBottomRightRadius: HOME_RADIUS.card,
                      backgroundColor: palette.background,
                      overflow: 'hidden',
                    }}>
                      {negativeAccounts.map((account, idx) => {
                        const typeMeta = ACCOUNT_TYPE_META[account.type];
                        return (
                          <TouchableOpacity
                            key={account.id}
                            activeOpacity={0.7}
                            onPress={() => onOpenAccount(account.id)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              borderTopWidth: idx === 0 ? 0 : 1,
                              borderTopColor: palette.border,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                              <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: HOME_RADIUS.small,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: typeMeta.bg ?? `${typeMeta.color}12`,
                                marginRight: 12,
                              }}>
                                <AppIcon name={typeMeta.icon as any} size={16} color={typeMeta.color} strokeWidth={1.5} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
                                  {formatAccountDisplayName(account.name, account.accountNumber)}
                                </Text>
                                <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, marginTop: 2 }}>
                                  {getAccountTypeLabel(account.type)}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.negative }}>
                              -{formatCurrency(Math.abs(account.balance), currencySymbol)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {/* Loans Card under Liabilities */}
              {loanSummary.youOwe > 0 && (
                <View style={{ overflow: 'hidden' }}>
                  <SectionHeaderCard
                    title={'Loans \u203A Borrowed'}
                    icon="hand-coins"
                    iconColor={palette.loan}
                    iconBg={`${palette.loan}12`}
                    value={loanSummary.youOwe}
                    isExpanded={false}
                    onToggle={() => router.push('/loans?direction=borrowed&status=open')}
                    palette={palette}
                    currencySymbol={currencySymbol}
                    valueColor={palette.text}
                    isRedirect
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </View>


      {/* Change Breakdown Table */}
      <View
        onLayout={(event) => {
          tableYRef.current = event.nativeEvent.layout.y;
        }}
        style={{ marginTop: 28, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, overflow: 'hidden' }}
      >
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: palette.divider,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <Text style={{ fontSize: HOME_TEXT.bodySmall - 0.5, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
            Net Worth Change
          </Text>
          <SegmentedPillSwitch
            options={[
              { key: 'today', label: 'Today' },
              { key: 'month', label: 'Month' },
            ]}
            value={period}
            onChange={(key) => setPeriod(key as 'today' | 'month')}
            backgroundColor={palette.states.segmentedBg}
            pillColor={palette.states.segmentedPill}
            borderColor={palette.states.segmentedBorder}
            activeTextColor={palette.text}
            inactiveTextColor={palette.textMuted}
            height={32}
            radius={14}
            fontSize={10.5}
            itemMinWidth={60}
            style={{ width: 124 }}
          />
        </View>
        <View>
          {/* Income Row */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openBreakdownActivity('in')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.divider }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.positive}12` }}>
                <AppIcon name="arrow-down-left" size={12} color={palette.positive} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: CARD_TEXT.line1, color: palette.text }}>Income</Text>
            </View>
            <Text style={{ fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.regular, color: activeVals.income === 0 ? palette.textMuted : palette.text }}>
              {activeVals.income === 0 ? '—' : `${activeVals.income < 0 ? '-' : '+'}${formatCurrency(Math.abs(activeVals.income), currencySymbol)}`}
            </Text>
          </TouchableOpacity>

          {/* Expense Row */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => openBreakdownActivity('out')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.divider }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.negative}12` }}>
                <AppIcon name="arrow-up-right" size={12} color={palette.negative} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: CARD_TEXT.line1, color: palette.text }}>Expense</Text>
            </View>
            <Text style={{ fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.regular, color: activeVals.expense === 0 ? palette.textMuted : palette.text }}>
              {activeVals.expense === 0 ? '—' : `${activeVals.expense < 0 ? '+' : '-'}${formatCurrency(Math.abs(activeVals.expense), currencySymbol)}`}
            </Text>
          </TouchableOpacity>

          {/* Assets Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.divider }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center', backgroundColor: `${ASSET_TONE}12` }}>
                <AppIcon name="gem" size={11} color={ASSET_TONE} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: CARD_TEXT.line1, color: palette.text }}>Assets</Text>
            </View>
            <Text style={{ fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.regular, color: activeVals.assetAdditions === 0 ? palette.textMuted : palette.text }}>
              {activeVals.assetAdditions === 0 ? '—' : `+${formatCurrency(activeVals.assetAdditions, currencySymbol)}`}
            </Text>
          </View>

          {/* Net Change Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: palette.states.rowSubtleBg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 20, height: 20, borderRadius: HOME_RADIUS.small, alignItems: 'center', justifyContent: 'center',
                backgroundColor: activeVals.netChange === 0
                  ? nwChangeBg
                  : activeVals.netChange > 0 ? `${palette.positive}12` : `${palette.negative}12`,
              }}>
                <AppIcon
                  name={activeVals.netChange === 0 ? 'minus' : activeVals.netChange > 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={activeVals.netChange === 0 ? palette.textMuted : activeVals.netChange > 0 ? palette.positive : palette.negative}
                  strokeWidth={2.2}
                />
              </View>
              <Text style={{ fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>Net Change</Text>
            </View>
            <Text style={{ fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.bold, color: activeVals.netChange === 0 ? palette.textMuted : activeVals.netChange > 0 ? palette.positive : palette.negative }}>
              {activeVals.netChange === 0 ? '—' : `${activeVals.netChange > 0 ? '+' : '-'}${formatCurrency(Math.abs(activeVals.netChange), currencySymbol)}`}
            </Text>
          </View>
        </View>
      </View>



    </Animated.ScrollView>
  );
}

function SectionHeaderCard({
  title,
  icon,
  iconColor,
  iconBg,
  value,
  isExpanded,
  onToggle,
  palette,
  currencySymbol,
  valueColor,
  isRedirect,
}: {
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  value: number;
  isExpanded: boolean;
  onToggle: () => void;
  palette: AppThemePalette;
  currencySymbol: string;
  valueColor?: string;
  isRedirect?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      delayPressIn={0}
      onPress={onToggle}
      style={{
        borderRadius: isExpanded ? 0 : HOME_RADIUS.card,
        borderTopLeftRadius: HOME_RADIUS.card,
        borderTopRightRadius: HOME_RADIUS.card,
        borderBottomLeftRadius: isRedirect ? HOME_RADIUS.card : isExpanded ? 0 : HOME_RADIUS.card,
        borderBottomRightRadius: isRedirect ? HOME_RADIUS.card : isExpanded ? 0 : HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.divider,
        backgroundColor: palette.card,
        paddingHorizontal: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: HOME_RADIUS.small,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: iconBg,
        borderWidth: 1,
        borderColor: `${iconColor}20`,
      }}>
        <AppIcon name={icon as any} size={18} color={iconColor} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <Text style={{ fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 124, fontSize: CARD_TEXT.line1, fontWeight: FONT_WEIGHT.medium, color: valueColor ?? palette.text, textAlign: 'right' }}>
          {value === 0 ? '—' : `${value < 0 ? '-' : ''}${formatCurrency(Math.abs(value), currencySymbol)}`}
        </Text>
        {!isRedirect && (
          <AppIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={palette.textMuted} strokeWidth={2} />
        )}
      </View>
    </TouchableOpacity>
  );
}
