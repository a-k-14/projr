import { Feather } from '@expo/vector-icons';
import { ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, TouchableOpacity, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_PADDING, HOME_TEXT, RADIUS, SCREEN_GUTTER, SHEET_GUTTER, SPACING, TYPE } from '../lib/design';
import type { AppThemePalette } from '../lib/theme';

export function ScreenTitle({
  title,
  subtitle,
  palette }: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
}) {
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: SPACING.md }}>
      <Text style={{ fontSize: TYPE.title, fontWeight: '700', color: palette.text, letterSpacing: -0.5 }}>{title}</Text>
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
      style={{
        fontSize: TYPE.body,
        fontWeight: '700',
        color: palette.textMuted,
        marginHorizontal: 14,
        marginBottom: 6,
        marginTop: 4 }}
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
        borderRadius: RADIUS.lg,
        marginHorizontal: SCREEN_GUTTER,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: palette.border,
        marginBottom: SPACING.lg }}
    >
      {children}
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  palette,
  onPress,
  noBorder,
  rightElement,
  subtitle,
  leftElement }: {
  icon?: keyof typeof Feather.glyphMap;
  label: string;
  subtitle?: string;
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
        <Feather name={icon} size={18} color={palette.iconTint} />
      ) : null}
      <View style={{ flex: 1, marginLeft: leftElement || icon ? 14 : 0 }}>
        <Text
          style={{
            fontSize: TYPE.section,
            fontWeight: '500',
            color: palette.text }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: TYPE.body,
              color: palette.textMuted,
              marginTop: 2,
              fontWeight: '400' }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement ? rightElement : null}
      {!rightElement && value ? (
        <Text style={{ fontSize: TYPE.body, color: palette.textMuted, marginRight: 10 }} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !rightElement ? <Feather name="chevron-right" size={18} color={palette.textSoft} /> : null}
    </>
  );

  const style = {
    minHeight: 72,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderBottomWidth: noBorder ? 0 : 1,
    borderBottomColor: palette.divider };

  if (onPress) {
    return (
      <TouchableOpacity delayPressIn={0} onPress={onPress} style={style}>
        {content}
      </TouchableOpacity>
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
    <TouchableOpacity delayPressIn={0}
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        minHeight: 68,
        paddingHorizontal: horizontalPadding,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected ? palette.brandSoft : 'transparent',
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider }}
      >
      {leftElement && <View style={{ marginRight: 14 }}>{leftElement}</View>}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: TYPE.rowLabel,
            fontWeight: selected ? '500' : '400',
            color: selected ? palette.tabActive : palette.text }}
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
              fontWeight: '400' }}
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
            borderRadius: 11,
            backgroundColor: palette.tabActive,
            alignItems: 'center',
            justifyContent: 'center' }}
        >
          <Feather name="check" size={13} color={palette.onBrand} />
        </View>
      )}
    </TouchableOpacity>
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
        justifyContent: 'center' }}
    >
      <Text style={{ fontSize: TYPE.rowValue, fontWeight: '500', color: palette.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FieldLabel({ label, palette }: { label: string; palette: AppThemePalette }) {
  return (
    <Text
      style={{
        fontSize: TYPE.body,
        fontWeight: '700',
        color: palette.textMuted,
        marginBottom: 8 }}
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
  variant = 'default',
  palette,
  hitSlop }: {
  onPress: () => void;
  children: ReactNode;
  variant?: 'default' | 'danger';
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
        backgroundColor: palette.inputBg,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center' }}
    >
      {children}
    </TouchableOpacity>
  );
}

export function InputField({
  palette,
  isNumeric,
  rightElement,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  palette: AppThemePalette;
  isNumeric?: boolean;
  rightElement?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        paddingHorizontal: CARD_PADDING }}
    >
      <TextInput
        {...props}
        style={[
          {
            flex: 1,
            color: palette.text,
            fontSize: TYPE.rowLabel,
            paddingVertical: 12 },
          props.style as any,
        ]}
        placeholderTextColor={palette.textSoft}
        keyboardType={isNumeric ? (Platform.OS === 'ios' ? 'decimal-pad' : 'numeric') : props.keyboardType}
      />
      {rightElement}
    </View>
  );
}

