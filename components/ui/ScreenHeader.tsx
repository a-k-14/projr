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
  titleSize?: number;
}

import { PillIconButton } from './PillIconButton';

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
    <PillIconButton
      icon={icon as any}
      onPress={onPress}
      palette={palette}
      active={active}
    />
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
      style={[styles.headerButton, styles.addButton, { backgroundColor: palette.brand }]}
    >
      <AppIcon name="plus" size={14} color="#FFFFFF" strokeWidth={2} />
      <Text style={[styles.headerButtonText, styles.addButtonText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function HeaderEditButton({
  onPress,
  palette,
  label = 'Edit',
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
      style={[
        styles.headerButton,
        {
          backgroundColor: palette.brandSoft,
          borderWidth: 1.5,
          borderColor: palette.brand,
        },
      ]}
    >
      <Text style={[styles.headerButtonText, { color: palette.brand }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ScreenHeader({ 
  title, 
  palette, 
  rightAction, 
  onBack, 
  showBack = true,
  height = 54,
  titleSize = 27,
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
          fontSize: titleSize,
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    minWidth: 58,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerButtonText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#050505',
  },
  addButtonText: {
    color: '#FFFFFF',
  },
});
