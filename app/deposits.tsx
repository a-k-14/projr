import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
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
            {/* Modernized Hero Card with Gradient */}
            <View 
              style={{ 
                marginHorizontal: SCREEN_GUTTER,
                marginTop: 12,
                marginBottom: 20,
                borderRadius: HOME_RADIUS.card,
                borderWidth: 1,
                borderColor: palette.divider,
                backgroundColor: palette.brand,
                padding: 20,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[
                  palette.isDark ? '#172033' : palette.brand,
                  palette.isDark ? '#0F172A' : '#3C4760'
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                {/* Glass Icon Container — left */}
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: HOME_RADIUS.chip,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                    <AppIcon name="vault" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
                    Total Invested
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.screenTitle, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF', letterSpacing: -0.5 }}>
                    {formatCurrency(totalInvested, sym)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                    Total Returns
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AppIcon name="trending-up" size={14} color="#4ADE80" />
                    <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: '#4ADE80', letterSpacing: -0.2 }}>
                      +{formatCurrency(totalInterest, sym)}
                    </Text>
                  </View>
                </View>

                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.22)' }} />

                <View style={{ flex: 1, paddingLeft: 12, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                    Maturity Value
                  </Text>
                  <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF', letterSpacing: -0.2 }}>
                    {formatCurrency(totalMaturityValue, sym)}
                  </Text>
                </View>
              </View>
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
