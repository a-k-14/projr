import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../components/settings-ui';
import { BottomSheet } from '../components/ui/BottomSheet';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { LoanListCard } from '../components/ui/cards';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FilterChip } from '../components/ui/FilterChip';
import { AccountPickerButton } from '../components/ui/AccountPickerButton';
import { FilterMoreButton } from '../components/ui/FilterMoreButton';
import { ACCOUNT_TYPE_META, getAccountTypeLabel } from '../lib/settings-shared';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { GrainHeroCard } from '../components/ui/GrainHeroCard';
import { HeaderResetButton } from '../components/ui/HeaderResetButton';
import { HeaderSearchBar, HeaderSearchTrigger } from '../components/ui/HeaderSearchBar';
import { ListHeading } from '../components/ui/ListHeading';
import { MoreFiltersAmountRange } from '../components/ui/MoreFiltersAmountRange';
import { getScrollableBottomPadding, SystemBottomGuard } from '../components/ui/safeBottom';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { CATEGORY_COLORS } from '../lib/categoryColors';
import { toLocalDayEndISO, toLocalDayStartISO } from '../lib/dateUtils';
import { formatCurrency, getLoanSummary } from '../lib/derived';
import { CARD_PADDING, FONT_WEIGHT } from '../lib/design';
import {
  ACTIVITY_LAYOUT,
  BUTTON_TOKENS,
  HOME_RADIUS,
  HOME_TEXT,
  BOTTOM_SHEET_TOKENS,
} from '../lib/layoutTokens';
import { safePush } from '../lib/safePush';
import { registerTabReset } from '../lib/tabResetRegistry';
import { useAppTheme } from '../lib/theme';
import { formatDateFull } from '../lib/ui-format';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useUIStore } from '../stores/useUIStore';
import type { LoanStatus, LoanWithSummary } from '../types';

const STATUS_OPTIONS: { label: string; value: LoanStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];
const SHOW_EMPTY_STATE_PREVIEW = false;

const MemoizedLoanRow = memo(LoanListCard);

