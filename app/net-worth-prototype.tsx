import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { G, Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { formatCurrency, getLoanSummary, getTotalBalance } from '../lib/derived';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useUIStore } from '../stores/useUIStore';
import { useAppTheme } from '../lib/theme';
import { AppCard, CardTitleRow, CardSubtitleRow } from '../components/ui/AppCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- SLEEK DESIGN TOKENS ---
const SLEEK_DARK = {
  bg: '#050505',
  card: 'rgba(20, 20, 23, 0.65)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  brand: '#00FAD9', 
  asset: '#00FAD9',
  liability: '#FF4D4D', 
  lent: '#8A5CFF', 
  accent: '#FFD600', 
  divider: 'rgba(255, 255, 255, 0.05)',
  glass: 'rgba(255, 255, 255, 0.03)',
  blur: 'dark' as const,
};

const SLEEK_LIGHT = {
  bg: '#F2F2F7',
  card: 'rgba(255, 255, 255, 0.85)',
  cardBorder: 'rgba(0, 0, 0, 0.05)',
  text: '#000000',
  textSecondary: '#3A3A3C',
  textMuted: '#8E8E93',
  brand: '#0D9488', 
  asset: '#0D9488',
  liability: '#E11D48', 
  lent: '#6D28D9', 
  accent: '#D97706', 
  divider: 'rgba(0, 0, 0, 0.05)',
  glass: 'rgba(0, 0, 0, 0.02)',
  blur: 'light' as const,
};

