import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { HeaderResetButton } from '../components/ui/HeaderResetButton';
import { FilterChip } from '../components/ui/FilterChip';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { safePush } from '../lib/safePush';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { GrainHeroCard } from '../components/ui/GrainHeroCard';
import { DepositListCard } from '../components/ui/cards/DepositListCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { getScrollableBottomPadding } from '../components/ui/safeBottom';
import { DEPOSIT_VISUAL } from '../lib/depositVisuals';
import { formatCurrency } from '../lib/derived';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { useFixedDepositsStore } from '../stores/useFixedDepositsStore';
import { useUIStore } from '../stores/useUIStore';
import { APP_LOCALE } from '../lib/dateUtils';

function DepositsScreenContent() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { palette } = useAppTheme();
  const { deposits, refresh } = useFixedDepositsStore();

  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const hasDeposits = deposits.length > 0;

  const [statusFilter, setStatusFilter] = useState<'active' | 'closed' | 'all'>('active');
  const activeDeposits = useMemo(() => {
    return deposits
      .filter((d) => d.status === 'active')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getTime();
        const timeB = new Date(b.startDate).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [deposits]);

  const closedDeposits = useMemo(() => {
    return deposits
      .filter((d) => d.status === 'closed')
      .sort((a, b) => {
        const timeA = new Date(a.startDate).getTime();
        const timeB = new Date(b.startDate).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [deposits]);
  const showActive = statusFilter === 'all' || statusFilter === 'active';
  const showClosed = statusFilter === 'all' || statusFilter === 'closed';

  const activeInvested = useMemo(
    () => activeDeposits.reduce((sum, d) => sum + d.principalAmount, 0),
    [activeDeposits]
  );

  // Total maturity value across all deposits
  const totalMaturity = useMemo(
    () => deposits.reduce((sum, d) => sum + (d.maturityValue ?? d.principalAmount), 0),
    [deposits],
  );
  // Expected return: unrealised gains from active deposits only
  const expectedReturn = useMemo(
    () => activeDeposits.reduce((sum, d) => sum + Math.max(0, (d.maturityValue ?? d.principalAmount) - d.principalAmount), 0),
    [activeDeposits],
  );

  const avgAPY = useMemo(() => {
    const withRate = activeDeposits.filter((d) => d.interestRate != null && d.interestRate > 0);
    if (withRate.length === 0) return null;
    return withRate.reduce((sum, d) => sum + d.interestRate!, 0) / withRate.length;
  }, [activeDeposits]);

  const nextMaturityLabel = useMemo(() => {
    const upcoming = activeDeposits
      .filter((d) => d.maturityDate)
      .sort((a, b) => new Date(a.maturityDate!).getTime() - new Date(b.maturityDate!).getTime())[0];
    if (!upcoming?.maturityDate) return undefined;
    return new Date(upcoming.maturityDate).toLocaleDateString(APP_LOCALE, { month: 'short', year: 'numeric' });
  }, [activeDeposits]);

  const pills = [
    { key: 'active' as const, label: 'Active', count: activeDeposits.length },
    { key: 'closed' as const, label: 'Closed', count: closedDeposits.length },
    { key: 'all' as const, label: 'All', count: deposits.length },
  ];

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Deposits"
        palette={palette}
        showBack={true}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        titleAddon={
          <HeaderResetButton
            visible={statusFilter !== 'active'}
            onPress={() => setStatusFilter('active')}
            palette={palette}
          />
        }
        rightAction={
          <HeaderAddButton palette={palette} onPress={() => router.push({ pathname: '/modals/add-transaction', params: { type: 'deposit', editDepositId: '', closeDepositId: '' } })} />
        }
      />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refresh().catch(() => undefined)}
            tintColor={palette.brand}
          />
        }
        contentContainerStyle={{ paddingBottom: getScrollableBottomPadding(insets) }}
        showsVerticalScrollIndicator={false}
      >
        {hasDeposits ? (
          <>
            {/* Hero Card */}
            <View style={{ marginHorizontal: SCREEN_GUTTER, marginTop: 12, marginBottom: 20 }}>
              <GrainHeroCard
                solidColor={DEPOSIT_VISUAL.tone}
                icon="vault"
                eyebrow="Invested"
                value={formatCurrency(activeInvested, sym)}
                sym={sym}
                badgeLabel={activeDeposits.length > 0 ? `${activeDeposits.length} ACTIVE` : undefined}
                palette={palette}
                metrics={[
                  {
                    label: 'MATURITY',
                    value: formatCurrency(totalMaturity, sym),
                    subValue: nextMaturityLabel,
                  },
                  {
                    label: 'EXPECTED RETURNS',
                    value: expectedReturn > 0 ? `+${formatCurrency(expectedReturn, sym)}` : '—',
                    subValue: avgAPY != null ? `${avgAPY.toFixed(2)}% APY` : undefined,
                    valueColor: expectedReturn > 0 ? palette.numberPositive : undefined,
                  },
                ]}
              />
            </View>

            {/* Filter pills — Active / Closed / All */}
            <View style={{ flexDirection: 'row', paddingHorizontal: SCREEN_GUTTER, gap: 8, marginBottom: HOME_SPACE.md }}>
              {pills.map((pill) => {
                const labelWithCount = `${pill.label}${pill.count > 0 ? ` (${pill.count})` : ''}`;
                return (
                  <FilterChip
                    key={pill.key}
                    label={labelWithCount}
                    isActive={statusFilter === pill.key}
                    palette={palette}
                    onPress={() => setStatusFilter(pill.key)}
                    style={{ borderRadius: HOME_RADIUS.pill }}
                  />
                );
              })}
            </View>

            {/* Active Deposits */}
            {showActive && activeDeposits.length > 0 && (
              <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.lg }}>
                {statusFilter === 'all' && (
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginBottom: HOME_SPACE.md }}>
                    Active
                  </Text>
                )}
                <View style={{ gap: HOME_SPACE.lg }}>
                  {activeDeposits.map((deposit) => (
                    <DepositListCard
                      key={deposit.id}
                      deposit={deposit}
                      sym={sym}
                      palette={palette}
                      onPress={() => safePush(nav, `/deposit/${deposit.id}`)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Closed Deposits */}
            {showClosed && closedDeposits.length > 0 && (
              <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
                {statusFilter === 'all' && (
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginBottom: HOME_SPACE.md }}>
                    Closed
                  </Text>
                )}
                <View style={{ gap: HOME_SPACE.lg }}>
                  {closedDeposits.map((deposit) => (
                    <DepositListCard
                      key={deposit.id}
                      deposit={deposit}
                      sym={sym}
                      palette={palette}
                      onPress={() => safePush(nav, `/deposit/${deposit.id}`)}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={{ paddingHorizontal: SCREEN_GUTTER, marginTop: HOME_SPACE.xl }}>
            <EmptyStateCard
              palette={palette}
              title="No fixed deposits yet"
              subtitle="Add your fixed deposits to track maturity dates and interest earnings."
              illustration={<FinanceEmptyMascot palette={palette} variant="budget" />}
            />
          </View>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

export default function DepositsScreen() {
  return <DepositsScreenContent />;
}
