import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { HeaderAddButton, HeaderIconButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { AppChevron } from '@/components/ui/AppChevron';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { safePush } from '../lib/safePush';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../components/settings-ui';
import { BottomSheet } from '../components/ui/BottomSheet';
import { getScrollableBottomPadding, SystemBottomGuard } from '../components/ui/safeBottom';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FilterChip } from '../components/ui/FilterChip';
import { FilterMoreButton } from '../components/ui/FilterMoreButton';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { ListHeading } from '../components/ui/ListHeading';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { LoanListCard } from '../components/ui/cards';
import { GrainHeroCard } from '../components/ui/GrainHeroCard';
import { formatCurrency, getLoanSummary } from '../lib/derived';
import { CARD_PADDING , FONT_WEIGHT} from '../lib/design';
import { CATEGORY_COLORS } from '../lib/categoryColors';
import {
  ACTIVITY_LAYOUT,
  BUTTON_TOKENS,
  HOME_RADIUS,
  HOME_TEXT,
} from '../lib/layoutTokens';
import { registerTabReset } from '../lib/tabResetRegistry';
import { useAppTheme } from '../lib/theme';
import { toLocalDayStartISO, toLocalDayEndISO } from '../lib/dateUtils';
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
const DIRECTION_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Lent', value: 'lent' },
  { label: 'Borrowed', value: 'borrowed' },
] as const;
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
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const [fromDate, setFromDate] = useState<string | undefined>();
  const [toDate, setToDate] = useState<string | undefined>();
  const [amountMinStr, setAmountMinStr] = useState('');
  const [amountMaxStr, setAmountMaxStr] = useState('');
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
    setStatusFilter('all');
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
      const loanAmount = loan.pendingAmount;

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
    });
  }, [accountsById, amountMaxStr, amountMinStr, directionFilter, fromDate, loans, search, statusFilter, toDate]);

  const summary = useMemo(() => getLoanSummary(filteredLoans), [filteredLoans]);
  const netPositive = summary.net >= 0;
  const selectedAccountId = filters.accountId ?? 'all';
  const selectedAccountLabel =
    selectedAccountId === 'all' ? 'All Accounts' : (accountsById.get(selectedAccountId) ?? 'All Accounts');
  const moreActiveCount =
    (directionFilter !== 'all' ? 1 : 0) +
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

  const openFromDatePicker = () => {
    DateTimePickerAndroid.open({
      value: fromDate ? new Date(fromDate) : new Date(),
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        const nextFrom = toLocalDayStartISO(date);
        if (toDate && nextFrom > toDate) {
          setToDate(toLocalDayEndISO(date));
        }
        setFromDate(nextFrom);
      }
    });
  };

  const openToDatePicker = () => {
    DateTimePickerAndroid.open({
      value: toDate ? new Date(toDate) : new Date(),
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        const nextTo = toLocalDayEndISO(date);
        if (fromDate && fromDate > nextTo) {
          setFromDate(toLocalDayStartISO(date));
        }
        setToDate(nextTo);
      }
    });
  };

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      {isSearchActive ? (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider, flexDirection: 'row', alignItems: 'center' }]}>
          <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.divider, flex: 1 }]}>
            <AppIcon name="search" size={15} color={palette.textMuted} />
            <TextInput
              autoFocus
              placeholder="Search loans…"
              placeholderTextColor={palette.textSoft}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, fontSize: HOME_TEXT.body, color: palette.text, padding: 0 }}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <TouchableOpacity delayPressIn={0} onPress={() => setSearch('')}>
                <AppIcon name="x-circle" size={16} color={palette.textSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity delayPressIn={0} onPress={() => toggleSearch(false)}>
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: BUTTON_TOKENS.text.compactLabelWeight, color: palette.brand, marginLeft: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScreenHeader
          title="Loans"
          palette={palette}
          showBack={true}
          onBack={() => router.replace('/')}
          rightAction={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <HeaderIconButton icon="search" palette={palette} onPress={() => toggleSearch(true)} />
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
                eyebrow="Loans · Lent"
                value={formatCurrency(summary.youLent, sym)}
                sym={sym}
                badgeLabel={filteredLoans.filter(l => l.status === 'open').length > 0 ? `${filteredLoans.filter(l => l.status === 'open').length} OPEN` : undefined}
                palette={palette}
                metrics={[
                  {
                    label: 'BORROWED',
                    value: formatCurrency(summary.youOwe, sym),
                  },
                  {
                    label: netPositive ? 'NET LENT' : 'NET OWED',
                    value: formatCurrency(Math.abs(summary.net), sym),
                    valueColor: netPositive ? palette.numberPositive : palette.numberNegative,
                  },
                ]}
              />
            </View>

            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                  marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom,
                  gap: ACTIVITY_LAYOUT.controlChipGap
                },
              ]}
            >
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowAccountSheet(true)}
                style={[
                  styles.accountPicker,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0
                  },
                ]}
              >
                <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text, flex: 1 }}>
                  {selectedAccountLabel}
                </Text>
                <AppChevron direction="down" size={15} tone="secondary" palette={palette} />
              </TouchableOpacity>

              <FilterMoreButton
                palette={palette}
                moreActiveCount={moreActiveCount}
                onPress={() => setShowMoreSheet(true)}
                flex
              />
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
        <BottomSheet title="Select Account" palette={palette} onClose={() => setShowAccountSheet(false)}>
          <ChoiceRow
            title="All Accounts"
            selected={selectedAccountId === 'all'}
            palette={palette}
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
              selected={selectedAccountId === account.id}
              palette={palette}
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
          footer={
            <View style={{ paddingHorizontal: CARD_PADDING, paddingTop: 8, paddingBottom: 3, borderTopWidth: 1, borderTopColor: palette.divider, backgroundColor: palette.surface }}>
              <TouchableOpacity delayPressIn={0}
                onPress={() => setShowMoreSheet(false)}
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
                setDirectionFilter('all');
                setStatusFilter('all');
                setFromDate(undefined);
                setToDate(undefined);
                setAmountMinStr('');
                setAmountMaxStr('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              style={styles.clearAllButton}
            >
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: BUTTON_TOKENS.text.labelWeight, color: palette.brand }}>Clear All</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ paddingBottom: 12 }}>
            <ListHeading label="Direction" palette={palette} />
            <View style={styles.sheetChipRow}>
              {DIRECTION_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  isActive={directionFilter === option.value}
                  onPress={() => setDirectionFilter(option.value)}
                  palette={palette}
                />
              ))}
            </View>

            <ListHeading label="Status" palette={palette} />
            <View style={styles.sheetChipRow}>
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  isActive={statusFilter === option.value}
                  onPress={() => setStatusFilter(option.value)}
                  palette={palette}
                />
              ))}
            </View>

            <ListHeading label="Date Range" palette={palette} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
              <TouchableOpacity delayPressIn={0}
                onPress={openFromDatePicker}
                style={[styles.dateField, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.heavy, color: palette.textMuted, letterSpacing: 0.6 }}>
                  FROM
                </Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginTop: 2 }}>
                  {fromDate ? formatDateFull(fromDate) : 'Select...'}
                </Text>
              </TouchableOpacity>
              <AppIcon name="arrow-right" size={18} color={palette.textSoft} />
              <TouchableOpacity delayPressIn={0}
                onPress={openToDatePicker}
                style={[styles.dateField, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.heavy, color: palette.textMuted, letterSpacing: 0.6 }}>
                  TO
                </Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginTop: 2 }}>
                  {toDate ? formatDateFull(toDate) : 'Select...'}
                </Text>
              </TouchableOpacity>
            </View>

            <ListHeading label="Amount Range" palette={palette} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
              <TextInput
                value={amountMinStr}
                onChangeText={setAmountMinStr}
                keyboardType="numeric"
                placeholder="Min ₹"
                placeholderTextColor={palette.textMuted}
                style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
              />
              <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.rowLabel }}>—</Text>
              <TextInput
                value={amountMaxStr}
                onChangeText={setAmountMaxStr}
                keyboardType="numeric"
                placeholder="Max ₹"
                placeholderTextColor={palette.textMuted}
                style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
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
  accountPicker: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    height: ACTIVITY_LAYOUT.controlHeight,
    paddingHorizontal: ACTIVITY_LAYOUT.accountChipHorizontalPadding,
    borderRadius: ACTIVITY_LAYOUT.controlRadius,
    borderWidth: 1,
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
    borderRadius: HOME_RADIUS.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  amountField: {
    flex: 1,
    borderRadius: HOME_RADIUS.chip,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: HOME_TEXT.body,
    fontWeight: FONT_WEIGHT.bold
  },
  sheetChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 8
  }
});