// --- HELPERS ---
function polar(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

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

// --- COMPONENTS ---

function GlassCard({ children, style, theme }: { children: React.ReactNode; style?: any; theme: any }) {
  return (
    <View style={[styles.glassCardWrapper, { backgroundColor: theme.card, borderColor: theme.cardBorder }, style]}>
      <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint={theme.blur} style={styles.glassBlur}>
        <View style={styles.glassInner}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

function DonutChart({ slices, size, strokeWidth, theme }: { slices: { color: string; percent: number }[]; size: number; strokeWidth: number; theme: any }) {
  let angle = 0;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2;
  const inner = size / 2 - strokeWidth;
  const gap = slices.length > 1 ? 1.5 : 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={theme.brand} stopOpacity="0.1" />
            <Stop offset="100%" stopColor={theme.brand} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={outer} fill="url(#glow)" />
        <G>
          {slices.length === 0 ? (
            <Circle cx={cx} cy={cy} r={outer - strokeWidth / 2} stroke={theme.divider} strokeWidth={strokeWidth} fill="none" />
          ) : (
            slices.map((slice, i) => {
              const sliceAngle = slice.percent * 360;
              const start = angle + gap;
              const end = angle + sliceAngle - gap;
              angle += sliceAngle;
              return (
                <Path 
                  key={i} 
                  d={donutPath(cx, cy, outer, inner, start, Math.max(start + 0.1, end))} 
                  fill={slice.color}
                />
              );
            })
          )}
        </G>
      </Svg>
    </View>
  );
}

export default function NetWorthScreen() {
  const { mode, palette } = useAppTheme();
  const SLEEK = mode === 'dark' ? SLEEK_DARK : SLEEK_LIGHT;
  
  const VIBRANT_PALETTE = [
    SLEEK.brand,
    SLEEK.lent,
    mode === 'dark' ? '#3B82F6' : '#2563EB',
    mode === 'dark' ? '#F59E0B' : '#D97706',
    mode === 'dark' ? '#EC4899' : '#DB2777',
    mode === 'dark' ? '#10B981' : '#059669',
  ];
  const getSleekColor = (index: number) => VIBRANT_PALETTE[index % VIBRANT_PALETTE.length];

  const accounts = useAccountsStore((s) => s.accounts);
  const accountsLoaded = useAccountsStore((s) => s.isLoaded);
  const loadAccounts = useAccountsStore((s) => s.load);
  const loans = useLoansStore((s) => s.loans);
  const loansLoaded = useLoansStore((s) => s.isLoaded);
  const loadLoans = useLoansStore((s) => s.load);
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const sym = showCurrencySymbol ? currencySymbol : '';

  const cashBalance = getTotalBalance(accounts);
  const loanSummary = getLoanSummary(loans);
  const netWorth = cashBalance + loanSummary.net;
  const assetTotal = cashBalance + loanSummary.youLent;
  const liabilityTotal = loanSummary.youOwe;

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
    const rawItems = [
      { id: 'cash', label: 'Liquid Assets', icon: 'wallet', amount: cashBalance },
      { id: 'lent', label: 'Receivables', icon: 'arrow-up-right', amount: loanSummary.youLent },
      { id: 'owed', label: 'Liabilities', icon: 'arrow-down-left', amount: -loanSummary.youOwe },
    ].filter(item => Math.abs(item.amount) > 0);
    
    const totalAbs = rawItems.reduce((sum, item) => sum + Math.abs(item.amount), 0) || 1;
    
    return rawItems.map((item, index) => {
      let color = getSleekColor(index);
      if (item.id === 'cash') color = SLEEK.brand;
      if (item.id === 'owed') color = SLEEK.liability;
      if (item.id === 'lent') color = SLEEK.lent;
      
      return { ...item, color, percent: Math.abs(item.amount) / totalAbs };
    });
  }, [cashBalance, loanSummary.youLent, loanSummary.youOwe, SLEEK, getSleekColor]);

  const donutSlices = useMemo(() => {
    const total = assetTotal + liabilityTotal;
    if (total === 0) return [];
    return [
      { id: 'assets', color: SLEEK.brand, percent: assetTotal / total },
      { id: 'liabilities', color: SLEEK.liability, percent: liabilityTotal / total },
    ].filter(s => s.percent > 0);
  }, [assetTotal, liabilityTotal, SLEEK]);


  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: SLEEK.bg }]} edges={['top']}>
      {/* Background Decor */}
      <View style={[styles.bgGlow, { backgroundColor: SLEEK.brand }]} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            router.back();
          }} 
          style={styles.backButton}
        >
          <AppIcon name="chevron-left" size={24} color={SLEEK.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: SLEEK.text }]}>Portfolio</Text>
        <TouchableOpacity style={styles.backButton}>
          <AppIcon name="share-2" size={20} color={SLEEK.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Value Display */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroLabel, { color: SLEEK.textMuted }]}>NET WORTH</Text>
          <Text appWeight="medium" adjustsFontSizeToFit numberOfLines={1} style={[styles.heroValue, { color: SLEEK.text }]}>
            {formatMoney(netWorth)}
          </Text>
          
          <View style={styles.chartContainer}>
            <DonutChart slices={donutSlices} size={160} strokeWidth={16} theme={SLEEK} />
            <View style={styles.donutCenter}>
               <Text style={[styles.donutCenterLabel, { color: SLEEK.textMuted }]}>Ratio</Text>
               <Text style={[styles.donutCenterValue, { color: SLEEK.text }]}>{Math.round((assetTotal / (assetTotal + liabilityTotal || 1)) * 100)}%</Text>
            </View>
          </View>

          <View style={styles.statGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: SLEEK.textMuted }]}>ASSETS</Text>
              <Text style={[styles.statValue, { color: SLEEK.brand }]}>{formatMoney(assetTotal)}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: SLEEK.divider }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: SLEEK.textMuted }]}>LIABILITIES</Text>
              <Text style={[styles.statValue, { color: SLEEK.liability }]}>{formatMoney(liabilityTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: SLEEK.textMuted }]}>Breakdown</Text>
          <GlassCard theme={SLEEK}>
            {composition.map((item, index) => (
              <View key={item.id} style={[styles.compRow, index < composition.length - 1 && { borderBottomWidth: 1, borderBottomColor: SLEEK.divider }]}>
                <View style={[styles.compIconBox, { backgroundColor: SLEEK.glass }]}>
                  <AppIcon name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={styles.compBody}>
                  <View style={styles.compTop}>
                    <Text style={[styles.compLabel, { color: SLEEK.textSecondary }]}>{item.label}</Text>
                    <Text appWeight="medium" style={[styles.compAmount, { color: item.amount < 0 ? SLEEK.liability : SLEEK.text }]}>
                      {formatMoney(item.amount)}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: SLEEK.glass }]}>
                    <View style={[styles.progressFill, { backgroundColor: item.color, width: `${item.percent * 100}%` }]} />
                  </View>
                </View>
              </View>
            ))}
          </GlassCard>
        </View>

        {/* Breakdown (Card Design) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: SLEEK.textMuted }]}>Breakdown (Card Design)</Text>
          <View style={{ gap: 12 }}>
            {composition.map((item) => (
              <AppCard
                key={`card-${item.id}`}
                palette={palette}
                style={{
                  borderRadius: 24,
                  paddingTop: 16,
                  paddingBottom: 16,
                  borderWidth: 1,
                  borderColor: SLEEK.cardBorder,
                  backgroundColor: SLEEK.card,
                }}
                icon={<AppIcon name={item.icon as any} size={22} color={item.color} />}
                iconBg={SLEEK.glass}
                topRow={
                  <CardTitleRow
                    title={item.label}
                    secondary={`${Math.round(item.percent * 100)}%`}
                    amount={formatMoney(item.amount)}
                    palette={palette}
                  />
                }
                bottomRow={
                  <CardSubtitleRow
                    text={item.id === 'cash' ? 'Available' : 'Pending'}
                    rightText={`Ratio`}
                    palette={palette}
                  />
                }
              />
            ))}
          </View>
        </View>

        {/* Monthly Velocity */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: SLEEK.textMuted }]}>Monthly Velocity</Text>
          <GlassCard theme={SLEEK} style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <View>
                <Text style={[styles.statLabel, { color: SLEEK.textMuted }]}>AVG. INCOME</Text>
                <Text style={[styles.statValue, { fontSize: 20, color: SLEEK.brand }]}>+ {sym}42,500</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.statLabel, { color: SLEEK.textMuted }]}>AVG. EXPENSE</Text>
                <Text style={[styles.statValue, { fontSize: 20, color: SLEEK.liability }]}>- {sym}18,200</Text>
              </View>
            </View>
            <View style={[styles.velocityTrack, { backgroundColor: SLEEK.glass }]}>
               <View style={[styles.velocityIn, { flex: 42500, backgroundColor: SLEEK.brand }]} />
               <View style={[styles.velocityOut, { flex: 18200, backgroundColor: SLEEK.liability, borderLeftColor: mode === 'dark' ? '#050505' : '#FFFFFF' }]} />
            </View>
            <Text style={[styles.heroLabel, { marginTop: 12, textAlign: 'center', opacity: 0.5, color: SLEEK.textMuted }]}>64% RETENTION RATE</Text>
          </GlassCard>
        </View>

        {/* Accounts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: SLEEK.textMuted }]}>Accounts</Text>
          <View style={styles.accountGrid}>
            {accounts.map((account) => (
              <TouchableOpacity key={account.id} activeOpacity={0.7} style={{ width: (SCREEN_WIDTH - 40 - 12) / 2 }}>
                <GlassCard theme={SLEEK} style={styles.accountCard}>
                  <View style={styles.accountHeader}>
                    <View style={[styles.smallIconBox, { backgroundColor: SLEEK.glass }]}>
                        <AppIcon name={account.type === 'credit' ? 'credit-card' : 'banknote'} size={14} color={SLEEK.textSecondary} />
                    </View>
                    <Text style={[styles.accountType, { color: SLEEK.textMuted }]}>{account.type.toUpperCase()}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.accountName, { color: SLEEK.textSecondary }]}>{account.name}</Text>
                  <Text appWeight="medium" style={[styles.accountValue, { color: account.balance < 0 ? SLEEK.liability : SLEEK.text }]}>
                    {formatMoney(account.balance)}
                  </Text>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bgGlow: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.03,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20,
    paddingVertical: 16 
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  content: { paddingBottom: 60 },
  
  heroSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  heroValue: { fontSize: 48, fontWeight: '900', letterSpacing: -1.5 },
  
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutCenterLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  donutCenterValue: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  
  statGrid: { flexDirection: 'row', alignItems: 'center', gap: 32, marginTop: 10 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statDivider: { width: 1, height: 24 },
  
  section: { marginTop: 32, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16, textTransform: 'uppercase' },
  
  glassCardWrapper: { 
    borderRadius: 24, 
    borderWidth: 1, 
    overflow: 'hidden',
  },
  glassBlur: { flex: 1 },
  glassInner: { padding: 0 },
  
  compRow: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16 },
  compIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  compBody: { flex: 1, gap: 10 },
  compTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compLabel: { fontSize: 14, fontWeight: '600' },
  compAmount: { fontSize: 16, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  
  velocityTrack: { height: 8, flexDirection: 'row', borderRadius: 4, overflow: 'hidden' },
  velocityIn: { },
  velocityOut: { borderLeftWidth: 2 },

  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  accountCard: { 
    padding: 16,
    gap: 12
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  accountType: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  accountName: { fontSize: 14, fontWeight: '600' },
  accountValue: { fontSize: 18, fontWeight: '700' },
});
