import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, FilePenLine, Landmark, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GlassCard,
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
        <PrototypeTopBar title={loan.personName} kicker="Loan Detail" />
        <Text style={styles.subtitle}>Overview, terms, and timeline entries</Text>

        <GlassCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.kicker}>{direction.noun}</Text>
              <Text style={styles.amount}>{formatPrototypeMoney(loan.pending)}</Text>
              <Text style={styles.caption}>Pending amount</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
              <Text style={[styles.statusText, { color: statusTone.fg }]}>{getStatusLabel(loan.status)}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <MetricItem label="Principal" value={formatPrototypeMoney(loan.principal)} />
            <MetricItem label="Settled" value={formatPrototypeMoney(loan.settled)} />
            <MetricItem label="APR" value={loan.apr} />
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>Completion</Text>
              <Text style={styles.progressLabel}>{loan.collectionRate}%</Text>
            </View>
            <ProgressBar value={loan.collectionRate} color={loan.accent} />
          </View>
        </GlassCard>

        <SectionLabel title="Loan Information" />
        <GlassCard style={styles.infoCard}>
          <InfoRow icon={<UserRound size={16} color={loanPrototypeTheme.textSoft} />} label="Person" value={loan.personName} />
          <InfoRow icon={<Landmark size={16} color={loanPrototypeTheme.textSoft} />} label="Account" value={loan.accountName} />
          <InfoRow icon={<CalendarClock size={16} color={loanPrototypeTheme.textSoft} />} label="Repayment schedule" value={loan.schedule} />
          <Text style={styles.note}>{loan.note}</Text>
        </GlassCard>

        <SectionLabel title="Recent Activity" meta={`${loan.timeline.length}`} />
        <View style={{ gap: 8, paddingBottom: 86 }}>
          {loan.timeline.map((entry) => (
            <View key={entry.id} style={styles.txCard}>
              <View style={styles.txTop}>
                <View>
                  <Text style={styles.txTitle}>{entry.title}</Text>
                  <Text style={styles.txSub}>{entry.subtitle}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.txAmount}>{entry.amount ? formatPrototypeMoney(entry.amount) : 'Note'}</Text>
                  <Text style={styles.txSub}>{entry.date}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <Pressable onPress={() => router.push(`/loan-prototype/form?mode=settlement&loanId=${loan.id}`)} style={[styles.primaryBtn, { backgroundColor: loan.accent }]}>
          <Text style={styles.primaryBtnText}>{direction.action}</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/loan-prototype/form?mode=edit&loanId=${loan.id}`)} style={styles.secondaryBtn}>
          <FilePenLine size={16} color={loanPrototypeTheme.text} />
          <Text style={styles.secondaryBtnText}>Edit</Text>
        </Pressable>
      </View>
    </PrototypeScreen>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 20 },
  subtitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: loanPrototypeTheme.textSoft, marginTop: 4, marginBottom: 12 },
  hero: { marginBottom: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kicker: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: loanPrototypeTheme.textSoft },
  amount: { marginTop: 4, fontFamily: 'Outfit_700Bold', fontSize: 32, color: loanPrototypeTheme.text },
  caption: { marginTop: 2, fontFamily: 'Outfit_500Medium', fontSize: 12, color: loanPrototypeTheme.textSoft },
  statusPill: { minHeight: 26, borderRadius: 999, paddingHorizontal: 10, justifyContent: 'center' },
  statusText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11.5 },
  summaryRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  metricLabel: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: loanPrototypeTheme.textFaint, textTransform: 'uppercase', letterSpacing: 0.7 },
  metricValue: { marginTop: 2, fontFamily: 'Outfit_700Bold', fontSize: 16, color: loanPrototypeTheme.text },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: loanPrototypeTheme.textSoft },
  infoCard: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: loanPrototypeTheme.border, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: loanPrototypeTheme.textFaint },
  infoValue: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: loanPrototypeTheme.text },
  note: { marginTop: 4, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18, color: loanPrototypeTheme.textSoft },
  txCard: { borderRadius: 14, borderWidth: 1, borderColor: loanPrototypeTheme.border, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: loanPrototypeTheme.surface },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: loanPrototypeTheme.text },
  txSub: { marginTop: 2, fontFamily: 'Outfit_500Medium', fontSize: 12, color: loanPrototypeTheme.textSoft },
  txAmount: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: loanPrototypeTheme.text },
  bottomActions: { position: 'absolute', left: 14, right: 14, bottom: 18, flexDirection: 'row', gap: 8 },
  primaryBtn: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFFFFF' },
  secondaryBtn: {
    minWidth: 96, minHeight: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: loanPrototypeTheme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  secondaryBtnText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: loanPrototypeTheme.text },
});
