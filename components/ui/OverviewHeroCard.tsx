import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { CARD_PADDING } from '../../lib/design';
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
  metrics,
  progressLabelLeft,
  progressLabelRight,
  progressPercent,
  progressColor,
  progressTrackColor,
  footerLabel,
  footerValue,
  footerValueColor,
  decorativeColor,
}: {
  palette: AppThemePalette;
  eyebrow: string;
  title: string;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  metrics: HeroMetric[];
  progressLabelLeft?: string;
  progressLabelRight?: string;
  progressPercent?: number;
  progressColor?: string;
  progressTrackColor?: string;
  footerLabel: string;
  footerValue: string;
  footerValueColor: string;
  decorativeColor: string;
}) {
  const showProgress =
    progressLabelLeft !== undefined &&
    progressLabelRight !== undefined &&
    progressPercent !== undefined &&
    progressColor !== undefined &&
    progressTrackColor !== undefined;
  const clampedPercent = progressPercent !== undefined ? Math.min(Math.max(progressPercent, 0), 100) : 0;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.divider }]}>
      <View style={[styles.glowLarge, { backgroundColor: decorativeColor }]} />
      <View style={[styles.glowSmall, { backgroundColor: decorativeColor }]} />

      <View style={styles.header}>
        <View>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: '400' }}>
            {eyebrow}
          </Text>
          <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: '700', color: palette.text, marginTop: HOME_SPACE.xs }}>
            {title}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: badgeBg }]}>
          <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: '700', color: badgeColor }}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        {metrics.map((metric, index) => (
          <View key={metric.key} style={[styles.metricBlock, index > 0 ? { marginLeft: HOME_SPACE.md } : null]}>
            {index > 0 ? <View style={[styles.metricDivider, { backgroundColor: palette.divider }]} /> : null}
            <Text style={styles.metricLabel(palette)}>{metric.label}</Text>
            <Text style={styles.metricValue(metric.valueColor ?? palette.text)}>{metric.value}</Text>
          </View>
        ))}
      </View>

      {showProgress ? (
        <View style={{ marginTop: HOME_SPACE.lg }}>
          <View style={styles.progressRow}>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>{progressLabelLeft}</Text>
            <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary }}>{progressLabelRight}</Text>
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

      <View style={[styles.footer, { marginTop: showProgress ? HOME_SPACE.lg : HOME_SPACE.md }]}>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: palette.textMuted }}>
          {footerLabel}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '500', color: footerValueColor }}>
          {footerValue}
        </Text>
      </View>
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
    width: 140,
    height: 140,
    borderRadius: 999,
    top: -42,
    right: -34,
    opacity: 0.24,
  },
  glowSmall: {
    position: 'absolute' as const,
    width: 76,
    height: 76,
    borderRadius: 999,
    bottom: -22,
    right: 28,
    opacity: 0.12,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: HOME_SPACE.md,
  },
  pill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
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
  metricLabel: (palette: AppThemePalette) => ({
    fontSize: HOME_TEXT.tiny,
    color: palette.textMuted,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  }),
  metricValue: (color: string) => ({
    fontSize: HOME_TEXT.heroValue,
    lineHeight: 30,
    fontWeight: '800' as const,
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
    borderRadius: 999,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: PROGRESS.heroHeight,
    borderRadius: 999,
  },
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
};
