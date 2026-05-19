import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { OverviewHeroCard } from '../components/ui/OverviewHeroCard';
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

function DepositsScreenContent() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { deposits, totalInvested, refresh } = useFixedDepositsStore();

  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const hasDeposits = deposits.length > 0;

  const [statusFilter, setStatusFilter] = useState<'active' | 'closed' | 'all'>('active');
  const activeDeposits = useMemo(() => deposits.filter((d) => d.status === 'active'), [deposits]);
  const closedDeposits = useMemo(() => deposits.filter((d) => d.status === 'closed'), [deposits]);
  const showActive = statusFilter === 'all' || statusFilter === 'active';
  const showClosed = statusFilter === 'all' || statusFilter === 'closed';

  // Total maturity value across all deposits
  const totalMaturity = useMemo(
    () => deposits.reduce((sum, d) => sum + (d.maturityValue ?? d.principalAmount), 0),
    [deposits],
  );
  // Expected return: unrealised gains from active deposits only (shown in footer)
  const expectedReturn = useMemo(
    () => activeDeposits.reduce((sum, d) => sum + Math.max(0, (d.maturityValue ?? d.principalAmount) - d.principalAmount), 0),
    [activeDeposits],
  );

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
        onBack={() => router.replace('/')}
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
              <OverviewHeroCard
                palette={palette}
                icon="vault"
                iconBg={DEPOSIT_VISUAL.bg}
                iconColor={DEPOSIT_VISUAL.tone}
                eyebrow="Deposits"
                title="Overview"
                badgeLabel=""
                badgeBg="transparent"
                badgeColor="transparent"
                metrics={[
                  { key: 'invested', label: 'Invested', value: formatCurrency(totalInvested, sym), valueColor: palette.text },
                  { key: 'maturity', label: 'Maturity', value: formatCurrency(totalMaturity, sym), valueColor: palette.text },
                ]}
                footerLabel=""
                footerValue=""
                footerValueColor={palette.text}
                footerMetrics={[
                  { key: 'active', label: 'Active', value: String(activeDeposits.length), valueColor: palette.text },
                  { key: 'return', label: 'Expected Return', value: expectedReturn > 0 ? formatCurrency(expectedReturn, sym) : '—', valueColor: expectedReturn > 0 ? palette.numberPositive : palette.textMuted },
                ]}
              />
            </View>

            {/* Filter pills — Active / Closed / All */}
            <View style={{ flexDirection: 'row', paddingHorizontal: SCREEN_GUTTER, gap: 8, marginBottom: HOME_SPACE.md }}>
              {pills.map((pill) => {
                const selected = statusFilter === pill.key;
                return (
                  <TouchableOpacity
                    key={pill.key}
                    delayPressIn={0}
                    activeOpacity={0.75}
                    onPress={() => setStatusFilter(pill.key)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: HOME_RADIUS.pill,
                      borderWidth: 1,
                      borderColor: selected ? palette.brand : palette.divider,
                      backgroundColor: selected ? palette.brand : palette.surface,
                    }}
                  >
                    <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: selected ? palette.onBrand : palette.text }}>
                      {pill.label}{pill.count > 0 ? ` (${pill.count})` : ''}
                    </Text>
                  </TouchableOpacity>
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
                      onPress={() => router.push(`/deposit/${deposit.id}`)}
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
                      onPress={() => router.push(`/deposit/${deposit.id}`)}
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
