import { View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight, LinearTransition } from 'react-native-reanimated';
import { Text } from '@/components/ui/AppText';
import { SegmentedPillSwitch } from '@/components/ui/SegmentedPillSwitch';
import { HOME_LAYOUT, HOME_RADIUS, HOME_TEXT } from '@/lib/layoutTokens';

import { formatDateFull } from '../../lib/ui-format';

export function PeriodSelector({
  period,
  from,
  to,
  onPeriodChange,
  onOpenCustomRange,
  theme,
  options,
  leftLabel,
  rightLabel,
}: {
  period: string;
  from: string;
  to: string;
  onPeriodChange: (next: string) => void;
  onOpenCustomRange: () => void;
  theme: { surface: string; border: string; text: string; textMuted?: string; muted: string; inputBg?: string };
  options: { key: string; label: string }[];
  /** Optional caption shown on the left side (rarely used now). */
  leftLabel?: string;
  /** When provided, replaces the default `dd mmm yyyy - dd mmm yyyy` on the right side. */
  rightLabel?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <SegmentedPillSwitch
        options={options}
        value={period}
        onChange={(next) => {
          if (next === 'custom') {
            onOpenCustomRange();
            return;
          }
          onPeriodChange(next);
        }}
        backgroundColor={theme.surface}
        pillColor={theme.inputBg ?? '#FFFFFF'}
        borderColor={theme.border}
        activeTextColor={theme.text}
        inactiveTextColor={theme.textMuted ?? theme.muted}
        style={{ alignSelf: 'stretch' }}
        itemMinWidth={58}
        height={HOME_LAYOUT.periodHeight}
        radius={HOME_RADIUS.tab + 3}
        fontSize={HOME_TEXT.caption}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
          {leftLabel ? (
            <Animated.View
              entering={FadeInLeft.duration(200)}
              exiting={FadeOutLeft.duration(200)}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: theme.textMuted ?? theme.muted }}>
                {leftLabel}
              </Text>
            </Animated.View>
          ) : null}
        </View>
        <Animated.View layout={LinearTransition.springify().damping(30).stiffness(200).mass(0.8)} style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 1 }}>
          {rightLabel ? (
            <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: theme.textMuted ?? theme.muted }}>
              {rightLabel}
            </Text>
          ) : (
            <>
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: theme.textMuted ?? theme.muted }}>
                {formatDateFull(from)}
              </Text>
              {period !== 'today' && (
                <Animated.View
                  entering={FadeInRight.duration(200)}
                  exiting={FadeOutRight.duration(200)}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: theme.textMuted ?? theme.muted }}>
                    {` - ${formatDateFull(to)}`}
                  </Text>
                </Animated.View>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
