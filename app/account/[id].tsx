import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Modal, Pressable, TouchableOpacity, View, BackHandler } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useDesignLabStore, VARIANT_LABEL } from '../../stores/useDesignLabStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useTransactionsStore } from '../../stores/useTransactionsStore';
import { useUIStore } from '../../stores/useUIStore';

import { Text } from '@/components/ui/AppText';
import { HomeAccountPage, CategoryDrilldown, AccountViewMode } from '../(tabs)/index';
import { TrendLineChart } from '../../components/insights/TrendLineChart';
import { ActionStrip } from '../../components/ui/ActionStrip';
import { ActionChip, FilledButton, TextButton } from '../../components/ui/AppButton';
import { HeaderResetButton } from '../../components/ui/HeaderResetButton';
import { HeaderMoreButton, ScreenHeader } from '../../components/ui/ScreenHeader';
import { ScreenScaffold } from '../../components/ui/ScreenScaffold';
import { SheetScrollTopButton } from '../../components/ui/SheetScrollTopButton';
import { getScrollableBottomPadding } from '../../components/ui/safeBottom';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { formatDate, toLocalDayEndISO, toLocalDayStartISO } from '../../lib/dateUtils';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../../lib/settings-shared';
import { trendCache } from '../../lib/trendCache';
import { useDateFilter, DEFAULT_FILTER_PERIOD } from '../../lib/useDateFilter';
import { getAccountBalanceTrend } from '../../services/analytics';
import { getMaxTransactionDate } from '../../services/transactions';
import { getAccountBootstrapCache } from '../../lib/accountBootstrapCache';

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

  const designVariantRaw = useDesignLabStore((s) => s.accountDetailVariant);
  const designVariant = __DEV__ ? designVariantRaw : 'current';
  const cycleDesignVariant = useDesignLabStore((s) => s.cycleAccountDetailVariant);

  const LEDGER_BG = palette.background;
  const LEDGER_INK = palette.text;

  const account = accounts.find((a) => a.id === id);

  const cachedFromPrefetch = id ? getAccountBootstrapCache(id) : undefined;
  const [trendPoints, setTrendPoints] = useState<{ date: string; val: number }[]>(
    () => trendCache.get(id ?? '')?.data ?? cachedFromPrefetch?.trendPoints ?? []
  );
  const [isLoadingTrend, setIsLoadingTrend] = useState(
    () => !trendCache.has(id ?? '') && !cachedFromPrefetch?.trendPoints
  );
  const [chartInteracting, setChartInteracting] = useState(false);
  const mutationVersion = useTransactionsStore((s) => s.mutationVersion);
  const [inlineFilter, setInlineFilter] = useState<'in' | 'out' | null>(null);
  const [resetInlineFilterToken, setResetInlineFilterToken] = useState(0);

  const [activityViewMode, setActivityViewMode] = useState<AccountViewMode>('date');
  const [categoryDrilldown, setCategoryDrilldown] = useState<CategoryDrilldown | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setChartReady(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activityViewMode === 'category' && categoryDrilldown) {
        setCategoryDrilldown(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [categoryDrilldown, activityViewMode, isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    loadCategories().catch(() => undefined);
  }, [isFocused, loadCategories]);

  useEffect(() => {
    if (!isFocused || !account) return;
    const cachedTrend = trendCache.get(account.id);
    if (cachedTrend?.version === mutationVersion) {
      setTrendPoints(cachedTrend.data);
      setIsLoadingTrend(false);
      return;
    }
    let active = true;
    const loadTrend = async () => {
      // Only show skeleton on the very first load; subsequent refreshes are silent.
      if (!cachedTrend && trendPoints.length === 0) setIsLoadingTrend(true);
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 29);
      const fromStr = toLocalDayStartISO(thirtyDaysAgo);
      const toStr = toLocalDayEndISO(today);
      try {
        const trend = await getAccountBalanceTrend(account.id, fromStr, toStr);
        if (active) {
          const mapped = trend.map(t => ({ date: t.date, val: t.balance }));
          trendCache.set(account.id, { version: mutationVersion, data: mapped });
          setTrendPoints(mapped);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoadingTrend(false);
      }
    };

    if (cachedTrend) {
      // Mutation-driven refresh: data exists but is stale — reload immediately,
      // no need to wait for a navigation transition that's already complete.
      loadTrend();
      return () => { active = false; };
    }
    // Initial load: defer until the screen's navigation transition settles.
    const task = InteractionManager.runAfterInteractions(() => { loadTrend(); });
    return () => {
      active = false;
      task.cancel();
    };
  }, [account?.id, mutationVersion, isFocused]);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const verticalScrolls = useSharedValue<number[]>([0]);
  const indicatorY = useSharedValue(0);

  const [maxTxDate, setMaxTxDate] = useState<string | null>(
    () => cachedFromPrefetch?.recentTransactions?.[0]?.date ?? null
  );

  useEffect(() => {
    if (!account?.id) return;
    let active = true;
    getMaxTransactionDate(account.id).then((date) => {
      if (active) setMaxTxDate(date);
    });
    return () => { active = false; };
  }, [account?.id, mutationVersion]);

  const dateFilter = useDateFilter({ initialPeriod: DEFAULT_FILTER_PERIOD, maxDate: maxTxDate });
  const [activePoint, setActivePoint] = useState<any>(null);

  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const panelProgress = useSharedValue(0);

  const openCustomRange = useCallback(() => {
    setCustomDraftFrom(new Date(dateFilter.customRange?.from || Date.now()));
    setCustomDraftTo(new Date(dateFilter.customRange?.to || Date.now()));
    setCustomRangeOpen(true);
  }, [dateFilter]);

  const handleApplyCustomRange = useCallback((from: Date, to: Date) => {
    dateFilter.setCustomRange({
      from: toLocalDayStartISO(from),
      to: toLocalDayEndISO(to)
    });
    dateFilter.setPeriod('custom');
  }, [dateFilter]);

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    handleApplyCustomRange(fromDate, toDate);
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo, handleApplyCustomRange]);

  const toggleActions = useCallback(() => {
    const nextShow = !showActions;
    setShowActions(nextShow);
    panelProgress.value = withTiming(nextShow ? 1 : 0, { duration: 220 });
  }, [showActions]);

  const closePanel = useCallback(() => {
    setShowActions(false);
    panelProgress.value = withTiming(0, { duration: 220 });
  }, []);

  const pageScrollTopRef = useRef<(() => void) | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const handleRegisterScrollTop = useCallback((_id: string, fn: (() => void) | null) => {
    pageScrollTopRef.current = fn;
  }, []);

  const handleScrollYChange = useCallback((y: number) => {
    setShowScrollTop(y > 150);
  }, []);

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 56, // 36 height + 20 vertical padding
    opacity: panelProgress.value,
  }));

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

  if (!account) return null;

  const lineColor = ACCOUNT_TYPE_META[account.type]?.color ?? palette.brand;
  const isLedger = designVariant === 'ledger';
  const isPulse = designVariant === 'pulse';
  // Both Pulse and Ledger use the editorial cream canvas.
  const isEditorial = isLedger || isPulse;  const middleContent = useMemo(() => {

    return (
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
        hideAxisLabels={true}
        endLabelIsToday={true}
        hideEndBalance={true}
        onActivePointChange={setActivePoint}
        hideInternalTooltip={true}
        lineStrokeWidth={1.8}
        chartHeight={100}
        paddingX={10}
      />
    );
  }, [chartReady, trendPoints, palette, showCurrencySymbol, currencySymbol, lineColor, setChartInteracting, isLoadingTrend, setActivePoint]);

  // Ledger-tuned chart: deep ink 1px stroke, no fill, no axis labels chrome.
  const middleContentLedger = useMemo(() => {

    return (
      <TrendLineChart
        points={trendPoints}
        palette={palette}
        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
        title=""
        lineColor={LEDGER_INK}
        onInteractionStateChange={setChartInteracting}
        isLoading={isLoadingTrend}
        hideHeader={true}
        hideStartDot={true}
        flatStyle={true}
        smoothCurves={true}
        hideAxisLabels={true}
        endLabelIsToday={true}
        hideEndBalance={true}
        onActivePointChange={setActivePoint}
        hideInternalTooltip={true}
        hideAreaFill={true}
        lineStrokeWidth={1.6}
        chartHeight={100}
      />
    );
  }, [chartReady, trendPoints, palette, showCurrencySymbol, currencySymbol, setChartInteracting, isLoadingTrend, setActivePoint]);

  // Pulse-tuned chart: ink stroke (2.0px width), no area fill, no axis labels.
  const middleContentPulse = useMemo(() => {

    return (
      <TrendLineChart
        points={trendPoints}
        palette={palette}
        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
        title=""
        lineColor={palette.text}
        onInteractionStateChange={setChartInteracting}
        isLoading={isLoadingTrend}
        hideHeader={true}
        hideStartDot={true}
        flatStyle={true}
        smoothCurves={true}
        hideAxisLabels={true}
        hideAxisBalances={true}
        endLabelIsToday={true}
        hideEndBalance={true}
        onActivePointChange={setActivePoint}
        hideInternalTooltip={true}
        hideAreaFill={true}
        lineStrokeWidth={1.8}
        chartHeight={100}
      />
    );
  }, [chartReady, trendPoints, palette, showCurrencySymbol, currencySymbol, setChartInteracting, isLoadingTrend, setActivePoint]);

  return (
    <ScreenScaffold
      palette={palette}
      style={isEditorial ? { backgroundColor: LEDGER_BG } : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerShadowVisible: false,
          header: () => (
            <View style={{ paddingTop: insets.top, backgroundColor: isEditorial ? LEDGER_BG : palette.background }}>
              <ScreenHeader
                title={formatAccountDisplayName(account.name, account.accountNumber)}
                onBack={() => {
                  if (activityViewMode === 'category' && categoryDrilldown) {
                    setCategoryDrilldown(null);
                  } else {
                    router.back();
                  }
                }}
                palette={palette}
                onTitleLongPress={__DEV__ ? cycleDesignVariant : undefined}
                backgroundColor={isEditorial ? LEDGER_BG : undefined}
                titleColor={isEditorial ? LEDGER_INK : undefined}
                iconColor={isEditorial ? LEDGER_INK : undefined}
                titleAddon={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <HeaderResetButton
                      visible={!!inlineFilter || dateFilter.period !== DEFAULT_FILTER_PERIOD || dateFilter.offset !== 0}
                      onPress={() => {
                        setInlineFilter(null);
                        dateFilter.setPeriod(DEFAULT_FILTER_PERIOD);
                        dateFilter.setOffset(0);
                        setResetInlineFilterToken((t) => t + 1);
                      }}
                      palette={palette}
                      isFocused={isFocused}
                    />
                    {__DEV__ && designVariant !== 'current' && (
                      <TouchableOpacity
                        delayPressIn={0}
                        onPress={cycleDesignVariant}
                        activeOpacity={0.75}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: isEditorial ? LEDGER_INK : palette.brand,
                          backgroundColor: isEditorial ? 'transparent' : palette.brandSoft,
                        }}
                      >
                        <Text style={{
                          fontSize: 9.5,
                          fontWeight: FONT_WEIGHT.heavy,
                          color: isEditorial ? LEDGER_INK : palette.brand,
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                        }}>
                          {VARIANT_LABEL[designVariant]}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                }
                rightAction={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <SheetScrollTopButton
                      visible={showScrollTop}
                      onPress={() => pageScrollTopRef.current?.()}
                      palette={palette}
                      color={isEditorial ? LEDGER_INK : undefined}
                    />
                    {/* Per Direction A, Pulse moves +Add to a floating FAB.
                        Ledger keeps it in the header (user constraint). */}
                    <TouchableOpacity
                      delayPressIn={0}
                      activeOpacity={0.5}
                      onPress={() => router.push({ pathname: '/modals/add-transaction', params: { accountId: account.id } })}
                    >
                      <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: isEditorial ? LEDGER_INK : palette.brand }}>+ Add</Text>
                    </TouchableOpacity>
                    <HeaderMoreButton palette={palette} isOpen={showActions} onPress={toggleActions} iconColor={isEditorial ? LEDGER_INK : undefined} />
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
        dateFilter={dateFilter}
        onOpenCustomRange={openCustomRange}
        totalBalance={account.balance}
        onRefresh={refreshAccounts}
        isSelected={true}
        pageIndex={0}
        verticalScrolls={verticalScrolls}
        indicatorY={indicatorY}
        registerScrollTop={handleRegisterScrollTop}
        isPageReady={chartReady}
        accountsById={accountsById}
        categoriesById={categoriesById}
        loansById={loansById}
        getCategoryFullDisplayName={getCategoryFullDisplayName}
        loansLoaded={loansLoaded}
        loadLoans={loadLoans}
        contentBottomPadding={getScrollableBottomPadding(insets)}
        onScrollBeginDrag={closePanel}
        middleContent={middleContent}
        middleContentLedger={middleContentLedger}
        middleContentPulse={middleContentPulse}
        scrollEnabled={!chartInteracting}
        dataNonce={mutationVersion}
        onInlineFilterChange={setInlineFilter}
        resetInlineFilterToken={resetInlineFilterToken}
        isDetailScreen={true}
        activePoint={activePoint}
        onApplyCustomRange={handleApplyCustomRange}
        onScrollYChange={handleScrollYChange}
        activityViewMode={activityViewMode}
        onActivityViewModeChange={setActivityViewMode}
        categoryDrilldown={categoryDrilldown}
        onCategoryDrilldownChange={setCategoryDrilldown}
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
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextButton label="Cancel" onPress={() => setCustomRangeOpen(false)} palette={palette} tone="default" />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton label="Done" onPress={handleCustomRangeDone} palette={palette} tone="brand" style={{ borderRadius: 24, minHeight: 40 }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenScaffold>
  );
}
