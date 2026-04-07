import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';

export default function SelectAccountSheet() {
  const { accounts } = useAccountsStore();
  const { accountId, setAccountId } = useTransactionDraftStore();
  const insets = useSafeAreaInsets();

  const ordered = useMemo(
    () => [
      ...accounts.filter((a) => a.id === accountId),
      ...accounts.filter((a) => a.id !== accountId),
    ],
    [accounts, accountId]
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.32)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} />
      <View
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          paddingHorizontal: SCREEN_GUTTER,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 42, height: 5, borderRadius: 999, backgroundColor: '#E5E7EB' }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0A0A0A', flex: 1 }}>
            Select account
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color="#0A0A0A" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
          {ordered.map((account) => {
            const selected = account.id === accountId;
            return (
              <TouchableOpacity
                key={account.id}
                onPress={() => {
                  setAccountId(account.id);
                  router.back();
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: SCREEN_GUTTER,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selected ? '#17673B' : '#E5E7EB',
                  backgroundColor: selected ? '#F0FAF4' : '#fff',
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#0A0A0A' }}>
                    {account.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {account.type}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark" size={18} color="#17673B" /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
