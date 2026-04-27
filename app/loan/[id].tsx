import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FixedBottomActions } from '../../components/settings-ui';
import { TransactionListItem } from '../../components/TransactionListItem';
import { FilledButton, TextButton } from '../../components/ui/AppButton';
import { AppConfirmDialog } from '../../components/ui/AppConfirmDialog';
import { formatDate, formatDateShort, getRelativeDateLabel } from '../../lib/dateUtils';
import { formatCurrency, getLoanTransactionKind, getLoanTransactionUserNote, groupTransactionsByDate } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import {
  ACTIVITY_LAYOUT,
  BUTTON_TOKENS,
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
  PRIMARY_ACTION,
  SCREEN_HEADER,
  PROGRESS
} from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useCategoriesStore } from '../../stores/useCategoriesStore';
import { useLoansStore } from '../../stores/useLoansStore';
import { useUIStore } from '../../stores/useUIStore';
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
  const tags = useCategoriesStore((s) => s.tags);
  const tagNamesById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const loan = loans.find((l) => l.id === id);

  useEffect(() => {
    loadLoans();
  }, []);

  useEffect(() => {
    if (!loan && id) {
      router.back();
    }
  }, [loan, id]);

  if (!loan) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  const account = accounts.find((a) => a.id === loan.accountId);
  const isLent = loan.direction === 'lent';
  const progressColor = loan.status === 'closed' ? palette.textSoft : (isLent ? palette.brand : palette.negative);
  const balanceColor = isLent ? palette.loan : palette.textSecondary;
  const grouped = groupTransactionsByDate(loan.transactions);
  const originTx = loan.transactions
    .filter((tx) => getLoanTransactionKind(tx, loan.direction) === 'origin')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const loanMetrics = [
    { key: 'given', label: isLent ? 'LENT' : 'BORROWED', value: formatCurrency(loan.givenAmount, sym), color: palette.text },
    { key: 'balance', label: 'BALANCE', value: formatCurrency(loan.pendingAmount, sym), color: balanceColor },
  ];

  const handleToggleStatus = async () => {
    if (!loan) return;
    const nextStatus = loan.status === 'open' ? 'closed' : 'open';
    if (nextStatus === 'closed') {
      setShowCloseConfirm(true);
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
          backgroundColor: palette.background
        }}
      >
        <TouchableOpacity delayPressIn={0} onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
          <AppIcon name="arrow-left" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text, flex: 1 }}>
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
                marginBottom: HOME_SPACE.md
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: HOME_SPACE.md,
                  marginBottom: HOME_SPACE.md
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textMuted }} numberOfLines={1}>
                    {isLent ? 'You Lent' : 'You Borrowed'} · {account?.name} · {formatDate(loan.date)}
                  </Text>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.rowLabel, fontWeight: '600', color: palette.text, marginTop: HOME_SPACE.xs }} numberOfLines={1}>
                    {loan.personName}
                  </Text>
                </View>
                <TouchableOpacity delayPressIn={0}
                  onPress={handleToggleStatus}
                  style={{
                    paddingHorizontal: HOME_SPACE.md,
                    paddingVertical: HOME_SPACE.xs,
                    borderRadius: HOME_RADIUS.small,
                    backgroundColor: loan.status === 'open' ? (isLent ? palette.outBg : palette.inBg) : palette.inputBg
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: '600',
                      color: loan.status === 'open' ? (isLent ? palette.negative : palette.positive) : palette.textSecondary
                    }}
                  >
                    {loan.status === 'open' ? 'Open' : 'Closed'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', marginTop: HOME_SPACE.sm, marginBottom: HOME_SPACE.lg }}>
                {loanMetrics.map((item, index) => (
                  <View
                    key={item.key}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      marginLeft: index > 0 ? HOME_SPACE.md : 0,
                    }}
                  >
                    {index > 0 ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: -HOME_SPACE.md / 2,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          backgroundColor: palette.inputBg,
                        }}
                      />
                    ) : null}
                    <Text appWeight="medium" style={{ fontSize: HOME_TEXT.tiny, color: palette.textMuted, fontWeight: '600', letterSpacing: 0, textAlign: 'left' }}>
                      {item.label}
                    </Text>
                    <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.heroLabel + 2, fontWeight: '700', color: item.color, marginTop: HOME_SPACE.xs, textAlign: 'left' }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ paddingTop: HOME_SPACE.sm, paddingBottom: HOME_SPACE.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: HOME_SPACE.sm }}>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: '600', color: palette.textMuted }}>
                    {isLent ? 'Received' : 'Repaid'} · {formatCurrency(loan.settledAmount, sym)}
                  </Text>
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

              {originTx?.note ? (
                <View style={{ marginTop: HOME_SPACE.md, paddingTop: HOME_SPACE.md, borderTopWidth: 1, borderTopColor: palette.inputBg }}>
                  <Text style={{ fontSize: HOME_TEXT.tiny + 1, color: palette.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: HOME_SPACE.sm }}>
                    NOTE
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text }}>{getLoanTransactionUserNote(originTx.note)}</Text>
                </View>
              ) : null}
            </View>

            {grouped.map(({ dateKey, items }) => {
              const { date, label } = getRelativeDateLabel(dateKey + 'T00:00:00.000Z');
              return (
                <View key={dateKey} style={{ marginBottom: HOME_SPACE.sm + 4 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: HOME_SPACE.sm,
                      paddingHorizontal: ACTIVITY_LAYOUT.groupHeaderPaddingX - SCREEN_GUTTER
                    }}
                  >
                    <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text }}>
                      {date}
                    </Text>
                    {label ? (
                      <>
                        <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: palette.textMuted, marginHorizontal: 6 }}>•</Text>
                        <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: palette.textMuted }}>{label}</Text>
                      </>
                    ) : null}
                  </View>
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
                      loanPersonName={loan.personName}
                      loanDirection={loan.direction}
                      tertiaryText={
                        tx.tags.length > 0
                          ? tx.tags
                            .map((tagId) => tagNamesById.get(tagId))
                            .filter((value): value is string => !!value)
                            .join(' • ') || undefined
                          : undefined
                      }
                      onPress={() =>
                        router.push({
                          pathname:
                            getLoanTransactionKind(tx, loan.direction) === 'settlement'
                              ? '/modals/loan-settlement'
                              : '/modals/add-transaction',
                          params: { editId: tx.id }
                        })
                      }
                    />
                  ))}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {loan.status === 'open' && (
          <FixedBottomActions palette={palette}>
            {loan.pendingAmount > 0 ? (
              <FilledButton
                label={isLent ? 'Record Receipt' : 'Record Repayment'}
                onPress={() =>
                  router.push({ pathname: '/modals/loan-settlement', params: { loanId: loan.id } })
                }
                palette={palette}
                tone="loan"
                startIcon={<AppIcon name={isLent ? 'arrow-down' : 'arrow-up'} size={18} color={palette.onLoan} />}
              />
            ) : null}
            <TextButton
              label="Add More"
              onPress={() =>
                router.push({ pathname: '/modals/add-transaction', params: { loanId: loan.id, addMore: '1' } })
              }
              palette={palette}
              tone="loan"
            />
          </FixedBottomActions>
        )}
      </View>
      <AppConfirmDialog
        visible={showCloseConfirm}
        title="Close Loan"
        message="This will mark the loan as closed. No further receipts or repayments can be recorded until you reopen it."
        palette={palette}
        onCancel={() => setShowCloseConfirm(false)}
        confirm={{
          label: 'Close',
          destructive: true,
          onPress: () => {
            setShowCloseConfirm(false);
            updateLoan(loan.id, { status: 'closed' }).catch(() => undefined);
          },
        }}
      />
    </SafeAreaView>
  );
}

function describeLoanDetailTransaction(loan: LoanWithSummary, tx: LoanWithSummary['transactions'][number]) {
  const kind = getLoanTransactionKind(tx, loan.direction);
  if (kind === 'origin') return loan.direction === 'lent' ? 'Lent' : 'Borrowed';
  if (kind === 'settlement') return loan.direction === 'lent' ? 'Receipt' : 'Repayment';
  return 'Loan';
}
