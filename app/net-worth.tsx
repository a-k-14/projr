import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { getScrollableBottomPadding } from '../components/ui/safeBottom';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { HomeNetWorthPage } from '../components/HomeNetWorthPage';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useUIStore } from '../stores/useUIStore';
import { useAppTheme } from '../lib/theme';
import { getLoanSummary, getTotalBalance } from '../lib/derived';

export default function NetWorthScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const loans = useLoansStore((s) => s.loans);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);

  const loanSummary = useMemo(() => getLoanSummary(loans), [loans]);
  const totalBalance = useMemo(() => getTotalBalance(accounts), [accounts]);
  const netWorth = totalBalance + loanSummary.net;

  const orderedAccounts = useMemo(
    () => accounts.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt)),
    [accounts],
  );

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Net Worth"
        palette={palette}
        showBack={true}
        onBack={() => router.back()}
      />
      <View style={{ flex: 1 }}>
        <HomeNetWorthPage
          pageHeight={800}
          palette={palette}
          currencySymbol={showCurrencySymbol ? currencySymbol : ''}
          accounts={orderedAccounts}
          loanSummary={loanSummary}
          netWorth={netWorth}
          pageIndex={0}
          verticalScrolls={undefined as any}
          indicatorY={undefined as any}
          isSelected={false}
          compactTop
          hideTitle
          bottomPadding={getScrollableBottomPadding(insets)}
          onOpenAccount={(accountId) => {
            router.push(`/account/${accountId}`);
          }}
        />
      </View>
    </ScreenScaffold>
  );
}
