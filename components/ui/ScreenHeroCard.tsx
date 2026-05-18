import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { FONT_WEIGHT, SCREEN_GUTTER } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, PROGRESS } from '../../lib/layoutTokens';
import type { IconName } from './AppIcon';
import type { AppThemePalette } from '../../lib/theme';

export type ScreenHeroMetric = {
  key: string;
  label: string;
  value: string;
  valueColor?: string;
  iconName?: IconName;
};

// Blends the accent colour 48% toward deep navy (#0A0E1A) for the gradient end.
// Blending toward a fixed dark base (vs pure scaling) keeps the hue readable
// while avoiding the old-school "shiny button" look that pure darkening creates.
function gradientEnd(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r1 = parseInt(hex.slice(1, 3), 16);
  const g1 = parseInt(hex.slice(3, 5), 16);
  const b1 = parseInt(hex.slice(5, 7), 16);
  const t = 0.48;
  const r = Math.round(r1 * (1 - t) + 0x0A * t);
  const g = Math.round(g1 * (1 - t) + 0x0E * t);
  const b = Math.round(b1 * (1 - t) + 0x1A * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function ScreenHeroCard({
  palette,
  accentColor,
  icon,
  screenLabel,
  badge,
  eyebrow,
  primaryValue,
  metrics,
  progressPercent,
  progressColor,
  style,
}: {
  palette: AppThemePalette;
  accentColor: string;
  icon: IconName;
  screenLabel: string;
  badge?: { label: string; color?: string; bg?: string };
  eyebrow: string;
  primaryValue: string;
  metrics?: ScreenHeroMetric[];
  progressPercent?: number;
  progressColor?: string;
  style?: object;
}) {
  const darker = gradientEnd(accentColor);
  const hasMetrics = metrics && metrics.length > 0;
  const clampedProgress = progressPercent !== undefined
    ? Math.min(Math.max(progressPercent, 0), 100)
    : 0;

  const badgeBg = badge?.bg ?? 'rgba(255,255,255,0.15)';
  const badgeColor = badge?.color ?? 'rgba(255,255,255,0.88)';

  return (
    <View
      style={[
        {
          borderRadius: HOME_RADIUS.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          ...(!palette.isDark ? {
            elevation: 6,
            shadowColor: '#94A3B8',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.13,
            shadowRadius: 10,
          } : {}),
        },
        style,
      ]}
    >
      {/* ── Colored top section ── */}
      <View style={{ overflow: 'hidden' }}>
        <LinearGradient
          pointerEvents="none"
          colors={[darker, accentColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 16, paddingBottom: hasMetrics ? 16 : 20 }}>
          {/* Row 1: icon + screen label + badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: HOME_RADIUS.chip,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AppIcon name={icon} size={18} color="rgba(255,255,255,0.90)" strokeWidth={1.9} />
              </View>
              <Text style={{ fontSize: HOME_TEXT.metaSmall, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.4 }}>
                {screenLabel}
              </Text>
            </View>

            {badge && (
              <View style={{
                paddingHorizontal: 11,
                paddingVertical: 5,
                borderRadius: HOME_RADIUS.full,
                backgroundColor: badgeBg,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
              }}>
                <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.semibold, color: badgeColor }}>
                  {badge.label}
                </Text>
              </View>
            )}
          </View>

          {/* Row 2: eyebrow + big value */}
          <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.60)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
            {eyebrow}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 28, fontWeight: FONT_WEIGHT.medium, color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 36 }}
          >
            {primaryValue}
          </Text>
        </View>
      </View>

      {/* ── palette.card bottom section (only when metrics provided) ── */}
      {hasMetrics && (
        <View style={{ backgroundColor: palette.card }}>
          {/* Divider */}
          <View style={{ height: 1, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : palette.divider }} />

          <View style={{ flexDirection: 'row' }}>
            {metrics!.map((metric, index) => (
              <View key={metric.key} style={{ flex: 1, flexDirection: 'row' }}>
                {index > 0 && (
                  <View style={{ width: 1, backgroundColor: palette.isDark ? 'rgba(255,255,255,0.08)' : palette.divider }} />
                )}
                <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    {metric.iconName && (
                      <AppIcon name={metric.iconName} size={11} color={palette.textMuted} strokeWidth={2} />
                    )}
                    <Text style={{ fontSize: HOME_TEXT.tiny, fontWeight: FONT_WEIGHT.semibold, color: palette.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                      {metric.label}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.bold, color: metric.valueColor ?? palette.text, letterSpacing: -0.2 }}
                  >
                    {metric.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {progressPercent !== undefined && progressColor && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 13 }}>
              <View style={[{ height: PROGRESS.heroHeight, borderRadius: HOME_RADIUS.full, overflow: 'hidden' }, { backgroundColor: palette.isDark ? 'rgba(255,255,255,0.10)' : palette.divider }]}>
                <View style={{ width: `${clampedProgress}%`, height: PROGRESS.heroHeight, borderRadius: HOME_RADIUS.full, backgroundColor: progressColor }} />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
