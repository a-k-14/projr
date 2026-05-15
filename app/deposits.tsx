import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { HeaderAddButton, ScreenHeader } from '@/components/ui/ScreenHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../components/ui/FinanceEmptyMascot';
import { getDaysUntil } from '../lib/dateUtils';
import { formatCurrency } from '../lib/derived';
import { HOME_TEXT, SCREEN_GUTTER , FONT_WEIGHT} from '../lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';
import { useFixedDepositsStore } from '../stores/useFixedDepositsStore';
import { useUIStore } from '../stores/useUIStore';

function DepositsScreenContent() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { deposits, totalInvested, totalMaturityValue, totalInterest, refresh } = useFixedDepositsStore();

  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const hasDeposits = deposits.length > 0;

  const activeDeposits = useMemo(() => deposits.filter((d) => d.status === 'active'), [deposits]);
  const maturedDeposits = useMemo(() => deposits.filter((d) => d.status === 'matured'), [deposits]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      <ScreenHeader
        title="Deposits"
        palette={palette}
        showBack={true}
        onBack={() => router.replace('/')}
        rightAction={
          <HeaderAddButton palette={palette} onPress={() => router.push('/settings/account-form')} />
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
        contentContainerStyle={{ paddingBottom: insets.bottom + HOME_LAYOUT.fabContentBottomPadding + 20 }}
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

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
                    Total Invested
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.screenTitle, fontWeight: FONT_WEIGHT.bold, color: '#FFFFFF', letterSpacing: -0.5 }}>
                    {formatCurrency(totalInvested, sym)}
                  </Text>
                </View>
                
                {/* Glass Icon Container */}
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
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                <View>
                  <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                    Total Returns
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <AppIcon name="trending-up" size={14} color="#4ADE80" />
                    <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: '#4ADE80' }}>
                      +{formatCurrency(totalInterest, sym)}
                    </Text>
                  </View>
                </View>

                <View style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', opacity: 0.6 }} />

                <View>
                  <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                    Maturity Value
                  </Text>
                  <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: '#FFFFFF' }}>
                    {formatCurrency(totalMaturityValue, sym)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Deposits */}
            {activeDeposits.length > 0 && (
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
                  {activeDeposits.map((deposit) => {
                    const daysLeft = getDaysUntil(deposit.maturityDate);
                    return (
                      <TouchableOpacity
                        delayPressIn={0}
                        activeOpacity={0.82}
                        key={deposit.id}
                        onPress={() => { /* Navigate to deposit detail */ }}
                        style={{
                          padding: HOME_SPACE.lg,
                          borderRadius: HOME_RADIUS.card,
                          borderWidth: 1,
                          borderColor: palette.divider,
                          backgroundColor: palette.card,
                        }}
                      >
                        {/* Header Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: HOME_SPACE.md }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                              {deposit.bankName}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: HOME_TEXT.body,
                                fontWeight: FONT_WEIGHT.bold,
                                color: palette.text,
                                marginTop: 2,
                              }}
                            >
                              {deposit.name}
                            </Text>
                          </View>
                          <View
                            style={{
                              backgroundColor: palette.positive + '15',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: HOME_RADIUS.pill,
                            }}
                          >
                            <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: palette.positive }}>
                              {deposit.interestRate}%
                            </Text>
                          </View>
                        </View>

                        {/* Amount Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: HOME_SPACE.md }}>
                          <View>
                            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Invested</Text>
                            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text, marginTop: 2 }}>
                              {formatCurrency(deposit.principalAmount, sym)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Maturity Value</Text>
                            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.positive, marginTop: 2 }}>
                              {formatCurrency(deposit.maturityValue, sym)}
                            </Text>
                          </View>
                        </View>

                        {/* Footer Row */}
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: HOME_SPACE.md,
                            borderTopWidth: 1,
                            borderTopColor: palette.divider,
                          }}
                        >
                          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                            {deposit.tenureMonths} months
                          </Text>
                          <Text
                            style={{
                              fontSize: HOME_TEXT.caption,
                              fontWeight: FONT_WEIGHT.semibold,
                              color: daysLeft <= 30 ? palette.negative : daysLeft <= 90 ? palette.warning : palette.textMuted,
                            }}
                          >
                            {daysLeft > 0 ? `${daysLeft} days left` : 'Matured'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Matured Deposits */}
            {maturedDeposits.length > 0 && (
              <View style={{ paddingHorizontal: SCREEN_GUTTER }}>
                <Text
                  style={{
                    fontSize: HOME_TEXT.sectionTitle,
                    fontWeight: FONT_WEIGHT.bold,
                    color: palette.text,
                    marginBottom: HOME_SPACE.md,
                  }}
                >
                  Matured ({maturedDeposits.length})
                </Text>

                <View style={{ gap: HOME_SPACE.md }}>
                  {maturedDeposits.map((deposit) => (
                    <TouchableOpacity
                      delayPressIn={0}
                      activeOpacity={0.82}
                      key={deposit.id}
                      onPress={() => { }}
                      style={{
                        padding: HOME_SPACE.lg,
                        borderRadius: HOME_RADIUS.card,
                        borderWidth: 1,
                        borderColor: palette.divider,
                        backgroundColor: palette.surface,
                        opacity: 0.8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
                            {deposit.bankName}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: HOME_TEXT.body,
                              fontWeight: FONT_WEIGHT.semibold,
                              color: palette.text,
                              marginTop: 2,
                            }}
                          >
                            {deposit.name}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: palette.text }}>
                            {formatCurrency(deposit.maturityValue, sym)}
                          </Text>
                          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 2 }}>
                            Matured
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
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
    </View>
  );
}

export default function DepositsScreen() {
  return <DepositsScreenContent />;
}
