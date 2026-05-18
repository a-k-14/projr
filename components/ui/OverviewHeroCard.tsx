import { Text } from '@/components/ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { CARD_PADDING, FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, PROGRESS } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

type HeroMetric = {
  key: string;
  label: string;
  value: string;
  valueColor?: string;
};

export function OverviewHeroCard({
  palette,
  eyebrow,
  title,
  badgeLabel,
  badgeBg,
  badgeColor,
  badgeBorder,
  metrics,
  progressLabelLeft,
  progressLabelRight,
  progressPercent,
  progressColor,
  progressTrackColor,
  footerLabel,
  footerValue,
  footerValueColor,
  footerNote,
  footerNoteColor,
  decorativeColor,
  gradient = false,
}: {
  palette: AppThemePalette;
  eyebrow: string;
  title: string;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder?: string;
  metrics: HeroMetric[];
  progressLabelLeft?: string;
  progressLabelRight?: string;
  progressPercent?: number;
  progressColor?: string;
  progressTrackColor?: string;
  footerLabel: string;
  footerValue: string;
  footerValueColor: string;
  footerNote?: string;
  footerNoteColor?: string;
  decorativeColor: string;
  gradient?: boolean;
}) {
  const showProgress =
    progressLabelLeft !== undefined &&
    progressLabelRight !== undefined &&
    progressPercent !== undefined &&
    progressColor !== undefined &&
    progressTrackColor !== undefined;
  const clampedPercent = progressPercent !== undefined ? Math.min(Math.max(progressPercent, 0), 100) : 0;

  const eyebrowColor = gradient ? 'rgba(255,255,255,0.65)' : palette.textMuted;
  const titleColor = gradient ? '#FFFFFF' : palette.text;
  const dividerColor = gradient ? 'rgba(255,255,255,0.22)' : palette.divider;
  const metricLabelColor = gradient ? 'rgba(255,255,255,0.65)' : palette.textMuted;
  const progressLabelColor = gradient ? 'rgba(255,255,255,0.65)' : palette.textSecondary;
  const footerLabelColor = gradient ? 'rgba(255,255,255,0.65)' : palette.textMuted;
  const footerNoteResolvedColor = gradient
    ? 'rgba(255,255,255,0.5)'
    : (footerNoteColor ?? palette.textSecondary);

  const gradientColors = palette.isDark
    ? (['#172033', '#0F172A'] as const)
    : ([palette.brand, '#3C4760'] as const);

  const cardBg = gradient ? palette.brand : palette.surface;
  const cardBorder = gradient ? 'rgba(255,255,255,0.12)' : palette.divider;

  const inner = (
    <>
      {!gradient && (
        <>
          <View style={[styles.glowLarge, { backgroundColor: decorativeColor, opacity: palette.isDark ? 0.18 : 0.12 }]} />
          <View style={[styles.glowSmall, { backgroundColor: decorativeColor, opacity: palette.isDark ? 0.1 : 0.07 }]} />
        </>
      )}

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={{ fontSize: HOME_TEXT.caption, color: eyebrowColor, fontWeight: FONT_WEIGHT.regular }}>
            {eyebrow}
          </Text>
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: titleColor, marginTop: HOME_SPACE.xs }}>
            {title}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: badgeBg, borderColor: badgeBorder ?? badgeBg }]}>
          <Text numberOfLines={1} appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.bold, color: badgeColor }}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        {metrics.map((metric, index) => (
          <View key={metric.key} style={[styles.metricBlock, index > 0 ? { marginLeft: HOME_SPACE.md } : null]}>
            {index > 0 ? <View style={[styles.metricDivider, { backgroundColor: dividerColor }]} /> : null}
            <Text appWeight="medium" style={styles.metricLabel(metricLabelColor)}>{metric.label}</Text>
            <Text appWeight="medium" style={styles.metricValue(metric.valueColor ?? (gradient ? '#FFFFFF' : palette.text))}>{metric.value}</Text>
          </View>
        ))}
      </View>

      {showProgress ? (
        <View style={{ marginTop: HOME_SPACE.lg }}>
          <View style={styles.progressRow}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: progressLabelColor }}>{progressLabelLeft}</Text>
            <Text style={{ fontSize: HOME_TEXT.caption, color: progressLabelColor }}>{progressLabelRight}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: progressTrackColor }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${clampedPercent}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={[styles.footerBlock, { marginTop: showProgress ? HOME_SPACE.lg : HOME_SPACE.md }]}>
        <View style={styles.footer}>
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: footerLabelColor }}>
            {footerLabel}
          </Text>
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: footerValueColor }}>
            {footerValue}
          </Text>
        </View>
        {footerNote ? (
          <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: footerNoteResolvedColor, marginTop: 5 }}>
            {footerNote}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (gradient) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <LinearGradient
          pointerEvents="none"
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        {inner}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {inner}
    </View>
  );
}

const styles = {
  card: {
    borderRadius: HOME_RADIUS.card,
    padding: CARD_PADDING,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    borderWidth: 1,
  },
  glowLarge: {
    position: 'absolute' as const,
    width: 200,
    height: 200,
    borderRadius: HOME_RADIUS.full,
    top: -65,
    right: -45,
  },
  glowSmall: {
    position: 'absolute' as const,
    width: 120,
    height: 120,
    borderRadius: HOME_RADIUS.full,
    bottom: -40,
    left: -30,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: HOME_SPACE.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  pill: {
    minHeight: 30,
    borderRadius: HOME_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexShrink: 1,
    maxWidth: 132,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  metrics: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    marginTop: HOME_SPACE.lg,
  },
  metricBlock: {
    flex: 1,
    minWidth: 0,
  },
  metricDivider: {
    position: 'absolute' as const,
    left: -HOME_SPACE.md / 2,
    top: 0,
    bottom: 0,
    width: 1,
  },
  metricLabel: (color: string) => ({
    fontSize: HOME_TEXT.tiny,
    color,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  }),
  metricValue: (color: string) => ({
    fontSize: HOME_TEXT.heroValue,
    lineHeight: 30,
    fontWeight: FONT_WEIGHT.heavy,
    color,
    marginTop: HOME_SPACE.xs + 2,
  }),
  progressRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: HOME_SPACE.xs + 2,
  },
  progressTrack: {
    height: PROGRESS.heroHeight,
    borderRadius: HOME_RADIUS.full,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: PROGRESS.heroHeight,
    borderRadius: HOME_RADIUS.full,
  },
  footerBlock: {
    gap: 0,
  },
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
};
