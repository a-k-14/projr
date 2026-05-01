import { router } from 'expo-router';
import { ArrowUpRight, HandCoins, Plus, SlidersHorizontal } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ActionPill,
  GlassCard,
  ProgressBar,
  PrototypeScreen,
  PrototypeTopBar,
  SectionLabel,
} from '@/components/prototypes/LoanPrototypePrimitives';
import {
  formatPrototypeMoney,
  getDirectionCopy,
  getPortfolioMetrics,
  getStatusLabel,
  getStatusTone,
  loanPrototypeTheme,
  prototypeLoans,
  useLoanPrototypeFonts,
} from '@/lib/loanPrototype';

export default function LoanPrototypeIndexScreen() {
  const [fontsLoaded] = useLoanPrototypeFonts();
  if (!fontsLoaded) return null;

  const metrics = getPortfolioMetrics();

  return (
    <PrototypeScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PrototypeTopBar title="Loan flow" kicker="Prototype" />
        <Text style={styles.subtitle}>Track balances, repayment progress, and recent loan activity</Text>

        <GlassCard style={styles.panel}>
          <Text style={styles.summaryTitle}>Portfolio Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Receivable</Text>
              <Text style={[styles.metricValue, { color: loanPrototypeTheme.accent }]}>{formatPrototypeMoney(metrics.receivables)}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Payable</Text>
              <Text style={[styles.metricValue, { color: loanPrototypeTheme.coral }]}>{formatPrototypeMoney(metrics.payables)}</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Deployed</Text>
              <Text style={styles.metricValue}>{formatPrototypeMoney(metrics.deployed)}</Text>
            </View>
          </View>
          <View style={styles.controlRow}>
            <ActionPill label="All" active />
            <ActionPill label="Open" />
            <ActionPill label="Lent" />
            <View style={styles.spacer} />
            <Pressable style={styles.iconBtn}>
              <SlidersHorizontal size={16} color={loanPrototypeTheme.text} />
            </Pressable>
          </View>
          <SectionLabel title="Loan Accounts" meta={`${prototypeLoans.length} items`} />
          <View style={styles.list}>
          {prototypeLoans.map((loan) => {
            const statusTone = getStatusTone(loan.status);
            const direction = getDirectionCopy(loan.direction);
            return (
              <Pressable key={loan.id} onPress={() => router.push(`/loan-prototype/${loan.id}`)}>
                <View style={styles.loanRow}>
                  <View style={styles.loanTop}>
                    <View style={[styles.avatar, { backgroundColor: `${loan.accent}1F` }]}>
                      <HandCoins size={17} color={loan.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{loan.personName}</Text>
                      <Text style={styles.meta}>{direction.noun} • {loan.accountName}</Text>
                    </View>
                    <View style={[styles.status, { backgroundColor: statusTone.bg }]}>
                      <Text style={[styles.statusText, { color: statusTone.fg }]}>{getStatusLabel(loan.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.amountRow}>
                    <View>
                      <Text style={styles.metricLabel}>Outstanding</Text>
                      <Text style={[styles.amount, { color: direction.amountTone }]}>{formatPrototypeMoney(loan.pending)}</Text>
                    </View>
                    <Text style={styles.smallMeta}>{loan.collectionRate}% settled</Text>
                  </View>

                  <ProgressBar value={loan.collectionRate} color={loan.accent} />

                  <View style={styles.footRow}>
                    <Text style={styles.smallMeta}>{loan.dueLabel}</Text>
                    <ArrowUpRight size={16} color={loanPrototypeTheme.textSoft} />
                  </View>
                </View>
              </Pressable>
            );
          })}
          </View>
        </GlassCard>
      </ScrollView>

      <View style={styles.fabWrap}>
        <Pressable onPress={() => router.push('/loan-prototype/form?mode=new')} style={styles.fab}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.fabText}>New Loan</Text>
        </Pressable>
      </View>
    </PrototypeScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 96 },
  subtitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: loanPrototypeTheme.textSoft, marginTop: 4, marginBottom: 12 },
  panel: { marginBottom: 12 },
  summaryTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: loanPrototypeTheme.text, marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', gap: 10 },
  metricCell: { flex: 1 },
  metricLabel: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: loanPrototypeTheme.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  metricValue: { marginTop: 4, fontFamily: 'Outfit_700Bold', fontSize: 20, color: loanPrototypeTheme.text },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 10 },
  spacer: { flex: 1 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: loanPrototypeTheme.border, alignItems: 'center', justifyContent: 'center',
  },
  list: { gap: 8 },
  loanRow: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 10, paddingVertical: 10, backgroundColor: loanPrototypeTheme.surface },
  loanTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: loanPrototypeTheme.text },
  meta: { marginTop: 2, fontFamily: 'Outfit_500Medium', fontSize: 12.5, color: loanPrototypeTheme.textSoft },
  status: { borderRadius: 999, paddingHorizontal: 9, minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11.5 },
  amountRow: { marginTop: 10, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amount: { marginTop: 3, fontFamily: 'Outfit_700Bold', fontSize: 24 },
  smallMeta: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: loanPrototypeTheme.textSoft },
  footRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fabWrap: { position: 'absolute', left: 14, right: 14, bottom: 18 },
  fab: { minHeight: 52, borderRadius: 14, backgroundColor: loanPrototypeTheme.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fabText: { fontFamily: 'Outfit_700Bold', fontSize: 15, color: '#FFFFFF' },
});
