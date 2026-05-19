import React from 'react';
import { Text } from '@/components/ui/AppText';
import { View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { CARD_PADDING , FONT_WEIGHT} from '../../lib/design';
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
  icon,
  iconBg,
  iconColor,
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
  footerMetrics,
}: {
  palette: AppThemePalette;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
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
  footerMetrics?: { key: string; label: string; value: string; valueColor?: string }[];
}) {
  const showProgress =
    progressLabelLeft !== undefined &&
    progressLabelRight !== undefined &&
    progressPercent !== undefined &&
    progressColor !== undefined &&
    progressTrackColor !== undefined;
  const clampedPercent = progressPercent !== undefined ? Math.min(Math.max(progressPercent, 0), 100) : 0;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.divider }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', position: 'relative' }}>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <AppIcon name={icon as any} size={20} color={iconColor} strokeWidth={1.9} />
          </View>
        ) : null}
        
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {metrics.map((metric, index) => {
            const val = metric.value;
            const dotIdx = val.lastIndexOf('.');
            const hasDot = dotIdx !== -1;
            const intPart = hasDot ? val.slice(0, dotIdx) : val;
            const decPart = hasDot ? val.slice(dotIdx) : '';
            
            // Extract currency symbol if present to render it smaller and match AccountSummaryCard
            let symbol = '';
            let mainVal = intPart;
            const isNegative = intPart.startsWith('-');
            const temp = isNegative ? intPart.slice(1) : intPart;
            if (temp.length > 0 && !/[\d]/.test(temp[0])) {
              const numericIdx = temp.search(/[\d]/);
              if (numericIdx !== -1) {
                symbol = temp.slice(0, numericIdx).trim();
                mainVal = (isNegative ? '-' : '') + temp.slice(numericIdx);
              }
            }

            return (
              <React.Fragment key={metric.key}>
                {index > 0 && <View style={[styles.metricDivider, { backgroundColor: palette.divider }]} />}
                <View style={{ flex: 1, paddingRight: index === metrics.length - 1 ? (badgeLabel ? 48 : 0) : 0 }}>
                  <Text style={styles.metricLabel(palette)}>{metric.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    {symbol ? (
                      <Text style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted, marginRight: 3 }}>
                        {symbol}
                      </Text>
                    ) : null}
                    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValueInt(metric.valueColor ?? palette.text)}>
                      {mainVal}
                    </Text>
                    {decPart ? (
                      <Text style={styles.metricValueDec(palette.textMuted)}>
                        {decPart}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {badgeLabel ? (
          <View style={[styles.pill, { backgroundColor: badgeBg, borderColor: badgeBorder ?? badgeBg }]}>
            <Text numberOfLines={1} appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.bold, color: badgeColor }}>
              {badgeLabel}
            </Text>
          </View>
        ) : null}
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

      {(footerLabel || footerValue || footerMetrics) ? (
        <View style={[styles.footerBlock, { marginTop: footerMetrics ? 18 : (showProgress ? HOME_SPACE.lg : HOME_SPACE.md) }]}>
          {footerMetrics ? (
            <View style={styles.footer}>
              {footerMetrics.map((m, i) => (
                <View key={m.key} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: i === footerMetrics.length - 1 ? 'flex-end' : 'flex-start' }}>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.regular, color: palette.textMuted }}>
                    {m.label}
                  </Text>
                  <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: m.valueColor ?? palette.text }}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.footer}>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.medium, color: palette.textMuted }}>
                {footerLabel}
              </Text>
              <Text appWeight="medium" style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: footerValueColor }}>
                {footerValue}
              </Text>
            </View>
          )}
          {footerNote ? (
            <Text appWeight="medium" style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: footerNoteColor ?? palette.textSecondary, marginTop: 5 }}>
              {footerNote}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = {
  card: {
    borderRadius: HOME_RADIUS.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: HOME_RADIUS.chip,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginRight: 14,
  },
  pill: {
    minHeight: 26,
    borderRadius: HOME_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexShrink: 1,
    maxWidth: 132,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'absolute' as const,
    top: 0,
    right: 0,
  },
  metricDivider: {
    width: 1,
    height: 34,
    marginHorizontal: 14,
  },
  metricLabel: (palette: AppThemePalette) => ({
    fontSize: HOME_TEXT.metaSmall,
    color: palette.textMuted,
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: 4,
  }),
  metricValueInt: (color: string) => ({
    fontSize: HOME_TEXT.heroCardValue,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: -0.5,
    color,
  }),
  metricValueDec: (color: string) => ({
    fontSize: HOME_TEXT.rowLabel,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: -0.2,
    color,
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
