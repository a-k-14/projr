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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLoansStore } from '../../stores/useLoansStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { formatCurrency, groupTransactionsByDate } from '../../lib/derived';
import { formatDate, formatDateShort, todayUTC } from '../../lib/dateUtils';
import type { LoanWithSummary } from '../../types';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loans, recordPayment, update, load } = useLoansStore();
  const { accounts } = useAccountsStore();
  const { settings } = useUIStore();

  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const sym = settings.currencySymbol;
  const loan = loans.find((l) => l.id === id);

  useEffect(() => {
    if (!loan) load();
  }, [id]);

  if (!loan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F0F5', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#9CA3AF' }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const account = accounts.find((a) => a.id === loan.accountId);
  const isLent = loan.direction === 'lent';
  const progressColor = isLent ? '#16A34A' : '#DC2626';
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
    Alert.alert(
      `Mark as ${newStatus}?`,
      `This loan will be marked as ${newStatus}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => update(loan.id, { status: newStatus }) },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F0F5' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#F0F0F5',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#0A0A0A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#0A0A0A', flex: 1 }}>
          {loan.personName}
        </Text>
        <TouchableOpacity>
          <Text style={{ color: '#1B4332', fontSize: 15, fontWeight: '600' }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: 16 }}>
            {/* Person header */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#0A0A0A' }}>
                  {loan.personName}
                </Text>
                <TouchableOpacity
                  onPress={handleToggleStatus}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: loan.status === 'open' ? '#FEF3C7' : '#F3F4F6',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: loan.status === 'open' ? '#B45309' : '#6B7280',
                    }}
                  >
                    {loan.status === 'open' ? 'Open' : 'Closed'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {isLent ? 'You lent' : 'You borrowed'} · {account?.name} · {formatDateShort(loan.date)}
              </Text>
            </View>

            {/* Summary */}
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {[
                  { label: 'GIVEN', value: loan.givenAmount, color: '#0A0A0A' },
                  { label: 'SETTLED', value: loan.settledAmount, color: '#16A34A' },
                  { label: 'PENDING', value: loan.pendingAmount, color: isLent ? '#B45309' : '#DC2626' },
                ].map((item, i) => (
                  <View
                    key={item.label}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      borderRightWidth: i < 2 ? 1 : 0,
                      borderRightColor: '#F3F4F6',
                    }}
                  >
                    <Text style={{ fontSize: 10, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: item.color, marginTop: 4 }}>
                      {formatCurrency(item.value, sym)}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Repaid</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{loan.repaidPercent}%</Text>
                </View>
                <View style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
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
            {loan.note && (
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 }}>
                  NOTE
                </Text>
                <Text style={{ fontSize: 15, color: '#0A0A0A' }}>{loan.note}</Text>
              </View>
            )}

            {/* Transactions */}
            <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>
              TRANSACTIONS
            </Text>
            {grouped.map(({ dateKey, items }) => (
              <View key={dateKey} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>
                  {formatDate(dateKey + 'T00:00:00.000Z')}
                </Text>
                <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' }}>
                  {items.map((tx, i) => (
                    <View
                      key={tx.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        borderBottomWidth: i < items.length - 1 ? 1 : 0,
                        borderBottomColor: '#F3F4F6',
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: '#FEF3C7',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}
                      >
                        <Ionicons name="cash" size={14} color="#B45309" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#0A0A0A' }}>
                          {tx.note ?? 'Loan'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                          Loan · {account?.name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0A0A0A' }}>
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
              paddingHorizontal: 16,
              paddingBottom: 28,
              paddingTop: 12,
              backgroundColor: '#F0F0F5',
            }}
          >
            {showPaymentInput ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder={`Amount (max ${formatCurrency(loan.pendingAmount, sym)})`}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  autoFocus
                  style={{
                    flex: 1,
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 15,
                    color: '#0A0A0A',
                  }}
                />
                <TouchableOpacity
                  onPress={handleRecordPayment}
                  disabled={loading}
                  style={{
                    backgroundColor: '#1B4332',
                    borderRadius: 14,
                    paddingHorizontal: 20,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowPaymentInput(true)}
                style={{
                  backgroundColor: '#1B4332',
                  borderRadius: 16,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="arrow-down" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
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
