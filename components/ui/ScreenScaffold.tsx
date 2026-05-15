import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { SCREEN_GUTTER } from '../../lib/design';
import type { AppThemePalette } from '../../lib/theme';
import { getBottomActionPadding, getSheetBottomPadding, SystemBottomGuard } from './safeBottom';

export function ScreenScaffold({
  children,
  palette,
  edges = ['left', 'right'],
  style,
}: {
  children: ReactNode;
  palette: AppThemePalette;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: palette.background }, style]}>
      {children}
      <SystemBottomGuard />
    </SafeAreaView>
  );
}

export function BottomActionBar({
  children,
  palette,
  horizontalPadding = SCREEN_GUTTER,
  extraBottom = 4,
  gap = 4,
}: {
  children: ReactNode;
  palette: AppThemePalette;
  horizontalPadding?: number;
  extraBottom?: number;
  gap?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: horizontalPadding,
        paddingTop: 8,
        paddingBottom: getBottomActionPadding(insets, extraBottom),
        backgroundColor: palette.background,
        gap,
      }}
    >
      {children}
    </View>
  );
}

export function BottomSheetContent({
  children,
  bottom,
  extraBottom = 14,
  style,
}: {
  children: ReactNode;
  bottom: number;
  extraBottom?: number;
  style?: ViewStyle;
}) {
  return <View style={[{ paddingBottom: getSheetBottomPadding(bottom, extraBottom) }, style]}>{children}</View>;
}
