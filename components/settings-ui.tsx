import { AppChevron } from '@/components/ui/AppChevron';
import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import { forwardRef, ReactNode, RefObject, useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_PADDING, RADIUS, SCREEN_GUTTER, SPACING, TYPE , FONT_WEIGHT} from '../lib/design';
import { HOME_LAYOUT , HOME_RADIUS, HOME_TEXT, SCREEN_HEADER, FORM_TOKENS} from '../lib/layoutTokens';
import type { AppThemePalette } from '../lib/theme';
import { isEmojiIcon } from '../lib/ui-format';
import { FilledButton, TextButton } from './ui/AppButton';
import { PressableScale } from './ui/PressableScale';
import { BottomActionBar } from './ui/ScreenScaffold';
import { getScrollableBottomPadding } from './ui/safeBottom';

export function ScreenTitle({
  title,
  subtitle,
  palette,
  right }: {
    title: string;
    subtitle?: string;
    palette: AppThemePalette;
    right?: ReactNode;
  }) {
  return (
    <View style={{ paddingHorizontal: SCREEN_HEADER.paddingX, paddingTop: 8, paddingBottom: SPACING.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md }}>
        <Text style={{ flex: 1, fontSize: TYPE.title, fontWeight: FONT_WEIGHT.regular, color: palette.text, letterSpacing: -0.5 }}>
          {title}
        </Text>
        {right ? <View style={{ flexShrink: 0 }}>{right}</View> : null}
      </View>
      {subtitle ? (
        <Text style={{ fontSize: TYPE.caption, color: palette.textMuted, marginTop: 2, lineHeight: 17 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionLabel({ label, palette }: { label: string; palette: AppThemePalette }) {
  return (
    <Text
      appWeight="medium"
      style={{
        fontSize: HOME_TEXT.caption,
        fontWeight: FONT_WEIGHT.bold,
        color: palette.textSecondary,
        marginHorizontal: SCREEN_HEADER.paddingX,
        marginBottom: 6,
        marginTop: 4,
        letterSpacing: 0.3
      }}
    >
      {label}
    </Text>
  );
}

export function CardSection({
  children,
  palette }: {
    children: ReactNode;
    palette: AppThemePalette;
  }) {
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        marginHorizontal: SCREEN_GUTTER,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.borderSoft,
        marginBottom: SPACING.lg
      }}
    >
      {children}
    </View>
  );
}

export function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  palette,
  onPress,
  noBorder,
  rightElement,
  subtitle,
  labelStyle,
  leftElement }: {
    icon?: string;
    iconColor?: string;
    label: string;
    subtitle?: string;
    labelStyle?: any;
    value?: string;
    palette: AppThemePalette;
    onPress?: () => void;
    noBorder?: boolean;
    rightElement?: ReactNode;
    leftElement?: ReactNode;
  }) {
  const content = (
    <>
      {leftElement ? (
        leftElement
      ) : icon ? (
        <AppIcon name={icon as any} size={18} color={iconColor ?? palette.text} />
      ) : null}
      <View style={{ flex: 1, marginLeft: leftElement || icon ? 14 : 0 }}>
        <Text
          style={[
            {
              fontSize: HOME_TEXT.sectionTitle,
              color: palette.text,
            },
            labelStyle,
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: TYPE.body,
              color: palette.textMuted,
              marginTop: 2,
              fontWeight: FONT_WEIGHT.regular
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ? rightElement : null}
      {!rightElement && value ? (
        <Text
          appWeight="medium"
          style={{ fontSize: TYPE.rowValue, color: palette.textSecondary, marginRight: 10 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {onPress && !rightElement ? <AppChevron direction="right" size={18} tone="secondary" palette={palette} /> : null}
    </>
  );

  const style = {
    minHeight: 72,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderBottomWidth: noBorder ? 0 : 1,
    borderBottomColor: palette.divider
  };

  if (onPress) {
    return (
      <PressableScale activeScale={0.985} onPress={onPress} style={style}>
        {content}
      </PressableScale>
    );
  }
  return <View style={style}>{content}</View>;
}

export function ChoiceRow({
  title,
  subtitle,
  selected,
  palette,
  onPress,
  noBorder,
  leftElement,
  rightElement,
  horizontalPadding = CARD_PADDING }: {
    title: string;
    subtitle?: string;
    selected?: boolean;
    palette: AppThemePalette;
    onPress: () => void;
    noBorder?: boolean;
    leftElement?: ReactNode;
    rightElement?: ReactNode;
    horizontalPadding?: number;
  }) {
  return (
    <PressableScale
      activeScale={0.985}
      onPress={onPress}
      style={{
        minHeight: 68,
        paddingHorizontal: horizontalPadding,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected ? palette.brandSoft : 'transparent',
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider
      }}
    >
      {leftElement && <View style={{ marginRight: 14 }}>{leftElement}</View>}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: TYPE.rowLabel,
            fontWeight: selected ? '500' : '400',
            color: selected ? palette.tabActive : palette.text
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: TYPE.body,
              color: palette.textMuted,
              marginTop: 2,
              lineHeight: 18,
              fontWeight: FONT_WEIGHT.regular
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ? <View style={{ marginRight: selected ? 10 : 0 }}>{rightElement}</View> : null}
      {selected && (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: HOME_RADIUS.chipSm,
            backgroundColor: palette.tabActive,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <AppIcon name="check" size={13} color={palette.onBrand} />
        </View>
      )}
    </PressableScale>
  );
}


export function PickerChip({
  label,
  selected,
  palette,
  onPress }: {
    label: string;
    selected?: boolean;
    palette: AppThemePalette;
    onPress: () => void;
  }) {
  return (
    <TouchableOpacity delayPressIn={0}
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: selected ? palette.tabActive : palette.border,
        backgroundColor: selected ? palette.brandSoft : palette.surface,
        paddingHorizontal: SPACING.lg,
        justifyContent: 'center'
      }}
    >
      <Text style={{ fontSize: TYPE.rowValue, fontWeight: FONT_WEIGHT.medium, color: palette.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FieldLabel({ label, palette, hasError = false }: { label: string; palette: AppThemePalette; hasError?: boolean }) {
  return (
    <Text
      style={{
        fontSize: TYPE.body,
        fontWeight: FONT_WEIGHT.bold,
        color: hasError ? palette.negative : palette.textMuted,
        marginBottom: 8
      }}
    >
      {label}
    </Text>
  );
}

/**
 * Square icon button used alongside InputField rows (e.g. calculator, trash).
 * Matches InputField height (56) and border radius (RADIUS.md) exactly.
 */
export function IconBtn({
  onPress,
  children,
  palette,
  hitSlop }: {
    onPress: () => void;
    children: ReactNode;
    palette: AppThemePalette;
    hitSlop?: { top: number; bottom: number; left: number; right: number };
  }) {
  return (
    <TouchableOpacity delayPressIn={0}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={hitSlop}
      style={{
        width: 52,
        height: 56,
        borderRadius: RADIUS.md,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.divider,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

export const InputField = forwardRef<TextInput, React.ComponentProps<typeof TextInput> & {
  palette: AppThemePalette;
  isNumeric?: boolean;
  rightElement?: ReactNode;
  hasError?: boolean;
}>(function InputField({
  palette,
  isNumeric,
  rightElement,
  hasError = false,
  ...props
}, ref) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: hasError
          ? palette.negative
          : (isFocused ? palette.brand : palette.border),
        backgroundColor: palette.surface,
        paddingHorizontal: CARD_PADDING
      }}
    >
      <TextInput
        ref={ref}
        {...props}
        style={[
          {
            flex: 1,
            color: hasError ? palette.negative : palette.text,
            fontSize: TYPE.rowLabel,
            paddingVertical: 12
          },
          props.style as any,
        ]}
        placeholderTextColor={hasError ? palette.negative : palette.textSoft}
        cursorColor={hasError ? palette.negative : (palette.isDark ? '#FFFFFF' : '#000000')}
        keyboardType={isNumeric ? (Platform.OS === 'ios' ? 'decimal-pad' : 'numeric') : props.keyboardType}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
      />
      {rightElement}
    </View>
  );
});

export function SelectTrigger({
  label,
  valueLabel,
  onPress,
  palette,
  placeholder = 'Select...',
  containerStyle,
  leftElement,
  hasError = false,
}: {
  label: string;
  valueLabel?: string;
  onPress: () => void;
  palette: AppThemePalette;
  placeholder?: string;
  containerStyle?: View['props']['style'];
  leftElement?: ReactNode;
  hasError?: boolean;
}) {
  return (
    <View style={[{ marginBottom: SPACING.xl }, containerStyle]}>
      <FieldLabel label={label} palette={palette} hasError={hasError} />
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.7}
        style={{
          minHeight: 56,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: hasError ? palette.negative : palette.border,
          backgroundColor: palette.surface,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onPress={onPress}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {leftElement}
          <Text style={{ color: hasError ? palette.negative : (valueLabel ? palette.text : palette.textSoft), fontSize: TYPE.rowLabel }}>
            {valueLabel ?? placeholder}
          </Text>
        </View>
        <AppChevron direction="down" size={22} tone="secondary" palette={palette} color={hasError ? palette.negative : undefined} />
      </TouchableOpacity>
    </View>
  );
}

export function ColorGrid({
  colors,
  selectedColor,
  onSelect,
  palette }: {
    colors: readonly string[];
    selectedColor: string;
    onSelect: (color: string) => void;
    palette: AppThemePalette;
  }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
      {colors.map((color) => {
        const isSelected = selectedColor === color;
        return (
          <TouchableOpacity delayPressIn={0}
            key={color}
            activeOpacity={0.8}
            onPress={() => onSelect(color)}
            style={{
              width: 36,
              height: 36,
              borderRadius: HOME_RADIUS.cardSm,
              backgroundColor: color,
              borderWidth: 2,
              borderColor: isSelected ? palette.text : 'transparent',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isSelected && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: palette.onBrand
                }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function IconGrid({
  icons,
  selectedIcon,
  onSelect,
  palette }: {
    icons: readonly string[];
    selectedIcon: string;
    onSelect: (icon: string) => void;
    palette: AppThemePalette;
  }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
      {icons.map((icon, index) => {
        const isSelected = selectedIcon === icon;
        const isEmoji = isEmojiIcon(icon);
        return (
          <TouchableOpacity delayPressIn={0}
            key={`${icon}-${index}`}
            activeOpacity={0.7}
            onPress={() => onSelect(icon)}
            style={{
              width: 52,
              height: 52,
              borderRadius: HOME_RADIUS.pill,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? palette.tabActive : palette.border,
              backgroundColor: isSelected ? palette.brandSoft : palette.surface,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isEmoji ? (
              <Text style={{ fontSize: 24 }}>{icon}</Text>
            ) : (
              <AppIcon name={icon as any}
                size={24}
                color={isSelected ? palette.tabActive : palette.brand}
                strokeWidth={HOME_LAYOUT.listIconStrokeWidth}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  palette,
  disabled,
}: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'danger' | 'secondary';
    palette: AppThemePalette;
    disabled?: boolean;
  }) {
  const styles = {
    primary: 'brand',
    danger: 'danger',
    secondary: 'default',
  } as const;

  if (variant === 'primary') {
    return <FilledButton label={label} onPress={onPress} palette={palette} tone={styles.primary} disabled={disabled} />;
  }

  return (
    <TextButton
      label={label}
      onPress={onPress}
      palette={palette}
      tone={variant === 'danger' ? styles.danger : styles.secondary}
      disabled={disabled}
    />
  );
}

/**
 * Layout components for Settings Screens
 */

export function FixedBottomActions({
  children,
  palette }: {
    children: ReactNode;
    palette: AppThemePalette;
  }) {
  return (
    <BottomActionBar palette={palette}>
      {children}
    </BottomActionBar>
  );
}

export function SettingsScreenLayout({
  children,
  palette,
  bottomAction,
  scrollEnabled = true,
  useScrollView = true }: {
    children: ReactNode;
    palette: AppThemePalette;
    bottomAction?: ReactNode;
    scrollEnabled?: boolean;
    useScrollView?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      {useScrollView ? (
        <ScrollView
          style={{ flex: 1 }}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={{
            paddingTop: SPACING.md,
            paddingBottom: bottomAction ? getScrollableBottomPadding(insets) + 48 : SPACING.sm,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {bottomAction}
    </SafeAreaView>
  );
}

export function SettingsFormLayout({
  children,
  palette,
  bottomActions,
  scrollRef,
  onScroll,
  onScrollBeginDrag,
  scrollEventThrottle,
  preFocusScrollYRef,
}: {
    children: ReactNode;
    palette: AppThemePalette;
    bottomActions?: ReactNode;
    scrollRef?: RefObject<ScrollView | null>;
    onScroll?: (event: any) => void;
    onScrollBeginDrag?: () => void;
    scrollEventThrottle?: number;
    preFocusScrollYRef?: RefObject<number | null>;
}) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        if (preFocusScrollYRef && preFocusScrollYRef.current !== null) {
          scrollRef?.current?.scrollTo({ y: preFocusScrollYRef.current, animated: true });
          preFocusScrollYRef.current = null;
        }

        if (Platform.OS === 'ios') {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setKeyboardHeight(0);
        } else {
          setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setKeyboardHeight(0);
          }, 250);
        }
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollRef, preFocusScrollYRef]);

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: SPACING.md,
          paddingBottom: getScrollableBottomPadding(insets) + 132 + keyboardHeight,
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={{ width: '100%' }}>{children}</View>
      </ScrollView>
      {bottomActions}
    </SafeAreaView>
  );
}

export function FormSection({
  title,
  children,
  palette,
  rightElement,
  style,
}: {
  title: string;
  children: React.ReactNode;
  palette: AppThemePalette;
  rightElement?: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginHorizontal: FORM_TOKENS.gutter, marginTop: FORM_TOKENS.sectionGap }, style]}>
      {!!title && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text
            appWeight="medium"
            style={{
              fontSize: HOME_TEXT.caption,
              fontWeight: FONT_WEIGHT.bold,
              color: palette.textSecondary,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </Text>
          {rightElement}
        </View>
      )}
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: FORM_TOKENS.cardRadius,
          borderWidth: 1,
          borderColor: palette.borderSoft,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
