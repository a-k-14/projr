import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronRight, Landmark, NotebookPen, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionPill, GlassCard, PrototypeScreen, PrototypeTopBar, SectionLabel } from '@/components/prototypes/LoanPrototypePrimitives';
import {
  formatPrototypeMoney,
  getPrototypeLoan,
  loanPrototypeTheme,
  type PrototypeFormMode,
  useLoanPrototypeFonts,
} from '@/lib/loanPrototype';

const modeCopy: Record<PrototypeFormMode, { title: string; cta: string }> = {
  new: { title: 'New Loan', cta: 'Create Loan' },
  settlement: { title: 'Record Settlement', cta: 'Save Entry' },
  edit: { title: 'Edit Loan', cta: 'Save Changes' },
};

export default function LoanPrototypeFormScreen() {
  const [fontsLoaded] = useLoanPrototypeFonts();
  const params = useLocalSearchParams<{ mode?: PrototypeFormMode; loanId?: string }>();
  if (!fontsLoaded) return null;

  const mode = params.mode && params.mode in modeCopy ? params.mode : 'new';
  const loan = getPrototypeLoan(params.loanId);
  const copy = modeCopy[mode];
  const amount = mode === 'settlement' ? Math.max(18000, Math.round(loan.pending * 0.24)) : loan.principal;

  return (
    <PrototypeScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PrototypeTopBar title={copy.title} kicker="Prototype Form" />
        <Text style={styles.subtitle}>Simple entry flow with clear field groups and fixed save action</Text>

        <GlassCard style={styles.block}>
          <SectionLabel title="Direction" />
          <View style={styles.rowWrap}>
            <ActionPill label="You lent" active={loan.direction === 'lent'} />
            <ActionPill label="You borrowed" active={loan.direction === 'borrowed'} />
          </View>
          <SectionLabel title="Primary Fields" />
          <FieldRow icon={<UserRound size={16} color={loanPrototypeTheme.textSoft} />} label="Person" value={loan.personName} />
          <FieldRow icon={<Landmark size={16} color={loanPrototypeTheme.textSoft} />} label="Account" value={loan.accountName} />
          <FieldRow icon={<CalendarDays size={16} color={loanPrototypeTheme.textSoft} />} label="Date" value="28 Apr 2026" />
          <FieldRow icon={<NotebookPen size={16} color={loanPrototypeTheme.textSoft} />} label="Loan Type" value={mode === 'settlement' ? 'Principal settlement' : loan.schedule} />
          <SectionLabel title="Amount" />
          <Text style={styles.amountLabel}>{mode === 'settlement' ? 'Settlement Amount' : 'Principal Amount'}</Text>
          <Text style={styles.amountValue}>{formatPrototypeMoney(amount)}</Text>
          <Text style={styles.amountHelp}>
            {mode === 'settlement'
              ? 'For prototype view only. In production this would update outstanding amount rules.'
              : 'Form uses large but practical amount emphasis for quick review before save.'}
          </Text>
          <SectionLabel title="Notes" />
          <Text style={styles.noteText}>
            {mode === 'edit'
              ? 'Requested date shift by 5 days. Keep notification cadence weekly.'
              : 'Add context, reminders, collateral, or repayment instructions here.'}
          </Text>
        </GlassCard>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveText}>{copy.cta}</Text>
          <ChevronRight size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </PrototypeScreen>
  );
}

function FieldRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Pressable style={styles.fieldRow}>
      <View style={styles.fieldIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      <ChevronRight size={16} color={loanPrototypeTheme.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 20 },
  subtitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: loanPrototypeTheme.textSoft, marginTop: 4, marginBottom: 12 },
  block: { marginBottom: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fieldRow: { minHeight: 54, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  fieldIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.84)', borderWidth: 1, borderColor: loanPrototypeTheme.border, alignItems: 'center', justifyContent: 'center',
  },
  fieldLabel: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: loanPrototypeTheme.textFaint },
  fieldValue: { marginTop: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: loanPrototypeTheme.text },
  amountLabel: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: loanPrototypeTheme.textFaint, textTransform: 'uppercase', letterSpacing: 0.7 },
  amountValue: { marginTop: 6, fontFamily: 'Outfit_700Bold', fontSize: 30, color: loanPrototypeTheme.text },
  amountHelp: { marginTop: 6, fontFamily: 'Outfit_500Medium', fontSize: 12.5, lineHeight: 17, color: loanPrototypeTheme.textSoft },
  noteText: { fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20, color: loanPrototypeTheme.textSoft },
  bottomBar: { position: 'absolute', left: 14, right: 14, bottom: 18, flexDirection: 'row', gap: 8 },
  cancelBtn: {
    minWidth: 100, minHeight: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: loanPrototypeTheme.border, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14, color: loanPrototypeTheme.text },
  saveBtn: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: loanPrototypeTheme.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#FFFFFF' },
});
