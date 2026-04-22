import { Text } from '@/components/ui/AppText';
import { View, ScrollView, Pressable , TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER, SHEET_GUTTER, RADIUS, SPACING } from '../../lib/design';
import { formatAccountDisplayName } from '../../lib/account-utils';
import { useAccountsStore } from '../../stores/useAccountsStore';
import { useTransactionDraftStore } from '../../stores/useTransactionDraftStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAppTheme } from '../../lib/theme';
import { HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';
import { CardSection, ChoiceRow } from '../../components/settings-ui';

export default function SelectAccountSheet() {
  const accounts = useAccountsStore((s) => s.accounts);
  const accountId = useTransactionDraftStore((s) => s.accountId);
  const setAccountId = useTransactionDraftStore((s) => s.setAccountId);
  const { palette } = useAppTheme();
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
          paddingBottom: insets.bottom + 14 }}
      >
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 999,
              backgroundColor: palette.divider,
              opacity: 0.65 }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingHorizontal: SHEET_GUTTER }}>
          <Text style={{ fontSize: SCREEN_HEADER.titleSize, fontWeight: SCREEN_HEADER.titleWeight, color: palette.text, flex: 1 }}>
            Select Account
          </Text>
          <TouchableOpacity delayPressIn={0} onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={palette.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <CardSection palette={palette}>
            {accounts.map((account, index) => {
              const selected = account.id === accountId;
              return (
                <ChoiceRow
                  key={account.id}
                  title={formatAccountDisplayName(account.name, account.accountNumber)}
                  subtitle={account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                  selected={selected}
                  palette={palette}
                  horizontalPadding={16}
                  onPress={() => {
                    setAccountId(account.id);
                    router.back();
                  }}
                  noBorder={index === accounts.length - 1}
                />
              );
            })}
          </CardSection>
        </ScrollView>
      </View>
    </View>
  );
}