export function SelectTrigger({
  label,
  valueLabel,
  onPress,
  palette,
  placeholder = 'Select...',
  containerStyle,
}: {
  label: string;
  valueLabel?: string;
  onPress: () => void;
  palette: AppThemePalette;
  placeholder?: string;
  containerStyle?: View['props']['style'];
}) {
  return (
    <View style={[{ marginBottom: SPACING.xl }, containerStyle]}>
      <FieldLabel label={label} palette={palette} />
      <TouchableOpacity
        delayPressIn={0}
        activeOpacity={0.7}
        style={{
          minHeight: 56,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onPress={onPress}
      >
        <Text style={{ color: valueLabel ? palette.text : palette.textSoft, fontSize: TYPE.rowLabel }}>
          {valueLabel ?? placeholder}
        </Text>
        <Feather name="chevron-down" size={20} color={palette.textSoft} />
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
              borderRadius: 18,
              backgroundColor: color,
              borderWidth: 2,
              borderColor: isSelected ? palette.text : 'transparent',
              alignItems: 'center',
              justifyContent: 'center' }}
          >
            {isSelected && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: palette.onBrand }}
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
      {icons.map((icon) => {
        const isSelected = selectedIcon === icon;
        return (
          <TouchableOpacity delayPressIn={0}
            key={icon}
            activeOpacity={0.7}
            onPress={() => onSelect(icon)}
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? palette.tabActive : palette.border,
              backgroundColor: isSelected ? palette.brandSoft : palette.surface,
              alignItems: 'center',
              justifyContent: 'center' }}
          >
            <Feather
              name={icon as any}
              size={24}
              color={isSelected ? palette.tabActive : palette.iconTint}
            />
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
  palette }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
  palette: AppThemePalette;
}) {
  const styles = {
    primary: { backgroundColor: palette.tabActive, color: palette.onBrand },
    danger: { backgroundColor: 'transparent', color: palette.negative },
    secondary: { backgroundColor: palette.card, color: palette.text } } as const;
  const picked = styles[variant];
  return (
    <TouchableOpacity delayPressIn={0}
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        minHeight: variant === 'danger' ? 0 : 56,
        paddingVertical: variant === 'danger' ? 8 : 12,
        borderRadius: 18,
        backgroundColor: picked.backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: variant === 'secondary' ? palette.border : 'transparent',
        paddingHorizontal: 20 }}
    >
      <Text style={{ fontSize: variant === 'primary' ? HOME_TEXT.rowLabel : TYPE.section, fontWeight: variant === 'danger' ? '500' : '600', color: picked.color }}>{label}</Text>
    </TouchableOpacity>
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
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SCREEN_GUTTER,
        paddingTop: 12,
        paddingBottom: (insets.bottom || 16) + 4,
        backgroundColor: palette.background,
        gap: 12 }}
    >
      {children}
    </View>
  );
}

export function SettingsScreenLayout({
  children,
  palette,
  bottomAction }: {
  children: ReactNode;
  palette: AppThemePalette;
  bottomAction?: ReactNode;
}) {
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: 8 }}
      >
        {children}
      </ScrollView>
      {bottomAction}
    </SafeAreaView>
  );
}

export function SettingsFormLayout({
  children,
  palette,
  bottomActions,
  scrollRef }: {
  children: ReactNode;
  palette: AppThemePalette;
  bottomActions?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: SCREEN_GUTTER,
            paddingTop: SPACING.md,
            paddingBottom: 150,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>{children}</View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
      {bottomActions}
    </SafeAreaView>
  );
}
