import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/theme';

const MIN_SYSTEM_BOTTOM = 0;
const ACTION_EXTRA = 8;
const CONTENT_EXTRA = 8;
const COMPACT_CONTENT_EXTRA = 4;
const SHEET_EXTRA = 4;
const TAB_BAR_EXTRA = 52;

export function getSafeBottomInset(insetsOrBottom: EdgeInsets | number | undefined | null): number {
  if (!insetsOrBottom) return MIN_SYSTEM_BOTTOM;
  const bottom = typeof insetsOrBottom === 'number' ? insetsOrBottom : (insetsOrBottom.bottom ?? 0);
  return Math.max(bottom, MIN_SYSTEM_BOTTOM);
}

export function getBottomActionPadding(insetsOrBottom: EdgeInsets | number | undefined | null, extra = ACTION_EXTRA): number {
  return getSafeBottomInset(insetsOrBottom) + extra;
}

export function getScrollableBottomPadding(insetsOrBottom: EdgeInsets | number | undefined | null, extra = CONTENT_EXTRA): number {
  return getSafeBottomInset(insetsOrBottom) + extra;
}

export function getCompactScrollableBottomPadding(insetsOrBottom: EdgeInsets | number | undefined | null): number {
  return getScrollableBottomPadding(insetsOrBottom, COMPACT_CONTENT_EXTRA);
}

export function getSheetBottomPadding(insetsOrBottom: EdgeInsets | number | undefined | null, extra = SHEET_EXTRA): number {
  return getSafeBottomInset(insetsOrBottom) + extra;
}

export function getTabScreenBottomPadding(insetsOrBottom: EdgeInsets | number | undefined | null): number {
  return getSafeBottomInset(insetsOrBottom) + TAB_BAR_EXTRA;
}

interface SystemBottomGuardProps {
  backgroundColor?: string;
  zIndex?: number;
}

export function SystemBottomGuard({ backgroundColor, zIndex = 99 }: SystemBottomGuardProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  
  if (insets.bottom === 0) {
    return null;
  }
  
  const bgColor = backgroundColor || palette.background;
  
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: insets.bottom,
        backgroundColor: bgColor,
        zIndex,
      }}
    />
  );
}

