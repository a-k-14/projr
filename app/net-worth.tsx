import { useMemo, useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { getScrollableBottomPadding } from '../components/ui/safeBottom';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { NetWorthDetailBlock } from '../components/NetWorthDetailBlock';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useFixedDepositsStore } from '../stores/useFixedDepositsStore';
import { useAssetsStore } from '../stores/useAssetsStore';
import { useUIStore } from '../stores/useUIStore';
import { useAppTheme } from '../lib/theme';
import { getLoanSummary, getTotalBalance } from '../lib/derived';
import { getFixedDepositSummary } from '../lib/fixed-deposits';

export default function NetWorthScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const loadAccounts = useAccountsStore((s) => s.load);

  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);

  const depositsList = useFixedDepositsStore((s) => s.deposits);
  const depositsLoaded = useFixedDepositsStore((s) => s.isLoaded);
  const loadDeposits = useFixedDepositsStore((s) => s.load);

  const assets = useAssetsStore((s) => s.assets);
  const assetsValue = useAssetsStore((s) => s.totalValue);
  const assetsLoaded = useAssetsStore((s) => s.isLoaded);
  const loadAssets = useAssetsStore((s) => s.load);

  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);

  useEffect(() => {
    if (!accountsLoaded) loadAccounts().catch(() => undefined);
    if (!loansLoaded) loadLoans().catch(() => undefined);
    if (!depositsLoaded) loadDeposits().catch(() => undefined);
    if (!assetsLoaded) loadAssets().catch(() => undefined);
  }, [accountsLoaded, loansLoaded, depositsLoaded, assetsLoaded]);

  const loanSummary = useMemo(() => getLoanSummary(loans), [loans]);
  const totalBalance = useMemo(() => getTotalBalance(accounts), [accounts]);
  const depositSummary = useMemo(() => getFixedDepositSummary(depositsList), [depositsList]);

  const netWorth = totalBalance + loanSummary.net + depositSummary.activeInvestedValue + assetsValue;

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
        <NetWorthDetailBlock
          pageHeight={800}
          palette={palette}
          currencySymbol={showCurrencySymbol ? currencySymbol : ''}
          accounts={orderedAccounts}
          loanSummary={loanSummary}
          depositSummary={depositSummary}
          assetsValue={assetsValue}
          assets={assets}
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
