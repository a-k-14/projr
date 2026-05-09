import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';
import { FinanceEmptyMascot } from '../../components/ui/FinanceEmptyMascot';
import { formatCurrency } from '../../lib/derived';
import { HOME_TEXT, SCREEN_GUTTER } from '../../lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useUIStore } from '../../stores/useUIStore';

// Fixed Deposit type definition
interface FixedDeposit {
  id: string;
  name: string;
  bankName: string;
  principalAmount: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  tenureMonths: number;
  maturityValue: number;
  status: 'active' | 'matured' | 'closed';
}

// Mock data - replace with actual store when ready
const useFixedDepositsStore = () => {
  // This is a placeholder - user should replace with real store
  const [deposits] = useState<FixedDeposit[]>([
    {
      id: '1',
      name: 'Emergency Fund FD',
      bankName: 'HDFC Bank',
      principalAmount: 100000,
      interestRate: 7.5,
      startDate: '2025-01-15',
      maturityDate: '2026-01-15',
      tenureMonths: 12,
      maturityValue: 107500,
      status: 'active',
    },
    {
      id: '2',
      name: 'Tax Saver FD',
      bankName: 'SBI',
      principalAmount: 150000,
      interestRate: 6.8,
      startDate: '2024-04-01',
      maturityDate: '2029-04-01',
      tenureMonths: 60,
      maturityValue: 210000,
      status: 'active',
    },
  ]);

  const totalInvested = deposits.reduce((sum, d) => sum + d.principalAmount, 0);
  const totalMaturityValue = deposits.reduce((sum, d) => sum + d.maturityValue, 0);
  const totalInterest = totalMaturityValue - totalInvested;

  return {
    deposits,
    totalInvested,
    totalMaturityValue,
    totalInterest,
    refresh: async () => { /* placeholder */ },
  };
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysUntilMaturity(maturityDate: string): number {
  const today = new Date();
  const maturity = new Date(maturityDate);
  const diffTime = maturity.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

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
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      {/* Custom Header - matches loans/budget/settings style exactly */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.divider }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -8, padding: 8 }}>
            <AppIcon name="arrow-left" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: HOME_TEXT.screenTitle, fontWeight: '400', color: palette.text, letterSpacing: -0.5 }}>
            Deposits
          </Text>
          <View style={{ flex: 1 }} />
          {/* Spacer for alignment */}
          <View style={{ width: 40 }} />
        </View>
      </View>

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
            {/* Hero Card with Gradient & Glassmorphism */}
            <View style={[styles.heroCard, { borderColor: palette.divider }]}>
              {/* Gradient layers */}
              <View style={[styles.gradientTop, { backgroundColor: palette.brand }]} />
              <View style={[styles.gradientBottom, { backgroundColor: palette.positive }]} />
              <View style={[styles.gradientAccent, { backgroundColor: palette.surface }]} />

              {/* Glassmorphism content container */}
              <View style={styles.glassContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.xs }}>
                      Total Invested
                    </Text>
                    <Text style={{ fontSize: HOME_TEXT.heroValue, fontWeight: '700', color: palette.text }}>
                      {formatCurrency(totalInvested, sym)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginBottom: HOME_SPACE.xs }}>
                      Total Returns
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AppIcon name="trending-up" size={14} color={palette.positive} />
                      <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.positive }}>
                        +{formatCurrency(totalInterest, sym)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: palette.divider,
                    marginVertical: HOME_SPACE.lg,
                    opacity: 0.6,
                  }}
                />

                <View style={{ flexDirection: 'row', gap: HOME_SPACE.lg }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Maturity Value</Text>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text, marginTop: 2 }}>
                      {formatCurrency(totalMaturityValue, sym)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Active Deposits</Text>
                    <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.text, marginTop: 2 }}>
                      {activeDeposits.length}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Active Deposits */}
            {activeDeposits.length > 0 && (
              <View style={{ paddingHorizontal: SCREEN_GUTTER, marginBottom: HOME_SPACE.lg }}>
                <Text
                  style={{
                    fontSize: HOME_TEXT.sectionTitle,
                    fontWeight: '700',
                    color: palette.text,
                    marginBottom: HOME_SPACE.md,
                  }}
                >
                  Active Deposits ({activeDeposits.length})
                </Text>

                <View style={{ gap: HOME_SPACE.md }}>
                  {activeDeposits.map((deposit) => {
                    const daysLeft = getDaysUntilMaturity(deposit.maturityDate);
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
                                fontWeight: '700',
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
                            <Text style={{ fontSize: 12, fontWeight: '600', color: palette.positive }}>
                              {deposit.interestRate}%
                            </Text>
                          </View>
                        </View>

                        {/* Amount Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: HOME_SPACE.md }}>
                          <View>
                            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Invested</Text>
                            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginTop: 2 }}>
                              {formatCurrency(deposit.principalAmount, sym)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>Maturity Value</Text>
                            <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.positive, marginTop: 2 }}>
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
                              fontWeight: '600',
                              color: daysLeft <= 30 ? palette.negative : daysLeft <= 90 ? '#F2B84B' : palette.textMuted,
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
                    fontWeight: '700',
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
                              fontWeight: '600',
                              color: palette.text,
                              marginTop: 2,
                            }}
                          >
                            {deposit.name}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text }}>
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

        {/* Add FD Button */}
        <TouchableOpacity
          delayPressIn={0}
          activeOpacity={0.82}
          onPress={() => { /* Navigate to add deposit form */ }}
          style={{
            marginHorizontal: SCREEN_GUTTER,
            marginTop: HOME_SPACE.xl,
            padding: HOME_SPACE.lg,
            borderRadius: HOME_RADIUS.card,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: palette.borderSoft,
            backgroundColor: palette.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: HOME_SPACE.sm,
          }}
        >
          <AppIcon name="plus-circle" size={20} color={palette.brand} />
          <Text style={{ fontSize: HOME_TEXT.body, fontWeight: '600', color: palette.brand }}>
            Add Fixed Deposit
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function DepositsScreen() {
  return <DepositsScreenContent />;
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  heroCard: {
    marginHorizontal: SCREEN_GUTTER,
    marginTop: HOME_SPACE.md,
    marginBottom: HOME_SPACE.lg,
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 180,
  },
  gradientTop: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 999,
    top: -80,
    right: -60,
    opacity: 0.15,
  },
  gradientBottom: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    bottom: -60,
    left: -40,
    opacity: 0.1,
  },
  gradientAccent: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 999,
    top: 20,
    right: 60,
    opacity: 0.08,
  },
  glassContent: {
    padding: HOME_SPACE.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});
