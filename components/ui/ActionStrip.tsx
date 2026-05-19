import Animated from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';
import { SCREEN_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';

export function ActionStrip({
  palette,
  animatedStyle,
  children,
}: {
  palette: AppThemePalette;
  animatedStyle: any;
  children: React.ReactNode;
}) {
  return (
    <Animated.View style={[animatedStyle, styles.strip, { backgroundColor: palette.stripBg, borderBottomColor: palette.divider }]}>
      <View style={styles.row}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SCREEN_GUTTER,
    paddingVertical: 10,
  },
});
