import { Text } from '@/components/ui/AppText';
import { TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export function StatusPill({
  label,
  color,
  backgroundColor,
  palette,
  onPress,
}: {
  label: string;
  color: string;
  backgroundColor: string;
  palette: AppThemePalette;
  onPress?: () => void;
}) {
  void palette;
  const content = (
    <Text
      style={{
        fontSize: HOME_TEXT.bodySmall,
        fontWeight: FONT_WEIGHT.semibold,
        color,
      }}
    >
      {label}
    </Text>
  );

  const style = {
    paddingHorizontal: HOME_SPACE.md,
    paddingVertical: HOME_SPACE.xs,
    borderRadius: HOME_RADIUS.pill,
    backgroundColor,
  };

  if (onPress) {
    return (
      <TouchableOpacity delayPressIn={0} activeOpacity={0.78} onPress={onPress} style={style}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={style}>{content}</View>;
}
