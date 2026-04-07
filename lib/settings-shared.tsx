import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppThemePalette } from './theme';
import { CardSection, SectionLabel } from '../components/settings-ui';
import { formatCurrency } from './derived';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

export const THEMES = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const;

export const ACCOUNT_TYPES = [
  { key: 'savings', label: 'Savings' },
  { key: 'credit', label: 'Credit Card' },
  { key: 'cash', label: 'Cash' },
  { key: 'wallet', label: 'Wallet' },
] as const;

export const ACCOUNT_ICONS = [
  'credit-card',
  'smartphone',
  'briefcase',
  'home',
  'dollar-sign',
  'shopping-cart',
  'truck',
  'coffee',
  'box',
  'archive',
] as const;

export const ACCOUNT_COLORS = [
  '#17673B',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

export const CATEGORY_ICONS = [
  'shopping-cart',
  'coffee',
  'truck',
  'home',
  'briefcase',
  'smartphone',
  'credit-card',
  'gift',
  'map-pin',
  'archive',
] as const;

export const CATEGORY_COLORS = [
  '#17673B',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

export const TAG_COLORS = [
  '#17673B',
  '#0F4C81',
  '#8B5CF6',
  '#CC3B2D',
  '#B45309',
  '#2563EB',
  '#7C3AED',
  '#0F766E',
] as const;

export function formatDisplayCurrency(amount: number, symbol: string) {
  return formatCurrency(amount, symbol);
}

export function SettingsScreenShell({
  palette,
  children,
}: {
  palette: AppThemePalette;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PickerSheetShell({
  title,
  subtitle,
  palette,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
  onClose: () => void;
  children: ReactNode;
}) {
  const { height: screenHeight } = Dimensions.get('window');
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: screenHeight, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [screenHeight, onClose, translateY, opacity]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 13 }),
    ]).start();
  }, [translateY, opacity]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // Only capture downward vertical drags
        onMoveShouldSetPanResponder: (_, gs) =>
          gs.dy > 5 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          // Never go upward — clamp at 0
          translateY.setValue(Math.max(0, gs.dy));
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy > 80 || gs.vy > 0.5) {
            closeSheet();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 70,
              friction: 13,
            }).start();
          }
        },
      }),
    [closeSheet, translateY],
  );

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000 }}>
      {/* Dimmed backdrop — content behind is still visible */}
      <Animated.View
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', opacity }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet: grows to content height, max 50% of screen */}
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            maxHeight: screenHeight * 0.5,
            backgroundColor: palette.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
            transform: [{ translateY }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 24,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: palette.divider,
                opacity: 0.5,
              }}
            />
          </View>

          {/* Title */}
          <View style={{ paddingHorizontal: 22, paddingBottom: 12 }}>
            <Text
              style={{ fontSize: 20, fontWeight: '600', color: palette.text, letterSpacing: -0.3 }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{ fontSize: 13, color: palette.textMuted, marginTop: 3, fontWeight: '400' }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

export { CardSection, SectionLabel };
