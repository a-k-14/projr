import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ACTIVITY_LAYOUT, HOME_LAYOUT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import { AppIcon } from './AppIcon';

interface Props {
  onPress: () => void;
  palette: AppThemePalette;
  bottom?: number;
  backgroundColor?: string;
  iconColor?: string;
  style?: ViewStyle;
}

export function FabButton({
  onPress,
  palette,
  bottom = 32,
  backgroundColor,
  iconColor,
  style }: Props) {
  const iconSize = Math.round(HOME_LAYOUT.listIconSize * 0.55);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.fab,
        {
          bottom,
          backgroundColor: backgroundColor ?? palette.brand,
          shadowColor: '#000000',
        },
        style,
      ]}
    >
      <AppIcon name="plus" size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: HOME_LAYOUT.fabRightOffset,
    width: HOME_LAYOUT.fabSize,
    height: HOME_LAYOUT.fabSize,
    borderRadius: HOME_LAYOUT.fabSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 10,
  },
});
