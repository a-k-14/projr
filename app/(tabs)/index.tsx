import { Text } from '@/components/ui/AppText';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeDonutChartBlock, type HomeChartMode } from '../../components/HomeDonutChartBlock';
import { ScreenTitle } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FabButton } from '../../components/ui/FabButton';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { SegmentedPillSwitch } from '../../components/ui/SegmentedPillSwitch';
import { formatAccountDisplayName } from '../../lib/account-utils';
import {
  formatDate,
  getDateRange,
  toLocalDateKey,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER } from '../../lib/design';
import {
  BUTTON_TOKENS,
  getFabBottomOffset,
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_SURFACE,
  HOME_TEXT
} from '../../lib/layoutTokens';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import { registerTabReset, type TabResetMode } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getCashflowSnapshot, getCashflowSummary } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  Account,
  CashflowSummary,
  Category,
  LoanStatus,
  LoanWithSummary,
  PeriodType,
  Transaction,
  AccountType
} from '../../types';

const PERIODS: PeriodType[] = ['week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};
const ACCOUNT_TYPE_SORT_ORDER: Record<AccountType, number> = {
  savings: 0,
  cash: 1,
  wallet: 2,
  investment: 3,
  credit: 4,
  other: 5,
};

// Set false to restore the previous behavior where the indicator stays visible
// during horizontal swipes, even when the current page is vertically scrolled.
const HIDE_SCROLLED_INDICATOR_DURING_SWIPE = true;

type AccountTab = {
  id: string | 'all' | 'add' | 'net-worth';
  name: string;
};

type AccountCardItem = {
  id: string | 'all';
  name: string;
  accountTypeLabel: string;
};

export default function HomeScreen() {
  const accounts = useAccountsStore((s) => s.accounts);
  const refreshAccounts = useAccountsStore((s) => s.refresh);
  const categories = useCategoriesStore((s) => s.categories);
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const homeAccountViewMode = useUIStore((s) => s.settings.homeAccountViewMode);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showAllAccountsTab = accounts.length !== 1;
  const homeRootAccountId = showAllAccountsTab ? 'all' : (accounts[0]?.id ?? 'all');
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const accountPagerScrollX = useSharedValue(0);
  const settledAccountPageIndex = useSharedValue(0);
  const verticalScrolls = useSharedValue<number[]>(new Array(20).fill(0));
  const indicatorY = useSharedValue(0);
  const indicatorGestureOpacity = useSharedValue(1);
  const isPagerInteractingRef = useRef(false);
  const didPositionInitialPagerRef = useRef(false);
  const wasFocusedRef = useRef(false);
  const pendingPagerSyncAccountIdRef = useRef<string | 'all' | 'add' | 'net-worth' | null>(null);
  const selectedAccountIdRef = useRef<string | 'all' | 'add' | 'net-worth'>('all');
  const { palette } = useAppTheme();
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [globalScrollResetTick, setGlobalScrollResetTick] = useState<{ count: number; animated: boolean; mode: TabResetMode }>({
    count: 0,
    animated: false,
    mode: 'background',
  });
  const [pageBackgroundResetTicks, setPageBackgroundResetTicks] = useState<Record<string, number>>({});
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: HomeChartMode;
    resetTrigger: number;
  } | null>(null);
  const previousAccountCountRef = useRef(accounts.length);

  const displayAccounts = useMemo<AccountTab[]>(() => [
    ...(showAllAccountsTab ? [{ id: 'net-worth' as const, name: 'Net Worth' }] : []),
    ...(showAllAccountsTab ? [{ id: 'all' as const, name: 'All' }] : []),
    ...accounts.map((a) => ({ id: a.id, name: formatAccountDisplayName(a.name, a.accountNumber) })),
    { id: 'add', name: 'Add Account' },
  ], [accounts, showAllAccountsTab]);
  const accountCards = useMemo<AccountCardItem[]>(() => [
    ...(showAllAccountsTab ? [{ id: 'all' as const, name: 'All Accounts', accountTypeLabel: '' }] : []),
    ...accounts.map((a) => ({
      id: a.id,
      name: formatAccountDisplayName(a.name, a.accountNumber),
      accountTypeLabel: getAccountTypeLabel(a.type),
    })),
  ], [accounts, showAllAccountsTab]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all' | 'add' | 'net-worth'>(homeRootAccountId);
  const [headerAccountId, setHeaderAccountId] = useState<string | 'all' | 'add' | 'net-worth'>(homeRootAccountId);
  const [pagerHeight, setPagerHeight] = useState(0);
  const [isPagerReady, setIsPagerReady] = useState(homeRootAccountId === 'all' && width <= 0);
  const [loadedPageIds, setLoadedPageIds] = useState<Set<string | 'all' | 'add' | 'net-worth'>>(
    () => new Set([homeRootAccountId]),
  );
  const selectedPageIndex = useMemo(
    () => Math.max(displayAccounts.findIndex((account) => account.id === selectedAccountId), 0),
    [displayAccounts, selectedAccountId],
  );
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);
  const accountTypeById = useMemo(() => new Map(accounts.map((account) => [account.id, getAccountTypeLabel(account.type)])), [accounts]);
  const accountBalanceById = useMemo(() => new Map(accounts.map((account) => [account.id, account.balance])), [accounts]);
  const totalBalance = useMemo(() => getTotalBalance(accounts), [accounts]);
  const loanSummary = useMemo(() => getLoanSummary(loans), [loans]);
  const netWorth = totalBalance + loanSummary.net;

  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
    setHeaderAccountId(selectedAccountId);
  }, [selectedAccountId]);

  const updateHeaderPreviewById = useCallback((nextId: string | 'all' | 'add' | 'net-worth') => {
    setHeaderAccountId((current) => (current === nextId ? current : nextId));
  }, []);

  useEffect(() => {
    if (isFocused && !wasFocusedRef.current) {
      wasFocusedRef.current = true;
      if (selectedAccountId !== homeRootAccountId) {
        const rootIndex = Math.max(0, displayAccounts.findIndex((account) => account.id === homeRootAccountId));
        selectedAccountIdRef.current = homeRootAccountId;
        setSelectedAccountId(homeRootAccountId);
        settledAccountPageIndex.value = rootIndex;
        accountPagerScrollX.value = rootIndex * width;
        pagerRef.current?.scrollTo({ x: rootIndex * width, animated: false });
      }
    } else if (!isFocused) {
      wasFocusedRef.current = false;
    }
  }, [accountPagerScrollX, displayAccounts, homeRootAccountId, isFocused, pagerRef, selectedAccountId, settledAccountPageIndex, width]);

  useEffect(() => {
    if (didPositionInitialPagerRef.current || width <= 0 || displayAccounts.length === 0) return;
    didPositionInitialPagerRef.current = true;
    const targetX = selectedPageIndex * width;
    settledAccountPageIndex.value = selectedPageIndex;
    accountPagerScrollX.value = targetX;
    pagerRef.current?.scrollTo({ x: targetX, animated: false });
    setIsPagerReady(true);
  }, [accountPagerScrollX, displayAccounts.length, pagerRef, selectedPageIndex, settledAccountPageIndex, width]);

  useEffect(() => {
    const previousCount = previousAccountCountRef.current;
    previousAccountCountRef.current = accounts.length;
    if (selectedAccountId === 'add' && accounts.length > previousCount && accounts.length > 0) {
      const nextAccountId = accounts[accounts.length - 1].id;
      setSelectedAccountId(nextAccountId);
      const nextIndex = displayAccounts.findIndex((account) => account.id === nextAccountId);
      if (nextIndex >= 0) {
        const targetX = nextIndex * width;
        settledAccountPageIndex.value = nextIndex;
        accountPagerScrollX.value = targetX;
        pagerRef.current?.scrollTo({ x: targetX, animated: false });
      }
      return;
    }

    if (
      selectedAccountId !== 'all' &&
      selectedAccountId !== 'add' &&
      selectedAccountId !== 'net-worth' &&
      !accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(homeRootAccountId);
      const rootIndex = Math.max(0, displayAccounts.findIndex((account) => account.id === homeRootAccountId));
      pagerRef.current?.scrollTo({ x: rootIndex * width, animated: true });
    }
  }, [accountPagerScrollX, accounts, displayAccounts, homeRootAccountId, pagerRef, selectedAccountId, settledAccountPageIndex, width]);

  useEffect(() => {
    if (selectedAccountId === 'all' && !showAllAccountsTab && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId, showAllAccountsTab]);

  useEffect(() => {
    setLoadedPageIds((prev) => {
      const next = new Set(prev);
      const current = displayAccounts[selectedPageIndex];
      const left = displayAccounts[selectedPageIndex - 1];
      const right = displayAccounts[selectedPageIndex + 1];
      if (current) next.add(current.id);
      if (left) next.add(left.id);
      if (right) next.add(right.id);
      return next;
    });
  }, [displayAccounts, selectedPageIndex]);

  useEffect(() => {
    if (homeAccountViewMode !== 'swipe') return;
    if (pendingPagerSyncAccountIdRef.current !== selectedAccountId) return;
    if (isPagerInteractingRef.current) return;
    const selectedIndex = displayAccounts.findIndex((account) => account.id === selectedAccountId);
    if (selectedIndex >= 0) {
      const targetX = selectedIndex * width;
      settledAccountPageIndex.value = selectedIndex;
      if (Math.abs(accountPagerScrollX.value - targetX) > 1) {
        accountPagerScrollX.value = targetX;
        pagerRef.current?.scrollTo({ x: targetX, animated: false });
      }
      pendingPagerSyncAccountIdRef.current = null;
    }
  }, [accountPagerScrollX, displayAccounts, homeAccountViewMode, pagerRef, selectedAccountId, settledAccountPageIndex, width]);

  const resetHomeToAll = useCallback((mode: TabResetMode, animated: boolean) => {
    setSelectedAccountId(homeRootAccountId);
    if (mode === 'full' && homeAccountViewMode === 'list') {
      updateSettings({ homeAccountViewMode: 'swipe' }, 'home-tab-reset').catch(() => undefined);
    }
    const rootIndex = Math.max(0, displayAccounts.findIndex((account) => account.id === homeRootAccountId));
    const targetX = rootIndex * width;
    settledAccountPageIndex.value = rootIndex;
    accountPagerScrollX.value = targetX;
    if (mode === 'background') {
      verticalScrolls.value = verticalScrolls.value.map(() => 0);
      indicatorGestureOpacity.value = 1;
    }
    pagerRef.current?.scrollTo({ x: targetX, animated });
    setGlobalScrollResetTick(v => ({ count: v.count + 1, animated, mode }));
  }, [accountPagerScrollX, displayAccounts, homeAccountViewMode, homeRootAccountId, indicatorGestureOpacity, pagerRef, settledAccountPageIndex, updateSettings, verticalScrolls, width]);

  const resetPageInBackground = useCallback((accountId: string | 'all' | 'add' | 'net-worth') => {
    if (accountId === 'add' || accountId === 'net-worth') return;
    setPageBackgroundResetTicks((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] ?? 0) + 1,
    }));
  }, []);

  useEffect(() => {
    return registerTabReset('index', ({ mode, animated }) => {
      resetHomeToAll(mode, animated);
    });
  }, [resetHomeToAll]);

  const customRangeMemo = useMemo(
    () => ({ from: new Date(customRangeFrom), to: new Date(customRangeTo) }),
    [customRangeFrom, customRangeTo]
  );

  const handlePagerEnd = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(index, displayAccounts.length - 1));
      const next = displayAccounts[safeIndex];
      if (next) {
        settledAccountPageIndex.value = safeIndex;
      }
      const currentSelectedAccountId = selectedAccountIdRef.current;
      if (next && next.id !== currentSelectedAccountId) {
        resetPageInBackground(currentSelectedAccountId);
        selectedAccountIdRef.current = next.id;
        setHeaderAccountId(next.id);
        setSelectedAccountId(next.id);
      }
    },
    [displayAccounts, resetPageInBackground, settledAccountPageIndex],
  );

  const handlePagerBeginDrag = useCallback(() => {
    isPagerInteractingRef.current = true;
  }, []);

  const handlePagerMomentumBegin = useCallback(() => {
    isPagerInteractingRef.current = true;
  }, []);

  const accountPagerScrollHandler = useAnimatedScrollHandler({
    onBeginDrag: () => {
      if (!HIDE_SCROLLED_INDICATOR_DURING_SWIPE) {
        indicatorGestureOpacity.value = 1;
        return;
      }
      const settledIndex = Math.max(0, Math.round(settledAccountPageIndex.value));
      const currentScroll = verticalScrolls.value[settledIndex] ?? 0;
      indicatorGestureOpacity.value = Math.abs(currentScroll) > 1 ? 0 : 1;
    },
    onScroll: (event) => {
      accountPagerScrollX.value = event.contentOffset.x;

      const pageWidthValue = Math.max(width, 1);
      const progress = event.contentOffset.x / pageWidthValue;
      const settledIndex = Math.max(0, Math.round(settledAccountPageIndex.value));
      const delta = progress - settledIndex;
      let previewIndex = settledIndex;
      if (delta < -0.005) previewIndex = Math.max(0, settledIndex - 1);
      if (delta > 0.005) previewIndex = Math.min(displayAccounts.length - 1, settledIndex + 1);
      const previewId = displayAccounts[previewIndex]?.id ?? homeRootAccountId;
      runOnJS(updateHeaderPreviewById)(previewId);
      const hasMovedHorizontally = Math.abs(progress - settledIndex) > 0.01;
      const currentScroll = verticalScrolls.value[settledIndex] ?? 0;

      if (HIDE_SCROLLED_INDICATOR_DURING_SWIPE && hasMovedHorizontally && Math.abs(currentScroll) > 1) {
        indicatorGestureOpacity.value = 0;
      }
    },
  }, [displayAccounts, homeRootAccountId, indicatorGestureOpacity, settledAccountPageIndex, updateHeaderPreviewById, verticalScrolls, width]);

  const handlePagerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / Math.max(width, 1));
      handlePagerEnd(nextIndex);
      isPagerInteractingRef.current = false;
      indicatorGestureOpacity.value = 1;
    },
    [handlePagerEnd, indicatorGestureOpacity, width],
  );

  const handlePagerDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const pageWidthValue = Math.max(width, 1);
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / pageWidthValue);
      const settledOffset = nextIndex * pageWidthValue;

      if (Math.abs(offsetX - settledOffset) < 1) {
        handlePagerEnd(nextIndex);
        isPagerInteractingRef.current = false;
        indicatorGestureOpacity.value = 1;
      }
    },
    [handlePagerEnd, indicatorGestureOpacity, width],
  );

  const setHomeViewMode = useCallback(
    (mode: 'swipe' | 'list') => {
      updateSettings({ homeAccountViewMode: mode }, 'home-account-view-mode').catch(() => undefined);
    },
    [updateSettings],
  );

  const openAccountInSwipeMode = useCallback(
    (accountId: string | 'all') => {
      pendingPagerSyncAccountIdRef.current = accountId;
      selectedAccountIdRef.current = accountId;
      setSelectedAccountId(accountId);
      updateSettings({ homeAccountViewMode: 'swipe' }, 'home-account-list-open').catch(() => undefined);
    },
    [updateSettings],
  );

  const openCustomRange = useCallback(() => {
    setCustomDraftFrom(new Date(customRangeFrom));
    setCustomDraftTo(new Date(customRangeTo));
    setCustomRangeOpen(true);
  }, [customRangeFrom, customRangeTo]);

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

  const handleCustomRangeDone = useCallback(() => {
    const fromDate = customDraftFrom <= customDraftTo ? customDraftFrom : customDraftTo;
    const toDate = customDraftTo >= customDraftFrom ? customDraftTo : customDraftFrom;
    setCustomDraftFrom(fromDate);
    setCustomDraftTo(toDate);
    setCustomRangeFrom(toLocalDayStartISO(fromDate));
    setCustomRangeTo(toLocalDayEndISO(toDate));
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo]);

  if (accounts.length === 0) {
    return (
      <View
        style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: SCREEN_GUTTER,
            paddingBottom: Math.max(insets.bottom, 18),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FinanceEmptyMascot palette={palette} variant="account" />
          <Text
            style={{
              marginTop: 18,
              fontSize: HOME_TEXT.heroValue,
              fontWeight: '700',
              color: palette.text,
              textAlign: 'center',
            }}
          >
            Add your first account
          </Text>
          <Text
            style={{
              marginTop: 8,
              maxWidth: 280,
              fontSize: HOME_TEXT.body,
              lineHeight: 20,
              color: palette.textMuted,
              textAlign: 'center',
            }}
          >
            Create an account to start tracking balances and transactions.
          </Text>
          <FilledButton
            label="Add Account"
            onPress={() => router.push('/settings/account-form')}
            palette={palette}
            startIcon={<AppIcon name="plus" size={18} color={palette.onBrand} />}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              marginTop: 24,
              borderRadius: 14,
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}
    >
      <ScreenTitle
        title={headerAccountId === 'net-worth' ? 'Net Worth' : 'Accounts'}
        palette={palette}
        right={
          <View
            pointerEvents={headerAccountId === 'net-worth' ? 'none' : 'auto'}
            style={{ width: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, opacity: headerAccountId === 'net-worth' ? 0 : 1 }}
          >
            <HomeAccountViewToggle
              mode={homeAccountViewMode}
              palette={palette}
              onChange={setHomeViewMode}
            />
          </View>
        }
      />

      <View
        style={{ flex: 1, overflow: 'hidden' }}
        onLayout={(event: LayoutChangeEvent) => {
          setPagerHeight(event.nativeEvent.layout.height);
        }}
      >
        <View style={{ flex: 1 }}>
          <View
            pointerEvents={homeAccountViewMode === 'list' ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              opacity: homeAccountViewMode === 'list' ? 1 : 0,
              zIndex: homeAccountViewMode === 'list' ? 2 : 0,
            }}
          >
            <HomeAccountsList
              pageHeight={pagerHeight}
              accounts={accountCards}
              rawAccounts={accounts}
              currencySymbol={showCurrencySymbol ? currencySymbol : ''}
              palette={palette}
              onOpenAccount={openAccountInSwipeMode}
              onRefresh={refreshAccounts}
            />
          </View>
          <View
            pointerEvents={homeAccountViewMode === 'swipe' ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              opacity: homeAccountViewMode === 'swipe' && isPagerReady ? 1 : 0,
              zIndex: homeAccountViewMode === 'swipe' ? 2 : 0,
            }}
          >
            <Animated.ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
              onScroll={accountPagerScrollHandler}
              onScrollBeginDrag={handlePagerBeginDrag}
              onScrollEndDrag={handlePagerDragEnd}
              onMomentumScrollBegin={handlePagerMomentumBegin}
              onMomentumScrollEnd={handlePagerMomentumEnd}
              scrollEventThrottle={1}
              style={{ flex: 1 }}
            >
              {displayAccounts.map((account, index) => {
                return (
                  <View key={account.id} style={{ width, height: pagerHeight || undefined }}>
                    {account.id === 'net-worth' ? (
                      <HomeNetWorthPage
                        pageHeight={pagerHeight}
                        palette={palette}
                        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
                        accounts={accounts}
                        loanSummary={loanSummary}
                        netWorth={netWorth}
                        pageIndex={index}
                        verticalScrolls={verticalScrolls}
                        indicatorY={indicatorY}
                        resetTick={globalScrollResetTick}
                        onOpenAccount={openAccountInSwipeMode}
                      />
                    ) : account.id === 'add' ? (
                      <AddAccountPage
                        pageHeight={pagerHeight}
                        palette={palette}
                      />
                    ) : (
                      <HomeAccountPage
                        pageHeight={pagerHeight}
                        accountId={account.id}
                        accountName={account.name}
                        accountTypeLabel={
                          account.id === 'all'
                            ? ''
                            : (accountTypeById.get(account.id) ?? '')
                        }
                        settingsYearStart={settingsYearStart}
                        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
                        customRange={customRangeMemo}
                        onOpenCustomRange={openCustomRange}
                        totalBalance={
                          account.id === 'all'
                            ? totalBalance
                            : (accountBalanceById.get(account.id) ?? 0)
                        }
                        onRefresh={refreshAccounts}
                        isSelected={account.id === selectedAccountId}
                        pageIndex={index}
                        verticalScrolls={verticalScrolls}
                        indicatorY={indicatorY}
                        resetTick={globalScrollResetTick}
                        backgroundResetTick={pageBackgroundResetTicks[account.id] ?? 0}
                        onOpenChartExpanded={(transactions, mode, range, resetTrigger) => {
                          setExpandedChartState({ transactions, mode, resetTrigger });
                          setBottomSheetVisible(true);
                        }}
                        isPageReady={loadedPageIds.has(account.id) || Math.abs(index - selectedPageIndex) <= 1}
                        accountsById={accountsById}
                        categoriesById={categoriesById}
                        loansById={loansById}
                        getCategoryFullDisplayName={getCategoryFullDisplayName}
                        loansLoaded={loansLoaded}
                        loadLoans={loadLoans}
                      />
                    )}
                  </View>
                );
              })}
            </Animated.ScrollView>
            <PageDashIndicator
              pageCount={displayAccounts.length}
              palette={palette}
              pageWidth={width}
              scrollX={accountPagerScrollX}
              settledPageIndex={settledAccountPageIndex}
              verticalScrolls={verticalScrolls}
              indicatorY={indicatorY}
              gestureOpacity={indicatorGestureOpacity}
              hidden={bottomSheetVisible}
            />
          </View>
        </View>
      </View>

      <FabButton
        bottom={getFabBottomOffset(insets.bottom)}
        palette={palette}
        backgroundColor={palette.isDark ? palette.surfaceRaised : palette.text}
        iconColor={palette.isDark ? palette.listText : palette.surface}
        style={palette.isDark ? { borderWidth: 1, borderColor: palette.borderSoft } : undefined}
            onPress={() =>
              router.push({
                pathname: '/modals/add-transaction',
                params: selectedAccountId === 'all' || selectedAccountId === 'add' || selectedAccountId === 'net-worth' ? undefined : { accountId: selectedAccountId }
              })
            }
      />

      <Modal
        visible={customRangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomRangeOpen(false)}
      >
        <Pressable
          onPress={() => setCustomRangeOpen(false)}
          style={{
            flex: 1,
            backgroundColor: palette.scrim,
            justifyContent: 'center',
            padding: 20
          }}
        >
          <Pressable
            onPress={() => { }}
            style={{
              backgroundColor: palette.card,
              borderRadius: HOME_RADIUS.large,
              padding: HOME_SPACE.xxl,
              borderWidth: 1,
              borderColor: palette.divider,
            }}
          >
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginBottom: 8 }}>
              Custom range
            </Text>
            <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: 16 }}>
              Pick the from and to dates for this range.
            </Text>
            <View style={{ gap: HOME_SPACE.md, marginBottom: HOME_SPACE.lg }}>
              <TouchableOpacity delayPressIn={0}
                onPress={() => openDatePicker('from')}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: palette.inputBg,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>From</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftFrom.toISOString())}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity delayPressIn={0}
                onPress={() => openDatePicker('to')}
                style={{
                  borderWidth: 1,
                  borderColor: palette.divider,
                  backgroundColor: palette.inputBg,
                  borderRadius: HOME_RADIUS.card,
                  paddingHorizontal: HOME_SPACE.lg,
                  paddingVertical: 12
                }}
              >
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 4 }}>To</Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                  {formatDate(customDraftTo.toISOString())}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: HOME_SPACE.md, marginTop: HOME_SPACE.lg }}>
              <View style={{ flex: 1 }}>
                <TextButton
                  label="Cancel"
                  onPress={() => setCustomRangeOpen(false)}
                  palette={palette}
                  tone="default"
                  style={{
                    minHeight: 48,
                    borderRadius: HOME_RADIUS.tab,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FilledButton
                  label="Done"
                  onPress={handleCustomRangeDone}
                  palette={palette}
                  tone="brand"
                  style={{ borderRadius: HOME_RADIUS.tab }}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {expandedChartState ? (
        <BottomSheet
          title="Category Breakdown"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => {
            setExpandedChartState(null);
            setBottomSheetVisible(false);
          }}
          maxHeightRatio={0.80}
          fixedHeightRatio={0.80}
          hasNavBar
        >
          <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 0, backgroundColor: palette.background }}>
            <View style={{ backgroundColor: palette.card, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
              <HomeDonutChartBlock
                transactions={expandedChartState.transactions}
                categoriesById={categoriesById}
                sym={showCurrencySymbol ? currencySymbol : ''}
                listPalette={palette}
                getCategoryFullDisplayName={getCategoryFullDisplayName}
                theme={{
                  brand: palette.brand,
                  card: palette.card,
                  surface: '#EEF2F8',
                  inputBg: '#FFFFFF',
                  progressTrack: '#DDE4F0',
                  border: '#DFE5EF',
                  text: palette.text,
                  muted: '#7C8498',
                  textMuted: palette.textMuted,
                  accent: palette.brand,
                  positive: palette.positive,
                  negative: palette.negative,
                }}
                expanded
                initialMode={expandedChartState.mode}
                resetTrigger={expandedChartState.resetTrigger}
                accountsById={accountsById}
                loansById={loansById}
              />
            </View>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

function HomeAccountViewToggle({
  mode,
  palette,
  onChange,
}: {
  mode: 'swipe' | 'list';
  palette: AppThemePalette;
  onChange: (mode: 'swipe' | 'list') => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#F0F3F9',
        borderRadius: 14,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {([
        { key: 'swipe', icon: 'gallery-thumbnails' },
        { key: 'list', icon: 'list' },
      ] as const).map((item) => {
        const selected = mode === item.key;
        return (
          <TouchableOpacity
            delayPressIn={0}
            key={item.key}
            activeOpacity={0.8}
            onPress={() => {
              onChange(item.key);
            }}
            style={{
              width: 44,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? palette.surface : 'transparent',
            }}
          >
            <AppIcon name={item.icon}
              size={18}
              color={selected ? '#1F2A44' : '#8C94AF'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NetWorthBalanceByToggle({
  mode,
  palette,
  onChange,
}: {
  mode: 'balance' | 'type';
  palette: AppThemePalette;
  onChange: (mode: 'balance' | 'type') => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#F0F3F9',
        borderRadius: 14,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {([
        { key: 'balance', label: 'Account' },
        { key: 'type', label: 'Type' },
      ] as const).map((item) => {
        const selected = mode === item.key;
        return (
          <TouchableOpacity
            delayPressIn={0}
            key={item.key}
            activeOpacity={0.8}
            onPress={() => onChange(item.key)}
            style={{
              minWidth: 72,
              height: 34,
              paddingHorizontal: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? palette.surface : 'transparent',
            }}
          >
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: '700', color: selected ? '#1F2A44' : '#8C94AF' }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function HomeNetWorthPage({
  pageHeight,
  palette,
  currencySymbol,
  accounts,
  loanSummary,
  netWorth,
  pageIndex,
  verticalScrolls,
  indicatorY,
  resetTick,
  onOpenAccount,
}: {
  pageHeight: number;
  palette: AppThemePalette;
  currencySymbol: string;
  accounts: Account[];
  loanSummary: { youLent: number; youOwe: number; net: number };
  netWorth: number;
  pageIndex: number;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  resetTick: { count: number; animated: boolean; mode: TabResetMode };
  onOpenAccount: (accountId: string | 'all') => void;
}) {
  const [accountViewMode, setAccountViewMode] = useState<'balance' | 'type'>('balance');
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const positiveAccountTotal = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const negativeAccountTotal = accounts.reduce((sum, account) => sum + Math.abs(Math.min(account.balance, 0)), 0);
  const assetTotal = positiveAccountTotal + loanSummary.youLent;
  const liabilityTotal = negativeAccountTotal + loanSummary.youOwe;
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
  const largestAccountBalance = Math.max(...accounts.map((account) => Math.abs(account.balance)), 1);
  const largestTypeBalance = Math.max(...groupedAccounts.map((group) => Math.abs(group.balance)), 1);
  const assetPercent = Math.round(assetShare * 100);
  const liabilityPercent = Math.round(liabilityShare * 100);
  const positionRows = [
    {
      key: 'assets',
      label: 'Liquid assets',
      note: `${accounts.filter((account) => account.balance > 0).length} funded accounts`,
      value: positiveAccountTotal,
      color: palette.positive,
      icon: 'wallet',
    },
    {
      key: 'receivable',
      label: 'Receivables',
      note: 'Money you should receive',
      value: loanSummary.youLent,
      color: palette.brand,
      icon: 'arrow-down-left',
    },
    {
      key: 'liability',
      label: 'Liabilities',
      note: 'Borrowed and negative balances',
      value: liabilityTotal,
      color: palette.negative,
      icon: 'arrow-up-right',
    },
  ] as const;

  useEffect(() => {
    if (resetTick.count <= 0) return;
    scrollRef.current?.scrollTo({ y: 0, animated: resetTick.animated });
    const nextScrolls = verticalScrolls.value.slice();
    nextScrolls[pageIndex] = 0;
    verticalScrolls.value = nextScrolls;
  }, [pageIndex, resetTick, scrollRef, verticalScrolls]);

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = event.contentOffset.y;
    verticalScrolls.value = arr;
  });

  const renderAccountRow = (account: Account, isFirstInSection: boolean) => {
    const isNegative = account.balance < 0;
    return (
      <Pressable
        key={account.id}
        onPress={() => onOpenAccount(account.id)}
        style={({ pressed }) => ({
          minHeight: 72,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: isFirstInSection ? 0 : 1,
          borderTopColor: palette.divider,
          backgroundColor: pressed ? palette.inputBg : 'transparent',
        })}
      >
        {({ pressed }) => (
          <View style={{ transform: [{ scale: pressed ? 0.995 : 1 }] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.inputBg }}>
                <AppIcon name={account.type === 'credit' ? 'credit-card' : 'wallet'} size={16} color={isNegative ? palette.negative : palette.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.text }}>
                  {formatAccountDisplayName(account.name, account.accountNumber)}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 3 }}>
                  {getAccountTypeLabel(account.type)}
                </Text>
              </View>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                {isNegative ? '-' : ''}{formatCurrency(Math.abs(account.balance), currencySymbol)}
              </Text>
            </View>
            <View style={{ height: 3, borderRadius: 999, backgroundColor: palette.inputBg, overflow: 'hidden', marginTop: 10, marginLeft: 44 }}>
              <View style={{ width: `${Math.max(8, (Math.abs(account.balance) / largestAccountBalance) * 100)}%`, height: '100%', backgroundColor: isNegative ? palette.negative : palette.brand }} />
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  const renderTypeCard = (group: (typeof groupedAccounts)[number], isFirstInSection: boolean) => {
    const isNegative = group.balance < 0;
    return (
      <View key={group.type} style={{ minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: isFirstInSection ? 0 : 1, borderTopColor: palette.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.inputBg }}>
            <AppIcon name={group.type === 'credit' ? 'credit-card' : 'wallet'} size={16} color={isNegative ? palette.negative : palette.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.text }}>
              {getAccountTypeLabel(group.type)}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 3 }}>
              {group.accounts.length} {group.accounts.length === 1 ? 'account' : 'accounts'}
            </Text>
          </View>
          <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
            {isNegative ? '-' : ''}{formatCurrency(Math.abs(group.balance), currencySymbol)}
          </Text>
        </View>
        <View style={{ height: 3, borderRadius: 999, backgroundColor: palette.inputBg, overflow: 'hidden', marginTop: 10, marginLeft: 44 }}>
          <View style={{ width: `${Math.max(8, (Math.abs(group.balance) / largestTypeBalance) * 100)}%`, height: '100%', backgroundColor: isNegative ? palette.negative : palette.brand }} />
        </View>
      </View>
    );
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={{ flex: 1, height: pageHeight }}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: HOME_SURFACE.heroTop,
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
      }}
      onScroll={verticalScrollHandler}
      scrollEventThrottle={1}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, padding: CARD_PADDING, minHeight: 184, overflow: 'hidden', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: HOME_SPACE.lg }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
              Net Worth
            </Text>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.heroValue + 2, lineHeight: 38, fontWeight: '800', color: netWorth < 0 ? palette.negative : palette.text, marginTop: HOME_SPACE.xs + 2 }}>
              {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth), currencySymbol)}
            </Text>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFD' }}>
            <AppIcon name="landmark" size={22} color={palette.brand} />
          </View>
        </View>

        <View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: palette.inputBg, overflow: 'hidden', position: 'relative' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${assetShare * 100}%`, backgroundColor: palette.positive, borderTopRightRadius: liabilityTotal > 0 ? 0 : 999, borderBottomRightRadius: liabilityTotal > 0 ? 0 : 999 }} />
            <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${liabilityShare * 100}%`, backgroundColor: palette.negative, borderTopLeftRadius: assetTotal > 0 ? 0 : 999, borderBottomLeftRadius: assetTotal > 0 ? 0 : 999 }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Assets</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: palette.positive, marginTop: 5 }}>
                {formatCurrency(assetTotal, currencySymbol)} · {assetPercent}%
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Liabilities</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: palette.negative, marginTop: 5, textAlign: 'right' }}>
                {formatCurrency(liabilityTotal, currencySymbol)} · {liabilityPercent}%
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        onLayout={(event) => {
          const newY = event.nativeEvent.layout.y;
          if (newY > 0 && indicatorY.value !== newY) {
            indicatorY.value = newY;
          }
        }}
        style={{ height: 22 }}
      />

      <View style={{ gap: 10 }}>
        {positionRows.map((row) => (
          <View key={row.key} style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.inputBg }}>
              <AppIcon name={row.icon} size={17} color={row.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.text }}>
                {row.label}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 3 }}>
                {row.note}
              </Text>
            </View>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: row.color, textAlign: 'right' }}>
              {formatCurrency(row.value, currencySymbol)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 16, marginBottom: HOME_SPACE.pageBottom, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text appWeight="medium" style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text }}>Balance by</Text>
          <NetWorthBalanceByToggle
            mode={accountViewMode}
            palette={palette}
            onChange={setAccountViewMode}
          />
        </View>
        {accountViewMode === 'balance'
          ? sortedAccounts.map((account, index) => renderAccountRow(account, index === 0))
          : groupedAccounts.map((group, index) => renderTypeCard(group, index === 0))}
      </View>
    </Animated.ScrollView>
  );
}

