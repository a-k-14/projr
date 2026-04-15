import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FabButton } from '../../components/ui/FabButton';
import { FilterChip } from '../../components/ui/FilterChip';
import { OverviewHeroCard } from '../../components/ui/OverviewHeroCard';
import { formatCurrency, getLoanSummary } from '../../lib/derived';
import { CARD_PADDING } from '../../lib/design';
import {
  ACTIVITY_LAYOUT,
  HOME_LAYOUT,
  PROGRESS,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  getFabBottomOffset,
} from '../../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
import type { LoanStatus, LoanWithSummary } from '../../types';

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

export default function LoansScreen() {
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
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'lent' | 'borrowed'>('all');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const [fromDate, setFromDate] = useState<string | undefined>();
  const [toDate, setToDate] = useState<string | undefined>();
  const [amountMinStr, setAmountMinStr] = useState('');
  const [amountMaxStr, setAmountMaxStr] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

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
  const openCount = filteredLoans.filter((loan) => loan.status === 'open').length;
  const closedCount = filteredLoans.length - openCount;
  const totalTracked = summary.youLent + summary.youOwe;
  const recoveredAmount = filteredLoans.reduce((sum, loan) => sum + loan.settledAmount, 0);
  const recoveredPercent = totalTracked > 0 ? Math.min((recoveredAmount / totalTracked) * 100, 100) : 0;

  const displayAccounts = useMemo(
    () => [{ id: 'all', name: 'All Accounts' }, ...accounts.map((a) => ({ id: a.id, name: a.name }))],
    [accounts],
  );
  const selectedAccountId = filters.accountId ?? 'all';
  const selectedAccountLabel =
    selectedAccountId === 'all' ? 'All Accounts' : (accountsById.get(selectedAccountId) ?? 'All Accounts');
  const moreActiveCount =
    (directionFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (fromDate || toDate ? 1 : 0) +
    (amountMinStr ? 1 : 0) +
    (amountMaxStr ? 1 : 0);

  const renderLoanItem = useCallback(
    ({ item, index }: { item: LoanWithSummary; index: number }) => {
      const accountName = accountsById.get(item.accountId);
      return (
        <LoanRow
          loan={item}
          accountName={accountName}
          sym={sym}
          palette={palette}
          isLast={index === filteredLoans.length - 1}
          onPress={() => router.push(`/loan/${item.id}`)}
        />
      );
    },
    [accountsById, filteredLoans.length, palette, sym],
  );

  const openFromDatePicker = () => {
    DateTimePickerAndroid.open({
      value: fromDate ? new Date(fromDate) : new Date(),
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        const nextFrom = startOfDayIso(date);
        if (toDate && nextFrom > toDate) {
          setToDate(endOfDayIso(date));
        }
        setFromDate(nextFrom);
      },
    });
  };

  const openToDatePicker = () => {
    DateTimePickerAndroid.open({
      value: toDate ? new Date(toDate) : new Date(),
      mode: 'date',
      onChange: (_, date) => {
        if (!date) return;
        const nextTo = endOfDayIso(date);
        if (fromDate && fromDate > nextTo) {
          setFromDate(startOfDayIso(date));
        }
        setToDate(nextTo);
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.background }}>
      {isSearchActive ? (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider, flexDirection: 'row', alignItems: 'center' }]}>
          <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.divider, flex: 1 }]}>
            <Ionicons name="search" size={15} color={palette.textMuted} />
            <TextInput
              autoFocus
              placeholder="Search loans…"
              placeholderTextColor={palette.textSoft}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, fontSize: 14, color: palette.text, padding: 0 }}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={palette.textSoft} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => { setIsSearchActive(false); setSearch(''); }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.brand, marginLeft: 12 }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.topBar, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}>
          <View style={styles.topBarMainRow}>
            <Text style={{ fontSize: 26, fontWeight: '700', color: palette.text, letterSpacing: -0.5 }}>
              Loans
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => setIsSearchActive(true)}
              style={[styles.iconBtn, { backgroundColor: palette.surface, borderColor: palette.divider }]}
            >
              <Ionicons name="search" size={17} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={filteredLoans}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + ACTIVITY_LAYOUT.listBottomPadding }}
        ListHeaderComponent={
          <View style={{ paddingTop: ACTIVITY_LAYOUT.headerPaddingTop }}>
            <View style={{ paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX, marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom }}>
              <LoanSummaryCard
                lent={summary.youLent}
                borrowed={summary.youOwe}
                net={summary.net}
                netPositive={netPositive}
                openCount={openCount}
                closedCount={closedCount}
                sym={sym}
                palette={palette}
              />
            </View>

            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
                  marginBottom: ACTIVITY_LAYOUT.summaryPaddingBottom,
                  gap: ACTIVITY_LAYOUT.controlChipGap,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowAccountSheet(true)}
                style={[
                  styles.accountPicker,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.divider,
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0,
                  },
                ]}
              >
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: palette.text, flex: 1 }}>
                  {selectedAccountLabel}
                </Text>
                <Ionicons name="chevron-down" size={13} color={palette.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowMoreSheet(true)}
                activeOpacity={0.75}
                style={[
                  styles.moreChip,
                  {
                    flex: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    backgroundColor: moreActiveCount > 0 ? palette.brandSoft : palette.surface,
                    borderColor: moreActiveCount > 0 ? palette.brand : palette.divider,
                  },
                ]}
              >
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: moreActiveCount > 0 ? palette.brand : palette.textMuted }}>
                  {moreActiveCount > 0 ? `More ${moreActiveCount}` : 'More'}
                </Text>
                <MaterialIcons name="filter-list" size={17} color={moreActiveCount > 0 ? palette.brand : palette.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 1, backgroundColor: palette.divider, marginBottom: 14 }} />
          </View>
        }
        ListEmptyComponent={
          !refreshing ? (
            <View style={{ alignItems: 'center', paddingTop: 64 }}>
              <Ionicons name="people-outline" size={48} color={palette.textMuted} />
              <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: '500', marginTop: HOME_SPACE.md }}>
                No loans found
              </Text>
            </View>
          ) : null
        }
        renderItem={renderLoanItem}
      />

      <FabButton
        bottom={getFabBottomOffset(insets.bottom)}
        palette={palette}
        backgroundColor={palette.loan}
        iconColor={palette.onLoan}
        onPress={() => router.push({ pathname: '/modals/add-transaction', params: { type: 'loan' } })}
      />

      {showAccountSheet ? (
        <BottomSheet title="Select account" palette={palette} onClose={() => setShowAccountSheet(false)} hasNavBar>
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
          title="More filters"
          palette={palette}
          onClose={() => setShowMoreSheet(false)}
          hasNavBar
          footer={
            <View style={{ paddingHorizontal: CARD_PADDING, paddingTop: 8, paddingBottom: 3, borderTopWidth: 1, borderTopColor: palette.divider, backgroundColor: palette.surface }}>
              <TouchableOpacity
                onPress={() => setShowMoreSheet(false)}
                style={{ backgroundColor: palette.brand, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.onBrand }}>Apply filters</Text>
              </TouchableOpacity>
            </View>
          }
          headerRight={
            <TouchableOpacity
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: palette.brand }}>Clear all</Text>
            </TouchableOpacity>
          }
        >
          <View style={{ paddingBottom: 12 }}>
            <Text style={sectionLabelStyle(palette)}>
              Direction
            </Text>
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

            <Text style={sectionLabelStyle(palette)}>
              Status
            </Text>
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

            <Text style={sectionLabelStyle(palette)}>
              Date Range
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
              <TouchableOpacity
                onPress={openFromDatePicker}
                style={[styles.dateField, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.6 }}>
                  FROM
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {fromDate ? formatDateShortLabel(fromDate) : 'Select...'}
                </Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={18} color={palette.textSoft} />
              <TouchableOpacity
                onPress={openToDatePicker}
                style={[styles.dateField, { borderColor: palette.divider, backgroundColor: palette.surface }]}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: palette.textMuted, letterSpacing: 0.6 }}>
                  TO
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                  {toDate ? formatDateShortLabel(toDate) : 'Select...'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={sectionLabelStyle(palette)}>
              Amount Range
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: CARD_PADDING }}>
              <TextInput
                value={amountMinStr}
                onChangeText={setAmountMinStr}
                keyboardType="numeric"
                placeholder="Min ₹"
                placeholderTextColor={palette.textMuted}
                style={[styles.amountField, { borderColor: palette.divider, backgroundColor: palette.background, color: palette.text }]}
              />
              <Text style={{ color: palette.textMuted, fontSize: 18 }}>—</Text>
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
    </SafeAreaView>
  );
}