export default function LoansScreen() {
  const isFocused = useIsFocused();
  const loans = useLoansStore((s) => s.loans);
  const loadLoans = useLoansStore((s) => s.load);
  const filters = useLoansStore((s) => s.filters);
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const toggleSearch = useCallback((active: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchActive(active);
    if (!active) setSearch('');
  }, []);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'lent' | 'borrowed'>('all');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('open');
  const [fromDate, setFromDate] = useState<string | undefined>();
  const [toDate, setToDate] = useState<string | undefined>();
  const [amountMinStr, setAmountMinStr] = useState('');
  const [amountMaxStr, setAmountMaxStr] = useState('');

  const [pendingStatusFilter, setPendingStatusFilter] = useState<LoanStatus | 'all'>('open');
  const [pendingFromDate, setPendingFromDate] = useState<string | undefined>();
  const [pendingToDate, setPendingToDate] = useState<string | undefined>();
  const [pendingAmountMinStr, setPendingAmountMinStr] = useState('');
  const [pendingAmountMaxStr, setPendingAmountMaxStr] = useState('');

  useEffect(() => {
    if (showMoreSheet) {
      setPendingStatusFilter(statusFilter);
      setPendingFromDate(fromDate);
      setPendingToDate(toDate);
      setPendingAmountMinStr(amountMinStr);
      setPendingAmountMaxStr(amountMaxStr);
    }
  }, [showMoreSheet, statusFilter, fromDate, toDate, amountMinStr, amountMaxStr]);

  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlatList>(null);
  const pendingListResetRef = useRef(false);
  const [listResetKey, setListResetKey] = useState(0);

  const scrollToTop = useCallback((animated: boolean) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  const resetLoanView = useCallback((animated: boolean) => {
    setSearch('');
    setIsSearchActive(false);
    setShowAccountSheet(false);
    setShowMoreSheet(false);
    setDirectionFilter('all');
    // 'open' is the default loans view, so a reset restores it (not 'all').
    setStatusFilter('open');
    setFromDate(undefined);
    setToDate(undefined);
    setAmountMinStr('');
    setAmountMaxStr('');
    loadLoans({ accountId: undefined, status: undefined }).catch(() => undefined);
    scrollToTop(animated);
  }, [loadLoans, scrollToTop]);

  useEffect(() => {
    return registerTabReset('loans', ({ mode, animated }) => {
      if (mode === 'background') {
        pendingListResetRef.current = true;
      } else {
        pendingListResetRef.current = false;
        resetLoanView(animated);
      }
    });
  }, [resetLoanView, scrollToTop]);

  useEffect(() => {
    if (!isFocused || !pendingListResetRef.current) return;
    pendingListResetRef.current = false;
    setListResetKey((value) => value + 1);
  }, [isFocused]);

  const params = useLocalSearchParams<{ direction?: 'lent' | 'borrowed', status?: string }>();
  useEffect(() => {
    if (params.direction && ['lent', 'borrowed'].includes(params.direction)) {
      setDirectionFilter(params.direction);
    }
    if (params.status && ['open', 'closed', 'all'].includes(params.status)) {
      setStatusFilter(params.status as any);
    }
  }, [params.direction, params.status]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLoans(filters);
    setRefreshing(false);
  };

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );

  const filteredLoans = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minAmount = amountMinStr ? Number(amountMinStr) : undefined;
    const maxAmount = amountMaxStr ? Number(amountMaxStr) : undefined;

    return loans.filter((loan) => {
      const accountName = accountsById.get(loan.accountId) ?? '';
      const directionLabel = loan.direction === 'lent' ? 'lent' : 'borrowed';
      const loanDate = new Date(loan.date).getTime();
      const loanAmount = loan.givenAmount;

      if (directionFilter !== 'all' && loan.direction !== directionFilter) return false;
      if (statusFilter !== 'all' && loan.status !== statusFilter) return false;
      if (fromDate && loanDate < new Date(fromDate).getTime()) return false;
      if (toDate && loanDate > new Date(toDate).getTime()) return false;
      if (minAmount !== undefined && !Number.isNaN(minAmount) && loanAmount < minAmount) return false;
      if (maxAmount !== undefined && !Number.isNaN(maxAmount) && loanAmount > maxAmount) return false;
      if (!query) return true;

      return (
        loan.personName.toLowerCase().includes(query) ||
        accountName.toLowerCase().includes(query) ||
        directionLabel.includes(query) ||
        loan.status.toLowerCase().includes(query) ||
        loan.note?.toLowerCase().includes(query)
      );
    }).sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [accountsById, amountMaxStr, amountMinStr, directionFilter, fromDate, loans, search, statusFilter, toDate]);

  const summary = useMemo(() => getLoanSummary(filteredLoans), [filteredLoans]);
  const netPositive = summary.net >= 0;
  const selectedAccountId = filters.accountId ?? 'all';
  const selectedAccountLabel =
    selectedAccountId === 'all' ? 'All Accounts' : (accountsById.get(selectedAccountId) ?? 'All Accounts');
  const moreActiveCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (fromDate || toDate ? 1 : 0) +
    (amountMinStr ? 1 : 0) +
    (amountMaxStr ? 1 : 0);

  const nav = useNavigation();

  const openLoanDetail = useCallback((loanId: string) => {
    safePush(nav, `/loan/${loanId}`);
  }, [nav]);

  const renderLoanItem = useCallback(
    ({ item, index: _index }: { item: LoanWithSummary; index: number }) => {
      const accountName = accountsById.get(item.accountId);
      return (
        <MemoizedLoanRow
          loan={item}
          accountName={accountName}
          sym={sym}
          palette={palette}
          onPress={() => openLoanDetail(item.id)}
        />
      );
    },
    [accountsById, openLoanDetail, palette, sym],
  );



  const openPendingFromDatePicker = () => {
    DateTimePickerAndroid.open({
      value: pendingFromDate ? new Date(pendingFromDate) : new Date(),
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        const nextFrom = toLocalDayStartISO(date);
        if (pendingToDate && nextFrom > pendingToDate) {
          setPendingToDate(toLocalDayEndISO(date));
        }
        setPendingFromDate(nextFrom);
      }
    });
  };

  const openPendingToDatePicker = () => {
    DateTimePickerAndroid.open({
      value: pendingToDate ? new Date(pendingToDate) : new Date(),
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        const nextTo = toLocalDayEndISO(date);
        if (pendingFromDate && pendingFromDate > nextTo) {
          setPendingFromDate(toLocalDayStartISO(date));
        }
        setPendingToDate(nextTo);
      }
    });
  };

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      {isSearchActive ? (
        <HeaderSearchBar
          visible={isSearchActive}
          value={search}
          onChangeText={setSearch}
          placeholder="Search loans…"
          onClose={() => toggleSearch(false)}
          palette={palette}
          style={{ borderBottomWidth: 1 }}
        />
      ) : (
        <ScreenHeader
          title="Loans"
          palette={palette}
          showBack={true}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          titleAddon={
            <HeaderResetButton
              visible={directionFilter !== 'all' || statusFilter !== 'open' || !!search || !!fromDate || !!toDate || !!amountMinStr || !!amountMaxStr || selectedAccountId !== 'all'}
              onPress={() => resetLoanView(true)}
              palette={palette}
            />
          }
          rightAction={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HeaderSearchTrigger onPress={() => toggleSearch(true)} palette={palette} />
              <HeaderAddButton palette={palette} onPress={() => router.push({ pathname: '/modals/add-transaction', params: { type: 'loan' } })} />
            </View>
          }
        />
      )}

      <FlatList
        key={`loans-${listResetKey}`}
        ref={flatListRef}
        data={filteredLoans}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />
        }
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={
          <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
            <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: 12 }}>
              <GrainHeroCard
                solidColor={CATEGORY_COLORS.loans.surface}
                icon="hand-coins"
                eyebrow={netPositive ? "Net Lent" : "Net Owed"}
                value={formatCurrency(Math.abs(summary.net), sym)}
                sym={sym}
                badgeLabel={filteredLoans.filter(l => l.status === 'open').length > 0 ? `${filteredLoans.filter(l => l.status === 'open').length} OPEN` : undefined}
                palette={palette}
                metrics={[
                  {
                    label: 'LENT',
                    value: formatCurrency(summary.youLent, sym),
                  },
                  {
                    label: 'BORROWED',
                    value: formatCurrency(summary.youOwe, sym),
                  },
                ]}
              />
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 0,
              paddingRight: ACTIVITY_LAYOUT.headerPaddingX,
              gap: ACTIVITY_LAYOUT.controlChipGap,
              marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom,
            }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  alignItems: 'center',
                  paddingLeft: ACTIVITY_LAYOUT.headerPaddingX,
                  gap: ACTIVITY_LAYOUT.controlChipGap,
                }}
              >
                <FilterChip
                  label="All"
                  isActive={directionFilter === 'all'}
                  onPress={() => setDirectionFilter('all')}
                  palette={palette}
                />
                <FilterChip
                  label="Lent"
                  isActive={directionFilter === 'lent'}
                  onPress={() => setDirectionFilter('lent')}
                  palette={palette}
                />
                <FilterChip
                  label="Borrowed"
                  isActive={directionFilter === 'borrowed'}
                  onPress={() => setDirectionFilter('borrowed')}
                  palette={palette}
                />
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <AccountPickerButton
                  label={selectedAccountLabel}
                  onPress={() => setShowAccountSheet(true)}
                  palette={palette}
                  compact
                  width={122}
                />

                <FilterMoreButton
                  palette={palette}
                  moreActiveCount={moreActiveCount}
                  onPress={() => setShowMoreSheet(true)}
                  iconOnly
                  marginLeft={0}
                />
              </View>
            </View>


            {SHOW_EMPTY_STATE_PREVIEW ? (
              <View style={{ paddingTop: 8, paddingBottom: 22, paddingHorizontal: 24 }}>
                <EmptyStateCard
                  palette={palette}
                  title="No loans found"
                  subtitle="Add a lent or borrowed loan to track balances, receipts, and payments."
                  illustration={<FinanceEmptyMascot palette={palette} variant="loan" />}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ paddingTop: 4, paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX }}>
              <EmptyStateCard
                palette={palette}
                title="No loans found"
                subtitle="Add a lent or borrowed loan to track balances, receipts, and payments."
                illustration={<FinanceEmptyMascot palette={palette} variant="loan" />}
              />
            </View>
          ) : null
        }
        renderItem={renderLoanItem}
      />
      {showAccountSheet ? (
        <BottomSheet title="Select Account" palette={palette} onClose={() => setShowAccountSheet(false)} maxHeightRatio={BOTTOM_SHEET_TOKENS.filterNoNavBarMaxHeight}>
          <ChoiceRow
            title="All Accounts"
            selected={selectedAccountId === 'all'}
            palette={palette}
            leftElement={
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: HOME_RADIUS.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${palette.brand}18`,
                  borderWidth: 1,
                  borderColor: `${palette.brand}30`,
                }}
              >
                <AppIcon name="wallet" size={19} color={palette.brand} strokeWidth={1.6} />
              </View>
            }
            onPress={() => {
              loadLoans({ accountId: undefined, status: filters.status });
              setShowAccountSheet(false);
            }}
            noBorder={accounts.length === 0}
          />
          {accounts.map((account, index) => (
            <ChoiceRow
              key={account.id}
              title={account.name}
              subtitle={getAccountTypeLabel(account.type)}
              selected={selectedAccountId === account.id}
              palette={palette}
              leftElement={(() => {
                const typeMeta = ACCOUNT_TYPE_META[account.type];
                const color = typeMeta.color;
                return (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: HOME_RADIUS.chip,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${color}18`,
                      borderWidth: 1,
                      borderColor: `${color}30`,
                    }}
                  >
                    <AppIcon name={typeMeta.icon as any} size={19} color={color} strokeWidth={1.6} />
                  </View>
                );
              })()}
              onPress={() => {
                loadLoans({ accountId: account.id, status: filters.status });
                setShowAccountSheet(false);
              }}
              noBorder={index === accounts.length - 1}
            />
          ))}
        </BottomSheet>
      ) : null}

      {showMoreSheet ? (
        <BottomSheet
          title="More Filters"
          palette={palette}
          onClose={() => setShowMoreSheet(false)}
          maxHeightRatio={BOTTOM_SHEET_TOKENS.filterNoNavBarMaxHeight}
          footer={
            <View style={{ paddingHorizontal: CARD_PADDING, paddingTop: 8, paddingBottom: 3, borderTopWidth: 1, borderTopColor: palette.divider, backgroundColor: palette.surface }}>
              <TouchableOpacity delayPressIn={0}
                onPress={() => {
                  setStatusFilter(pendingStatusFilter);
                  setFromDate(pendingFromDate);
                  setToDate(pendingToDate);
                  setAmountMinStr(pendingAmountMinStr);
                  setAmountMaxStr(pendingAmountMaxStr);
                  setShowMoreSheet(false);
                }}
                style={{ backgroundColor: palette.brand, borderRadius: HOME_RADIUS.button, paddingVertical: 16, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: BUTTON_TOKENS.filled.labelWeight, color: palette.onBrand }}>Apply</Text>
              </TouchableOpacity>
            </View>
          }
          headerRight={
            <TouchableOpacity delayPressIn={0}
              onPress={() => {
                setPendingStatusFilter('open');
                setPendingFromDate(undefined);
                setPendingToDate(undefined);
                setPendingAmountMinStr('');
                setPendingAmountMaxStr('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              style={styles.clearAllButton}
            >
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: BUTTON_TOKENS.text.labelWeight, color: palette.brand }}>Clear All</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ paddingBottom: 12 }}>
            <ListHeading label="Status" palette={palette} />
            <View style={styles.sheetChipRow}>
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  isActive={pendingStatusFilter === option.value}
                  onPress={() => setPendingStatusFilter(option.value)}
                  palette={palette}
                />
              ))}
            </View>

            <ListHeading label="Date Range" palette={palette} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
              <TouchableOpacity delayPressIn={0}
                onPress={openPendingFromDatePicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: pendingFromDate ? palette.brand : palette.divider,
                    backgroundColor: palette.surface,
                    justifyContent: 'center',
                  }
                ]}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: pendingFromDate ? palette.text : palette.textSoft }}>
                  {pendingFromDate ? formatDateFull(pendingFromDate) : 'From'}
                </Text>
              </TouchableOpacity>
              <AppIcon name="arrow-right" size={18} color={palette.textSoft} />
              <TouchableOpacity delayPressIn={0}
                onPress={openPendingToDatePicker}
                style={[
                  styles.dateField,
                  {
                    borderColor: pendingToDate ? palette.brand : palette.divider,
                    backgroundColor: palette.surface,
                    justifyContent: 'center',
                  }
                ]}
              >
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: pendingToDate ? palette.text : palette.textSoft }}>
                  {pendingToDate ? formatDateFull(pendingToDate) : 'To'}
                </Text>
              </TouchableOpacity>
            </View>

            <ListHeading label="Amount Range" subtitle="Filter by principal amount" palette={palette} />
            <View style={{ paddingHorizontal: CARD_PADDING }}>
              <MoreFiltersAmountRange
                amountMinStr={pendingAmountMinStr}
                setAmountMinStr={setPendingAmountMinStr}
                amountMaxStr={pendingAmountMaxStr}
                setAmountMaxStr={setPendingAmountMaxStr}
                palette={palette}
                TextInputComponent={BottomSheetTextInput as any}
              />
            </View>
          </View>
        </BottomSheet>
      ) : null}
      <SystemBottomGuard />
    </ScreenScaffold>
  );
}


const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 0
  },
  topBarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1
  },
  iconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    height: ACTIVITY_LAYOUT.controlHeight,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  clearAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: -4
  },
  dateField: {
    flex: 1,
    height: 48,
    borderRadius: HOME_RADIUS.chip,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  sheetChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 8
  }
});