function AccountSummaryCard({
  accountName,
  accountTypeLabel,
  balance,
  todayCashflow,
  currencySymbol,
  palette,
  onPress,
  onPressCategory,
  onLayout,
}: {
  accountName: string;
  accountTypeLabel: string;
  balance: number;
  todayCashflow: CashflowSummary;
  currencySymbol: string;
  palette: AppThemePalette;
  onPress?: () => void;
  onPressCategory?: (category: 'in' | 'out' | 'net') => void;
  onLayout?: (height: number) => void;
}) {
  const isNetPositive = todayCashflow.net >= 0;
  const netColor = isNetPositive ? palette.brand : palette.negative;
  const balanceColor = palette.text;

  const content = (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.divider,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        overflow: 'hidden',
        padding: CARD_PADDING,
        position: 'relative',
      }}
      onLayout={onLayout ? (event) => onLayout(event.nativeEvent.layout.height) : undefined}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: 999,
          top: -48,
          right: -38,
          backgroundColor: '#F8FAFD',
          opacity: 1,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: HOME_SPACE.lg }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
              Account
            </Text>
            {accountTypeLabel ? (
              <>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSoft }}>
                  {'\u2022'}
                </Text>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                  {accountTypeLabel}
                </Text>
              </>
            ) : null}
          </View>
          <Text appWeight="medium" numberOfLines={2} style={{ minHeight: 40, fontSize: HOME_TEXT.sectionTitle, lineHeight: 20, fontWeight: '700', color: palette.text, marginTop: HOME_SPACE.xs }}>
            {accountName}
          </Text>
        </View>

        <View style={{ flexShrink: 1, maxWidth: '56%', alignItems: 'flex-end' }}>
          <Text
            appWeight="medium"
            style={{
              fontSize: HOME_TEXT.tiny,
              color: palette.textMuted,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              textAlign: 'right',
            }}
          >
            Current balance
          </Text>
          <Text
            appWeight="medium"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontSize: HOME_TEXT.heroValue + 2,
              lineHeight: 34,
              fontWeight: '800',
              color: balanceColor,
              marginTop: HOME_SPACE.xs + 2,
              textAlign: 'right',
            }}
          >
            {balance < 0 ? '-' : ''}{formatCurrency(Math.abs(balance), currencySymbol)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: HOME_SPACE.xxl }}>
        <Text
          appWeight="medium"
          style={{
            fontSize: HOME_TEXT.tiny,
            color: palette.textMuted,
            fontWeight: '700',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          Today
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'stretch', marginTop: HOME_SPACE.sm }}>
          {([
            { key: 'in', label: 'Income', value: todayCashflow.in, color: palette.positive },
            { key: 'out', label: 'Expense', value: todayCashflow.out, color: palette.negative },
            { key: 'net', label: 'Net', value: todayCashflow.net, color: netColor },
          ] as const).map((item, index) => {
            const metric = (
              <View style={{ alignItems: index === 0 ? 'flex-start' : index === 2 ? 'flex-end' : 'center' }}>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.cardContent, color: palette.textMuted }}>
                  {item.label}
                </Text>
                <Text
                  appWeight="medium"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontSize: HOME_TEXT.cardContent, fontWeight: '500', color: item.color, marginTop: HOME_SPACE.xs }}
                >
                  {formatTodayMetricValue(item.key, item.value, currencySymbol)}
                </Text>
              </View>
            );

            return (
              <React.Fragment key={item.key}>
                {index > 0 ? (
                  <View style={{ width: 1, backgroundColor: palette.divider, marginHorizontal: HOME_SPACE.md }} />
                ) : null}
                {onPressCategory ? (
                  <TouchableOpacity
                    delayPressIn={0}
                    activeOpacity={0.72}
                    onPress={() => onPressCategory(item.key)}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {metric}
                  </TouchableOpacity>
                ) : (
                  <View style={{ flex: 1, minWidth: 0 }}>{metric}</View>
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity delayPressIn={0} activeOpacity={0.78} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

function formatSignedCurrency(value: number, currencySymbol: string) {
  return `${value < 0 ? '-' : ''}${formatCurrency(Math.abs(value), currencySymbol)}`;
}

function formatTodayMetricValue(key: 'in' | 'out' | 'net', value: number, currencySymbol: string) {
  if (key === 'net') return formatCurrency(Math.abs(value), currencySymbol);
  return formatSignedCurrency(value, currencySymbol);
}

function HomeAccountsList({
  pageHeight,
  accounts,
  rawAccounts,
  currencySymbol,
  palette,
  onOpenAccount,
  onRefresh,
}: {
  pageHeight: number;
  accounts: AccountCardItem[];
  rawAccounts: Account[];
  currencySymbol: string;
  palette: AppThemePalette;
  onOpenAccount: (accountId: string | 'all') => void;
  onRefresh: () => Promise<void>;
}) {
  const [todaySummaries, setTodaySummaries] = useState<Record<string, CashflowSummary>>({});
  const [refreshing, setRefreshing] = useState(false);
  const isScreenFocused = useIsFocused();

  const todayFrom = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  }, []);
  const todayTo = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  }, []);

  const loadListSummaries = useCallback(async () => {
    const entries = await Promise.all(
      accounts.map(async (account) => [
        account.id,
        await getCashflowSummary(account.id === 'all' ? 'all' : account.id, todayFrom, todayTo),
      ] as const),
    );
    setTodaySummaries(Object.fromEntries(entries));
  }, [accounts, todayFrom, todayTo]);

  useEffect(() => {
    if (!isScreenFocused) return;
    loadListSummaries().catch(() => undefined);
  }, [isScreenFocused, loadListSummaries]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadListSummaries();
    setRefreshing(false);
  }, [loadListSummaries, onRefresh]);

  return (
    <ScrollView
      style={{ flex: 1, height: pageHeight }}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: HOME_SURFACE.heroTop,
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
        gap: HOME_SPACE.md,
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {accounts.map((account) => (
        <CompactAccountListCard
          key={account.id}
          accountName={account.name}
          balance={
            account.id === 'all'
              ? getTotalBalance(rawAccounts)
              : (rawAccounts.find((item) => item.id === account.id)?.balance ?? 0)
          }
          todayCashflow={todaySummaries[account.id] ?? { in: 0, out: 0, net: 0 }}
          currencySymbol={currencySymbol}
          palette={palette}
          onPress={() => onOpenAccount(account.id === 'all' ? 'all' : account.id)}
        />
      ))}
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.82}
        onPress={() => router.push('/settings/account-form')}
        style={{
          minHeight: 86,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: palette.borderSoft,
          backgroundColor: palette.surface,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <AppIcon name="plus-circle" size={22} color={palette.text} />
        <Text appWeight="medium" style={{ fontSize: HOME_TEXT.cardContent, color: palette.text }}>
          Add Account
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CompactAccountListCard({
  accountName,
  balance,
  todayCashflow,
  currencySymbol,
  palette,
  onPress,
}: {
  accountName: string;
  balance: number;
  todayCashflow: CashflowSummary;
  currencySymbol: string;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const netColor = todayCashflow.net >= 0 ? palette.brand : palette.negative;

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.divider,
        borderWidth: 1,
        borderRadius: HOME_RADIUS.card,
        paddingHorizontal: CARD_PADDING,
        paddingVertical: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            appWeight="medium"
            numberOfLines={1}
            style={{ fontSize: HOME_TEXT.sectionTitle, lineHeight: 20, fontWeight: '600', color: palette.text }}
          >
            {accountName}
          </Text>
          <Text style={{ marginTop: 4, fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
            Current balance
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', maxWidth: '48%' }}>
          <Text
            appWeight="medium"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontSize: HOME_TEXT.rowLabel,
              lineHeight: 22,
              fontWeight: '600',
              color: palette.text,
              textAlign: 'right',
            }}
          >
            {formatSignedCurrency(balance, currencySymbol)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.divider, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: HOME_TEXT.cardContent, color: palette.textMuted, fontWeight: '500' }}>
          Today's Net
        </Text>
        <Text
          appWeight="medium"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: HOME_TEXT.cardContent, fontWeight: '600', color: netColor, textAlign: 'right' }}
        >
          {formatTodayMetricValue('net', todayCashflow.net, currencySymbol)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function PageDashIndicator({
  pageCount,
  palette,
  pageWidth,
  scrollX,
  settledPageIndex,
  verticalScrolls,
  indicatorY,
  gestureOpacity,
  hidden,
}: {
  pageCount: number;
  palette: AppThemePalette;
  pageWidth: number;
  scrollX: SharedValue<number>;
  settledPageIndex: SharedValue<number>;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  gestureOpacity: SharedValue<number>;
  hidden?: boolean;
}) {
  const safePageCount = Math.max(pageCount, 1);
  const dotCount = safePageCount;
  const inactiveWidth = 7;
  const activeWidth = 16;
  const dashHeight = 3;
  const gap = 8;
  const step = inactiveWidth + gap;
  const sidePad = (activeWidth - inactiveWidth) / 2;
  const trackWidth = inactiveWidth * dotCount + gap * (dotCount - 1) + sidePad * 2;

  const containerStyle = useAnimatedStyle(() => {
    const rawProgress = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const progress = Math.min(Math.max(rawProgress, 0), safePageCount - 1);
    const settledIndex = Math.min(Math.max(Math.round(settledPageIndex.value), 0), safePageCount - 1);
    const swipeEpsilon = 0.02;
    let anchorIndex = settledIndex;

    // During horizontal swipe, anchor Y to the destination page early so the
    // indicator does not appear to slide in vertically from the previous page.
    if (progress > settledIndex + swipeEpsilon) {
      anchorIndex = Math.min(Math.ceil(progress), safePageCount - 1);
    } else if (progress < settledIndex - swipeEpsilon) {
      anchorIndex = Math.max(Math.floor(progress), 0);
    }

    const currentScroll = verticalScrolls.value[anchorIndex] ?? 0;
    const y = indicatorY.value;
    const addIndex = safePageCount - 1;
    const addSwipeThreshold = Math.max(addIndex - 1 + 0.04, 0);
    const movingTowardAdd = settledIndex < addIndex && progress > addSwipeThreshold;
    const settledOnAdd = settledIndex === addIndex;
    const addPageOpacity = movingTowardAdd || settledOnAdd ? 0 : 1;
    const targetReady = (y > 0 && pageCount > 1) ? 1 : 0;
    const hideFlag = hidden ? 0 : 1;
    const swipeVisibility = HIDE_SCROLLED_INDICATOR_DURING_SWIPE ? gestureOpacity.value : 1;

    return {
      transform: [
        { translateY: y - currentScroll }
      ],
      opacity: hideFlag * targetReady * addPageOpacity * swipeVisibility
    };
  }, [pageWidth, pageCount, hidden]);

  const activeStyle = useAnimatedStyle(() => {
    const rawIndex = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const clampedIndex = Math.min(Math.max(rawIndex, 0), dotCount - 1);
    return {
      transform: [{ translateX: clampedIndex * step }],
    };
  }, [gap, pageWidth, dotCount, step]);

  if (pageCount <= 1) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          height: 26,
          justifyContent: 'center'
        },
        containerStyle
      ]}
    >
      <View style={{ width: trackWidth, height: 8, justifyContent: 'center', paddingHorizontal: sidePad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
          {Array.from({ length: dotCount }).map((_, index) => (
            <View
              key={index}
              style={{
                width: inactiveWidth,
                height: dashHeight,
                borderRadius: HOME_RADIUS.full,
                backgroundColor: palette.textSecondary,
                opacity: palette.isDark ? 0.42 : 0.6,
              }}
            />
          ))}
        </View>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              width: activeWidth,
              height: dashHeight,
              borderRadius: HOME_RADIUS.full,
              backgroundColor: palette.listText,
              opacity: palette.isDark ? 0.68 : 0.82,
            },
            activeStyle,
          ]}
        />
      </View>
    </Animated.View>
  );
}

