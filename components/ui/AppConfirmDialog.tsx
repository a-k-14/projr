import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { TextButton } from './AppButton';
import { FONT_WEIGHT } from '../../lib/design';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { useEffect, useState } from 'react';

type ConfirmAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function AppConfirmDialog({
  visible,
  title,
  message,
  palette,
  confirm,
  cancelLabel = 'Cancel',
  onCancel,
  showCancel = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  palette: AppThemePalette;
  confirm: ConfirmAction;
  cancelLabel?: string;
  onCancel: () => void;
  showCancel?: boolean;
}) {
  const progress = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      progress.value = withSpring(1, { damping: 20, stiffness: 220, mass: 0.8 });
    } else {
      progress.value = withTiming(0, { duration: 140 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const cardStyle = useAnimatedStyle(() => {
    const scale = 0.94 + 0.06 * progress.value;
    return {
      opacity: progress.value,
      transform: [{ scale }],
    };
  });

  return (
    <Modal visible={shouldRender} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: palette.scrim,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          },
          backdropStyle,
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onCancel}
        />
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 380,
              borderRadius: HOME_RADIUS.tab,
              backgroundColor: palette.card,
              borderWidth: 1,
              borderColor: palette.divider,
              padding: HOME_SPACE.lg,
              ...palette.states.cardShadow,
            },
            cardStyle,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: HOME_SPACE.md }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: palette.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="alert-circle" size={16} color={palette.brand} />
            </View>
            <Text appWeight="medium" style={{ flex: 1, fontSize: HOME_TEXT.rowLabel, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>
              {title}
            </Text>
          </View>
          <Text style={{ fontSize: HOME_TEXT.body, lineHeight: 20, color: palette.textSecondary }}>
            {message}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: HOME_SPACE.lg, alignItems: 'center' }}>
            {showCancel ? (
              <TextButton label={cancelLabel} onPress={onCancel} palette={palette} tone="muted" weight={FONT_WEIGHT.regular} />
            ) : null}
            <PressableScale
              onPress={confirm.onPress}
              activeScale={0.96}
              style={{
                backgroundColor: palette.brand,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 38,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.regular, color: palette.onBrand }}>
                {confirm.label}
              </Text>
            </PressableScale>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
