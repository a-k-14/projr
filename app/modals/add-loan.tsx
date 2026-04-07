import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { useLoansStore } from '../../stores/useLoansStore';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';
import { todayUTC, formatDate } from '../../lib/dateUtils';

export default function AddLoanModal() {
  const { add } = useLoansStore();
  const { accounts, refresh } = useAccountsStore();
  const { settings } = useUIStore();

  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<'lent' | 'borrowed'>('lent');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayUTC());
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const sym = settings.currencySymbol;

  useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(settings.defaultAccountId || accounts[0].id);
    }
  }, [accounts]);

  const amount = parseFloat(amountStr) || 0;
  const isValid = amount > 0 && accountId && personName.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await add({
        personName: personName.trim(),
        direction,
        accountId,
        givenAmount: amount,
        note: note || undefined,
        date,
      });
      await refresh();
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0F0F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F0F0F5' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
            <Ionicons name="close" size={24} color="#0A0A0A" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#0A0A0A' }}>Add Loan</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Amount */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 8 }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 32, color: '#9CA3AF', marginRight: 4 }}>{sym}</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={{ fontSize: 40, fontWeight: '700', color: '#B45309', minWidth: 80, textAlign: 'center' }}
              autoFocus
            />
          </View>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 20, marginHorizontal: SCREEN_GUTTER, overflow: 'hidden' }}>
          {/* Account */}
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => setAccountId(acc.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    marginRight: 8,
                    backgroundColor: accountId === acc.id ? '#1B4332' : '#F3F4F6',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: accountId === acc.id ? '#fff' : '#6B7280' }}>
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Person */}
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Person</Text>
            <TextInput
              value={personName}
              onChangeText={setPersonName}
              placeholder="Name"
              placeholderTextColor="#9CA3AF"
              style={{ fontSize: 15, color: '#0A0A0A' }}
            />
          </View>

          {/* Direction */}
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Direction</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['lent', 'borrowed'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDirection(d)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: direction === d ? '#1B4332' : '#E5E7EB',
                    backgroundColor: direction === d ? '#DCFCE7' : '#fff',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: direction === d ? '#1B4332' : '#6B7280' }}>
                    {d === 'lent' ? 'I lent' : 'I borrowed'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date */}
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Date</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15, color: '#0A0A0A' }}>{formatDate(date)}</Text>
              <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
            </View>
          </View>

          {/* Note */}
          <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14 }}>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor="#9CA3AF"
              style={{ fontSize: 15, color: '#0A0A0A' }}
            />
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SCREEN_GUTTER, paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: '#F0F0F5' }}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? '#B45309' : '#9CA3AF',
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Add</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
