import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';

import { Text } from '@/components/ui/AppText';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useUIStore } from '../../stores/useUIStore';

import { formatAccountDisplayName } from '../../lib/account-utils';
import { getAccountTypeLabel } from '../../lib/settings-shared';
import { formatCurrency } from '../../lib/derived';
import { HOME_RADIUS, SCREEN_GUTTER } from '../../lib/layoutTokens';
import { AppIcon } from '../../components/ui/AppIcon';

export default function AllAccountsScreen() {
  const { palette } = useAppTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'All Accounts',
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 0, padding: 8 }}>
              <AppIcon name="arrow-left" size={24} color={palette.text} />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView 
        contentContainerStyle={{ padding: SCREEN_GUTTER, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {accounts.map((account) => {
          const typeLabel = getAccountTypeLabel(account.type);
          const isNegative = account.balance < 0;
          
          return (
            <TouchableOpacity 
              key={account.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/account/${account.id}`)}
              style={{
                backgroundColor: palette.card,
                borderRadius: HOME_RADIUS.card,
                borderWidth: 1,
                borderColor: palette.divider,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>
                  {formatAccountDisplayName(account.name, account.accountNumber)}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted, marginTop: 4 }}>
                  {typeLabel}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: isNegative ? palette.negative : palette.text }}>
                  {isNegative ? '-' : ''}{formatCurrency(Math.abs(account.balance), currencySymbol)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        
        <TouchableOpacity 
          onPress={() => router.push('/settings/account-form')}
          style={{ 
            padding: 16, 
            backgroundColor: palette.surface, 
            borderRadius: HOME_RADIUS.card, 
            borderWidth: 1, 
            borderStyle: 'dashed',
            borderColor: palette.borderSoft,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            marginTop: 8
          }}
        >
          <AppIcon name="plus-circle" size={22} color={palette.text} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>Add Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
