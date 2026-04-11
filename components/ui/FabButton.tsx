import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOME_RADIUS, HOME_SHADOW, HOME_LAYOUT } from '../../lib/homeTokens';
import type { AppThemePalette } from '../../lib/theme';

export function FabButton({
  onPress,
  palette,
  bottom,
  right = 24,
  size = HOME_LAYOUT.fabSize,
  iconSize = 28,
  activeOpacity = 0.75,
  style,
}: {
  onPress: () => void;
  palette: AppThemePalette;
  bottom: number;
  right?: number;
  size?: number;
  iconSize?: number;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      onPress={onPress}
      style={[
        {
          position: 'absolute',
          bottom,
          right,
          width: size,
          height: size,
          borderRadius: HOME_RADIUS.fab,
          backgroundColor: palette.active,
          alignItems: 'center',
          justifyContent: 'center',
          ...HOME_SHADOW.card,
        },
        style,
      ]}
    >
      <Ionicons name="add" size={iconSize} color={palette.surface} />
    </TouchableOpacity>
  );
}