function LoanSummaryCard({
  lent,
  borrowed,
  net,
  netPositive,
  openCount,
  closedCount,
  sym,
  palette,
}: {
  lent: number;
  borrowed: number;
  net: number;
  netPositive: boolean;
  openCount: number;
  closedCount: number;
  sym: string;
  palette: AppThemePalette;
}) {
  const badgeLabel = borrowed === 0 && lent === 0 ? 'No open loans' : borrowed === 0 ? 'Net lent' : lent === 0 ? 'Net borrowed' : netPositive ? 'Net lent' : 'Net borrowed';
  const total = lent + borrowed;
  const resolvedPercent = total > 0 ? Math.min((Math.max(total - Math.abs(net), 0) / total) * 100, 100) : 0;

  return (
    <OverviewHeroCard
      palette={palette}
      eyebrow="Loans overview"
      title="Current position"
      badgeLabel={badgeLabel}
      badgeBg={palette.loanBg}
      badgeColor={palette.loan}
      metrics={[
        { key: 'lent', label: 'Lent', value: formatCurrency(lent, sym), valueColor: palette.text },
        { key: 'borrowed', label: 'Borrowed', value: formatCurrency(borrowed, sym), valueColor: palette.text },
      ]}
      progressLabelLeft={total > 0 ? `${Math.round(resolvedPercent)}% settled` : 'No loan balance'}
      progressLabelRight={total > 0 ? formatCurrency(Math.abs(net), sym) : '0'}
      progressPercent={resolvedPercent}
      progressColor={palette.loan}
      progressTrackColor={palette.loanBg}
      footerLabel="Open / Closed"
      footerValue={`${openCount} open • ${closedCount} closed`}
      footerValueColor={palette.loan}
      decorativeColor={palette.loanBg}
    />
  );
}

