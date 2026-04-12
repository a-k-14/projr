import { View, Text, TouchableOpacity, ScrollView, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER, SHEET_GUTTER, RADIUS, SPACING } from '../../lib/design';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';
import { getThemePalette, resolveTheme } from '../../lib/theme';

export default function SelectAccountSheet() {
  const { accounts } = useAccountsStore();
  const { accountId, setAccountId } = useTransactionDraftStore();
  const { settings } = useUIStore();
  const scheme = useColorScheme();
  const palette = getThemePalette(resolveTheme(settings.theme, scheme));
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: palette.scrim }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} />
      <View
        style={{
          backgroundColor: palette.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          paddingHorizontal: SHEET_GUTTER,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 999,
              backgroundColor: palette.divider,
              opacity: 0.65,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text, flex: 1 }}>
            Select account
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={palette.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {accounts.map((account) => {
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
                  paddingHorizontal: SHEET_GUTTER,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selected ? palette.tabActive : palette.divider,
                  backgroundColor: selected ? palette.brandSoft : palette.surface,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: palette.text }}>
                    {formatAccountDisplayName(account.name, account.accountNumber)}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 2 }}>
                    {account.type}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark" size={18} color={palette.tabActive} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
