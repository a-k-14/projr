import { Text } from '@/components/ui/AppText';
import HomeScreenContent from '@/components/HomeScreen';
import { FilledButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { FinanceEmptyMascot } from '@/components/ui/FinanceEmptyMascot';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { registerTabReset, type TabResetMode } from '../../lib/tabResetRegistry';
import { useAppTheme } from '../../lib/theme';
import { useAccountsStore } from '../../stores/useAccountsStore';

export default function HomeScreen() {
  const accounts = useAccountsStore((s) => s.accounts);
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const [resetTick, setResetTick] = useState<{ count: number; animated: boolean; mode: TabResetMode }>({
    count: 0,
    animated: false,
    mode: 'background',
  });

  useEffect(() => {
    return registerTabReset('index', ({ mode, animated }) => {
      setResetTick((value) => ({ count: value.count + 1, animated, mode }));
    });
  }, []);

  if (accounts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: SCREEN_GUTTER,
            paddingBottom: Math.max(insets.bottom, 18),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FinanceEmptyMascot palette={palette} variant="account" />
          <Text
            style={{
              marginTop: 18,
              fontSize: HOME_TEXT.heroValue,
              fontWeight: '700',
              color: palette.text,
              textAlign: 'center',
            }}
          >
            Add your first account
          </Text>
          <Text
            style={{
              marginTop: 8,
              maxWidth: 280,
              fontSize: HOME_TEXT.body,
              lineHeight: 20,
              color: palette.textMuted,
              textAlign: 'center',
            }}
          >
            Create an account to start tracking balances and transactions.
          </Text>
          <FilledButton
            label="Add Account"
            onPress={() => router.push('/settings/account-form')}
            palette={palette}
            startIcon={<AppIcon name="plus" size={18} color={palette.onBrand} />}
            style={{
              width: '100%',
              alignSelf: 'stretch',
              marginTop: 24,
              borderRadius: 14,
            }}
          />
        </View>
      </View>
    );
  }

  return <HomeScreenContent resetTick={resetTick} />;
}
