import { View } from 'react-native';
import { AppIcon } from './AppIcon';

interface CircleIconBadgeProps {
  icon: string;
  /** Outer size of the rounded square. Defaults to 42. */
  size?: number;
  /** Border radius. Defaults to size * 0.33 to match existing call sites (42 → 14). */
  radius?: number;
  /** Icon foreground color. */
  tone: string;
  /** Tile background color. */
  background: string;
  /** Icon glyph size. Defaults to roughly half the tile. */
  iconSize?: number;
  iconStrokeWidth?: number;
}

export function CircleIconBadge({
  icon,
  size = 42,
  radius,
  tone,
  background,
  iconSize,
  iconStrokeWidth = 1.8,
}: CircleIconBadgeProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.33),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
      }}
    >
      <AppIcon
        name={icon}
        size={iconSize ?? Math.round(size * 0.48)}
        color={tone}
        strokeWidth={iconStrokeWidth}
      />
    </View>
  );
}
