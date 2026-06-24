import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { HeaderResetButton } from '../components/ui/HeaderResetButton';
import { FilterChip } from '../components/ui/FilterChip';
import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { safePush } from '../lib/safePush';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

  const pills = [
    { key: 'active' as const, label: 'Active', count: activeDeposits.length },
    { key: 'closed' as const, label: 'Closed', count: closedDeposits.length },
    { key: 'all' as const, label: 'All', count: deposits.length },
  ];

  const listData = useMemo(() => {
    if (!hasDeposits) return [];
    const items: Array<
      | { type: 'section_header'; title: string }
      | { type: 'deposit'; deposit: typeof deposits[number] }
    > = [];

    if (showActive && activeDeposits.length > 0) {
      if (statusFilter === 'all') {
        items.push({ type: 'section_header', title: 'Active' });
      }
      activeDeposits.forEach((deposit) => {
        items.push({ type: 'deposit', deposit });
      });
    }

    if (showClosed && closedDeposits.length > 0) {
      if (statusFilter === 'all') {
        items.push({ type: 'section_header', title: 'Closed' });
      }
      closedDeposits.forEach((deposit) => {
        items.push({ type: 'deposit', deposit });
      });
    }

    return items;
  }, [hasDeposits, showActive, activeDeposits, showClosed, closedDeposits, statusFilter]);

  const renderItem = ({ item, index }: { item: typeof listData[number]; index: number }) => {
    if (item.type === 'section_header') {
      return (
        <Text
          style={{
            fontSize: HOME_TEXT.sectionTitle,
            fontWeight: FONT_WEIGHT.bold,
            color: palette.text,
            marginTop: index > 0 ? HOME_SPACE.lg - HOME_SPACE.md : 0,
            marginBottom: HOME_SPACE.md,
          }}
        >
          {item.title}
        </Text>
      );
    }

    return (
      <View style={{ marginBottom: HOME_SPACE.md }}>
        <DepositListCard
          deposit={item.deposit}
          sym={sym}
          palette={palette}
          onPress={() => safePush(nav, `/deposit/${item.deposit.id}`)}
        />
      </View>
    );
  };

  const keyExtractor = (item: typeof listData[number]) => {
    if (item.type === 'section_header') {
      return `header-${item.title}`;
    }
    return `deposit-${item.deposit.id}`;
  };

  const getItemType = (item: typeof listData[number]) => item.type;

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Deposits"
        palette={palette}
        showBack={true}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        titleSize={25}
        titleWeight="400"
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

      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingBottom: getScrollableBottomPadding(insets),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refresh().catch(() => undefined)}
            tintColor={palette.brand}
          />
        }
        ListHeaderComponent={
          hasDeposits ? (
            <View>
              {/* Hero Card */}
              <View style={{ marginTop: 4, marginBottom: 20 }}>
                <GrainHeroCard
                  solidColor={DEPOSIT_VISUAL.tone}
                  icon="vault"
                  eyebrow="Invested"
                  value={formatCurrency(activeInvested, sym)}
                  sym={sym}
                  badgeLabel={activeDeposits.length > 0 ? `${activeDeposits.length} Active` : undefined}
                  palette={palette}
                  metrics={[
                    {
                      label: 'MATURITY',
                      value: formatCurrency(totalMaturity, sym),
                    },
                    {
                      label: 'EST. RETURNS',
                      value: expectedReturn > 0 ? `+${formatCurrency(expectedReturn, sym)}` : '—',
                      valueColor: expectedReturn > 0 ? palette.numberPositive : undefined,
                    },
                  ]}
                />
              </View>

              {/* Filter pills — Active / Closed / All */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: HOME_SPACE.md }}>
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
            </View>
          ) : null
        }
        ListEmptyComponent={
          hasDeposits ? (
            <View style={{ marginTop: HOME_SPACE.xl }}>
              <EmptyStateCard
                palette={palette}
                title={statusFilter === 'active' ? 'No active deposits' : 'No closed deposits'}
                subtitle={statusFilter === 'active' ? 'All your fixed deposits are closed.' : "You don't have any closed fixed deposits."}
                illustration={<FinanceEmptyMascot palette={palette} variant="budget" />}
              />
            </View>
          ) : (
            <View style={{ marginTop: HOME_SPACE.xl }}>
              <EmptyStateCard
                palette={palette}
                title="No fixed deposits yet"
                subtitle="Add your fixed deposits to track maturity dates and interest earnings."
                illustration={<FinanceEmptyMascot palette={palette} variant="budget" />}
              />
            </View>
          )
        }
      />
    </ScreenScaffold>
  );
}

export default function DepositsScreen() {
  return <DepositsScreenContent />;
}
