import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppIcon } from './AppIcon';
import { AppThemePalette } from '../../lib/theme';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';

interface ScreenHeaderProps {
  title: string;
  palette: AppThemePalette;
  rightAction?: ReactNode;
  titleAddon?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  height?: number;
  titleSize?: number;
  titleWeight?: string;
  backgroundColor?: string;
  titleColor?: string;
  iconColor?: string;
  /** Size of the back-arrow icon in dp. Defaults to 22. */
  iconSize?: number;
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
      style={[styles.headerButton, { backgroundColor: palette.brand }]}
    >
      <AppIcon name="plus" size={13} color={palette.onBrand} strokeWidth={2} />
      <Text style={[styles.headerButtonText, { color: palette.onBrand }]}>{label}</Text>
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

export function HeaderMoreButton({
  palette,
  isOpen,
  onPress,
}: {
  palette: AppThemePalette;
  isOpen: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.75}
      onPress={onPress}
      style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.full, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppIcon name={isOpen ? 'x' : 'more-vertical'} size={18} color={palette.text} strokeWidth={2} />
    </TouchableOpacity>
  );
}

export function ScreenHeader({
  title,
  palette,
  rightAction,
  titleAddon,
  onBack,
  showBack = true,
  height = 54,
  titleSize = 27,
  titleWeight = FONT_WEIGHT.regular,
  backgroundColor,
  titleColor,
  iconColor,
  iconSize = 22,
}: ScreenHeaderProps) {
  const resolvedBg = backgroundColor ?? palette.background;
  const resolvedTitle = titleColor ?? palette.text;
  const resolvedIcon = iconColor ?? palette.text;
  return (
    <View
      style={{
        height,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_GUTTER,
        backgroundColor: resolvedBg,
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
          <AppIcon name="arrow-left" size={iconSize} color={resolvedIcon} strokeWidth={2} />
        </TouchableOpacity>
      )}

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: showBack ? 0 : 4 }}>
        <Text
          style={{
            flexShrink: 1,
            fontSize: titleSize,
            fontWeight: titleWeight as any,
            color: resolvedTitle,
            letterSpacing: -0.5,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {titleAddon}
      </View>

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
    borderRadius: HOME_RADIUS.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    minWidth: 52,
    height: 26,
    borderRadius: HOME_RADIUS.pill,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  headerButtonText: {
    fontSize: HOME_TEXT.metaSmall,
    lineHeight: 16,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
