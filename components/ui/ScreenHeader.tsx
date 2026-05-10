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

export function HeaderIconButton({
  icon,
  onPress,
  palette,
  active = false,
}: {
  icon: string;
  onPress: () => void;
  palette: AppThemePalette;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.72}
      onPress={onPress}
      style={[
        styles.iconPill,
        {
          backgroundColor: active ? palette.brandSoft : palette.surface,
          borderColor: active ? palette.brand : palette.divider,
        },
      ]}
    >
      <AppIcon name={icon} size={17} color={active ? palette.brand : palette.textMuted} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}

export function HeaderAddButton({
  onPress,
  palette,
  label = 'Add',
}: {
  onPress: () => void;
  palette: AppThemePalette;
  label?: string;
}) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.78}
      onPress={onPress}
      style={[styles.addButton, { backgroundColor: palette.brand }]}
    >
      <AppIcon name="plus" size={16} color="#FFFFFF" strokeWidth={2} />
      <Text style={styles.addButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ScreenHeader({ 
  title, 
  palette, 
  rightAction, 
  onBack, 
  showBack = true,
  height = 54 
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
          style={[
            styles.backButton,
            {
              marginRight: 4,
            },
          ]}
        >
          <AppIcon name="arrow-left" size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      )}
      
      <Text 
        style={{ 
          flex: 1, 
          fontSize: 27,
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
        <View style={{ marginLeft: 10 }}>
          {rightAction}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 30,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    minWidth: 66,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#050505',
  },
  addButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
