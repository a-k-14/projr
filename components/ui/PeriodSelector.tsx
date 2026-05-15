import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight, FadeOutRight, LinearTransition } from 'react-native-reanimated';
import { Text } from '@/components/ui/AppText';
import { SegmentedPillSwitch } from '@/components/ui/SegmentedPillSwitch';
import { FONT_WEIGHT } from '@/lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_TEXT } from '@/lib/layoutTokens';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PeriodSelector({
  period,
  from,
  to,
  onPeriodChange,
  onOpenCustomRange,
  theme,
  options,
}: {
  period: string;
  from: string;
  to: string;
  onPeriodChange: (next: string) => void;
  onOpenCustomRange: () => void;
  theme: { surface: string; border: string; text: string; textMuted?: string; muted: string };
  options: { key: string; label: string }[];
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
        pillColor="#FFFFFF"
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
        <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: theme.text }}></Text>
        <Animated.View layout={LinearTransition.springify().damping(30).stiffness(200).mass(0.8)} style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 1 }}>
          <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: theme.textMuted ?? theme.muted }}>
            {formatDate(from)}
          </Text>
          {period !== 'today' && (
            <Animated.View 
              entering={FadeInRight.duration(200)} 
              exiting={FadeOutRight.duration(200)} 
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text appWeight="medium" numberOfLines={1} style={{ fontSize: HOME_TEXT.caption, color: theme.textMuted ?? theme.muted }}>
                {` - ${formatDate(to)}`}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
