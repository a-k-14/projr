import { Text } from '@/components/ui/AppText';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../lib/derived';
import { CARD_PADDING, HOME_TEXT, SCREEN_GUTTER, SPACING } from '../lib/design';
import { AppThemePalette, useAppTheme } from '../lib/theme';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useUIStore } from '../stores/useUIStore';

export default function NetWorthPrototypeScreen() {
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const loadAccounts = useAccountsStore((s) => s.load);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';
  const { palette } = useAppTheme();

  const cashBalance = getTotalBalance(accounts);
  const loanSummary = getLoanSummary(loans);
  const netWorth = cashBalance + loanSummary.net;
  const assetTotal = cashBalance + loanSummary.youLent;
  const liabilityTotal = loanSummary.youOwe;
  const accountRows = accounts.slice().sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

  useEffect(() => {
    if (!accountsLoaded) loadAccounts().catch(() => undefined);
    if (!loansLoaded) loadLoans().catch(() => undefined);
  }, [accountsLoaded, loadAccounts, loansLoaded, loadLoans]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 10 }}>
          <TouchableOpacity
            delayPressIn={0}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}
          >
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </TouchableOpacity>
          <Text appWeight="medium" style={{ flex: 1, fontSize: 22, fontWeight: '700', color: palette.text }}>
            Net Worth
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER, paddingBottom: 28, gap: SPACING.md }}
      >
        <View
          style={{
            backgroundColor: palette.surfaceRaised,
            borderRadius: 24,
            padding: 22,
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.isDark ? palette.textMuted : '#C7CEDB', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Total position
              </Text>
              <Text
                appWeight="medium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ marginTop: 8, fontSize: 34, lineHeight: 40, color: '#FFFFFF', fontWeight: '800' }}
              >
                {formatSignedCurrency(netWorth, sym)}
              </Text>
            </View>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="analytics-outline" size={24} color="#FFFFFF" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <HeroMetric label="Assets" value={assetTotal} color={palette.brand} sym={sym} palette={palette} />
            <HeroMetric label="Liabilities" value={liabilityTotal} color={palette.negative} sym={sym} palette={palette} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: SPACING.md }}>
          <PositionCard label="Cash balance" value={cashBalance} icon="wallet-outline" tone="neutral" sym={sym} palette={palette} />
          <PositionCard label="Loans net" value={loanSummary.net} icon="people-outline" tone={loanSummary.net >= 0 ? 'positive' : 'negative'} sym={sym} palette={palette} />
        </View>

        <View style={{ backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
          <SectionHeader title="Composition" palette={palette} />
          <CompositionRow label="Accounts" value={cashBalance} detail={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`} palette={palette} sym={sym} />
          <CompositionRow label="Money lent" value={loanSummary.youLent} detail="Receivable" palette={palette} sym={sym} />
          <CompositionRow label="Money owed" value={-loanSummary.youOwe} detail="Payable" palette={palette} sym={sym} last />
        </View>

        <View style={{ backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.divider, overflow: 'hidden' }}>
          <SectionHeader title="Accounts" palette={palette} />
          {accountRows.length === 0 ? (
            <Text style={{ padding: CARD_PADDING, color: palette.textMuted, fontSize: HOME_TEXT.body }}>No accounts yet.</Text>
          ) : (
            accountRows.map((account, index) => (
              <CompositionRow
                key={account.id}
                label={account.name}
                value={account.balance}
                detail={account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                palette={palette}
                sym={sym}
                last={index === accountRows.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function HeroMetric({ label, value, color, sym, palette }: { label: string; value: number; color: string; sym: string; palette: AppThemePalette }) {
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 16, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)', padding: 14 }}>
      <Text style={{ fontSize: HOME_TEXT.caption, color: palette.isDark ? palette.textMuted : '#D7DDE8', fontWeight: '700' }}>{label}</Text>
      <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 5, fontSize: HOME_TEXT.rowLabel, color, fontWeight: '800' }}>
        {formatSignedCurrency(value, sym)}
      </Text>
    </View>
  );
}

function PositionCard({ label, value, icon, tone, sym, palette }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone: 'neutral' | 'positive' | 'negative'; sym: string; palette: AppThemePalette }) {
  const color = tone === 'positive' ? palette.brand : tone === 'negative' ? palette.negative : palette.text;
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: palette.surface, borderRadius: 18, borderWidth: 1, borderColor: palette.divider, padding: CARD_PADDING }}>
      <Ionicons name={icon} size={19} color={color} />
      <Text style={{ marginTop: 12, fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: '700' }}>{label}</Text>
      <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 5, fontSize: HOME_TEXT.rowLabel, color, fontWeight: '800' }}>
        {formatSignedCurrency(value, sym)}
      </Text>
    </View>
  );
}

function SectionHeader({ title, palette }: { title: string; palette: AppThemePalette }) {
  return (
    <View style={{ paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}>
      <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, color: palette.text, fontWeight: '700' }}>{title}</Text>
    </View>
  );
}

function CompositionRow({ label, detail, value, palette, sym, last }: { label: string; detail: string; value: number; palette: AppThemePalette; sym: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: palette.divider, gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.text, fontWeight: '600' }}>{label}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{detail}</Text>
      </View>
      <Text appWeight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: '42%', fontSize: HOME_TEXT.sectionTitle, color: value >= 0 ? palette.text : palette.negative, fontWeight: '700', textAlign: 'right' }}>
        {formatSignedCurrency(value, sym)}
      </Text>
    </View>
  );
}

function formatSignedCurrency(value: number, sym: string) {
  return `${value < 0 ? '-' : ''}${formatCurrency(Math.abs(value), sym)}`;
}
