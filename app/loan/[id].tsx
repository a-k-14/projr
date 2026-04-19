import { useEffect } from 'react';
import { View,
  Text,
  ScrollView,
  
  Alert,
  KeyboardAvoidingView,
  Platform , TouchableOpacity} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MetricProgressCard } from '../../components/ui/MetricProgressCard';
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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
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
          <Ionicons name="chevron-back" size={24} color={palette.text} />
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
          <Text style={{ color: palette.brand, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600' }}>
            Edit
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
            {/* Person card */}
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
            </View>

            {/* Summary card */}
            <MetricProgressCard
              palette={palette}
              metrics={[
                { key: 'given', label: isLent ? 'GIVEN' : 'BORROWED', value: formatCurrency(loan.givenAmount, sym), valueColor: palette.text },
                { key: 'settled', label: isLent ? 'RECEIVED' : 'REPAID', value: formatCurrency(loan.settledAmount, sym), valueColor: progressColor },
                { key: 'pending', label: 'PENDING', value: formatCurrency(loan.pendingAmount, sym), valueColor: isLent ? palette.loan : palette.textSecondary },
              ]}
              progressPercent={loan.repaidPercent}
              progressColor={progressColor}
              progressLabelLeft={isLent ? 'Received' : 'Repaid'}
              progressLabelRight={`${loan.repaidPercent}%`}
              footerLeft={{ text: isLent ? `${formatCurrency(loan.pendingAmount, sym)} due` : `${formatCurrency(loan.pendingAmount, sym)} left`, color: isLent ? palette.negative : palette.textSecondary }}
              footerRight={{ text: loan.status === 'closed' ? 'Closed' : 'Open', color: loan.status === 'closed' ? palette.textSecondary : (isLent ? palette.negative : palette.positive) }}
            />

            {/* Note */}
            {loan.note ? (
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: HOME_RADIUS.card,
                  padding: HOME_SPACE.xl,
                  marginBottom: HOME_SPACE.md }}
              >
                <Text
                  style={{
                    fontSize: HOME_TEXT.tiny + 1,
                    color: palette.textMuted,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                    marginBottom: HOME_SPACE.sm }}
                >
                  NOTE
                </Text>
                <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}>{loan.note}</Text>
              </View>
            ) : null}

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

        {loan.status === 'open' && loan.pendingAmount > 0 && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: SCREEN_GUTTER,
              paddingBottom: 28,
              paddingTop: HOME_SPACE.md,
              backgroundColor: palette.background }}
          >
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
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function describeLoanDetailTransaction(loan: LoanWithSummary, tx: LoanWithSummary['transactions'][number]) {
  const kind = getLoanTransactionKind(tx, loan.direction);
  if (kind === 'origin') return loan.direction === 'lent' ? 'Lent' : 'Borrowed';
  if (kind === 'settlement') return loan.direction === 'lent' ? 'Receipt' : 'Repayment';
  return 'Loan';
}
