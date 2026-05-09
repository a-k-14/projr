import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppIcon } from './AppIcon';
import { AppThemePalette } from '../../lib/theme';
import { SCREEN_GUTTER } from '../../lib/design';
import { SCREEN_HEADER } from '../../lib/layoutTokens';

interface ScreenHeaderProps {
  title: string;
  palette: AppThemePalette;
  rightAction?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  height?: number;
}

export function ScreenHeader({ 
  title, 
  palette, 
  rightAction, 
  onBack, 
  showBack = true,
  height = 60 
}: ScreenHeaderProps) {
  return (
    <View
      style={{
        height,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_GUTTER,
        backgroundColor: palette.background,
      }}
    >
      {showBack && (
        <TouchableOpacity
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => (onBack ? onBack() : router.back())}
          style={{ marginRight: SCREEN_HEADER.iconTitleGap }}
        >
          <AppIcon name="arrow-left" size={24} color={palette.text} />
        </TouchableOpacity>
      )}
      
      <Text 
        style={{ 
          flex: 1, 
          fontSize: 22, 
          fontWeight: '400', 
          color: palette.text, 
          letterSpacing: -0.5,
          marginLeft: showBack ? 0 : 4,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightAction && (
        <View style={{ marginLeft: 8 }}>
          {rightAction}
        </View>
      )}
    </View>
  );
}
