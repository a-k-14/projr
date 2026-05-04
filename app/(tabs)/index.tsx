import { Text } from '@/components/ui/AppText';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useEvent,
  useHandler,
  useSharedValue,
  type SharedValue,
  FadeInRight,
  FadeOutRight,
  LinearTransition
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeDonutChartBlock, type HomeChartMode } from '../../components/HomeDonutChartBlock';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppDonutChart } from '../../components/ui/AppDonutChart';
import { AppIcon } from '../../components/ui/AppIcon';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FabButton } from '../../components/ui/FabButton';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { SegmentedPillSwitch } from '../../components/ui/SegmentedPillSwitch';
import { formatAccountDisplayName } from '../../lib/account-utils';
import {
  formatDate,
  getDateRange,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../../lib/derived';
import { CARD_PADDING, SCREEN_GUTTER, SPACING, TYPE } from '../../lib/design';
import {
  BUTTON_TOKENS,
  getFabBottomOffset,
  HOME_LAYOUT,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_SURFACE,
  HOME_TEXT,
  SCREEN_HEADER
} from '../../lib/layoutTokens';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import { registerTabReset } from '../../lib/tabResetRegistry';
import { AppThemePalette, useAppTheme } from '../../lib/theme';
import { getCashflowSnapshot, getCashflowSummary } from '../../services/analytics';
import { getTransactions } from '../../services/transactions';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import type {
  Account,
  AccountType,
  CashflowSummary,
  Category,
  LoanStatus,
  LoanWithSummary,
  PeriodType,
  Transaction
} from '../../types';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export function usePageScrollHandler(handlers: any, dependencies?: any[]) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  const subscribeForEvents = ['onPageScroll'];

  return useEvent(
    (event: any) => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    subscribeForEvents,
    doDependenciesDiffer
  );
}

type HomePageUiState = {
  period: HomePeriodType;
  chartMode: HomeChartMode;
  selectedChartCategoryId: string | null;
};

const defaultHomePageUiState: HomePageUiState = {
  period: 'today',
  chartMode: 'expense',
  selectedChartCategoryId: null,
};

type HomePeriodType = 'today' | PeriodType;

