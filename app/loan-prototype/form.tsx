import { router, useLocalSearchParams } from 'expo-router';
import {
  CalendarDays,
  CircleDollarSign,
  Landmark,
  NotebookPen,
  UserRound,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ActionPill,
  GlassCard,
  PrototypeScreen,
  PrototypeTopBar,
  SectionLabel,
} from '@/components/prototypes/LoanPrototypePrimitives';
import {
  formatPrototypeMoney,
  getPrototypeLoan,
  loanPrototypeTheme,
  type PrototypeFormMode,
  useLoanPrototypeFonts,
} from '@/lib/loanPrototype';

const modeCopy: Record<PrototypeFormMode, { title: string; eyebrow: string; cta: string }> = {
  new: {
    title: 'New loan form',
    eyebrow: 'Fresh entry',
    cta: 'Create loan',
  },
  settlement: {
    title: 'Receipt / payment form',
    eyebrow: 'Settlement flow',
    cta: 'Save settlement',
  },
  edit: {
    title: 'Edit loan form',
    eyebrow: 'Refine terms',
    cta: 'Save changes',
  },
};

export default function LoanPrototypeFormScreen() {
  const [fontsLoaded] = useLoanPrototypeFonts();
  const params = useLocalSearchParams<{ mode?: PrototypeFormMode; loanId?: string }>();

  if (!fontsLoaded) return null;

  const mode = params.mode && params.mode in modeCopy ? params.mode : 'new';
  const loan = getPrototypeLoan(params.loanId);
  const copy = modeCopy[mode];

  return (
    <PrototypeScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PrototypeTopBar title={copy.title} kicker={copy.eyebrow} />

        <GlassCard style={styles.hero}>
          <Text style={styles.heroTitle}>A calmer, more premium form layout with high-contrast grouping.</Text>
          <Text style={styles.heroSub}>
            Large fields, soft glass panels, and clear section breaks so the loan flows feel intentional instead of inherited from the generic transaction stack.
          </Text>

          <View style={styles.modeRow}>
            <ActionPill label="New" active={mode === 'new'} />
            <ActionPill label="Settlement" active={mode === 'settlement'} />
            <ActionPill label="Edit" active={mode === 'edit'} />
          </View>
        </GlassCard>

        <View style={styles.section}>
          <SectionLabel eyebrow="Direction + amount" title="Primary details" />
          <GlassCard>
            <View style={styles.directionRow}>
              <ActionPill label="You lent" active={mode !== 'settlement' ? loan.direction === 'lent' : loan.direction === 'lent'} />
              <ActionPill label="You borrowed" active={loan.direction === 'borrowed'} />
            </View>

            <View style={styles.bigField}>
              <View style={styles.fieldIcon}>
                <CircleDollarSign size={18} color={loanPrototypeTheme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <Text style={styles.bigFieldValue}>
                  {mode === 'settlement' ? formatPrototypeMoney(Math.max(18000, Math.round(loan.pending * 0.24))) : formatPrototypeMoney(loan.principal)}
                </Text>
                <Text style={styles.fieldHelp}>
                  {mode === 'settlement' ? 'Outstanding balance will update only for principal receipts/payments.' : 'Hero-sized amount input can anchor the form beautifully.'}
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionLabel eyebrow="Core form cards" title="Borrower and routing" />
          <View style={styles.stack}>
            <FormCard
              icon={<UserRound size={18} color={loanPrototypeTheme.violet} />}
              label="Person"
              value={loan.personName}
              help="The person block gets its own card instead of being squeezed into generic rows."
            />
            <FormCard
              icon={<Landmark size={18} color={loanPrototypeTheme.mint} />}
              label="Account"
              value={loan.accountName}
              help="Account selection can stay prominent without feeling operational."
            />
            <FormCard
              icon={<CalendarDays size={18} color={loanPrototypeTheme.coral} />}
              label="Date and cadence"
              value={mode === 'settlement' ? '28 Apr 2026 • Principal receipt' : `28 Apr 2026 • ${loan.schedule}`}
              help="This section can expand into due-date and repayment scheduling controls."
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel eyebrow="Notes and tags" title="Secondary controls" />
          <GlassCard>
            <View style={styles.secondaryField}>
              <View style={styles.fieldIcon}>
                <NotebookPen size={18} color={loanPrototypeTheme.textSoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Private note</Text>
                <Text style={styles.secondaryValue}>
                  {mode === 'edit'
                    ? 'Requested a more legible loan editor with a softer, elevated tone.'
                    : 'Prototype note area for reminders, context, collateral, or repayment intent.'}
                </Text>
              </View>
            </View>

            <View style={styles.tagRow}>
              {['Priority', 'Secured', 'High touch', 'Principal only'].map((item, index) => (
                <ActionPill key={item} label={item} active={index === 0 || (mode === 'settlement' && item === 'Principal only')} />
              ))}
            </View>
          </GlassCard>
        </View>

        <GlassCard style={styles.footer}>
          <Text style={styles.footerTitle}>Prototype submit bar</Text>
          <Text style={styles.footerText}>
            This screen is visual-only for now, but it gives us the full loan form language: large hero amount, distinct section cards, and a cleaner progression from details to notes.
          </Text>
          <View style={styles.footerCtas}>
            <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{copy.cta}</Text>
            </Pressable>
          </View>
        </GlassCard>
      </ScrollView>
    </PrototypeScreen>
  );
}

function FormCard({
  icon,
  label,
  value,
  help,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  help: string;
}) {
  return (
    <GlassCard>
      <View style={styles.formCardRow}>
        <View style={styles.fieldIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{value}</Text>
          <Text style={styles.fieldHelp}>{help}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  hero: { marginBottom: 22 },
  heroTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 30,
    lineHeight: 34,
    color: loanPrototypeTheme.text,
    letterSpacing: -0.7,
  },
  heroSub: {
    marginTop: 10,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: loanPrototypeTheme.textSoft,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  section: { marginBottom: 22 },
  directionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  bigField: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    flexDirection: 'row',
    gap: 12,
  },
  fieldIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(36,87,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bigFieldValue: {
    marginTop: 8,
    fontFamily: 'Outfit_700Bold',
    fontSize: 34,
    lineHeight: 38,
    color: loanPrototypeTheme.text,
    letterSpacing: -0.8,
  },
  fieldValue: {
    marginTop: 6,
    fontFamily: 'Outfit_700Bold',
    fontSize: 21,
    color: loanPrototypeTheme.text,
  },
  fieldHelp: {
    marginTop: 8,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: loanPrototypeTheme.textSoft,
  },
  stack: { gap: 10 },
  formCardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryField: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  secondaryValue: {
    marginTop: 6,
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    lineHeight: 22,
    color: loanPrototypeTheme.text,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  footer: { marginTop: 2 },
  footerTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: loanPrototypeTheme.text,
  },
  footerText: {
    marginTop: 8,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: loanPrototypeTheme.textSoft,
  },
  footerCtas: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    minWidth: 92,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.borderStrong,
  },
  secondaryButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: loanPrototypeTheme.text,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loanPrototypeTheme.text,
  },
  primaryButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