function AddAccountPage({
  pageHeight,
  palette,
}: {
  pageHeight: number;
  palette: AppThemePalette;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: pageHeight,
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: HOME_SURFACE.heroTop,
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
        justifyContent: 'center',
      }}
    >
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.84}
        onPress={() => router.push('/settings/account-form')}
        style={{
          minHeight: 180,
          borderRadius: HOME_RADIUS.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: palette.borderSoft,
          backgroundColor: palette.surface,
          alignItems: 'center',
          justifyContent: 'center',
          padding: CARD_PADDING,
        }}
      >
        <AppIcon name="plus-circle" size={22} color={palette.text} />
        <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, marginTop: 12 }}>
          Add Account
        </Text>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginTop: 6, textAlign: 'center' }}>
          Create a new account to track balances separately.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const HomeAccountPage = React.memo(function HomeAccountPage({
  pageHeight,
  accountId,
  accountName,
  accountTypeLabel,
  settingsYearStart,
  currencySymbol,
  customRange,
  onOpenCustomRange,
  totalBalance,
  onRefresh,
  isSelected,
  pageIndex,
  verticalScrolls,
  indicatorY,
  resetTick,
  backgroundResetTick,
  onOpenChartExpanded,
  isPageReady,
  accountsById,
  categoriesById,
  loansById,
  getCategoryFullDisplayName,
  loansLoaded,
  loadLoans,
}: {
  pageHeight: number;
  accountId: string | 'all';
  accountName: string;
  accountTypeLabel: string;
  settingsYearStart: number;
  currencySymbol: string;
  customRange?: { from: Date; to: Date };
  onOpenCustomRange: () => void;
  totalBalance: number;
  onRefresh: () => Promise<void>;
  isSelected: boolean;
  pageIndex: number;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  resetTick: { count: number; animated: boolean; mode: TabResetMode };
  backgroundResetTick: number;
  onOpenChartExpanded?: (transactions: Transaction[], mode: HomeChartMode, range: { period: PeriodType; from: string; to: string }, resetTrigger: number) => void;
  isPageReady: boolean;
  accountsById: Map<string, string>;
  categoriesById: Map<string, Category>;
  loansById: Map<string, LoanWithSummary>;
  getCategoryFullDisplayName: (categoryId: string, separator?: string) => string;
  loansLoaded: boolean;
  loadLoans: (filters?: { accountId?: string; status?: LoanStatus }) => Promise<void>;
}) {
  const { palette } = useAppTheme();
  const [period, setPeriod] = useState<PeriodType>('week');
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [todayCashflow, setTodayCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const isScreenFocused = useIsFocused();
  const loadRequestIdRef = useRef(0);

  const mainScrollRef = useAnimatedRef<Animated.ScrollView>();
  const recentScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setCashflow({ in: 0, out: 0, net: 0 });
    setTodayCashflow({ in: 0, out: 0, net: 0 });
    setPeriodTransactions([]);
    setTransactions([]);
  }, [accountId]);

  useEffect(() => {
    const shouldScroll = resetTick.mode === 'background' || isSelected;
    if (shouldScroll && resetTick.count > 0 && mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ y: 0, animated: resetTick.animated });
      recentScrollRef.current?.scrollTo({ y: 0, animated: resetTick.animated });
    }
    if (resetTick.mode === 'full' && resetTick.count > 0) {
      setPeriod('week');
    }
  }, [isSelected, resetTick]);

  useEffect(() => {
    if (backgroundResetTick <= 0) return;
    setPeriod('week');
    const nextScrolls = verticalScrolls.value.slice();
    nextScrolls[pageIndex] = 0;
    verticalScrolls.value = nextScrolls;
    mainScrollRef.current?.scrollTo({ y: 0, animated: false });
    recentScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [backgroundResetTick, mainScrollRef, pageIndex, verticalScrolls]);

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    const y = event.contentOffset.y;
    // Keep the latest vertical offset per page so the overlay indicator follows settled page scroll.
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = y;
    verticalScrolls.value = arr;
  });

  const chartTheme = useMemo(() => ({
    brand: palette.brand,
    card: palette.card,
    surface: '#EEF2F8',
    inputBg: '#FFFFFF',
    progressTrack: '#DDE4F0',
    border: '#DFE5EF',
    text: palette.text,
    muted: '#7C8498',
    textMuted: palette.textMuted,
    accent: palette.brand,
    positive: palette.positive,
    negative: palette.negative,
  }), [palette]);

  const { from, to } = getDateRange(
    period,
    settingsYearStart,
    customRange ? customRange.from.toISOString() : undefined,
    customRange ? customRange.to.toISOString() : undefined,
  );

  // Use localized Today boundaries
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
  }, []);
  const todayKey = useMemo(() => toLocalDateKey(today), [today]);

  const todayEnd = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  }, []);

  const loadPageData = useCallback(async () => {
    if (!isPageReady) return;
    const requestId = ++loadRequestIdRef.current;
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSnapshot, recentTransactions, periodScopedTransactions, todaySnapshot] = await Promise.all([
      getCashflowSnapshot(accountId, from, to),
      getTransactions({ accountId: accountFilter, limit: 10 }),
      getTransactions({ accountId: accountFilter, fromDate: from, toDate: to }),
      today >= from && todayEnd <= to
        ? Promise.resolve(null)
        : getCashflowSummary(accountId, today, todayEnd),
    ]);

    if (requestId !== loadRequestIdRef.current) return;

    const periodSummary = periodSnapshot.summary;
    const todayEntry = periodSnapshot.daily.find((entry) => entry.date === todayKey);
    const todaySummary =
      todaySnapshot ??
      (todayEntry
        ? { in: todayEntry.in, out: todayEntry.out, net: todayEntry.in - todayEntry.out }
        : { in: 0, out: 0, net: 0 });

    setCashflow(periodSummary);
    setTransactions(recentTransactions);
    setPeriodTransactions(periodScopedTransactions);
    setTodayCashflow(todaySummary);
  }, [accountId, from, isPageReady, to, today, todayEnd, todayKey]);

  useEffect(() => {
    if (!isPageReady || !isScreenFocused) return;
    loadPageData();
  }, [isPageReady, isScreenFocused, loadPageData]);

  useEffect(() => {
    if (!isPageReady || !isScreenFocused || !isSelected || loansLoaded) return;
    loadLoans().catch(() => undefined);
  }, [isPageReady, isScreenFocused, isSelected, loadLoans, loansLoaded]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadPageData();
    setRefreshing(false);
  }, [loadPageData, onRefresh]);

  const openTodayActivity = useCallback(
    (kind: 'in' | 'out' | 'net') => {
      router.push({
        pathname: '/(tabs)/activity',
        params: {
          source: 'home-today',
          period: 'day',
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: kind,
          ts: String(Date.now())
        }
      });
    },
    [accountId],
  );
  const openPeriodActivity = useCallback(
    (kind: 'in' | 'out' | 'net') => {
      router.push({
        pathname: '/(tabs)/activity',
        params: {
          source: 'home-period',
          period,
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: kind,
          from,
          to,
          ts: String(Date.now())
        }
      });
    },
    [accountId, from, period, to],
  );

  const handleTransactionPress = useCallback((tx: Transaction) => {
    router.push({
      pathname: '/modals/add-transaction',
      params: { editId: tx.id }
    });
  }, []);

  return (
    <View style={{ flex: 1, height: pageHeight }}>
      <Animated.ScrollView
        ref={mainScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: HOME_LAYOUT.fabContentBottomPadding }}
        onScroll={verticalScrollHandler}
        scrollEventThrottle={1}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: HOME_SURFACE.heroTop, paddingBottom: HOME_SURFACE.heroBottom }}>
          <AccountSummaryCard
            accountName={accountId === 'all' ? 'All Accounts' : accountName}
            accountTypeLabel={accountTypeLabel}
            balance={totalBalance}
            todayCashflow={todayCashflow}
            currencySymbol={currencySymbol}
            palette={palette}
            onPressCategory={openTodayActivity}
          />
          <View
            onLayout={(event) => {
              const newY = event.nativeEvent.layout.y;
              if (newY > 0 && indicatorY.value !== newY) {
                indicatorY.value = newY;
              }
            }}
            style={{ height: 22 }}
          />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 6 }}>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.text, marginRight: 12 }}>
              This
            </Text>
            <SegmentedPillSwitch
              options={PERIODS.map((value) => ({ key: value, label: PERIOD_LABELS[value] }))}
              value={period}
              onChange={(next) => {
                if (next === 'custom') {
                  setPeriod('custom');
                  onOpenCustomRange();
                  return;
                }
                setPeriod(next as PeriodType);
              }}
              backgroundColor={chartTheme.surface}
              pillColor="#FFFFFF"
              borderColor={chartTheme.border}
              activeTextColor={palette.text}
              inactiveTextColor={palette.textMuted}
              style={{ flex: 1 }}
              height={HOME_LAYOUT.periodHeight}
              radius={HOME_RADIUS.tab + 3}
              fontSize={HOME_TEXT.caption}
            />
          </View>

          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: 14 }}>
            {formatDate(from)} - {formatDate(to)}
          </Text>

          <SummaryCard
            cashflow={cashflow}
            sym={currencySymbol}
            palette={palette}
            onPressCategory={openPeriodActivity}
          />

          <View
            style={{
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.divider,
              borderRadius: HOME_RADIUS.card,
              paddingTop: 12,
              paddingBottom: 12,
              marginBottom: HOME_SURFACE.chartCardBottom
            }}
          >
            <HomeDonutChartBlock
              transactions={periodTransactions}
              categoriesById={categoriesById}
              sym={currencySymbol}
              listPalette={palette}
              getCategoryFullDisplayName={getCategoryFullDisplayName}
              theme={chartTheme}
              resetTrigger={`${resetTick.count}:${backgroundResetTick}`}
              accountsById={accountsById}
              loansById={loansById}
              onExpand={(mode) => onOpenChartExpanded?.(periodTransactions, mode, { period, from, to }, resetTick.count)}
            />
          </View>

          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.card,
              borderWidth: 1,
              borderColor: palette.border,
              paddingTop: HOME_SURFACE.cardPaddingY,
              paddingBottom: 4,
              marginBottom: HOME_SPACE.pageBottom,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: HOME_SPACE.sm,
                paddingHorizontal: CARD_PADDING
              }}
            >
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>Recent</Text>
              <TouchableOpacity delayPressIn={0}
                onPress={() =>
                  router.navigate({
                    pathname: '/(tabs)/activity',
                    params: {
                      source: 'home-view-all',
                      accountId: accountId === 'all' ? 'all' : accountId,
                      ts: String(Date.now())
                    }
                  })
                }
              >
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: palette.brand, fontWeight: BUTTON_TOKENS.text.labelWeight }}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={recentScrollRef}
              style={{ maxHeight: HOME_SURFACE.listMaxHeight }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: HOME_SURFACE.cardPaddingBottom }}
            >
              {transactions.length === 0 ? (
                <Text style={{ color: palette.textSoft, fontSize: HOME_TEXT.bodySmall, textAlign: 'center', paddingVertical: 16 }}>
                  No transactions yet
                </Text>
              ) : (
                transactions.map((transaction, index) => {
                  const accountName = accountsById.get(transaction.accountId);
                  const linkedAccountName = transaction.linkedAccountId ? accountsById.get(transaction.linkedAccountId) : undefined;
                  const loan = transaction.loanId ? loansById.get(transaction.loanId) : undefined;
                  const category = transaction.categoryId ? categoriesById.get(transaction.categoryId) : undefined;

                  return (
                    <TransactionListItem
                      key={transaction.id}
                      tx={transaction}
                      sym={currencySymbol}
                      palette={palette}
                      isLast={index === transactions.length - 1}
                      categoryName={transaction.categoryId ? getCategoryFullDisplayName(transaction.categoryId, ' › ') : undefined}
                      categoryIcon={category?.icon}
                      accountName={accountName}
                      linkedAccountName={linkedAccountName}
                      loanPersonName={loan?.personName}
                      loanDirection={loan?.direction}
                      showAmountSign={false}
                      onPress={handleTransactionPress}
                    />
                  );
                })
              )}
            </ScrollView>
          </View>

          <View style={{ alignItems: 'center', marginTop: 2 }}>
            <TouchableOpacity delayPressIn={0} onPress={() => router.push('/loan-prototype')}>
              <Text
                appWeight="medium"
                style={{
                  fontSize: HOME_TEXT.bodySmall,
                  color: palette.brand,
                  fontWeight: BUTTON_TOKENS.text.labelWeight,
                }}
              >
                Open Loan Prototype
              </Text>
            </TouchableOpacity>
            <TouchableOpacity delayPressIn={0} onPress={() => router.push('/chart-prototype')} style={{ marginTop: 10 }}>
              <Text
                appWeight="medium"
                style={{
                  fontSize: HOME_TEXT.bodySmall,
                  color: palette.brand,
                  fontWeight: BUTTON_TOKENS.text.labelWeight,
                }}
              >
                Open Chart Prototype
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ width: '100%', alignItems: 'center', marginBottom: -70 }}>
            <Text
              style={{
                fontSize: 180,
                fontWeight: '900',
                color: palette.text,
                opacity: 0.05,
                textAlign: 'center',
                lineHeight: 180,
              }}
            >
              reni
            </Text>
          </View>

        </View>
      </Animated.ScrollView>

    </View>
  );
});
