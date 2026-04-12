import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '../../stores/useLoansStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency, groupTransactionsByDate } from '../../lib/derived';
import { formatDate, formatDateShort, todayUTC } from '../../lib/dateUtils';
import { getThemePalette, resolveTheme } from '../../lib/theme';
import { SCREEN_GUTTER } from '../../lib/design';
import {
  HOME_RADIUS,
  HOME_SPACE,
  HOME_TEXT,
} from '../../lib/homeTokens';
import type { LoanWithSummary } from '../../types';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loans, isLoaded, recordPayment, update, load } = useLoansStore();
  const { accounts } = useAccountsStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));

  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const sym = settings.currencySymbol;
  const loan = loans.find((l) => l.id === id);

  useEffect(() => {
    if (!loan) load();
  }, [id]);

  // 404 guard: store is loaded but loan still not found — navigate back
  useEffect(() => {
    if (isLoaded && !loan) {
      router.back();
    }
  }, [isLoaded, loan]);

  if (!loan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: palette.textMuted }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const account = accounts.find((a) => a.id === loan.accountId);
  const isLent = loan.direction === 'lent';
  const progressColor = isLent ? palette.positive : palette.negative;
  const grouped = groupTransactionsByDate(loan.transactions);

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount');
      return;
    }
    setLoading(true);
    try {
      await recordPayment(loan.id, amount, todayUTC());
      setPaymentAmount('');
      setShowPaymentInput(false);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = () => {
    const newStatus = loan.status === 'open' ? 'closed' : 'open';
    Alert.alert(`Mark as ${newStatus}?`, `This loan will be marked as ${newStatus}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => update(loan.id, { status: newStatus }) },
    ]);
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
          backgroundColor: palette.background,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: HOME_SPACE.md }}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text, flex: 1 }}>
          {loan.personName}
        </Text>
        <TouchableOpacity>
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
                marginBottom: HOME_SPACE.md,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: HOME_SPACE.xs,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: palette.text }}>
                  {loan.personName}
                </Text>
                <TouchableOpacity
                  onPress={handleToggleStatus}
                  style={{
                    paddingHorizontal: HOME_SPACE.md,
                    paddingVertical: HOME_SPACE.xs,
                    borderRadius: HOME_RADIUS.small,
                    backgroundColor: loan.status === 'open' ? palette.loanBg : palette.inputBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: HOME_TEXT.bodySmall,
                      fontWeight: '600',
                      color: loan.status === 'open' ? palette.loan : palette.textSecondary,
                    }}
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
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: HOME_RADIUS.card,
                padding: HOME_SPACE.xl,
                marginBottom: HOME_SPACE.md,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {[
                  { label: 'GIVEN', value: loan.givenAmount, color: palette.text },
                  { label: 'SETTLED', value: loan.settledAmount, color: palette.positive },
                  { label: 'PENDING', value: loan.pendingAmount, color: isLent ? palette.loan : palette.negative },
                ].map((item, i) => (
                  <View
                    key={item.label}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      borderRightWidth: i < 2 ? 1 : 0,
                      borderRightColor: palette.inputBg,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: HOME_TEXT.tiny,
                        color: palette.textMuted,
                        fontWeight: '600',
                        letterSpacing: 0.5,
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: HOME_TEXT.heroLabel, fontWeight: '700', color: item.color, marginTop: HOME_SPACE.xs }}>
                      {formatCurrency(item.value, sym)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Progress bar with ghost track */}
              <View style={{ marginTop: HOME_SPACE.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: HOME_SPACE.xs }}>
                  <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Repaid</Text>
                  <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                    {loan.repaidPercent}%
                  </Text>
                </View>
                <View
                  style={{
                    height: 4,
                    backgroundColor: palette.divider,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      width: `${loan.repaidPercent}%`,
                      backgroundColor: progressColor,
                      borderRadius: 2,
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Note */}
            {loan.note ? (
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: HOME_RADIUS.card,
                  padding: HOME_SPACE.xl,
                  marginBottom: HOME_SPACE.md,
                }}
              >
                <Text
                  style={{
                    fontSize: HOME_TEXT.tiny + 1,
                    color: palette.textMuted,
                    fontWeight: '600',
                    letterSpacing: 0.5,
                    marginBottom: HOME_SPACE.sm,
                  }}
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
                marginBottom: HOME_SPACE.sm,
              }}
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
                    <View
                      key={tx.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: HOME_SPACE.lg,
                        borderBottomWidth: i < items.length - 1 ? 1 : 0,
                        borderBottomColor: palette.inputBg,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: HOME_RADIUS.small,
                          backgroundColor: palette.loanBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: HOME_SPACE.md,
                        }}
                      >
                        <Ionicons name="cash" size={14} color={palette.loan} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '500', color: palette.text }}>
                          {tx.note ?? 'Loan'}
                        </Text>
                        <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                          Loan · {account?.name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text }}>
                        {formatCurrency(tx.amount, sym)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Record payment */}
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
              backgroundColor: palette.background,
            }}
          >
            {showPaymentInput ? (
              <View style={{ flexDirection: 'row', gap: HOME_SPACE.md }}>
                <TextInput
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder={`Amount (max ${formatCurrency(loan.pendingAmount, sym)})`}
                  placeholderTextColor={palette.textMuted}
                  keyboardType="decimal-pad"
                  autoFocus
                  style={{
                    flex: 1,
                    backgroundColor: palette.surface,
                    borderRadius: HOME_RADIUS.pill,
                    paddingHorizontal: HOME_SPACE.xl,
                    paddingVertical: HOME_SPACE.lg,
                    fontSize: HOME_TEXT.sectionTitle,
                    color: palette.text,
                  }}
                />
                <TouchableOpacity
                  onPress={handleRecordPayment}
                  disabled={loading}
                  style={{
                    backgroundColor: palette.loan,
                    borderRadius: HOME_RADIUS.pill,
                    paddingHorizontal: HOME_SPACE.xxxl,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: palette.surface, fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowPaymentInput(true)}
                style={{
                  backgroundColor: palette.loan,
                  borderRadius: HOME_RADIUS.card,
                  paddingVertical: HOME_SPACE.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: HOME_SPACE.sm,
                }}
              >
                <Ionicons name="arrow-down" size={18} color={palette.surface} />
                <Text style={{ color: palette.surface, fontSize: HOME_TEXT.sectionTitle, fontWeight: '600' }}>
                  Record payment · {formatCurrency(loan.pendingAmount, sym)} pending
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
