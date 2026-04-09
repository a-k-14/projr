import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { RADIUS, SCREEN_GUTTER, SHEET_GUTTER, SPACING, TYPE } from '../lib/design';
import type { AppThemePalette } from '../lib/theme';

export function ScreenTitle({
  title,
  subtitle,
  palette,
}: {
  title: string;
  subtitle?: string;
  palette: AppThemePalette;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: SPACING.md }}>
      <Text style={{ fontSize: 26, fontWeight: '700', color: palette.text, letterSpacing: -0.5 }}>{title}</Text>
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
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 1.2,
        color: palette.textMuted,
        marginHorizontal: SCREEN_GUTTER,
        marginBottom: 6,
        marginTop: 4,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Text>
  );
}

export function CardSection({
  children,
  palette,
}: {
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
        marginBottom: SPACING.lg,
      }}
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
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  palette: AppThemePalette;
  onPress?: () => void;
  noBorder?: boolean;
  rightElement?: ReactNode;
}) {
  const content = (
    <>
      <Feather name={icon} size={18} color={palette.iconTint} />
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '400',
          color: palette.text,
          marginLeft: 14,
        }}
      >
        {label}
      </Text>
      {rightElement ? rightElement : null}
      {!rightElement && value ? (
        <Text style={{ fontSize: 13, color: palette.textMuted, marginRight: 10 }} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !rightElement ? <Feather name="chevron-right" size={18} color={palette.textSoft} /> : null}
    </>
  );

  const style = {
    minHeight: 62,
    paddingHorizontal: SCREEN_GUTTER,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderBottomWidth: noBorder ? 0 : 1,
    borderBottomColor: palette.divider,
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} delayPressIn={0} style={style}>
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
  horizontalPadding = SHEET_GUTTER,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  palette: AppThemePalette;
  onPress: () => void;
  noBorder?: boolean;
  leftElement?: ReactNode;
  horizontalPadding?: number;
}) {
  const isDarkMode = palette.statusBarStyle === 'light';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      delayPressIn={0}
      style={{
        minHeight: 68,
        paddingHorizontal: horizontalPadding,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected
          ? isDarkMode
            ? palette.surfaceRaised
            : 'rgba(23, 103, 59, 0.05)'
          : 'transparent',
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider,
      }}
    >
      {leftElement && <View style={{ marginRight: 14 }}>{leftElement}</View>}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: selected ? '500' : '400',
            color: selected ? palette.tabActive : palette.text,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 13,
              color: palette.textMuted,
              marginTop: 2,
              lineHeight: 18,
              fontWeight: '400',
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {selected && (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: palette.tabActive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="check" size={13} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export function PickerChip({
  label,
  selected,
  palette,
  onPress,
}: {
  label: string;
  selected?: boolean;
  palette: AppThemePalette;
  onPress: () => void;
}) {
  const isDarkMode = palette.statusBarStyle === 'light';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: selected ? palette.tabActive : palette.border,
        backgroundColor: selected ? (isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#E8F3EC') : palette.surface,
        paddingHorizontal: SPACING.lg,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FieldLabel({ label, palette }: { label: string; palette: AppThemePalette }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: '500', color: palette.textMuted, marginBottom: 4 }}>
      {label}
    </Text>
  );
}

export function InputField({
  palette,
  ...props
}: React.ComponentProps<typeof TextInput> & { palette: AppThemePalette }) {
  return (
    <TextInput
      {...props}
      style={[
        {
          minHeight: 46,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          paddingHorizontal: SPACING.lg,
          color: palette.text,
          fontSize: 15,
        },
        props.style as any,
      ]}
      placeholderTextColor={palette.textSoft}
    />
  );
}

export function ColorGrid({
  colors,
  selectedColor,
  onSelect,
  palette,
}: {
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
          <TouchableOpacity
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
              justifyContent: 'center',
            }}
          >
            {isSelected && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#FFFFFF',
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
  palette,
}: {
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
          <TouchableOpacity
            key={icon}
            activeOpacity={0.7}
            onPress={() => onSelect(icon)}
            style={{
              width: '18%',
              aspectRatio: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isSelected ? palette.tabActive : palette.border,
              backgroundColor: isSelected
                ? palette.surfaceRaised
                : palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather
              name={icon as any}
              size={20}
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
  palette,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
  palette: AppThemePalette;
}) {
  const styles = {
    primary: { backgroundColor: palette.tabActive, color: '#FFFFFF' },
    danger: { backgroundColor: 'rgba(204, 59, 45, 0.1)', color: '#CC3B2D' },
    secondary: { backgroundColor: palette.card, color: palette.text },
  } as const;
  const picked = styles[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        minHeight: 52,
        borderRadius: 16,
        backgroundColor: picked.backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: variant === 'secondary' ? palette.border : 'transparent',
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: picked.color }}>{label}</Text>
    </TouchableOpacity>
  );
}
