import { Text } from '@/components/ui/AppText';
import { Feather } from '@expo/vector-icons';
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
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow, ScreenTitle } from '../../components/settings-ui';
import { SummaryCard } from '../../components/SummaryCard';
import { TransactionListItem } from '../../components/TransactionListItem';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { FabButton } from '../../components/ui/FabButton';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { formatAccountDisplayName } from '../../lib/account-utils';
import {
  formatDate,
  getDateRange,
  toLocalDateKey,
  toLocalDayEndISO,
  toLocalDayStartISO
} from '../../lib/dateUtils';
import { buildCashflowChartData, formatCurrency, formatIndianNumberStr, getTotalBalance } from '../../lib/derived';
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
  DailyCashflow,
  PeriodType,
  Transaction
} from '../../types';

const PERIODS: PeriodType[] = ['week', 'month', 'year', 'custom'];
const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
  custom: 'Custom'
};

// Set false to restore the previous behavior where the indicator stays visible
// during horizontal swipes, even when the current page is vertically scrolled.
const HIDE_SCROLLED_INDICATOR_DURING_SWIPE = true;

type AccountTab = {
  id: string | 'all' | 'add';
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
  const settingsYearStart = useUIStore((s) => s.settings.yearStart);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const homeAccountViewMode = useUIStore((s) => s.settings.homeAccountViewMode);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const accountPagerScrollX = useSharedValue(0);
  const settledAccountPageIndex = useSharedValue(0);
  const verticalScrolls = useSharedValue<number[]>(new Array(20).fill(0));
  const indicatorY = useSharedValue(0);
  const indicatorGestureOpacity = useSharedValue(1);
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
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const previousAccountCountRef = useRef(accounts.length);
  const showAllAccountsTab = accounts.length !== 1;
  const homeRootAccountId = showAllAccountsTab ? 'all' : (accounts[0]?.id ?? 'all');

  const displayAccounts = useMemo<AccountTab[]>(() => [
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all' | 'add'>('all');
  const [pagerHeight, setPagerHeight] = useState(0);

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
      !accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(homeRootAccountId);
      pagerRef.current?.scrollTo({ x: 0, animated: true });
    }
  }, [accountPagerScrollX, accounts, displayAccounts, homeRootAccountId, pagerRef, selectedAccountId, settledAccountPageIndex, width]);

  useEffect(() => {
    if (selectedAccountId === 'all' && !showAllAccountsTab && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId, showAllAccountsTab]);

  useEffect(() => {
    if (homeAccountViewMode !== 'swipe') return;
    const selectedIndex = displayAccounts.findIndex((account) => account.id === selectedAccountId);
    if (selectedIndex >= 0) {
      const targetX = selectedIndex * width;
      settledAccountPageIndex.value = selectedIndex;
      if (Math.abs(accountPagerScrollX.value - targetX) > 1) {
        accountPagerScrollX.value = targetX;
        pagerRef.current?.scrollTo({ x: targetX, animated: false });
      }
    }
  }, [accountPagerScrollX, displayAccounts, homeAccountViewMode, pagerRef, selectedAccountId, settledAccountPageIndex, width]);

  const resetHomeToAll = useCallback((mode: TabResetMode, animated: boolean) => {
    setSelectedAccountId(homeRootAccountId);
    if (mode === 'full' && homeAccountViewMode === 'list') {
      updateSettings({ homeAccountViewMode: 'swipe' }, 'home-tab-reset').catch(() => undefined);
    }
    settledAccountPageIndex.value = 0;
    accountPagerScrollX.value = 0;
    if (mode === 'background') {
      verticalScrolls.value = verticalScrolls.value.map(() => 0);
      indicatorGestureOpacity.value = 1;
    }
    pagerRef.current?.scrollTo({ x: 0, animated });
    setGlobalScrollResetTick(v => ({ count: v.count + 1, animated, mode }));
  }, [accountPagerScrollX, homeAccountViewMode, homeRootAccountId, indicatorGestureOpacity, pagerRef, settledAccountPageIndex, updateSettings, verticalScrolls]);

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
      const next = displayAccounts[index];
      if (next) {
        settledAccountPageIndex.value = index;
      }
      if (next && next.id !== selectedAccountId) {
        setSelectedAccountId(next.id);
      }
    },
    [displayAccounts, selectedAccountId, settledAccountPageIndex],
  );

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
      const hasMovedHorizontally = Math.abs(progress - settledIndex) > 0.01;
      const currentScroll = verticalScrolls.value[settledIndex] ?? 0;

      if (HIDE_SCROLLED_INDICATOR_DURING_SWIPE && hasMovedHorizontally && Math.abs(currentScroll) > 1) {
        indicatorGestureOpacity.value = 0;
      }
    },
  });

  const handlePagerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const nextIndex = Math.round(offsetX / Math.max(width, 1));
      handlePagerEnd(nextIndex);
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
            startIcon={<Feather name="plus" size={18} color={palette.onBrand} />}
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
        title="Accounts"
        palette={palette}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={0.72}
              onPress={() => router.push('/net-worth-prototype')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="bar-chart-2" size={17} color={palette.text} />
            </TouchableOpacity>
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
        {homeAccountViewMode === 'list' ? (
          <View style={{ flex: 1 }}>
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
        ) : (
          <View style={{ flex: 1 }}>
            <Animated.ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
              onScroll={accountPagerScrollHandler}
              onScrollEndDrag={handlePagerDragEnd}
              onMomentumScrollEnd={handlePagerMomentumEnd}
              scrollEventThrottle={1}
              style={{ flex: 1 }}
            >
              {displayAccounts.map((account, index) => {
                return (
                  <View key={account.id} style={{ width, height: pagerHeight || undefined }}>
                    {account.id === 'add' ? (
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
                            : getAccountTypeLabel(accounts.find((item) => item.id === account.id)?.type)
                        }
                        settingsYearStart={settingsYearStart}
                        currencySymbol={showCurrencySymbol ? currencySymbol : ''}
                        customRange={customRangeMemo}
                        onOpenCustomRange={openCustomRange}
                        totalBalance={
                          account.id === 'all'
                            ? getTotalBalance(accounts)
                            : (accounts.find((item) => item.id === account.id)?.balance ?? 0)
                        }
                        onRefresh={refreshAccounts}
                        isSelected={account.id === selectedAccountId}
                        pageIndex={index}
                        verticalScrolls={verticalScrolls}
                        indicatorY={indicatorY}
                        resetTick={globalScrollResetTick}
                        onBottomSheetChange={setBottomSheetVisible}
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
        )}
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
            params: selectedAccountId === 'all' || selectedAccountId === 'add' ? undefined : { accountId: selectedAccountId }
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
                    backgroundColor: palette.inputBg,
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
        backgroundColor: palette.surface,
        borderRadius: HOME_RADIUS.tab,
        borderWidth: 1,
        borderColor: palette.divider,
        overflow: 'hidden',
      }}
    >
      {([
        { key: 'swipe', icon: 'layers' },
        { key: 'list', icon: 'list' },
      ] as const).map((item) => {
        const selected = mode === item.key;
        return (
          <TouchableOpacity
            delayPressIn={0}
            key={item.key}
            activeOpacity={0.8}
            onPress={() => onChange(item.key)}
            style={{
              width: 42,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? palette.inputBg : 'transparent',
            }}
          >
            <Feather name={item.icon}
              size={18}
              color={selected ? palette.text : palette.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
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
          backgroundColor: palette.brandSoft,
          opacity: 0.24,
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
            { key: 'in', label: 'In', value: todayCashflow.in, color: palette.brand },
            { key: 'out', label: 'Out', value: todayCashflow.out, color: palette.negative },
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
        <Feather name="plus-circle" size={22} color={palette.text} />
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
  const activeWidth = 18;
  const dashHeight = 3;
  const gap = 5;
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
              left: sidePad,
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
        <Feather name="plus-circle" size={22} color={palette.text} />
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
  onBottomSheetChange,
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
  onBottomSheetChange?: (visible: boolean) => void;
}) {
  const { palette } = useAppTheme();
  const getCategoryFullDisplayName = useCategoriesStore((s) => s.getCategoryFullDisplayName);
  const accounts = useAccountsStore((s) => s.accounts);
  const categories = useCategoriesStore((s) => s.categories);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const loans = useLoansStore((s) => s.loans);
  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const [period, setPeriod] = useState<PeriodType>('week');
  const [activeView, setActiveView] = useState<'out' | 'in' | 'table'>('out');
  const [cashflow, setCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [todayCashflow, setTodayCashflow] = useState<CashflowSummary>({ in: 0, out: 0, net: 0 });
  const [dailyData, setDailyData] = useState<DailyCashflow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showViewPicker, setShowViewPicker] = useState(false);
  useEffect(() => { onBottomSheetChange?.(showViewPicker); }, [showViewPicker, onBottomSheetChange]);
  const isScreenFocused = useIsFocused();
  const [periodControlWidth, setPeriodControlWidth] = useState(0);
  const periodIndicatorX = useSharedValue(0);
  const periodIndex = Math.max(0, PERIODS.indexOf(period));
  const periodSegmentWidth = periodControlWidth > 0 ? periodControlWidth / PERIODS.length : 0;
  const periodIndicatorStyle = useAnimatedStyle(() => ({
    width: Math.max(periodSegmentWidth - 6, 0),
    transform: [{ translateX: periodIndicatorX.value }],
  }), [periodSegmentWidth]);

  const leftScrollRef = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    const shouldScroll = resetTick.mode === 'background' || isSelected;
    if (shouldScroll && resetTick.count > 0 && mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ y: 0, animated: resetTick.animated });
    }
    if (resetTick.mode === 'full' && resetTick.count > 0) {
      setPeriod('week');
      setActiveView('out');
    }
  }, [isSelected, resetTick]);

  useEffect(() => {
    periodIndicatorX.value = withTiming(periodIndex * periodSegmentWidth + 3, { duration: 180 });
  }, [periodIndex, periodIndicatorX, periodSegmentWidth]);

  const verticalScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    const y = event.contentOffset.y;
    // Keep the latest vertical offset per page so the overlay indicator follows settled page scroll.
    const arr = verticalScrolls.value.slice();
    arr[pageIndex] = y;
    verticalScrolls.value = arr;
  });

  const handleSyncScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    leftScrollRef.current?.scrollTo({ y, animated: false });
  };
  const isDarkMode = palette.statusBarStyle === 'light';

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
    const accountFilter = accountId === 'all' ? undefined : accountId;
    const [periodSnapshot, recentTransactions, todaySnapshot] = await Promise.all([
      getCashflowSnapshot(accountId, from, to),
      getTransactions({ accountId: accountFilter, limit: 10 }),
      today >= from && todayEnd <= to
        ? Promise.resolve(null)
        : getCashflowSummary(accountId, today, todayEnd),
    ]);

    const periodSummary = periodSnapshot.summary;
    const dailySummary = periodSnapshot.daily;
    const todayEntry = dailySummary.find((entry) => entry.date === todayKey);
    const todaySummary =
      todaySnapshot ??
      (todayEntry
        ? { in: todayEntry.in, out: todayEntry.out, net: todayEntry.in - todayEntry.out }
        : { in: 0, out: 0, net: 0 });

    setCashflow(periodSummary);
    setDailyData(dailySummary);
    setTransactions(recentTransactions);
    setTodayCashflow(todaySummary);
  }, [accountId, from, to, today, todayEnd, todayKey]);

  useEffect(() => {
    if (!isScreenFocused || !isSelected) return;
    loadPageData();
  }, [isScreenFocused, isSelected, loadPageData]);

  useEffect(() => {
    if (!isScreenFocused || !isSelected || loansLoaded) return;
    loadLoans().catch(() => undefined);
  }, [isScreenFocused, isSelected, loadLoans, loansLoaded]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    await loadPageData();
    setRefreshing(false);
  }, [loadPageData, onRefresh]);

  const viewData = buildCashflowChartData(period, dailyData, from, to, settingsYearStart);
  const maxVal = Math.max(...viewData.map((entry) => activeView === 'in' ? entry.in : entry.out), 1);
  const drilldownRanges = useMemo(
    () => buildCashflowDrilldownRanges(period, from, to, settingsYearStart),
    [from, period, settingsYearStart, to],
  );
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

  const openSliceActivity = useCallback(
    (range: { from: string; to: string }, bucket: 'in' | 'out' | 'net') => {
      router.push({
        pathname: '/(tabs)/activity',
        params: {
          source: 'home-slice',
          period: 'custom',
          accountId: accountId === 'all' ? 'all' : accountId,
          type: 'all',
          cashflowBucket: bucket,
          from: range.from,
          to: range.to,
          ts: String(Date.now())
        }
      });
    },
    [accountId],
  );

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
            <View
              onStartShouldSetResponder={() => true}
              onLayout={(event) => setPeriodControlWidth(event.nativeEvent.layout.width)}
              style={{
                flex: 1,
                flexDirection: 'row',
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.tab + 3,
                borderWidth: 1,
                borderColor: palette.divider,
                height: HOME_LAYOUT.periodHeight,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {periodControlWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      top: 3,
                      bottom: 3,
                      left: 0,
                      borderRadius: HOME_RADIUS.tab,
                      borderWidth: 1,
                      borderColor: palette.borderSoft,
                      backgroundColor: palette.inputBg,
                    },
                    periodIndicatorStyle,
                  ]}
                />
              ) : null}
              {PERIODS.map((value) => (
                <TouchableOpacity delayPressIn={0}
                  key={value}
                  onPress={
                    value === 'custom'
                      ? () => {
                        setPeriod('custom');
                        onOpenCustomRange();
                      }
                      : () => setPeriod(value)
                  }
                  style={{
                    flex: 1,
                    height: HOME_LAYOUT.periodHeight,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1
                  }}
                >
                  <Text
                    appWeight="medium"
                    style={{
                      fontSize: HOME_TEXT.caption,
                      fontWeight: period === value ? '700' : '600',
                      textAlign: 'center',
                      textAlignVertical: 'center',
                      includeFontPadding: false,
                      color: period === value
                        ? palette.text
                        : palette.textMuted
                    }}
                  >
                    {PERIOD_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
              borderRadius: HOME_RADIUS.card,
              paddingHorizontal: CARD_PADDING,
              paddingTop: HOME_SURFACE.cardPaddingY,
              paddingBottom: HOME_SURFACE.cardPaddingBottom,
              marginBottom: HOME_SURFACE.chartCardBottom
            }}
          >
            <TouchableOpacity delayPressIn={0}
              onPress={() => setShowViewPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: HOME_SURFACE.panelHeaderGap,
                gap: 6
              }}
            >
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
                {activeView === 'out' ? 'Outflows' : activeView === 'in' ? 'Inflows' : 'Cashflow'}
              </Text>
              <Feather name="chevron-down" size={16} color={palette.textMuted} />
            </TouchableOpacity>

            {activeView === 'table' ? (
              <View style={{ flexDirection: 'row' }}>
                {/* Left Fixed Column: Period */}
                <View style={{ width: 45 }}>
                  <View style={{ borderBottomWidth: 1, borderBottomColor: palette.borderSoft, paddingBottom: HOME_SURFACE.tableHeaderPaddingBottom, marginBottom: HOME_SURFACE.panelSubheaderGap }}>
                    <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center' }}>
                      Period
                    </Text>
                  </View>
                  <ScrollView
                    ref={leftScrollRef}
                    style={{ maxHeight: 310 }}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false} // Synced by right scroll
                  >
                    {viewData.map((row, i) => (
                      <View
                        key={i}
                        style={{
                          height: HOME_SURFACE.tableRowHeight,
                          justifyContent: 'center',
                          borderBottomWidth: i === viewData.length - 1 ? 0 : 0.6,
                          borderBottomColor: palette.borderSoft
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ width: 45, fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text, opacity: 0.85, textAlign: 'center' }}
                        >
                          {row.label}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* Right Scrollable Data: Inflow, Outflow, Net */}
                <GestureScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  disallowInterruption={true}
                  style={{ flex: 1 }}
                >
                  <View>
                    <View
                      style={{
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderBottomColor: palette.borderSoft,
                        paddingBottom: HOME_SURFACE.tableHeaderPaddingBottom,
                        marginBottom: HOME_SURFACE.panelSubheaderGap
                      }}
                    >
                      <Text style={{ width: 95, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: HOME_SURFACE.tableColumnGap }}>Inflow</Text>
                      <Text style={{ width: 95, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: HOME_SURFACE.tableColumnGap }}>Outflow</Text>
                      <Text style={{ width: 95, fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: palette.textMuted, textAlign: 'center', marginLeft: HOME_SURFACE.tableColumnGap }}>Net</Text>
                    </View>
                    <ScrollView
                      ref={rightScrollRef}
                      style={{ maxHeight: 310 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      onScroll={handleSyncScroll}
                      scrollEventThrottle={16}
                    >
                      {viewData.map((row, i) => (
                        <View
                          key={i}
                          style={{
                            flexDirection: 'row',
                            paddingVertical: HOME_SURFACE.cardPaddingY,
                            height: HOME_SURFACE.tableRowHeight,
                            borderBottomWidth: i === viewData.length - 1 ? 0 : 0.6,
                            borderBottomColor: palette.borderSoft,
                            alignItems: 'center'
                          }}
                        >
                          <TouchableOpacity delayPressIn={0}
                            activeOpacity={0.75}
                            onPress={() => openSliceActivity(drilldownRanges[i] ?? { from, to }, 'in')}
                            style={{ width: 95, marginLeft: 12 }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text, opacity: 0.85, textAlign: 'right' }}
                            >
                              {row.in > 0 ? formatIndianNumberStr(String(row.in)) : '-'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity delayPressIn={0}
                            activeOpacity={0.75}
                            onPress={() => openSliceActivity(drilldownRanges[i] ?? { from, to }, 'out')}
                            style={{ width: 95, marginLeft: 12 }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text, opacity: 0.85, textAlign: 'right' }}
                            >
                              {row.out > 0 ? formatIndianNumberStr(String(row.out)) : '-'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity delayPressIn={0}
                            activeOpacity={0.75}
                            onPress={() => openSliceActivity(drilldownRanges[i] ?? { from, to }, 'net')}
                            style={{ width: 95, marginLeft: 12 }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: HOME_TEXT.body,
                                fontWeight: '600',
                                color: row.net > 0 ? palette.brand : row.net < 0 ? palette.negative : palette.text,
                                opacity: row.net === 0 ? 0.85 : 1,
                                textAlign: 'right'
                              }}
                            >
                              {row.net !== 0 ? formatIndianNumberStr(String(Math.abs(row.net))) : '-'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </GestureScrollView>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: HOME_LAYOUT.chartHeight, paddingHorizontal: 2 }}>
                {viewData.length > 0
                  ? viewData.map((entry, index) => {
                    const amount = activeView === 'in' ? entry.in : entry.out;
                    return (
                      <TouchableOpacity delayPressIn={0}
                        key={`${entry.label}-${index}`}
                        activeOpacity={0.75}
                        onPress={() =>
                          openSliceActivity(
                            drilldownRanges[index] ?? { from, to },
                            activeView === 'in' ? 'in' : 'out',
                          )
                        }
                        style={{ flex: 1, alignItems: 'center' }}
                      >
                        <View
                          style={{
                            width: 14,
                            backgroundColor: activeView === 'in' ? palette.brand : palette.negative,
                            borderRadius: HOME_RADIUS.chartBar,
                            opacity: amount > 0 ? 0.88 : 0.2,
                            height: Math.max(4, (amount / maxVal) * HOME_LAYOUT.chartBarHeight)
                          }}
                        />
                        <Text style={{ fontSize: HOME_TEXT.tiny, color: palette.textSoft, marginTop: 8 }}>
                          {entry.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                  : ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                    <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={{
                          width: 10,
                          height: 4,
                          backgroundColor: index === 0 ? palette.heroBar : palette.chartBarMuted,
                          borderRadius: HOME_RADIUS.full
                        }}
                      />
                      <Text
                        style={{
                          fontSize: HOME_TEXT.tiny,
                          color: index === 0 ? palette.text : palette.textMuted,
                          marginTop: 8,
                          fontWeight: index === 0 ? '700' : '500'
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
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

          <View style={{ width: '100%', alignItems: 'center', marginBottom: -70 }}>
            <Text
              style={{
                fontSize: 180,
                fontWeight: '900',
                color: palette.text,
                opacity: 0.05,
                textAlign: 'center',
                letterSpacing: -6,
                lineHeight: 180,
                width: '140%',
              }}
            >
              reni
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {showViewPicker && (
        <BottomSheet
          title="Select Chart"
          palette={palette}
          onClose={() => setShowViewPicker(false)}
          hasNavBar
        >
          {(['in', 'out', 'table'] as const).map((view, index) => (
            <ChoiceRow
              key={view}
              title={view === 'in' ? 'Inflows' : view === 'out' ? 'Outflows' : 'Cashflow'}
              subtitle={
                view === 'in'
                  ? 'Money coming in by category'
                  : view === 'out'
                    ? 'Money going out by category'
                    : 'Summary of cashflow'
              }
              selected={activeView === view}
              palette={palette}
              onPress={() => {
                setActiveView(view);
                setShowViewPicker(false);
              }}
              noBorder={index === 2}
            />
          ))}
          <ChoiceRow
            title="Chart Prototype"
            subtitle="Open the new interactive category pie concept"
            selected={false}
            palette={palette}
            onPress={() => {
              setShowViewPicker(false);
              router.push('/chart-prototype');
            }}
            noBorder
          />
        </BottomSheet>
      )}
    </View>
  );
});

function addDays(date: Date, amount: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function getDaysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / msPerDay));
}

function buildCashflowDrilldownRanges(
  period: PeriodType,
  fromIso: string,
  toIso: string,
  yearStart: number,
): { from: string; to: string }[] {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);

  if (period === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(fromDate, index);
      return { from: toLocalDayStartISO(day), to: toLocalDayEndISO(day) };
    });
  }

  if (period === 'month') {
    const monthStart = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    return Array.from({ length: 5 }, (_, index) => {
      const bucketStart = addDays(monthStart, index * 7);
      const bucketEnd = addDays(bucketStart, 6);
      const boundedStart = bucketStart < fromDate ? fromDate : bucketStart;
      const boundedEnd = bucketEnd > toDate ? toDate : bucketEnd;
      return { from: toLocalDayStartISO(boundedStart), to: toLocalDayEndISO(boundedEnd) };
    });
  }

  if (period === 'year') {
    const fiscalStartYear = fromDate.getMonth() >= yearStart ? fromDate.getFullYear() : fromDate.getFullYear() - 1;
    const fiscalStart = new Date(fiscalStartYear, yearStart, 1);
    return Array.from({ length: 12 }, (_, index) => {
      const monthStart = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + index, 1);
      const monthEnd = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + index + 1, 0);
      const boundedStart = monthStart < fromDate ? fromDate : monthStart;
      const boundedEnd = monthEnd > toDate ? toDate : monthEnd;
      return { from: toLocalDayStartISO(boundedStart), to: toLocalDayEndISO(boundedEnd) };
    });
  }

  const totalDays = getDaysBetween(fromIso, toIso) + 1;
  if (totalDays <= 14) {
    return Array.from({ length: totalDays }, (_, index) => {
      const day = addDays(fromDate, index);
      return { from: toLocalDayStartISO(day), to: toLocalDayEndISO(day) };
    });
  }

  const bucketsCount = totalDays <= 60 ? Math.min(5, Math.ceil(totalDays / 7)) : 12;
  const step = totalDays <= 60 ? 7 : 30;

  return Array.from({ length: bucketsCount }, (_, index) => {
    const bucketStart = addDays(fromDate, index * step);
    const bucketEnd = addDays(bucketStart, step - 1);
    const boundedStart = bucketStart < fromDate ? fromDate : bucketStart;
    const boundedEnd = bucketEnd > toDate ? toDate : bucketEnd;
    return { from: toLocalDayStartISO(boundedStart), to: toLocalDayEndISO(boundedEnd) };
  });
}
