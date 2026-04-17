import React, { forwardRef } from 'react';
import { TouchableOpacity, TouchableOpacityProps, Platform } from 'react-native';
// Note: expo-haptics must be installed for this to work.
import * as Haptics from 'expo-haptics';

export const HapticTouch = forwardRef<React.ElementRef<typeof TouchableOpacity>, TouchableOpacityProps>(
  ({ onPress, onPressIn, ...props }, ref) => {
    
    const triggerHaptic = () => {
      // User disabled haptics
    };

    const handlePressIn = (e: any) => {
      triggerHaptic();
      if (onPressIn) onPressIn(e);
    };

    return (
      <TouchableOpacity
        ref={ref}
        delayPressIn={0} // Makes touch feel instantly responsive, completely eliminating RN bridge delay perception
        activeOpacity={0.7}
        onPressIn={handlePressIn}
        onPress={onPress}
        {...props}
      />
    );
  }
);
