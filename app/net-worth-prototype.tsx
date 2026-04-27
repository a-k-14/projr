import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../lib/derived';
import { HOME_TEXT, SCREEN_GUTTER, SPACING, RADIUS } from '../lib/design';
import { useAppTheme } from '../lib/theme';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useUIStore } from '../stores/useUIStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper for polar coordinates
function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// Helper for SVG donut path
function donutPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number) {
  const safeEnd = end - start >= 359.9 ? start + 359.9 : end;
  const large = safeEnd - start > 180 ? 1 : 0;
  const p1 = polar(cx, cy, outer, start);
  const p2 = polar(cx, cy, outer, safeEnd);
  const p3 = polar(cx, cy, inner, safeEnd);
  const p4 = polar(cx, cy, inner, start);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

export default function NetWorthScreen() {
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

  const formatMoney = (value: number, floor = false) => {
    const abs = Math.abs(value);
    const val = floor ? Math.floor(abs) : Math.round(abs);
    return `${value < 0 ? '-' : ''}${sym}${val.toLocaleString('en-IN')}`;
  };

  const composition = useMemo(() => {
    const items = [
      { id: 'cash', label: 'Cash Balance', icon: 'wallet', color: palette.brand, amount: cashBalance },
      { id: 'lent', label: 'Money Lent', icon: 'arrow-up-right', color: '#8B5CF6', amount: loanSummary.youLent },
      { id: 'owed', label: 'Money Owed', icon: 'arrow-down-left', color: palette.negative, amount: -loanSummary.youOwe },
    ].filter(item => Math.abs(item.amount) > 0);
    
    const totalPos = items.reduce((sum, item) => sum + Math.abs(item.amount), 0) || 1;
    return items.map(item => ({ ...item, percent: Math.abs(item.amount) / totalPos }));
  }, [cashBalance, loanSummary.youLent, loanSummary.youOwe, palette]);

  const donutSlices = useMemo(() => {
    const total = assetTotal + liabilityTotal;
    if (total === 0) return [];
    return [
      { id: 'assets', color: palette.brand, percent: assetTotal / total },
      { id: 'liabilities', color: palette.negative, percent: liabilityTotal / total },
    ].filter(s => s.percent > 0);
  }, [assetTotal, liabilityTotal, palette]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={15}>
          <AppIcon name="chevron-left" size={26} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>Net Worth</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Value Display */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroLabel, { color: palette.textSecondary }]}>YOUR TOTAL POSITION</Text>
          <Text appWeight="medium" adjustsFontSizeToFit numberOfLines={1} style={[styles.heroValue, { color: palette.text }]}>
            {formatMoney(netWorth)}
          </Text>
          
          <View style={styles.chartContainer}>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.brand }]} />
                <View>
                  <Text style={[styles.legendLabel, { color: palette.textMuted }]}>Assets</Text>
                  <Text appWeight="medium" style={[styles.legendValue, { color: palette.text }]}>{formatMoney(assetTotal)}</Text>
                </View>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.negative }]} />
                <View>
                  <Text style={[styles.legendLabel, { color: palette.textMuted }]}>Liabilities</Text>
                  <Text appWeight="medium" style={[styles.legendValue, { color: palette.text }]}>{formatMoney(liabilityTotal)}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.donutWrapper}>
              <DonutChart slices={donutSlices} palette={palette} size={120} strokeWidth={14} />
              <View style={styles.donutCenter}>
                 <AppIcon name="pie-chart" size={24} color={palette.textMuted} />
              </View>
            </View>
          </View>
        </View>

        {/* Portfolio Composition */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
             <Text style={[styles.sectionTitle, { color: palette.text }]}>Structure</Text>
          </View>
          
          <View style={[styles.compCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
            {composition.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ color: palette.textSoft, fontSize: 14 }}>No data available yet.</Text>
              </View>
            ) : (
              composition.map((item, index) => (
                <View key={item.id} style={[styles.compRow, index < composition.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.divider }]}>
                  <View style={[styles.compIconBox, { backgroundColor: palette.background }]}>
                    <AppIcon name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <View style={styles.compBody}>
                    <View style={styles.compTop}>
                      <Text style={[styles.compLabel, { color: palette.textSecondary }]}>{item.label}</Text>
                      <Text appWeight="medium" style={[styles.compAmount, { color: item.amount < 0 ? palette.negative : palette.text }]}>
                        {formatMoney(item.amount)}
                      </Text>
                    </View>
                    <View style={styles.progressBarWrapper}>
                      <View style={[styles.progressTrack, { backgroundColor: palette.divider }]}>
                        <View style={[styles.progressFill, { backgroundColor: item.color, width: `${item.percent * 100}%` }]} />
                      </View>
                      <Text style={[styles.progressPercent, { color: palette.textMuted }]}>{Math.round(item.percent * 100)}%</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Account Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Individual Accounts</Text>
            <View style={[styles.badge, { backgroundColor: palette.inputBg }]}>
              <Text style={[styles.badgeText, { color: palette.textMuted }]}>{accountRows.length}</Text>
            </View>
          </View>

          <View style={styles.accountGrid}>
            {accountRows.map((account) => (
              <TouchableOpacity 
                key={account.id} 
                activeOpacity={0.7}
                style={[styles.accountCard, { backgroundColor: palette.surface, borderColor: palette.divider }]}
              >
                <View style={styles.accountHeader}>
                   <View style={[styles.smallIconBox, { backgroundColor: palette.background }]}>
                      <AppIcon name={account.type === 'credit' ? 'credit-card' : 'hash'} size={14} color={palette.iconTint} />
                   </View>
                   <Text style={[styles.accountType, { color: palette.textMuted }]}>{account.type.toUpperCase()}</Text>
                </View>
                <Text numberOfLines={1} style={[styles.accountName, { color: palette.text }]}>{account.name}</Text>
                <Text appWeight="medium" style={[styles.accountValue, { color: account.balance < 0 ? palette.negative : palette.text }]}>
                  {formatMoney(account.balance)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function DonutChart({ slices, palette, size, strokeWidth }: { slices: { color: string; percent: number }[]; palette: any; size: number; strokeWidth: number }) {
  let angle = 0;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2;
  const inner = size / 2 - strokeWidth;
  const gap = slices.length > 1 ? 2 : 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {slices.length === 0 ? (
          <Circle cx={cx} cy={cy} r={outer - strokeWidth / 2} stroke={palette.divider} strokeWidth={strokeWidth} fill="none" />
        ) : (
          slices.map((slice, i) => {
            const sliceAngle = slice.percent * 360;
            const start = angle + gap;
            const end = angle + sliceAngle - gap;
            angle += sliceAngle;
            return (
              <Path key={i} d={donutPath(cx, cy, outer, inner, start, Math.max(start + 0.1, end))} fill={slice.color} />
            );
          })
        )}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    paddingVertical: 12 
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  content: { paddingBottom: 40 },
  
  heroSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  heroLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  heroValue: { fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    width: '100%',
    gap: 40
  },
  chartLegend: { gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontWeight: '600' },
  legendValue: { fontSize: 15, fontWeight: '700' },
  
  donutWrapper: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  
  section: { marginTop: 32, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  
  compCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  compRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  compIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  compBody: { flex: 1, gap: 8 },
  compTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compLabel: { fontSize: 13, fontWeight: '600' },
  compAmount: { fontSize: 16, fontWeight: '700' },
  progressBarWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressPercent: { fontSize: 11, fontWeight: '800', width: 30 },
  emptyState: { padding: 40, alignItems: 'center' },
  
  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  accountCard: { 
    width: (SCREEN_WIDTH - 32 - 12) / 2, 
    borderRadius: 20, 
    borderWidth: 1, 
    padding: 16,
    gap: 12
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  accountType: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  accountName: { fontSize: 14, fontWeight: '600' },
  accountValue: { fontSize: 18, fontWeight: '700' },
});