function LoanRow({
  loan,
  accountName,
  sym,
  palette,
  isLast,
  onPress,
}: {
  loan: LoanWithSummary;
  accountName?: string;
  sym: string;
  palette: AppThemePalette;
  isLast: boolean;
  onPress: () => void;
}) {
  const isLent = loan.direction === 'lent';
  const dirColor = isLent ? palette.brand : palette.negative;
  const dirBg = isLent ? palette.inBg : palette.outBg;
  const directionLabel = isLent ? 'Lent' : 'Borrowed';
  const progressPercent = loan.status === 'closed' ? 100 : loan.repaidPercent;
  const balanceAmount = loan.status === 'closed' ? 0 : loan.pendingAmount;

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: ACTIVITY_LAYOUT.groupCardRadius,
          marginHorizontal: ACTIVITY_LAYOUT.headerPaddingX,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingHorizontal: HOME_LAYOUT.listRowPaddingX,
              paddingVertical: HOME_LAYOUT.listRowPaddingY,
              borderBottomWidth: isLast ? 0 : 0,
              position: 'relative',
            }}
          >
            <View
              style={{
                width: HOME_LAYOUT.listIconSize,
                height: HOME_LAYOUT.listIconSize,
                borderRadius: HOME_RADIUS.small,
                backgroundColor: dirBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: HOME_SPACE.sm + 2,
              }}
            >
              <Ionicons
                name={isLent ? 'arrow-down' : 'arrow-up'}
                size={Math.round(HOME_LAYOUT.listIconSize * 0.45)}
                color={dirColor}
              />
            </View>

            {loan.status === 'closed' ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  minHeight: 22,
                  paddingHorizontal: 8,
                  borderTopRightRadius: ACTIVITY_LAYOUT.groupCardRadius,
                  borderBottomLeftRadius: HOME_RADIUS.small,
                  backgroundColor: palette.inputBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: palette.textSecondary }}>Closed</Text>
              </View>
            ) : null}

            <View style={{ flex: 1, paddingRight: CARD_PADDING - 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.body, fontWeight: '400', color: palette.text, marginBottom: 1 }}>
                  {loan.personName}
                  <Text style={{ color: palette.textSecondary, fontWeight: '400' }}> {'\u2022'} {directionLabel}</Text>
                </Text>
                <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text, textAlign: 'right' }}>
                  {formatCurrency(loan.givenAmount, sym)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 1 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>
                  {formatLoanRowDate(loan.date)} {'\u2022'} {accountName}
                </Text>
                <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, marginTop: 1, textAlign: 'right' }}>
                  Bal {formatCurrency(balanceAmount, sym)}
                </Text>
              </View>
              <View
                style={{
                  height: PROGRESS.cardHeight,
                  backgroundColor: palette.divider,
                  borderRadius: PROGRESS.radius,
                  marginTop: 6,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: PROGRESS.cardHeight,
                    width: `${progressPercent}%`,
                    backgroundColor: dirColor,
                    borderRadius: PROGRESS.radius,
                  }}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  topBarMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  iconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    borderWidth: 1.5,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  clearAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: -4,
  },
  dateField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amountField: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_LAYOUT.controlChipGap,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 8,
  },
});

function sectionLabelStyle(palette: AppThemePalette) {
  return {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: palette.textMuted,
    paddingHorizontal: CARD_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
  };
}

function startOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function endOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next.toISOString();
}

function formatDateShortLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatLoanRowDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
