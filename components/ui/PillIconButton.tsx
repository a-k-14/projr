import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { AppIcon, IconName } from './AppIcon';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import { AppThemePalette } from '../../lib/theme';

interface PillIconButtonProps {
  icon: IconName;
  onPress: () => void;
  palette: AppThemePalette;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

export function PillIconButton({
  icon,
  onPress,
  palette,
  active = false,
  style,
  iconSize = 17,
}: PillIconButtonProps) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.72}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: active ? palette.brandSoft : palette.surface,
          borderColor: active ? palette.brand : palette.divider,
        },
        style,
      ]}
    >
      <AppIcon 
        name={icon} 
        size={iconSize} 
        color={active ? palette.brand : palette.textMuted} 
        strokeWidth={1.8} 
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: HOME_RADIUS.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
