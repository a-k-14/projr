import { router } from 'expo-router';
import {
  ArrowUpRight,
  BadgeIndianRupee,
  BellRing,
  CircleAlert,
  HandCoins,
  Landmark,
} from 'lucide-react-native';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ActionPill,
  CTAChip,
  GlassCard,
  HeroPulse,
  MetricBlock,
  MiniTrend,
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
        <PrototypeTopBar title="Loan Atlas" kicker="Prototype route" />

        <GlassCard style={styles.heroCard}>
          <HeroPulse />
          <Text style={styles.heroTitle}>A full loan surface, rebuilt from scratch with a softer premium feel.</Text>
          <Text style={styles.heroSub}>
            This stays completely outside the live app flow and carries its own typography, cards, spacing, and form language.
          </Text>

          <View style={styles.metricRow}>
            <MetricBlock label="Receivables" value={formatPrototypeMoney(metrics.receivables)} tone={loanPrototypeTheme.accent} />
            <MetricBlock label="Payables" value={formatPrototypeMoney(metrics.payables)} tone={loanPrototypeTheme.coral} />
          </View>

          <View style={styles.metricRow}>
            <MetricBlock label="Deployed" value={formatPrototypeMoney(metrics.deployed)} />
            <View style={styles.heroInsight}>
              <MiniTrend />
              <Text style={styles.heroInsightText}>Collection rhythm is trending cleaner than the current loan UI.</Text>
            </View>
          </View>

          <View style={styles.pillRow}>
            <ActionPill label="Sleek hero" active />
            <ActionPill label="Standalone cards" />
            <ActionPill label="Custom forms" />
          </View>
        </GlassCard>

        <View style={styles.section}>
          <SectionLabel eyebrow="Overview hero + cards" title="Portfolio snapshot" meta="Fresh, not DS" />
          <View style={styles.grid}>
            <GlassCard style={styles.smallCard}>
              <View style={styles.iconWrap}>
                <Landmark size={18} color={loanPrototypeTheme.accent} />
              </View>
              <Text style={styles.smallTitle}>Live balances</Text>
              <Text style={styles.smallValue}>12 open lanes</Text>
              <Text style={styles.smallMeta}>Optimized for glancing, not dense admin UI.</Text>
            </GlassCard>

            <GlassCard style={styles.smallCard}>
              <View style={[styles.iconWrap, { backgroundColor: '#FFF1E8' }]}>
                <BellRing size={18} color={loanPrototypeTheme.coral} />
              </View>
              <Text style={styles.smallTitle}>Attention queue</Text>
              <Text style={styles.smallValue}>3 due soon</Text>
              <Text style={styles.smallMeta}>Watch states can sit beside healthy open loans cleanly.</Text>
            </GlassCard>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel eyebrow="Loan screen" title="Hero and loan cards" meta={`${prototypeLoans.length} mock records`} />
          <View style={styles.list}>
            {prototypeLoans.map((loan) => {
              const statusTone = getStatusTone(loan.status);
              const direction = getDirectionCopy(loan.direction);

              return (
                <Pressable key={loan.id} onPress={() => router.push(`/loan-prototype/${loan.id}`)}>
                  <GlassCard style={styles.loanCard}>
                    <View style={styles.loanTopRow}>
                      <View style={[styles.avatar, { backgroundColor: `${loan.accent}1A` }]}>
                        <HandCoins size={18} color={loan.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.loanName}>{loan.personName}</Text>
                        <Text style={styles.loanMeta}>
                          {direction.noun} • {loan.accountName} • {loan.city}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
                        <Text style={[styles.statusText, { color: statusTone.fg }]}>{getStatusLabel(loan.status)}</Text>
                      </View>
                    </View>

                    <View style={styles.amountRow}>
                      <View>
                        <Text style={styles.amountLabel}>Outstanding</Text>
                        <Text style={[styles.amountValue, { color: direction.amountTone }]}>{formatPrototypeMoney(loan.pending)}</Text>
                      </View>
                      <View style={styles.rateChip}>
                        <BadgeIndianRupee size={14} color={loanPrototypeTheme.textSoft} />
                        <Text style={styles.rateChipText}>{loan.collectionRate}% settled</Text>
                      </View>
                    </View>

                    <ProgressBar value={loan.collectionRate} color={loan.accent} />

                    <View style={styles.bottomMetaRow}>
                      <Text style={styles.bottomMetaText}>{loan.dueLabel}</Text>
                      <ArrowUpRight size={16} color={loanPrototypeTheme.textSoft} />
                    </View>
                  </GlassCard>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel eyebrow="Forms etc" title="Prototype actions" meta="Entry points" />
          <View style={styles.formStack}>
            <Pressable onPress={() => router.push('/loan-prototype/form?mode=new')}>
              <CTAChip label="New loan form concept" />
            </Pressable>
            <Pressable onPress={() => router.push('/loan-prototype/form?mode=settlement&loanId=maya')}>
              <CTAChip label="Settlement / receipt form concept" />
            </Pressable>
            <Pressable onPress={() => router.push('/loan-prototype/form?mode=edit&loanId=rohan')}>
              <CTAChip label="Edit / restructure loan concept" />
            </Pressable>
          </View>
        </View>

        <GlassCard>
          <View style={styles.footerNoteRow}>
            <CircleAlert size={18} color={loanPrototypeTheme.violet} />
            <Text style={styles.footerNote}>
              This prototype is intentionally self-contained so we can evolve the visual language before wiring any real loan features into it.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </PrototypeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingBottom: 36,
  },
  heroCard: {
    marginBottom: 22,
  },
  heroTitle: {
    marginTop: 16,
    fontFamily: 'Outfit_700Bold',
    fontSize: 34,
    lineHeight: 38,
    color: loanPrototypeTheme.text,
    letterSpacing: -0.8,
  },
  heroSub: {
    marginTop: 12,
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    lineHeight: 22,
    color: loanPrototypeTheme.textSoft,
    maxWidth: '95%',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 18,
    alignItems: 'stretch',
  },
  heroInsight: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    justifyContent: 'space-between',
    minHeight: 92,
  },
  heroInsightText: {
    marginTop: 10,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: loanPrototypeTheme.textSoft,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  section: {
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  smallCard: {
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: loanPrototypeTheme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  smallTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: loanPrototypeTheme.text,
  },
  smallValue: {
    marginTop: 6,
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: loanPrototypeTheme.text,
  },
  smallMeta: {
    marginTop: 8,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: loanPrototypeTheme.textSoft,
  },
  list: { gap: 12 },
  loanCard: {
    marginBottom: 0,
  },
  loanTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: loanPrototypeTheme.text,
  },
  loanMeta: {
    marginTop: 3,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: loanPrototypeTheme.textSoft,
  },
  statusPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
  },
  amountRow: {
    marginTop: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: loanPrototypeTheme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountValue: {
    marginTop: 5,
    fontFamily: 'Outfit_700Bold',
    fontSize: 30,
    letterSpacing: -0.7,
  },
  rateChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateChipText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.textSoft,
  },
  bottomMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomMetaText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: loanPrototypeTheme.textSoft,
  },
  formStack: {
    gap: 10,
  },
  footerNoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  footerNote: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: loanPrototypeTheme.textSoft,
  },
});

