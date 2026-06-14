import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';

import { Text } from '@/components/ui/AppText';
import { HomeAccountPage } from '../(tabs)/index';
import { ScreenScaffold } from '../../components/ui/ScreenScaffold';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { ActionStrip } from '../../components/ui/ActionStrip';
import { HeaderResetButton } from '../../components/ui/HeaderResetButton';
import { HeaderMoreButton, ScreenHeader } from '../../components/ui/ScreenHeader';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatDate, toLocalDayEndISO, toLocalDayStartISO } from '../../lib/dateUtils';
import { FONT_WEIGHT } from '../../lib/design';
import { ActionChip } from '../../components/ui/AppButton';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import { getAccountTypeLabel, ACCOUNT_TYPE_META } from '../../lib/settings-shared';
import type { PeriodType } from '../../types';
import { getAccountBalanceTrend } from '../../services/analytics';
import { TrendLineChart } from '../../components/insights/TrendLineChart';

// Persists across screen mounts — stack screens remount fresh on every navigation
// unlike tabs which stay mounted. Cache gives instant display on revisit; mutationVersion
// bump triggers a silent background refresh without showing the skeleton again.
const trendCache = new Map<string, { date: string; val: number }[]>();

type AccountPeriodType = 'today' | PeriodType;

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const isFocused = useIsFocused();
  const nav = useNavigation();

  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const loadCategories = useCategoriesStore((s) => s.load);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);

  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);

  const account = accounts.find((a) => a.id === id);

  const [trendPoints, setTrendPoints] = useState<{ date: string; val: number }[]>(
    () => trendCache.get(id ?? '') ?? []
  );
  const [isLoadingTrend, setIsLoadingTrend] = useState(!trendCache.has(id ?? ''));
  const [chartInteracting, setChartInteracting] = useState(false);
  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);
  const [inlineFilter, setInlineFilter] = useState<'in' | 'out' | null>(null);
  const [resetInlineFilterToken, setResetInlineFilterToken] = useState(0);

  useEffect(() => {
    if (!isFocused) return;
    loadCategories().catch(() => undefined);
  }, [isFocused, loadCategories]);

  useEffect(() => {
    if (!account) return;
    let active = true;
    const loadTrend = async () => {
      // Only show skeleton on the very first load; subsequent refreshes are silent.
      if (!trendCache.has(account.id)) setIsLoadingTrend(true);
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 29);
      const fromStr = toLocalDayStartISO(thirtyDaysAgo);
      const toStr = toLocalDayEndISO(today);
      try {
        const trend = await getAccountBalanceTrend(account.id, fromStr, toStr);
        if (active) {
          const mapped = trend.map(t => ({ date: t.date, val: t.balance }));
          trendCache.set(account.id, mapped);
          setTrendPoints(mapped);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoadingTrend(false);
      }
    };
    loadTrend();
    return () => {
      active = false;
    };
  }, [account?.id, mutationVersion]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const verticalScrolls = useSharedValue<number[]>([0]);
  const indicatorY = useSharedValue(0);

  const [period, setPeriod] = useState<AccountPeriodType>('today');
  const [activePoint, setActivePoint] = useState<any>(null);

  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const panelProgress = useSharedValue(0);

  const toggleActions = () => {
    const nextShow = !showActions;
    setShowActions(nextShow);
    panelProgress.value = withTiming(nextShow ? 1 : 0, { duration: 220 });
  };
  const closePanel = () => {
    setShowActions(false);
    panelProgress.value = withTiming(0, { duration: 220 });
  };

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 56, // 36 height + 20 vertical padding
    opacity: panelProgress.value,
  }));

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(toLocalDayStartISO(fromDate));
    setCustomRangeTo(toLocalDayEndISO(toDate));
    setPeriod('custom');
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  const handleApplyCustomRange = useCallback((from: Date, to: Date) => {
    setCustomDraftFrom(from);
    setCustomDraftTo(to);
    setCustomRangeFrom(toLocalDayStartISO(from));
    setCustomRangeTo(toLocalDayEndISO(to));
    setPeriod('custom');
  }, []);

  const openDatePicker = useCallback(
    (stage: 'from' | 'to') => {
      const value = stage === 'from' ? customDraftFrom : customDraftTo;
      const minDate = stage === 'to' ? customDraftFrom : undefined;
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        display: 'calendar',
        minimumDate: minDate,
        onChange: (_event, selected) => {
          if (!selected) return;
          if (stage === 'from') {
            setCustomDraftFrom(selected);
            if (selected > customDraftTo) {
              setCustomDraftTo(selected);
            }
          } else {
            setCustomDraftTo(selected < customDraftFrom ? customDraftFrom : selected);
          }
        }
      });
    },
    [customDraftFrom, customDraftTo],
  );

  const openCustomRange = useCallback(() => {
    setCustomDraftFrom(new Date(customRangeFrom));
    setCustomDraftTo(new Date(customRangeTo));
    setCustomRangeOpen(true);
  }, [customRangeFrom, customRangeTo]);

  if (!account) return null;

  const lineColor = ACCOUNT_TYPE_META[account.type]?.color ?? palette.brand;

  const middleContent = (
    <TrendLineChart
      points={trendPoints}
      palette={palette}
      currencySymbol={showCurrencySymbol ? currencySymbol : ''}
      title=""
      lineColor={lineColor}
      onInteractionStateChange={setChartInteracting}
      isLoading={isLoadingTrend}
      hideHeader={true}
      hideStartDot={true}
      flatStyle={true}
      smoothCurves={true}
      hideAxisLabels={false}
      endLabelIsToday={true}
      hideEndBalance={true}
      onActivePointChange={setActivePoint}
    />
  );

  return (
    <ScreenScaffold palette={palette}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: palette.background }}>
              <ScreenHeader
                title={formatAccountDisplayName(account.name, account.accountNumber)}
                onBack={() => router.back()}
                palette={palette}
                titleSize={18}
                iconSize={18}
                titleAddon={
                  <HeaderResetButton
                    visible={!!inlineFilter || period !== 'today'}
                    onPress={() => { setInlineFilter(null); setPeriod('today'); setResetInlineFilterToken((t) => t + 1); }}
                    palette={palette}
                    isFocused={isFocused}
                    style={{ marginLeft: 8 }}
                  />
                }
                rightAction={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <TouchableOpacity
                      delayPressIn={0}
                      activeOpacity={0.5}
                      onPress={() => router.push({ pathname: '/modals/add-transaction', params: { accountId: account.id } })}
                    >
                      <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: palette.brand }}>+ Add</Text>
                    </TouchableOpacity>
                    <HeaderMoreButton palette={palette} isOpen={showActions} onPress={toggleActions} />
                  </View>
                }
              />
            </View>
          )
        }}
      />

      <ActionStrip palette={palette} animatedStyle={actionsAnimatedStyle}>
          <ActionChip
            icon="edit"
            label="Edit Account"
            palette={palette}
            onPress={() => {
              closePanel();
              router.push({ pathname: '/settings/account-form', params: { id: account.id } });
            }}
          />
      </ActionStrip>

      <HomeAccountPage
        nav={nav}
        pageHeight={1000}
        accountId={account.id}
        accountName={formatAccountDisplayName(account.name, account.accountNumber)}
        accountTypeLabel={getAccountTypeLabel(account.type)}
        settingsYearStart={settingsYearStart}
        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
        customRange={{ from: new Date(customRangeFrom), to: new Date(customRangeTo) }}
        onOpenCustomRange={() => openCustomRange()}
        totalBalance={account.balance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        period={period}
        onPeriodChange={setPeriod}
        registerScrollTop={() => { }}
        isPageReady={true}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        contentBottomPadding={getScrollableBottomPadding(insets)}
        onScrollBeginDrag={closePanel}
        middleContent={middleContent}
        scrollEnabled={!chartInteracting}
        dataNonce={mutationVersion}
        onInlineFilterChange={setInlineFilter}
        resetInlineFilterToken={resetInlineFilterToken}
        isDetailScreen={true}
        activePoint={activePoint}
        onApplyCustomRange={handleApplyCustomRange}
      />

      <Modal
        visible={customRangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeOpen(false)}
      >
        <Pressable
          onPress={() => setCustomRangeOpen(false)}
          style={{ flex: 1, backgroundColor: palette.scrim, justifyContent: 'center', padding: 20 }}
        >
          <Pressable
            onPress={() => { }}
            style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.large, padding: HOME_SPACE.xxl, borderWidth: 1, borderColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('from')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0} onPress={() => openDatePicker('to')} style={{ borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.inputBg, borderRadius: HOME_RADIUS.card, paddingHorizontal: HOME_SPACE.lg, paddingVertical: 12 }}>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <View style={{ flex: 1 }}>
                <TextButton label="Cancel" onPress={() => setCustomRangeOpen(false)} palette={palette} tone="default" style={{ minHeight: 48, borderRadius: HOME_RADIUS.tab, backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border }} />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton label="Done" onPress={handleCustomRangeDone} palette={palette} tone="brand" style={{ borderRadius: HOME_RADIUS.tab }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenScaffold>
  );
}
