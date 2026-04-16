import { Text, View } from 'react-native';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT, PROGRESS } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

type MetricItem = {
  key: string;
  label: string;
  value: string;
  valueColor?: string;
};

export function MetricProgressCard({
  palette,
  metrics,
  progressPercent,
  progressColor,
  progressLabelLeft,
  progressLabelRight,
  footerLeft,
  footerRight,
}: {
  palette: AppThemePalette;
  metrics: MetricItem[];
  progressPercent: number;
  progressColor: string;
  progressLabelLeft: string;
  progressLabelRight: string;
  footerLeft: { text: string; color?: string };
  footerRight: { text: string; color?: string };
}) {
  const clampedPercent = Math.min(Math.max(progressPercent, 0), 100);

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: HOME_RADIUS.card,
        padding: HOME_SPACE.xl,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        {metrics.map((item, index) => (
          <View
            key={item.key}
            style={{
              flex: 1,
              alignItems: 'center',
              borderRightWidth: index < metrics.length - 1 ? 1 : 0,
              borderRightColor: palette.inputBg,
            }}
          >
            <Text
              style={{
                fontSize: HOME_TEXT.tiny,
                color: palette.textMuted,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              {item.label}
            </Text>
            <Text
              style={{
                fontSize: HOME_TEXT.heroLabel,
                fontWeight: '700',
                color: item.valueColor ?? palette.text,
                marginTop: HOME_SPACE.xs,
              }}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: HOME_SPACE.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: HOME_SPACE.xs }}>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{progressLabelLeft}</Text>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>{progressLabelRight}</Text>
        </View>
        <View
          style={{
            height: PROGRESS.cardHeight,
            backgroundColor: palette.divider,
            borderRadius: PROGRESS.radius,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: PROGRESS.cardHeight,
              width: `${clampedPercent}%`,
              backgroundColor: progressColor,
              borderRadius: PROGRESS.radius,
            }}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: footerLeft.color ?? palette.textSecondary }}>
          {footerLeft.text}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: footerRight.color ?? palette.textSecondary }}>
          {footerRight.text}
        </Text>
      </View>
    </View>
  );
}
