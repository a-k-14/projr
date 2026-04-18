import { Ionicons } from '@expo/vector-icons';
import { StyleProp, ViewStyle , TouchableOpacity} from 'react-native';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SHADOW } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export function FabButton({
  onPress,
  palette,
  bottom,
  right = HOME_LAYOUT.fabRightOffset,
  size = HOME_LAYOUT.fabSize,
  iconSize = 28,
  activeOpacity = 0.75,
  backgroundColor = palette.brand,
  iconColor = palette.onBrand,
  style }: {
  onPress: () => void;
  palette: AppThemePalette;
  bottom: number;
  right?: number;
  size?: number;
  iconSize?: number;
  activeOpacity?: number;
  backgroundColor?: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity delayPressIn={0}
      delayPressIn={0}
      activeOpacity={activeOpacity}
      onPress={() => requestAnimationFrame(() => onPress())}
      style={[
        {
          position: 'absolute',
          bottom,
          right,
          width: size,
          height: size,
          borderRadius: HOME_RADIUS.fab,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          ...HOME_SHADOW.card },
        style,
      ]}
    >
      <Ionicons name="add" size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}
