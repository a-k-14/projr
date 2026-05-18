import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { OverviewHeroCard } from '../components/ui/OverviewHeroCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { getScrollableBottomPadding } from '../components/ui/safeBottom';
import { getDepositProgress } from '../lib/depositDisplay';
import { DEPOSIT_VISUAL } from '../lib/depositVisuals';
import { formatCurrency } from '../lib/derived';
import { HOME_TEXT, SCREEN_GUTTER , FONT_WEIGHT} from '../lib/design';
import { CARD_TEXT, HOME_RADIUS, HOME_SPACE } from '../lib/layoutTokens';
import { useAppTheme, type AppThemePalette } from '../lib/theme';
import { ScreenScaffold } from '../components/ui/ScreenScaffold';
import { useFixedDepositsStore } from '../stores/useFixedDepositsStore';
import { useUIStore } from '../stores/useUIStore';
import type { Deposit } from '../types';

function DepositsScreenContent() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { deposits, totalInvested, totalMaturityValue, totalInterest, refresh } = useFixedDepositsStore();

  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const hasDeposits = deposits.length > 0;

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const activeDeposits = useMemo(() => deposits.filter((d) => d.status === 'active'), [deposits]);
  const closedDeposits = useMemo(
    () => deposits.filter((d) => d.status === 'closed'),
    [deposits],
  );
  const maturedDeposits = closedDeposits;
  const showActive = statusFilter === 'all' || statusFilter === 'active';
  const showMatured = statusFilter === 'all' || statusFilter === 'closed';

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
                  { key: 'maturity', label: 'Maturity', value: formatCurrency(totalMaturityValue, sym), valueColor: palette.text },
                ]}
                footerLabel="Active"
                footerValue={activeDeposits.length.toString()}
                footerValueColor={palette.text}
              />
            </View>

            {/* Filter pills */}
            <View style={{ flexDirection: 'row', paddingHorizontal: SCREEN_GUTTER, gap: 8, marginBottom: HOME_SPACE.md }}>
              {([
                { key: 'all', label: 'All', count: deposits.length },
                { key: 'active', label: 'Active', count: activeDeposits.length },
                { key: 'closed', label: 'Closed', count: closedDeposits.length },
              ] as const).map((pill) => {
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
                      {pill.label} {pill.count > 0 ? `(${pill.count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Active Deposits */}
            {showActive && activeDeposits.length > 0 && (
              <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.lg }}>
                <Text
                  style={{
                    fontSize: HOME_TEXT.sectionTitle,
                    fontWeight: FONT_WEIGHT.bold,
                    color: palette.text,
                    marginBottom: HOME_SPACE.md,
                  }}
                >
                  Active Deposits ({activeDeposits.length})
                </Text>

                <View style={{ gap: HOME_SPACE.md }}>
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

            {/* Matured Deposits */}
            {showMatured && maturedDeposits.length > 0 && (
              <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
                <Text
                  style={{
                    fontSize: HOME_TEXT.sectionTitle,
                    fontWeight: FONT_WEIGHT.bold,
                    color: palette.text,
                    marginBottom: HOME_SPACE.md,
                  }}
                >
                  Closed ({maturedDeposits.length})
                </Text>

                <View style={{ gap: HOME_SPACE.md }}>
                  {maturedDeposits.map((deposit) => (
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

function DepositListCard({
  deposit,
  sym,
  palette,
  onPress,
}: {
  deposit: Deposit;
  sym: string;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const progress = getDepositProgress(deposit);
  const isClosed = deposit.status === 'closed';
  const maturityLabel = isClosed ? 'Received' : 'Maturity';
  const statusLabel = isClosed ? 'Closed' : deposit.maturityDate ? progress.label : '-';

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.82}
      onPress={onPress}
      style={{
        paddingHorizontal: HOME_SPACE.lg,
        paddingVertical: 12,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: isClosed ? palette.divider : palette.borderSoft,
        backgroundColor: isClosed ? palette.surface : palette.card,
        opacity: isClosed ? 0.86 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: HOME_RADIUS.chip,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: DEPOSIT_VISUAL.bg,
          }}
        >
          <AppIcon name={DEPOSIT_VISUAL.icon} size={18} color={DEPOSIT_VISUAL.tone} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              appWeight="medium"
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: CARD_TEXT.line1,
                color: palette.text,
              }}
            >
              {deposit.bankName ? `${deposit.name} · ${deposit.bankName}` : deposit.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: HOME_TEXT.caption,
                fontWeight: FONT_WEIGHT.semibold,
                color: progress.isUrgent ? palette.warning : isClosed ? palette.textMuted : palette.brand,
              }}
            >
              {statusLabel}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 5,
            }}
          >
            <AmountText
              label="Invested"
              value={formatCurrency(deposit.principalAmount, sym)}
              palette={palette}
            />
            <AmountText
              label={maturityLabel}
              value={formatCurrency(deposit.maturityValue ?? deposit.principalAmount, sym)}
              palette={palette}
              valueColor={palette.numberPositive}
              align="right"
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AmountText({
  label,
  value,
  palette,
  valueColor,
  align = 'left',
}: {
  label: string;
  value: string;
  palette: AppThemePalette;
  valueColor?: string;
  align?: 'left' | 'right';
}) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={{
        flex: 1,
        minWidth: 0,
        textAlign: align,
        fontSize: HOME_TEXT.bodySmall,
        color: palette.textSecondary,
      }}
    >
      {label}{' '}
      <Text style={{ fontWeight: FONT_WEIGHT.bold, color: valueColor ?? palette.text }}>
        {value}
      </Text>
    </Text>
  );
}
