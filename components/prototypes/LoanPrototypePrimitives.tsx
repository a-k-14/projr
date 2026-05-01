import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Sparkles,
} from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { loanPrototypeTheme } from '@/lib/loanPrototype';

export function PrototypeScreen({
  children,
  scrollable = true,
}: PropsWithChildren<{ scrollable?: boolean }>) {
  const content = (
    <View style={styles.flex}>
      <Backdrop />
      {children}
    </View>
  );

  if (!scrollable) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: loanPrototypeTheme.bg }]} edges={['top']}>
        {content}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: loanPrototypeTheme.bg }]} edges={['top']}>
      {content}
    </SafeAreaView>
  );
}

function Backdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height={120} style={styles.wave}>
        <Path d="M0 120H900V24C760 10 620 8 480 18C320 29 160 43 0 30Z" fill="rgba(255,255,255,0.35)" />
      </Svg>
    </View>
  );
}

export function PrototypeTopBar({
  title,
  kicker,
  right,
}: {
  title: string;
  kicker: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.iconButton}>
        <ChevronLeft size={20} color={loanPrototypeTheme.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ?? (
        <View style={styles.badge}>
          <Sparkles size={14} color={loanPrototypeTheme.accent} />
          <Text style={styles.badgeText}>Prototype</Text>
        </View>
      )}
    </View>
  );
}

export function GlassCard({
  children,
  style,
}: PropsWithChildren<{ style?: any }>) {
  return (
    <View style={[styles.cardShell, style]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 45 : 90}
        tint={loanPrototypeTheme.blurTint}
        style={styles.blur}
      >
        <View style={styles.cardInner}>{children}</View>
      </BlurView>
    </View>
  );
}

export function SectionLabel({ eyebrow, title, meta }: { eyebrow?: string; title: string; meta?: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

export function ActionPill({
  label,
  active,
  icon,
}: {
  label: string;
  active?: boolean;
  icon?: ReactNode;
}) {
  return (
    <View
      style={[
        styles.pill,
        active && {
          backgroundColor: loanPrototypeTheme.text,
          borderColor: loanPrototypeTheme.text,
        },
      ]}
    >
      {icon}
      <Text style={[styles.pillText, active && { color: '#FFFFFF' }]}>{label}</Text>
    </View>
  );
}

export function MetricBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={styles.metricBlock}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(value, 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function MiniTrend() {
  return (
    <View style={styles.trendShell}>
      <Svg width={88} height={36}>
        <Path
          d="M4 28C14 26 18 20 28 21C39 22 43 10 53 12C63 14 69 26 84 8"
          stroke={loanPrototypeTheme.accent}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export function CTAChip({ label }: { label: string }) {
  return (
    <View style={styles.ctaChip}>
      <HandCoins size={15} color={loanPrototypeTheme.text} />
      <Text style={styles.ctaChipText}>{label}</Text>
      <ChevronRight size={16} color={loanPrototypeTheme.text} />
    </View>
  );
}

export function HeroPulse() {
  return (
    <View style={styles.pulseRow}>
      <View style={styles.pulseDot} />
      <Text style={styles.pulseText}>Fresh standalone visual direction</Text>
      <ArrowUpRight size={14} color={loanPrototypeTheme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
  },
  glowTop: {
    width: 260,
    height: 260,
    top: -36,
    right: -52,
    backgroundColor: 'rgba(73,122,255,0.22)',
  },
  glowMid: {
    width: 210,
    height: 210,
    top: 220,
    left: -80,
    backgroundColor: 'rgba(15,185,168,0.18)',
  },
  glowBottom: {
    width: 240,
    height: 240,
    bottom: 120,
    right: -90,
    backgroundColor: 'rgba(255,122,89,0.14)',
  },
  wave: {
    position: 'absolute',
    top: 64,
    opacity: 0.42,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loanPrototypeTheme.surface,
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
  },
  kicker: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 34,
    color: loanPrototypeTheme.text,
    letterSpacing: -0.4,
  },
  badge: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: loanPrototypeTheme.surface,
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
  },
  badgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.text,
  },
  cardShell: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: loanPrototypeTheme.card,
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    shadowColor: loanPrototypeTheme.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  blur: { borderRadius: 30 },
  cardInner: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: loanPrototypeTheme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 21,
    color: loanPrototypeTheme.text,
  },
  sectionMeta: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: loanPrototypeTheme.textSoft,
  },
  pill: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: loanPrototypeTheme.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pillText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: loanPrototypeTheme.text,
  },
  metricBlock: { flex: 1, gap: 6 },
  metricLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: loanPrototypeTheme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricValue: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: loanPrototypeTheme.text,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: loanPrototypeTheme.track,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  trendShell: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
    alignSelf: 'flex-start',
  },
  ctaChip: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaChipText: {
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: loanPrototypeTheme.text,
  },
  pulseRow: {
    minHeight: 36,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: loanPrototypeTheme.border,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: loanPrototypeTheme.accent,
  },
  pulseText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: loanPrototypeTheme.textSoft,
  },
});
