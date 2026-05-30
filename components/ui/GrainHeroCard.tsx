import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export type GrainHeroMetric = {
  label: string;
  value: string;
  subValue?: string;
  valueColor?: string;
};

type Props = {
  solidColor: string;
  icon: string;
  eyebrow: string;
  value: string;
  sym?: string;
  badgeLabel?: string;
  metrics: GrainHeroMetric[];
  palette: AppThemePalette;
};



export function GrainHeroCard({
  solidColor,
  icon,
  eyebrow,
  value,
  sym,
  badgeLabel,
  metrics,
  palette,
}: Props) {
  // Split currency symbol from numeric part for differential opacity rendering
  const dotIdx = value.lastIndexOf('.');
  const intPart = dotIdx !== -1 ? value.slice(0, dotIdx) : value;
  const decPart = dotIdx !== -1 ? value.slice(dotIdx) : '';

  let symbol = '';
  let mainInt = intPart;
  if (sym && intPart.startsWith(sym)) {
    symbol = sym;
    mainInt = intPart.slice(sym.length);
  }

  return (
    <View style={[styles.shell, palette.states.cardSoftShadow]}>
      {/* ── Top: solid colour + grain ── */}
      <View style={[styles.top, { backgroundColor: solidColor }]}>
        {badgeLabel ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}

        <View style={styles.topContent}>
          <View style={[styles.iconTile, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
            <AppIcon name={icon as any} size={20} color="#FFFFFF" strokeWidth={1.9} />
          </View>

          <View style={styles.identityCol}>
            <Text numberOfLines={1} style={styles.eyebrow}>{eyebrow}</Text>
            <View style={styles.valueRow}>
              {symbol ? (
                <Text style={styles.currencyGlyph}>{symbol}</Text>
              ) : null}
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.mainValue}>
                {mainInt}
              </Text>
              {decPart ? (
                <Text style={styles.decValue}>{decPart}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom: metric containers ── */}
      <View style={[styles.bottom, { backgroundColor: palette.card }]}>
        <View style={styles.metricsRow}>
          {metrics.map((m) => (
            <View
              key={m.label}
              style={[
                styles.metricContainer,
                { backgroundColor: palette.states.grainMetricBg }
              ]}
            >
              <Text style={[styles.metricLabel, { color: palette.textMuted }]}>{m.label}</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.metricValue,
                  { color: palette.text },
                  m.valueColor ? { color: m.valueColor } : null
                ]}
              >
                {m.value}
              </Text>
              {m.subValue ? (
                <Text style={[styles.metricSubValue, { color: palette.textMuted }]}>
                  {m.subValue}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: HOME_RADIUS.card,
    overflow: 'hidden',
  },
  // Matches account hero: paddingHorizontal 14, paddingTop 14, paddingBottom 12
  top: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: HOME_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: HOME_TEXT.caption - 1,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Matches account hero icon row: gap 12, alignItems center
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Matches account hero: 42×42, borderRadius chip (12)
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: HOME_RADIUS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
  },
  // Matches account hero label: metaSmall, semibold, 0.75 white, letterSpacing 0.4
  eyebrow: {
    fontSize: HOME_TEXT.metaSmall,
    fontWeight: FONT_WEIGHT.semibold,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Matches account hero currency: sectionTitle (15), medium, 0.75 white, marginRight 3
  currencyGlyph: {
    fontSize: HOME_TEXT.sectionTitle,
    fontWeight: FONT_WEIGHT.medium,
    color: 'rgba(255,255,255,0.75)',
    marginRight: 3,
  },
  // Matches account hero value: heroCardValue (24), medium, -0.5 letterSpacing
  mainValue: {
    fontSize: HOME_TEXT.heroCardValue,
    fontWeight: FONT_WEIGHT.medium,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  // Matches account hero decimal: rowLabel (16), medium, soft alpha
  decValue: {
    fontSize: HOME_TEXT.rowLabel,
    fontWeight: FONT_WEIGHT.medium,
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: -0.2,
  },
  bottom: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricContainer: {
    flex: 1,
    borderRadius: HOME_RADIUS.tab,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: HOME_TEXT.sectionTitle,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: -0.2,
  },
  metricSubValue: {
    fontSize: HOME_TEXT.caption,
    fontWeight: FONT_WEIGHT.regular,
    marginTop: 2,
  },
});
