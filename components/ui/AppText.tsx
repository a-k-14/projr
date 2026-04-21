import React, { useMemo } from 'react';
import { Text as RNText, TextProps, TextStyle, StyleSheet } from 'react-native';

export function Text({ style, ...props }: TextProps) {
  const flattenedStyle = useMemo(() => StyleSheet.flatten(style) || {}, [style]);
  
  // Decide which TrueType font family string to use
  const isBold = flattenedStyle.fontWeight === '600' || 
                 flattenedStyle.fontWeight === 'bold' || 
                 flattenedStyle.fontWeight === '700' || 
                 flattenedStyle.fontWeight === '800' || 
                 flattenedStyle.fontWeight === '900';
                 
  const fontFamilyString = isBold ? 'Geist-Bold' : 'Geist-Regular';

  // React Native Android silently falls back to Roboto if it receives a fontWeight 
  // parameter alongside a custom .ttf fontFamily. We must strip it out.
  const { fontWeight, ...safeStyle } = flattenedStyle;

  return (
    <RNText
      {...props}
      style={[safeStyle, { fontFamily: fontFamilyString }]}
    />
  );
}
