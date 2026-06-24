import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Keyboard, BackHandler } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/AppText';
import { ScreenScaffold } from '@/components/ui/ScreenScaffold';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { CalculatorSheet } from '@/components/CalculatorSheet';
import { IconPickerSheet } from '@/components/ui/IconPickerSheet';
import { ActionButton, FixedBottomActions, InputField } from '@/components/settings-ui';
import { useAppTheme } from '@/lib/theme';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useUIStore } from '@/stores/useUIStore';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatIndianNumberStr, parseFormattedNumber } from '@/lib/derived';
import { HOME_RADIUS, HOME_TEXT, SCREEN_HEADER } from '@/lib/layoutTokens';
import { SPACING, FONT_WEIGHT, SCREEN_GUTTER } from '@/lib/design';
import { CATEGORY_ICONS } from '@/lib/settings-shared';
import { isEmojiIcon } from '@/lib/ui-format';

export default function AssetFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { assets, isLoaded, load, add, update, remove } = useAssetsStore();
  const currencySymbol = useUIStore((s) => s.settings.currencySymbol);
  const showCurrencySymbol = useUIStore((s) => s.settings.showCurrencySymbol);
  const { showConfirm, dialog } = useAppDialog(palette);

  useEffect(() => {
    if (!isLoaded) {
      load().catch(() => undefined);
    }
  }, [isLoaded, load]);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [note, setNote] = useState('');

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [hintIcon, setHintIcon] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  useEffect(() => {
    if (id) {
      const asset = assets.find((a) => a.id === id);
      if (asset) {
        setName(asset.name);
        setIcon(asset.icon);
        setValueStr(formatIndianNumberStr(String(asset.value)));
        setNote(asset.note ?? '');
      }
    }
  }, [id, assets]);

  const asset = id ? assets.find((a) => a.id === id) : null;

  const checkIsDirty = () => {
    if (isEditing) {
      if (!asset) return false;
      const originalAmountStr = formatIndianNumberStr(String(asset.value));
      return (
        name !== asset.name ||
        icon !== asset.icon ||
        valueStr !== originalAmountStr ||
        note !== (asset.note ?? '')
      );
    }
    return name !== '' || icon !== '' || valueStr !== '' || note !== '';
  };

  const handleClose = () => {
    if (checkIsDirty()) {
      showConfirm({
        title: 'Discard Changes',
        message: 'Are you sure you want to discard your changes?',
        confirmLabel: 'Discard',
        onConfirm: () => {
          router.back();
        },
      });
      return;
    }
    router.back();
  };

  useEffect(() => {
    const onBackPress = () => {
      if (checkIsDirty()) {
        showConfirm({
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmLabel: 'Discard',
          onConfirm: () => {
            router.back();
          },
        });
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [asset, name, icon, valueStr, note]);

  const handleSave = async () => {
    if (!name.trim() || Number(parseFormattedNumber(valueStr)) <= 0) {
      setAttemptedSubmit(true);
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }

    if (!icon && !hintIcon) {
      setHintIcon(true);
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }

    const finalIcon = icon || CATEGORY_ICONS[0];
    const valNum = Number(parseFormattedNumber(valueStr));

    if (isEditing && id) {
      await update(id, { name: name.trim(), icon: finalIcon, value: valNum, note: note.trim() || null });
    } else {
      await add({ name: name.trim(), icon: finalIcon, value: valNum, note: note.trim() || null });
    }
    router.back();
  };

  const handleDelete = () => {
    if (isEditing && id) {
      showConfirm({
        title: 'Delete Asset',
        message: 'Are you sure you want to remove this asset? This cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: async () => {
          await remove(id);
          router.back();
        },
      });
    }
  };

  const handleAmountChange = (text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      setValueStr('');
      return;
    }
    const parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') {
      cleaned = cleaned.substring(1);
    }
    setValueStr(formatIndianNumberStr(cleaned));
  };


  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title={isEditing ? 'Edit Asset' : 'Add Asset'}
        palette={palette}
        showBack
        titleSize={SCREEN_HEADER.titleSize}
        titleWeight={SCREEN_HEADER.titleWeight}
        onBack={handleClose}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 32, paddingBottom: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.semibold, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Current Value {showCurrencySymbol && currencySymbol ? `(${currencySymbol})` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', position: 'relative' }}>
            <TextInput
              value={valueStr}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.textSoft}
              style={{
                flex: 1,
                fontSize: 44,
                fontWeight: FONT_WEIGHT.bold,
                color: palette.text,
                letterSpacing: -1,
                textAlign: 'center',
                minWidth: 120,
              }}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setShowCalculator(true);
              }}
              activeOpacity={0.7}
              style={{
                position: 'absolute',
                right: 0,
                bottom: -28,
                width: 44,
                height: 44,
                borderRadius: HOME_RADIUS.button,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: palette.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="calculator" size={22} color={palette.textSecondary} strokeWidth={1.9} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: SCREEN_GUTTER, gap: SPACING.xl }}>
          <View>
            <Text style={{ marginLeft: 4, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: attemptedSubmit && !name.trim() ? palette.negative : palette.textSecondary, marginBottom: 8 }}>
              Asset Name
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowIconPicker(true);
                }}
                activeOpacity={0.7}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: HOME_RADIUS.pill,
                  borderWidth: 1,
                  borderColor: hintIcon && !icon ? palette.brand : palette.borderSoft,
                  backgroundColor: palette.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon ? (
                  isEmojiIcon(icon) ? (
                    <Text style={{ fontSize: 24 }}>{icon}</Text>
                  ) : (
                    <AppIcon name={icon as any} size={24} color={palette.brand} />
                  )
                ) : (
                  <AppIcon name="smile" size={24} color={hintIcon ? palette.brand : palette.textSoft} />
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <InputField
                  palette={palette}
                  value={name}
                  onChangeText={setName}
                  placeholder="E.g. Rolex Submariner"
                  hasError={attemptedSubmit && !name.trim()}
                />
              </View>
            </View>
          </View>

          <View>
            <Text style={{ marginLeft: 4, fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 8 }}>
              Notes (Optional)
            </Text>
            <View>
              <InputField
                palette={palette}
                value={note}
                onChangeText={setNote}
                placeholder="Purchase details, condition, etc."
                multiline
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <FixedBottomActions palette={palette}>
        {hintIcon && !icon && (
          <Animated.View style={[shakeStyle, { alignItems: 'center', marginBottom: 6 }]}>
            <Text style={{ fontSize: HOME_TEXT.bodySmall + 1, color: palette.brand, fontWeight: FONT_WEIGHT.medium }}>
              Select an icon (or press Save again to skip)
            </Text>
          </Animated.View>
        )}
        <Animated.View style={shakeStyle}>
          <ActionButton
            label={isEditing ? 'Save Changes' : 'Add Asset'}
            onPress={handleSave}
            palette={palette}
            variant="primary"
          />
        </Animated.View>
        {isEditing && (
          <ActionButton
            label="Delete Asset"
            onPress={handleDelete}
            palette={palette}
            variant="danger"
          />
        )}
      </FixedBottomActions>

      <IconPickerSheet
        visible={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        selectedIcon={icon}
        onSelect={setIcon}
        palette={palette}
        name={name}
      />

      <CalculatorSheet
        visible={showCalculator}
        onClose={() => setShowCalculator(false)}
        value={valueStr}
        onApply={(v) => {
          setValueStr(v);
          setShowCalculator(false);
        }}
        palette={palette}
      />

      {dialog}
    </ScreenScaffold>
  );
}
