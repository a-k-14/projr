import { router, useLocalSearchParams } from 'expo-router';
import {
  Bell,
  ChartNoAxesColumn,
  CircleDollarSign,
  FilePenLine,
  ShieldCheck,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GlassCard,
  MetricBlock,
  ProgressBar,
  PrototypeScreen,
  PrototypeTopBar,
  SectionLabel,
} from '@/components/prototypes/LoanPrototypePrimitives';
import {
  formatPrototypeMoney,
  getDirectionCopy,
  getPrototypeLoan,
  getStatusLabel,
  getStatusTone,
  loanPrototypeTheme,
  useLoanPrototypeFonts,
} from '@/lib/loanPrototype';

export default function LoanPrototypeDetailScreen() {
  const [fontsLoaded] = useLoanPrototypeFonts();
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!fontsLoaded) return null;

  const loan = getPrototypeLoan(id);
  const direction = getDirectionCopy(loan.direction);
  const statusTone = getStatusTone(loan.status);

  return (
    <PrototypeScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PrototypeTopBar
          title={loan.personName}
          kicker="Loan detail prototype"
          right={
            <Pressable onPress={() => router.push(`/loan-prototype/form?mode=edit&loanId=${loan.id}`)} style={styles.editButton}>
              <FilePenLine size={16} color={loanPrototypeTheme.text} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          }
        />

        <GlassCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>
                {direction.noun} • {loan.accountName} • {loan.city}
              </Text>
              <Text style={styles.heroValue}>{formatPrototypeMoney(loan.pending)}</Text>
              <Text style={styles.heroCaption}>Outstanding balance</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
              <Text style={[styles.statusText, { color: statusTone.fg }]}>{getStatusLabel(loan.status)}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <MetricBlock label="Principal" value={formatPrototypeMoney(loan.principal)} />
            <MetricBlock label="Settled" value={formatPrototypeMoney(loan.settled)} tone={loanPrototypeTheme.mint} />
            <MetricBlock label="APR" value={loan.apr} />
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Recovery progress</Text>
              <Text style={styles.progressValue}>{loan.collectionRate}%</Text>
            </View>
            <ProgressBar value={loan.collectionRate} color={loan.accent} />
          </View>

          <Text style={styles.note}>{loan.note}</Text>

          <View style={styles.tagRow}>
            {loan.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <View style={styles.section}>
          <SectionLabel eyebrow="Detail hero card" title="Control cards" meta="Detail-only tone" />
          <View style={styles.grid}>
            <GlassCard style={styles.infoCard}>
              <Bell size={18} color={loanPrototypeTheme.coral} />
              <Text style={styles.infoTitle}>Next move</Text>
              <Text style={styles.infoValue}>{loan.dueLabel}</Text>
            </GlassCard>
            <GlassCard style={styles.infoCard}>
              <ShieldCheck size={18} color={loanPrototypeTheme.violet} />
              <Text style={styles.infoTitle}>Trust score</Text>
              <Text style={styles.infoValue}>{loan.trustScore}/100</Text>
            </GlassCard>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel eyebrow="Timeline cards" title="Activity trail" meta={`${loan.timeline.length} entries`} />
          <View style={styles.timeline}>
            {loan.timeline.map((entry) => (
              <GlassCard key={entry.id} style={styles.timelineCard}>
                <View style={styles.timelineTop}>
                  <View style={[styles.timelineIcon, { backgroundColor: `${loan.accent}17` }]}>
                    {entry.kind === 'origin' ? (
                      <CircleDollarSign size={16} color={loan.accent} />
                    ) : entry.kind === 'note' ? (
                      <FilePenLine size={16} color={loanPrototypeTheme.violet} />
                    ) : (
                      <ChartNoAxesColumn size={16} color={loanPrototypeTheme.mint} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{entry.title}</Text>
                    <Text style={styles.timelineSub}>{entry.subtitle}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.timelineAmount}>
                      {entry.amount ? formatPrototypeMoney(entry.amount) : 'Note'}
                    </Text>
                    <Text style={styles.timelineDate}>{entry.date}</Text>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        </View>

        <GlassCard style={styles.ctaPanel}>
          <Text style={styles.ctaTitle}>Prototype form entry points</Text>
          <Text style={styles.ctaSub}>
            The detail screen also carries its own action layout so receipt/payment and edit states can look more premium than the current bottom action bar.
          </Text>
          <View style={styles.ctaRow}>
            <Pressable onPress={() => router.push(`/loan-prototype/form?mode=settlement&loanId=${loan.id}`)} style={[styles.ctaButton, { backgroundColor: loan.accent }]}>
              <Text style={styles.primaryCtaText}>{direction.action}</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/loan-prototype/form?mode=edit&loanId=${loan.id}`)} style={styles.secondaryButton}>
              <Text style={styles.secondaryCtaText}>Open form</Text>
            </Pressable>
          </View>
        </GlassCard>
      </ScrollView>
    </PrototypeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  editButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.text,
  },
  hero: { marginBottom: 22 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroEyebrow: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: {
    marginTop: 10,
    fontFamily: 'Outfit_700Bold',
    fontSize: 40,
    lineHeight: 44,
    color: loanPrototypeTheme.text,
    letterSpacing: -1,
  },
  heroCaption: {
    marginTop: 6,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: loanPrototypeTheme.textSoft,
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  progressWrap: {
    marginTop: 20,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: loanPrototypeTheme.textSoft,
  },
  progressValue: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: loanPrototypeTheme.text,
  },
  note: {
    marginTop: 18,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: loanPrototypeTheme.textSoft,
  },
  tagRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.textSoft,
  },
  section: { marginBottom: 22 },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minHeight: 132,
  },
  infoTitle: {
    marginTop: 16,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: loanPrototypeTheme.text,
  },
  infoValue: {
    marginTop: 8,
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 27,
    color: loanPrototypeTheme.text,
  },
  timeline: { gap: 10 },
  timelineCard: { borderRadius: 22 },
  timelineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: loanPrototypeTheme.text,
  },
  timelineSub: {
    marginTop: 4,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: loanPrototypeTheme.textSoft,
  },
  timelineAmount: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: loanPrototypeTheme.text,
  },
  timelineDate: {
    marginTop: 5,
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: loanPrototypeTheme.textFaint,
  },
  ctaPanel: { marginTop: 4 },
  ctaTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: loanPrototypeTheme.text,
  },
  ctaSub: {
    marginTop: 8,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: loanPrototypeTheme.textSoft,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  ctaButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryButton: {
    minWidth: 110,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.borderStrong,
  },
  secondaryCtaText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: loanPrototypeTheme.text,
  },
});

