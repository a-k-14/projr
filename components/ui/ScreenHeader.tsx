import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { router } from 'expo-router';
import { AppIcon } from './AppIcon';
import { AppThemePalette } from '../../lib/theme';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_TEXT, SCREEN_HEADER } from '../../lib/layoutTokens';

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
  /** Size of the back-arrow icon in dp. Defaults to 18. */
  iconSize?: number;
  /** Optional long-press handler on the title (used for the Design Lab gesture
   *  on the account-detail screen). Default delay ~500ms. */
  onTitleLongPress?: () => void;
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
  iconColor,
}: {
  palette: AppThemePalette;
  isOpen: boolean;
  onPress: () => void;
  iconColor?: string;
}) {
  const rotationVal = useSharedValue(0);
  React.useEffect(() => {
    rotationVal.value = withSpring(isOpen ? 1 : 0, {
      damping: 18,
      stiffness: 160,
      mass: 0.8,
    });
  }, [isOpen]);

  const dotsStyle = useAnimatedStyle(() => {
    const rotation = `${rotationVal.value * 90}deg`;
    return {
      opacity: 1 - rotationVal.value,
      transform: [
        { scale: 1 - rotationVal.value * 0.15 },
        { rotate: rotation },
      ],
    };
  });

  const closeStyle = useAnimatedStyle(() => {
    const rotation = `${(rotationVal.value - 1) * 90}deg`;
    return {
      opacity: rotationVal.value,
      transform: [
        { scale: 0.85 + rotationVal.value * 0.15 },
        { rotate: rotation },
      ],
    };
  });

  return (
    <TouchableOpacity
      delayPressIn={0}
      activeOpacity={0.75}
      onPress={onPress}
      style={{ width: 34, height: 34, borderRadius: HOME_RADIUS.full, alignItems: 'center', justifyContent: 'center', marginRight: -8, position: 'relative' }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }, dotsStyle]}>
        <AppIcon name="more-vertical" size={18} color={iconColor ?? palette.text} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }, closeStyle]}>
        <AppIcon name="x" size={18} color={iconColor ?? palette.text} strokeWidth={2} />
      </Animated.View>
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
  height = 52,
  titleSize = SCREEN_HEADER.titleSize,
  titleWeight = FONT_WEIGHT.medium,
  backgroundColor,
  titleColor,
  iconColor,
  iconSize = 18,
  onTitleLongPress,
}: ScreenHeaderProps) {
  const resolvedBg = backgroundColor ?? palette.background;
  const resolvedTitle = titleColor ?? palette.text;
  const resolvedIcon = iconColor ?? palette.text;
  const titleNode = (
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
  );
  return (
    <View
      style={{
        height,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: resolvedBg,
        paddingBottom: 3,
      }}
    >
      {showBack && (
        <TouchableOpacity
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => (onBack ? onBack() : router.back())}
          style={{
            marginRight: SCREEN_HEADER.iconTitleGap,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AppIcon name="arrow-left" size={iconSize} color={resolvedIcon} strokeWidth={2} />
        </TouchableOpacity>
      )}

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {onTitleLongPress ? (
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={onTitleLongPress}
            delayLongPress={500}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={{ flexShrink: 1 }}
          >
            {titleNode}
          </TouchableOpacity>
        ) : (
          titleNode
        )}
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