const PERIODS: HomePeriodType[] = ['today', 'week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<HomePeriodType, string> = {
  today: 'Today',
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
const NW_TYPE_COLORS: Record<AccountType, string> = {
  savings: '#00A7A5',
  cash: '#F2B84B',
  wallet: '#4E8EF7',
  investment: '#8B5CF6',
  credit: '#EF476F',
  other: '#6B7A90',
};
const NW_ACCOUNT_COLORS = [
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
const NW_ASSET_LIGHT = '#0D9488';
const NW_ASSET_DARK = '#00FAD9';
const NW_HERO_PROGRESS_LABEL_GAP = 8;

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
  return <HomeScreenContent />;
}

function HomeScreenContent() {
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
  const pagerRef = useRef<PagerView>(null);
  const pageScrollTopRef = useRef(new Map<string, () => void>());
  const registerScrollTop = useCallback((id: string, fn: (() => void) | null) => {
    if (fn) pageScrollTopRef.current.set(id, fn);
    else pageScrollTopRef.current.delete(id);
  }, []);
  const accountPagerScrollX = useSharedValue(0);
  const settledAccountPageIndex = useSharedValue(0);
  const verticalScrolls = useSharedValue<number[]>(new Array(20).fill(0));
  const indicatorY = useSharedValue(0);
  const netWorthSheetVerticalScrolls = useSharedValue<number[]>([0]);
  const netWorthSheetIndicatorY = useSharedValue(0);
  const indicatorGestureOpacity = useSharedValue(1);
  const didPositionInitialPagerRef = useRef(false);
  const wasFocusedRef = useRef(false);
  const pendingPagerSyncAccountIdRef = useRef<string | 'all' | 'add' | 'net-worth' | null>(null);
  const selectedAccountIdRef = useRef<string | 'all' | 'add' | 'net-worth'>('all');
  const lastLeftPageIdRef = useRef<string | 'all' | 'add' | 'net-worth' | null>(null);

  const [pageUiStates, setPageUiStates] = useState<Record<string, HomePageUiState>>({});
  const { palette } = useAppTheme();
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(() => toLocalDayStartISO(new Date()));
  const [customRangeTo, setCustomRangeTo] = useState(() => toLocalDayEndISO(new Date()));
  const [customDraftFrom, setCustomDraftFrom] = useState(() => new Date());
  const [customDraftTo, setCustomDraftTo] = useState(() => new Date());
  const [pendingCustomAccountId, setPendingCustomAccountId] = useState<string | null>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [netWorthSheetVisible, setNetWorthSheetVisible] = useState(false);
  const [expandedChartState, setExpandedChartState] = useState<{
    transactions: Transaction[];
    mode: HomeChartMode;
    resetTrigger: number;
  } | null>(null);
  const previousAccountCountRef = useRef(accounts.length);

  const getPageUiState = useCallback(
    (id: string): HomePageUiState => pageUiStates[id] ?? defaultHomePageUiState,
    [pageUiStates],
  );
  const setPageUiField = useCallback(
    <K extends keyof HomePageUiState>(id: string, key: K, value: HomePageUiState[K]) => {
      setPageUiStates((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? defaultHomePageUiState), [key]: value },
      }));
    },
    [],
  );
  const resetPageUiState = useCallback((id: string | 'all' | 'add' | 'net-worth') => {
    if (id === 'add' || id === 'net-worth') return;
    setPageUiStates((prev) => {
      const current = prev[id] ?? defaultHomePageUiState;
      if (
        current.period === defaultHomePageUiState.period &&
        current.chartMode === defaultHomePageUiState.chartMode &&
        current.selectedChartCategoryId === defaultHomePageUiState.selectedChartCategoryId
      ) {
        return prev;
      }
      return {
        ...prev,
        [id]: defaultHomePageUiState,
      };
    });
  }, []);

  const displayAccounts = useMemo<AccountTab[]>(() => [
    ...(showAllAccountsTab ? [{ id: 'all' as const, name: 'All' }] : []),
    ...accounts.map((a) => ({ id: a.id, name: formatAccountDisplayName(a.name, a.accountNumber) })),
    { id: 'add', name: 'Add Account' },
  ], [accounts, showAllAccountsTab]);
  const accountCards = useMemo<AccountCardItem[]>(() => [
    ...(showAllAccountsTab ? [{ id: 'all' as const, name: 'All', accountTypeLabel: '' }] : []),
    ...accounts.map((a) => ({
      id: a.id,
      name: formatAccountDisplayName(a.name, a.accountNumber),
      accountTypeLabel: getAccountTypeLabel(a.type),
    })),
  ], [accounts, showAllAccountsTab]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all' | 'add' | 'net-worth'>(homeRootAccountId);
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
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return { transform: [{ translateX: 0 }] };
  }, []);

  const fabStyle = useAnimatedStyle(() => {
    if (width <= 0 || displayAccounts.length <= 1) return { opacity: 1 };

    const addIndex = displayAccounts.length - 1;
    const opacity = interpolate(
      accountPagerScrollX.value,
      [
        0,
        Math.max(addIndex - 1, 0) * width,
        addIndex * width - width * 0.12,
        addIndex * width,
      ],
      [1, 1, 0, 0],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale: 0.2 + 0.8 * opacity }],
    };
  }, [width, displayAccounts.length]);

  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
  }, [selectedAccountId]);

  // Track focus state for push/pop detection.
  // With freezeOnBlur disabled for Home, background resets render normally.
  useEffect(() => {
    if (isFocused && !wasFocusedRef.current) {
      wasFocusedRef.current = true;
    } else if (!isFocused) {
      wasFocusedRef.current = false;
    }
  }, [isFocused]);

  useEffect(() => {
    if (didPositionInitialPagerRef.current || width <= 0 || displayAccounts.length === 0) return;
    didPositionInitialPagerRef.current = true;
    const targetX = selectedPageIndex * width;
    settledAccountPageIndex.value = selectedPageIndex;
    accountPagerScrollX.value = targetX;
    pagerRef.current?.setPageWithoutAnimation(Math.round(targetX / Math.max(width, 1)));
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
        pagerRef.current?.setPageWithoutAnimation(Math.round(targetX / Math.max(width, 1)));
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
      pagerRef.current?.setPage(rootIndex);
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

    const selectedIndex = displayAccounts.findIndex((account) => account.id === selectedAccountId);
    if (selectedIndex >= 0) {
      const targetX = selectedIndex * width;
      settledAccountPageIndex.value = selectedIndex;
      if (Math.abs(accountPagerScrollX.value - targetX) > 1) {
        accountPagerScrollX.value = targetX;
        pagerRef.current?.setPageWithoutAnimation(Math.round(targetX / Math.max(width, 1)));
      }
      pendingPagerSyncAccountIdRef.current = null;
    }
  }, [accountPagerScrollX, displayAccounts, homeAccountViewMode, pagerRef, selectedAccountId, settledAccountPageIndex, width]);

  const resetCustomRangeToToday = useCallback(() => {
    const today = new Date();
    setCustomRangeFrom(toLocalDayStartISO(today));
    setCustomRangeTo(toLocalDayEndISO(today));
    setCustomDraftFrom(today);
    setCustomDraftTo(today);
  }, []);

  const resetHomeToAll = useCallback((animated: boolean) => {
    const rootIndex = Math.max(0, displayAccounts.findIndex((account) => account.id === homeRootAccountId));

    setPageUiStates({});
    resetCustomRangeToToday();
    selectedAccountIdRef.current = homeRootAccountId;
    setSelectedAccountId(homeRootAccountId);
    settledAccountPageIndex.value = rootIndex;
    accountPagerScrollX.value = rootIndex * width;

    if (animated) {
      pagerRef.current?.setPage(rootIndex);
    } else {
      pagerRef.current?.setPageWithoutAnimation(rootIndex);
    }

    pageScrollTopRef.current.get(homeRootAccountId)?.();
  }, [accountPagerScrollX, displayAccounts, homeRootAccountId, pagerRef, resetCustomRangeToToday, settledAccountPageIndex, width]);

  useEffect(() => {
    return registerTabReset('index', ({ animated }) => {
      resetHomeToAll(animated);
    });
  }, [resetHomeToAll]);

  const customRangeMemo = useMemo(
    () => ({ from: new Date(customRangeFrom), to: new Date(customRangeTo) }),
    [customRangeFrom, customRangeTo]
  );

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const index = e.nativeEvent.position;
      const safeIndex = Math.max(0, Math.min(index, displayAccounts.length - 1));
      const next = displayAccounts[safeIndex];
      if (!next) return;

      settledAccountPageIndex.value = safeIndex;

      if (next.id !== selectedAccountIdRef.current) {
        const prevId = selectedAccountIdRef.current;

        resetPageUiState(prevId);

        lastLeftPageIdRef.current = prevId;

        selectedAccountIdRef.current = next.id;
        setSelectedAccountId(next.id);
      }
    },
    [displayAccounts, resetPageUiState, settledAccountPageIndex],
  );

  const handlePageScrollStateChanged = useCallback(
    (e: { nativeEvent: { pageScrollState: string } }) => {
      const state = e.nativeEvent.pageScrollState;
      if (state === 'idle') {
        indicatorGestureOpacity.value = 1;

        // Scroll reset is safe at idle — page is fully off-screen, native command
        if (lastLeftPageIdRef.current) {
          pageScrollTopRef.current.get(lastLeftPageIdRef.current)?.();
          lastLeftPageIdRef.current = null;
        }

      } else if (state === 'dragging') {
        const currentScroll = verticalScrolls.value[settledAccountPageIndex.value] ?? 0;
        if (HIDE_SCROLLED_INDICATOR_DURING_SWIPE && Math.abs(currentScroll) > 1) {
          indicatorGestureOpacity.value = 0;
        }
      }
    },
    [indicatorGestureOpacity, settledAccountPageIndex, verticalScrolls],
  );

  const onPageScroll = usePageScrollHandler({
    onPageScroll(e: any) {
      'worklet';
      accountPagerScrollX.value = (e.position + e.offset) * width;
    },
  }, [width]);

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

  const openCustomRange = useCallback((accountId: string) => {
    setPendingCustomAccountId(accountId);
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
    if (pendingCustomAccountId) {
      setPageUiField(pendingCustomAccountId, 'period', 'custom');
      setPendingCustomAccountId(null);
    }
    setCustomRangeOpen(false);
  }, [customDraftFrom, customDraftTo, pendingCustomAccountId, setPageUiField]);

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
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      <Animated.View style={[
        {
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          paddingTop: 8,
          paddingBottom: SPACING.md,
          zIndex: 10,
          overflow: 'hidden',
          backgroundColor: palette.background,
        },
        headerAnimatedStyle
      ]}>
        <View style={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: TYPE.title, fontWeight: '400', color: palette.text, letterSpacing: -0.5 }}>
            Accounts
          </Text>
        </View>
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 8, right: 14 }}>
          <View style={{ width: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <HomeAccountViewToggle
              mode={homeAccountViewMode}
              palette={palette}
              onChange={setHomeViewMode}
            />
          </View>
        </View>
      </Animated.View>

      <View
        style={{ flex: 1, overflow: 'hidden', paddingTop: insets.top }}
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
            <AnimatedPagerView
              ref={pagerRef as any}
              style={{ flex: 1 }}
              initialPage={selectedPageIndex}
              overdrag={false}
              onPageSelected={handlePageSelected}
              onPageScrollStateChanged={handlePageScrollStateChanged}
              onPageScroll={onPageScroll}
            >
              {displayAccounts.map((account, index) => {
                return (
                  <View key={account.id} collapsable={false} style={{ flex: 1 }}>
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
                        isSelected={account.id === selectedAccountId}
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
                        period={getPageUiState(account.id).period}
                        onPeriodChange={(p) => setPageUiField(account.id, 'period', p)}
                        chartMode={getPageUiState(account.id).chartMode}
                        onChartModeChange={(m) => setPageUiField(account.id, 'chartMode', m)}
                        selectedChartCategoryId={getPageUiState(account.id).selectedChartCategoryId}
                        onChartCategorySelect={(id) => setPageUiField(account.id, 'selectedChartCategoryId', id)}
                        registerScrollTop={registerScrollTop}
                        onOpenChartExpanded={(transactions, mode, range, resetTrigger) => {
                          setExpandedChartState({ transactions, mode, resetTrigger });
                          setBottomSheetVisible(true);
                        }}
                        onOpenNetWorth={() => setNetWorthSheetVisible(true)}
                        netWorth={netWorth}
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
            </AnimatedPagerView>
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
              hiddenPageIndexes={[displayAccounts.length - 1]}
            />
          </View>
        </View>
      </View>

      <Animated.View
        pointerEvents={selectedAccountId === 'net-worth' || selectedAccountId === 'add' ? 'none' : 'auto'}
        style={[
          {
            position: 'absolute',
            right: HOME_LAYOUT.fabRightOffset,
            bottom: getFabBottomOffset(insets.bottom),
            width: HOME_LAYOUT.fabSize,
            height: HOME_LAYOUT.fabSize,
            zIndex: 10,
          },
          fabStyle,
        ]}
      >
        <FabButton
          bottom={0}
          palette={palette}
          backgroundColor={palette.isDark ? palette.surfaceRaised : palette.text}
          iconColor={palette.isDark ? palette.listText : palette.surface}
          style={{
            position: 'relative',
            right: 0,
            bottom: 0,
            elevation: 0,
            shadowOpacity: 0,
            ...(palette.isDark ? { borderWidth: 1, borderColor: palette.borderSoft } : undefined),
          }}
          onPress={() =>
            router.push({
              pathname: '/modals/add-transaction',
              params: selectedAccountId === 'all' || selectedAccountId === 'add' ? undefined : { accountId: selectedAccountId }
            })
          }
        />
      </Animated.View>

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

      {netWorthSheetVisible ? (
        <BottomSheet
          title="Net Worth"
          palette={palette}
          backgroundColor={palette.background}
          disableShadow
          onClose={() => setNetWorthSheetVisible(false)}
          maxHeightRatio={0.80}
          fixedHeightRatio={0.80}
          hasNavBar
          scrollEnabled={false}
        >
          <View style={{ flex: 1, backgroundColor: palette.background }}>
            <HomeNetWorthPage
              pageHeight={Math.max(1, pagerHeight * 0.8)}
              palette={palette}
              currencySymbol={showCurrencySymbol ? currencySymbol : ''}
              accounts={accounts}
              loanSummary={loanSummary}
              netWorth={netWorth}
              pageIndex={0}
              verticalScrolls={netWorthSheetVerticalScrolls}
              indicatorY={netWorthSheetIndicatorY}
              isSelected={false}
              compactTop
              hideTitle
              onOpenAccount={(accountId) => {
                setNetWorthSheetVisible(false);
                openAccountInSwipeMode(accountId);
              }}
            />
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

const NW_BALANCE_BY_OPTIONS = [
  { key: 'type', label: 'Type' },
  { key: 'account', label: 'Account' },
] as const;

function NetWorthBalanceByToggle({
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
      onChange={(key) => onChange(key as 'account' | 'type')}
      backgroundColor="#EEF2F8"
      pillColor="#FFFFFF"
      borderColor="#DFE5EF"
      activeTextColor="#1F2A44"
      inactiveTextColor="#7C8498"
      height={HOME_LAYOUT.periodHeight}
      radius={HOME_RADIUS.tab + 3}
      fontSize={HOME_TEXT.caption}
      itemMinWidth={62}
      style={{ alignSelf: 'flex-start', minWidth: 144 }}
    />
  );
}

function NetWorthRingMarker({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2.5,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
  );
}

function NetWorthDonut({
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
      color: NW_TYPE_COLORS[group.type],
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
  const selectedPercent = selectedItem ? Math.round((selectedItem.amount / total) * 100) : 100;
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
        <Text numberOfLines={2} style={{ maxWidth: 112, fontSize: 13, fontWeight: '700', textAlign: 'center', color: palette.text }}>
          {selectedItem ? selectedItem.label : mode === 'type' ? 'All Types' : 'All'}
        </Text>
        <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: 18, fontWeight: '800', color: palette.text, marginTop: 4, textAlign: 'center' }}>
          {selectedAmount === 0 ? '—' : `${selectedValue < 0 ? '-' : ''}${formatCurrency(Math.abs(selectedValue), currencySymbol)}`}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 2, color: palette.textMuted }}>
          {selectedPercent}% of Total
        </Text>
      </View>
    </View>
  );
}

function NetWorthTypeRows({
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
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                <NetWorthRingMarker color={NW_TYPE_COLORS[group.type]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                      {getAccountTypeLabel(group.type)}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted, marginTop: 3 }}>
                      {group.accounts.length} {group.accounts.length === 1 ? 'account' : 'accounts'} · {Math.round((Math.abs(group.balance) / total) * 100)}%
                    </Text>
                  </View>
                  <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: group.balance === 0 ? palette.textMuted : isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                    {group.balance === 0 ? '—' : `${isNegative ? '-' : ''}${formatCurrency(Math.abs(group.balance), currencySymbol)}`}
                  </Text>
                </View>
                <View style={{ height: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: palette.inputBg, marginTop: 10 }}>
                  <View style={{ height: 4, borderRadius: 999, width: `${(Math.abs(group.balance) / total) * 100}%`, backgroundColor: NW_TYPE_COLORS[group.type] }} />
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </>
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
  isSelected,
  compactTop = false,
  hideTitle = false,
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
  isSelected: boolean;
  compactTop?: boolean;
  hideTitle?: boolean;
  onOpenAccount: (accountId: string | 'all') => void;
}) {
  const [accountViewMode, setAccountViewMode] = useState<'account' | 'type'>('type');
  const [selectedType, setSelectedType] = useState<AccountType | null>(null);
  const [selectedChartAccountId, setSelectedChartAccountId] = useState<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const positiveAccountTotal = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const negativeAccountTotal = accounts.reduce((sum, account) => sum + Math.abs(Math.min(account.balance, 0)), 0);
  const assetTotal = positiveAccountTotal + loanSummary.youLent;
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
      color: nwLiabilityColor,
      icon: 'arrow-up-right',
    },
  ] as const;

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
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
          <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
            <NetWorthRingMarker color={accountColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text appWeight="medium" numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: palette.text }}>
                  {formatAccountDisplayName(account.name, account.accountNumber)}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted, marginTop: 3 }}>
                  {getAccountTypeLabel(account.type)}
                </Text>
              </View>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 132, fontSize: HOME_TEXT.bodySmall, fontWeight: '800', color: account.balance === 0 ? palette.textMuted : isNegative ? palette.negative : palette.text, textAlign: 'right' }}>
                {account.balance === 0 ? '—' : `${isNegative ? '-' : ''}${formatCurrency(Math.abs(account.balance), currencySymbol)}`}
              </Text>
            </View>
            <View style={{ height: 4, borderRadius: 999, backgroundColor: palette.inputBg, overflow: 'hidden', marginTop: 10 }}>
              {account.balance !== 0 ? <View style={{ width: `${(Math.abs(account.balance) / largestAccountBalance) * 100}%`, height: '100%', borderRadius: 999, backgroundColor: accountColor }} /> : null}
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
        paddingBottom: HOME_LAYOUT.fabContentBottomPadding,
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
      <View style={{ paddingTop: compactTop ? 12 : HOME_SURFACE.heroTop, borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.card, padding: CARD_PADDING, minHeight: 184, overflow: 'hidden', justifyContent: 'space-between' }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: NW_HERO_PROGRESS_LABEL_GAP }}>
            <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.10)' : '#E7ECF3', overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${dominantPosition.share * 100}%`, borderRadius: 999, backgroundColor: dominantPosition.color }} />
            </View>
            <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ minWidth: 60, fontSize: HOME_TEXT.caption, fontWeight: '800', color: dominantPosition.color, textAlign: 'right' }}>
              {dominantPosition.percent}% {dominantPosition.label}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Assets</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: nwAssetColor, marginTop: 5 }}>
                {formatCurrency(assetTotal, currencySymbol)}{assetPercent < 100 ? ` · ${assetPercent}%` : ''}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Liabilities</Text>
              <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.body, fontWeight: '800', color: liabilityTotal > 0 ? nwLiabilityColor : palette.textMuted, marginTop: 5, textAlign: 'right' }}>
                {liabilityTotal > 0 ? `${formatCurrency(liabilityTotal, currencySymbol)} · ${liabilityPercent}%` : 'None'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        onLayout={(event) => {
          const newY = event.nativeEvent.layout.y;
          if (isSelected && newY > 0 && indicatorY.value !== newY) {
            indicatorY.value = newY;
          }
        }}
        style={{ height: 32 }}
      />

      <View style={{ gap: 10 }}>
        {positionRows.map((row) => (
          <View key={row.key} style={{ borderRadius: HOME_RADIUS.card, borderWidth: 1, borderColor: palette.divider, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name={row.icon} size={16} color={row.color} />
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

function AccountSummaryCard({
  accountName,
  accountTypeLabel,
  balance,
  currencySymbol,
  palette,
  onPress,
  onLayout,
  onOpenNetWorth,
  netWorth,
}: {
  accountName: string;
  accountTypeLabel: string;
  balance: number;
  currencySymbol: string;
  palette: AppThemePalette;
  onPress?: () => void;
  onLayout?: (height: number) => void;
  onOpenNetWorth?: () => void;
  netWorth?: number;
}) {
  const balanceColor = palette.text;
  const isAll = accountName === 'All';

  const content = (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.divider,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        overflow: 'hidden',
        height: 112, // Reduced height
        position: 'relative',
      }}
      onLayout={onLayout ? (event) => onLayout(event.nativeEvent.layout.height) : undefined}
    >
      {!isAll && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 110,
            height: 110,
            borderRadius: 55,
            top: -25,
            right: -25,
            backgroundColor: palette.isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFD',
            zIndex: 0,
          }}
        />
      )}

      <View style={{ flex: 1, paddingHorizontal: CARD_PADDING, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: HOME_SPACE.lg }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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
            <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
              {accountName}
            </Text>
          </View>

          <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>
            <Text
              appWeight="medium"
              style={{
                fontSize: HOME_TEXT.tiny,
                color: palette.textMuted,
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                textAlign: 'right',
                marginBottom: 1,
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
                fontWeight: '800',
                color: balanceColor,
                textAlign: 'right',
              }}
            >
              {balance < 0 ? '-' : ''}{formatCurrency(Math.abs(balance), currencySymbol)}
            </Text>
          </View>
        </View>
      </View>

      {onOpenNetWorth ? (
        <TouchableOpacity
          delayPressIn={0}
          onPress={onOpenNetWorth}
          style={{
            borderTopWidth: 1,
            borderTopColor: palette.divider,
            paddingHorizontal: CARD_PADDING - 2,
            paddingVertical: 6, // Reduced padding
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: palette.background,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.textMuted }}>
            Net Worth
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
              {(netWorth ?? 0) < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth ?? 0), currencySymbol)}
            </Text>
            <AppIcon name="chevron-right" size={14} color={palette.textSoft} />
          </View>
        </TouchableOpacity>
      ) : null}
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
  if (value === 0) return '—';
  if (key === 'net') return formatCurrency(Math.abs(value), currencySymbol);
  return formatSignedCurrency(value, currencySymbol);
}

function getHomeDateRange(
  period: HomePeriodType,
  settingsYearStart: number,
  customRange?: { from: Date; to: Date },
) {
  if (period === 'today') {
    const now = new Date();
    return {
      from: toLocalDayStartISO(now),
      to: toLocalDayEndISO(now),
    };
  }

  return getDateRange(
    period,
    settingsYearStart,
    customRange ? customRange.from.toISOString() : undefined,
    customRange ? customRange.to.toISOString() : undefined,
  );
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
  const [period, setPeriod] = useState<HomePeriodType>('today');
  const [chartMode, setChartMode] = useState<HomeChartMode>('expense');
  const [selectedChartCategoryId, setSelectedChartCategoryId] = useState<string | null>(null);
  const [chartResetNonce, setChartResetNonce] = useState(0);
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
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: 54 + HOME_SURFACE.heroTop,
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
  hiddenPageIndexes = [],
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
  hiddenPageIndexes?: number[];
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
    let hiddenPageOpacity = 1;
    hiddenPageIndexes.forEach((index) => {
      if (Math.abs(progress - index) < 0.96) hiddenPageOpacity = 0;
    });

    return {
      transform: [
        { translateY: y - currentScroll }
      ],
      opacity: hideFlag * targetReady * addPageOpacity * hiddenPageOpacity * swipeVisibility
    };
  }, [pageWidth, pageCount, hidden, hiddenPageIndexes]);

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
          height: 32,
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
        paddingTop: 54 + HOME_SURFACE.heroTop,
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
  period,
  onPeriodChange,
  chartMode,
  onChartModeChange,
  selectedChartCategoryId,
  onChartCategorySelect,
  registerScrollTop,
  onOpenChartExpanded,
  onOpenNetWorth,
  netWorth,
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
  onOpenCustomRange: (accountId: string) => void;
  totalBalance: number;
  onRefresh: () => Promise<void>;
  isSelected: boolean;
  pageIndex: number;
  verticalScrolls: SharedValue<number[]>;
  indicatorY: SharedValue<number>;
  period: HomePeriodType;
  onPeriodChange: (p: HomePeriodType) => void;
  chartMode: HomeChartMode;
  onChartModeChange: (m: HomeChartMode) => void;
  selectedChartCategoryId: string | null;
  onChartCategorySelect: (id: string | null) => void;
  registerScrollTop: (id: string, fn: (() => void) | null) => void;
  onOpenChartExpanded?: (transactions: Transaction[], mode: HomeChartMode, range: { period: HomePeriodType; from: string; to: string }, resetTrigger: number) => void;
  onOpenNetWorth?: () => void;
  netWorth?: number;
  isPageReady: boolean;
  accountsById: Map<string, string>;
  categoriesById: Map<string, Category>;
  loansById: Map<string, LoanWithSummary>;
  getCategoryFullDisplayName: (categoryId: string, separator?: string) => string;
  loansLoaded: boolean;
  loadLoans: (filters?: { accountId?: string; status?: LoanStatus }) => Promise<void>;
}) {
  const { palette } = useAppTheme();
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<Transaction[]>([]);
  const [periodDataRangeKey, setPeriodDataRangeKey] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartResetNonce, setChartResetNonce] = useState(0);
  const isScreenFocused = useIsFocused();
  const loadRequestIdRef = useRef(0);
  const todayDataCacheRef = useRef<{
    cashflow: CashflowSummary;
    periodTransactions: Transaction[];
    transactions: Transaction[];
  } | null>(null);

  const mainScrollRef = useAnimatedRef<Animated.ScrollView>();
  const recentScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setCashflow({ in: 0, out: 0, net: 0 });
    setPeriodTransactions([]);
    setPeriodDataRangeKey(null);
    setTransactions([]);
    todayDataCacheRef.current = null;
  }, [accountId]);

  const loadRangeData = useCallback(async (rangeFrom: string, rangeTo: string) => {
    if (!isPageReady) return;
    const requestId = ++loadRequestIdRef.current;
    const requestRangeKey = `${rangeFrom}:${rangeTo}`;
    setPeriodDataRangeKey(null);
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSnapshot, recentTransactions, periodScopedTransactions] = await Promise.all([
      getCashflowSnapshot(accountId, rangeFrom, rangeTo),
      getTransactions({ accountId: accountFilter, limit: 10 }),
      getTransactions({ accountId: accountFilter, fromDate: rangeFrom, toDate: rangeTo }),
    ]);

    if (requestId !== loadRequestIdRef.current) return;

    const periodSummary = periodSnapshot.summary;

    setCashflow(periodSummary);
    setTransactions(recentTransactions);
    setPeriodTransactions(periodScopedTransactions);
    setPeriodDataRangeKey(requestRangeKey);

    const today = new Date();
    if (rangeFrom === toLocalDayStartISO(today) && rangeTo === toLocalDayEndISO(today)) {
      todayDataCacheRef.current = {
        cashflow: periodSummary,
        periodTransactions: periodScopedTransactions,
        transactions: recentTransactions,
      };
    }
  }, [accountId, isPageReady]);

  useEffect(() => {
    registerScrollTop(accountId, () => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: false });
      recentScrollRef.current?.scrollTo({ y: 0, animated: false });
      const arr = verticalScrolls.value.slice();
      arr[pageIndex] = 0;
      verticalScrolls.value = arr;
    });
    return () => registerScrollTop(accountId, null);
  }, [accountId, mainScrollRef, pageIndex, registerScrollTop, verticalScrolls]);

  // Reset chart nonce when category selection is cleared (e.g. parent reset)
  useEffect(() => {
    if (selectedChartCategoryId === null) {
      setChartResetNonce((n) => n + 1);
    }
  }, [selectedChartCategoryId]);

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

  const { from, to } = getHomeDateRange(
    period,
    settingsYearStart,
    customRange,
  );
  const currentRangeKey = `${from}:${to}`;
  const hasCurrentPeriodData = periodDataRangeKey === currentRangeKey;
  const displayedCashflow = hasCurrentPeriodData ? cashflow : { in: 0, out: 0, net: 0 };
  const displayedPeriodTransactions = hasCurrentPeriodData ? periodTransactions : [];
  const loadPageData = useCallback(async () => {
    await loadRangeData(from, to);
  }, [from, loadRangeData, to]);

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

  const openPeriodActivity = useCallback(
    (kind: 'in' | 'out' | 'net') => {
      router.push({
        pathname: '/(tabs)/activity',
        params: {
          source: period === 'today' ? 'home-today' : 'home-period',
          period: period === 'today' ? 'day' : period,
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 54 + HOME_SURFACE.heroTop, paddingBottom: HOME_SURFACE.heroBottom }}>
          <AccountSummaryCard
            accountName={accountId === 'all' ? 'All' : accountName}
            accountTypeLabel={accountTypeLabel}
            balance={totalBalance}
            currencySymbol={currencySymbol}
            palette={palette}
            onOpenNetWorth={accountId === 'all' ? onOpenNetWorth : undefined}
            netWorth={accountId === 'all' ? netWorth : undefined}
          />
          <View
            onLayout={(event) => {
              const newY = event.nativeEvent.layout.y;
              if (isSelected && newY > 0 && indicatorY.value !== newY) {
                indicatorY.value = newY;
              }
            }}
            style={{ height: 32 }}
          />
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 0 }}>

          <View style={{ marginBottom: 14 }}>
            <SegmentedPillSwitch
              options={PERIODS.map((value) => ({ key: value, label: PERIOD_LABELS[value] }))}
              value={period}
              onChange={(next) => {
                if (next === 'custom') {
                  onOpenCustomRange(accountId);
                  return;
                }
                onPeriodChange(next as HomePeriodType);
              }}
              backgroundColor={chartTheme.surface}
              pillColor="#FFFFFF"
              borderColor={chartTheme.border}
              activeTextColor={palette.text}
              inactiveTextColor={palette.textMuted}
              style={{ alignSelf: 'stretch' }}
              itemMinWidth={58}
              height={HOME_LAYOUT.periodHeight}
              radius={HOME_RADIUS.tab + 3}
              fontSize={HOME_TEXT.caption}
              animated={false}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -10, marginBottom: 12 }}>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '400', color: palette.text }}>

            </Text>
            <Animated.View layout={LinearTransition.springify().damping(30).stiffness(200).mass(0.8)} style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 1 }}>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                {formatDate(from)}
              </Text>
              {period !== 'today' && (
                <Animated.View 
                  entering={FadeInRight.duration(200)} 
                  exiting={FadeOutRight.duration(200)} 
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                    {` - ${formatDate(to)}`}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </View>

          <SummaryCard
            cashflow={displayedCashflow}
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
              transactions={displayedPeriodTransactions}
              categoriesById={categoriesById}
              sym={currencySymbol}
              listPalette={palette}
              getCategoryFullDisplayName={getCategoryFullDisplayName}
              theme={chartTheme}
              mode={chartMode}
              onModeChange={onChartModeChange}
              selectedCategoryId={selectedChartCategoryId}
              onCategorySelect={onChartCategorySelect}
              resetTrigger={`${period}:${from}:${to}:${chartResetNonce}`}
              accountsById={accountsById}
              loansById={loansById}
              onExpand={(mode) => onOpenChartExpanded?.(displayedPeriodTransactions, mode, { period, from, to }, Date.now())}
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
            <TouchableOpacity delayPressIn={0} onPress={() => router.push('/net-worth-prototype')} style={{ marginTop: 10 }}>
              <Text
                appWeight="medium"
                style={{
                  fontSize: HOME_TEXT.bodySmall,
                  color: palette.brand,
                  fontWeight: BUTTON_TOKENS.text.labelWeight,
                }}
              >
                Open Net Worth Prototype
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
