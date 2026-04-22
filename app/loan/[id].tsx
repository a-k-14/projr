import { useEffect } from 'react';
import { Text } from '@/components/ui/AppText';
import { View,
  ScrollView,
  
  Alert,
  TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { TransactionListItem } from '../../components/TransactionListItem';
import { useLoansStore } from '../../stores/useLoansStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency, getLoanTransactionKind, groupTransactionsByDate } from '../../lib/derived';
import { formatDate, formatDateShort } from '../../lib/dateUtils';
import { useAppTheme } from '../../lib/theme';
import { SCREEN_GUTTER } from '../../lib/design';
import {
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  PROGRESS } from '../../lib/layoutTokens';
import type { LoanWithSummary } from '../../types';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loans = useLoansStore((s) => s.loans);
  const updateLoan = useLoansStore((s) => s.update);
  const loadLoans = useLoansStore((s) => s.load);
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const actionBottomPadding = Math.max(Math.min(insets.bottom, 34), 12) + 12;

  const loan = loans.find((l) => l.id === id);

  useEffect(() => {
    loadLoans();
  }, []);

  if (!loan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.textMuted }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const account = accounts.find((a) => a.id === loan.accountId);
  const isLent = loan.direction === 'lent';
  const progressColor = isLent ? palette.negative : palette.brand;
  const grouped = groupTransactionsByDate(loan.transactions);
  const originTx = loan.transactions.find((tx) => getLoanTransactionKind(tx, loan.direction) === 'origin');

  const handleToggleStatus = async () => {
    if (!loan) return;
    const nextStatus = loan.status === 'open' ? 'closed' : 'open';
    if (nextStatus === 'closed') {
      Alert.alert(
        'Close loan?',
        'This will mark the loan as closed. No further receipts or repayments can be recorded until you reopen it.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Close loan', style: 'destructive', onPress: () => updateLoan(loan.id, { status: nextStatus }) },
        ],
      );
      return;
    }
    await updateLoan(loan.id, { status: nextStatus });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: SCREEN_GUTTER,
          paddingVertical: HOME_SPACE.md,
          backgroundColor: palette.background }}
      >
        <TouchableOpacity delayPressIn={0} onPress={() => router.back()} style={{ marginRight: HOME_SPACE.md }}>
          <Feather name="arrow-left" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: '700', color: palette.text, flex: 1 }}>
          {loan.personName}
        </Text>
        <TouchableOpacity delayPressIn={0}
          onPress={() => {
            if (!originTx) return;
            router.push({ pathname: '/modals/add-transaction', params: { editId: originTx.id } });
          }}
        >
          <Text appWeight="medium" style={{ color: palette.brand, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600' }}>
            Edit
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: loan.status === 'open' ? 156 : 24 }}>
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            {/* Loan details */}
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                padding: HOME_SPACE.xl,
                marginBottom: HOME_SPACE.md }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: HOME_SPACE.xs }}
              >
                <Text style={{ fontSize: HOME_TEXT.heroValue, fontWeight: '700', color: palette.text }}>
                  {loan.personName}
                </Text>
                <TouchableOpacity delayPressIn={0}
                  onPress={handleToggleStatus}
                  style={{
                    paddingHorizontal: HOME_SPACE.md,
                    paddingVertical: HOME_SPACE.xs,
                    borderRadius: HOME_RADIUS.small,
                    backgroundColor: loan.status === 'open' ? (isLent ? palette.outBg : palette.inBg) : palette.inputBg }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: '600',
                      color: loan.status === 'open' ? (isLent ? palette.negative : palette.positive) : palette.textSecondary }}
                  >
                    {loan.status === 'open' ? 'Open' : 'Closed'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }}>
                {isLent ? 'You lent' : 'You borrowed'} · {account?.name} · {formatDateShort(loan.date)}
              </Text>

              <View style={{ flexDirection: 'row', marginTop: HOME_SPACE.lg }}>
                {[
                  { key: 'given', label: isLent ? 'GIVEN' : 'BORROWED', value: formatCurrency(loan.givenAmount, sym), color: palette.text },
                  { key: 'settled', label: isLent ? 'RECEIVED' : 'REPAID', value: formatCurrency(loan.settledAmount, sym), color: progressColor },
                  { key: 'pending', label: 'PENDING', value: formatCurrency(loan.pendingAmount, sym), color: isLent ? palette.loan : palette.textSecondary },
                ].map((item, index) => (
                  <View
                    key={item.key}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      borderRightWidth: index < 2 ? 1 : 0,
                      borderRightColor: palette.inputBg,
                    }}
                  >
                    <Text appWeight="medium" style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, fontWeight: '600', letterSpacing: 0.5 }}>
                      {item.label}
                    </Text>
                    <Text appWeight="medium" style={{ fontSize: HOME_TEXT.heroLabel, fontWeight: '700', color: item.color, marginTop: HOME_SPACE.xs }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: HOME_SPACE.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: HOME_SPACE.xs }}>
                  <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{isLent ? 'Received' : 'Repaid'}</Text>
                  <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{loan.repaidPercent}%</Text>
                </View>
                <View style={{ height: PROGRESS.cardHeight, backgroundColor: palette.divider, borderRadius: PROGRESS.radius, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: PROGRESS.cardHeight,
                      width: `${Math.min(Math.max(loan.repaidPercent, 0), 100)}%`,
                      backgroundColor: progressColor,
                      borderRadius: PROGRESS.radius,
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: isLent ? palette.negative : palette.textSecondary }}>
                  {isLent ? `${formatCurrency(loan.pendingAmount, sym)} due` : `${formatCurrency(loan.pendingAmount, sym)} left`}
                </Text>
                <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, color: loan.status === 'closed' ? palette.textSecondary : (isLent ? palette.negative : palette.positive) }}>
                  {loan.status === 'closed' ? 'Closed' : 'Open'}
                </Text>
              </View>

              {loan.note ? (
                <View style={{ marginTop: HOME_SPACE.md, paddingTop: HOME_SPACE.md, borderTopWidth: 1, borderTopColor: palette.inputBg }}>
                  <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: HOME_SPACE.sm }}>
                    NOTE
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}>{loan.note}</Text>
                </View>
              ) : null}
            </View>

            {/* Transaction history */}
            <Text
              style={{
                fontSize: HOME_TEXT.tiny + 1,
                color: palette.textMuted,
                fontWeight: '600',
                letterSpacing: 0.5,
                marginBottom: HOME_SPACE.sm }}
            >
              TRANSACTIONS
            </Text>
            {grouped.map(({ dateKey, items }) => (
              <View key={dateKey} style={{ marginBottom: HOME_SPACE.sm }}>
                <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted, marginBottom: HOME_SPACE.sm }}>
                  {formatDate(dateKey + 'T00:00:00.000Z')}
                </Text>
                <View style={{ backgroundColor: palette.surface, borderRadius: HOME_RADIUS.card, overflow: 'hidden' }}>
                  {items.map((tx, i) => (
                    <TransactionListItem
                      key={tx.id}
                      tx={{ ...tx, payee: describeLoanDetailTransaction(loan, tx) }}
                      sym={sym}
                      palette={palette}
                      isLast={i === items.length - 1}
                      accountName={account?.name}
                      showAmountSign={false}
                      onPress={() =>
                        router.push({
                          pathname:
                            getLoanTransactionKind(tx, loan.direction) === 'settlement'
                              ? '/modals/loan-settlement'
                              : '/modals/add-transaction',
                          params: { editId: tx.id } })
                      }
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {loan.status === 'open' && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: SCREEN_GUTTER,
              paddingBottom: actionBottomPadding,
              paddingTop: 8,
              backgroundColor: palette.background }}
          >
            {loan.pendingAmount > 0 ? (
              <TouchableOpacity delayPressIn={0}
                onPress={() =>
                  router.push({ pathname: '/modals/loan-settlement', params: { loanId: loan.id } })
                }
                style={{
                  backgroundColor: isLent ? palette.negative : palette.brand,
                  borderRadius: HOME_RADIUS.card,
                  paddingVertical: HOME_SPACE.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: HOME_SPACE.sm }}
              >
                <Ionicons name="arrow-down" size={18} color={palette.surface} />
                <Text style={{ color: palette.surface, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600' }}>
                  {isLent ? 'Record receipt' : 'Record repayment'} · {formatCurrency(loan.pendingAmount, sym)} pending
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              delayPressIn={0}
              onPress={() =>
                router.push({ pathname: '/modals/add-transaction', params: { loanId: loan.id, addMore: '1' } })
              }
              style={{ alignItems: 'center', paddingVertical: 10, marginTop: loan.pendingAmount > 0 ? 4 : 0 }}
            >
              <Text appWeight="medium" style={{ color: isLent ? palette.negative : palette.brand, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600' }}>
                Add More
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function describeLoanDetailTransaction(loan: LoanWithSummary, tx: LoanWithSummary['transactions'][number]) {
  const kind = getLoanTransactionKind(tx, loan.direction);
  if (kind === 'origin') return loan.direction === 'lent' ? 'Lent' : 'Borrowed';
  if (kind === 'settlement') return loan.direction === 'lent' ? 'Receipt' : 'Repayment';
  return 'Loan';
}
