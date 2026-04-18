/**
 * InstantTouch — zero-delay touch primitive (drop-in for TouchableOpacity).
 *
 * Uses React Native's standard TouchableOpacity with delayPressIn={0} so the
 * visual feedback fires the moment the finger lands rather than after the default
 * 130ms gesture-disambiguation window.
 *
 * Why NOT RNGH Pressable: RNGH's Pressable can conflict with nested
 * ScrollViews / gesture handlers and silently swallow taps in certain layouts.
 * Plain RN TouchableOpacity is layout-safe and works everywhere.
 */
import React, { forwardRef } from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

export const HapticTouch = forwardRef<
  React.ElementRef<typeof TouchableOpacity>,
  TouchableOpacityProps
>(({ ...props }, ref) => (
  <TouchableOpacity
    ref={ref}
    delayPressIn={0}
    activeOpacity={0.7}
    {...props}
  />
));

HapticTouch.displayName = 'HapticTouch';
