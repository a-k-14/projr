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
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  }, [screenHeight, onClose, translateY, opacity]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
      }),
    ]).start();
  }, [translateY, opacity]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Captures vertical drags for dismiss
          return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.3) {
            closeSheet();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 70,
              friction: 12,
            }).start();
          }
        },
      }),
    [closeSheet, translateY],
  );

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 1000 }}>
      {/* Backdrop */}
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(5, 10, 20, 0.6)',
          opacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            maxHeight: screenHeight * 0.85,
            backgroundColor: palette.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            overflow: 'hidden',
            transform: [{ translateY }],
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 20,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: palette.divider,
                opacity: 0.5,
              }}
            />
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '600',
                color: palette.text,
                letterSpacing: -0.4,
              }}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={{
                  fontSize: 13,
                  color: palette.textMuted,
                  marginTop: 4,
                  fontWeight: '400',
                }}
              >
                {subtitle}
              </Text>
            )}
          </View>

          <ScrollView
            style={{ flexShrink: 1 }} // Changed from flex: 1 to flexShrink: 1 to prevent collapse
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
            overScrollMode="never"
          >
            {/* Pressables inside ScrollView often conflict with PanResponder, 
                so we use onStartShouldSetPanResponder: () => false above */}
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

export { CardSection, SectionLabel };
