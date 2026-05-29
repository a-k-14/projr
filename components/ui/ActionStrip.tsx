import Animated from 'react-native-reanimated';
import { StyleSheet, ScrollView } from 'react-native';
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
    <Animated.View style={[animatedStyle, styles.strip, { backgroundColor: palette.borderSoft, borderBottomColor: palette.divider }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexGrow: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SCREEN_GUTTER,
    paddingVertical: 10,
  },
});
