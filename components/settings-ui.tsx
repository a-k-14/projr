import { ReactNode } from 'react';
import { Text, TouchableOpacity, View, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { AppThemePalette } from '../lib/theme';
import { RADIUS, SPACING, TYPE } from '../lib/design';

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
    <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.md }}>
      <Text style={{ fontSize: 24, fontWeight: '600', color: palette.text }}>{title}</Text>
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
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        color: palette.textMuted,
        marginHorizontal: SPACING.lg,
        marginBottom: 6,
        marginTop: SPACING.md,
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
        backgroundColor: palette.surface,
        borderRadius: RADIUS.lg,
        marginHorizontal: SPACING.lg,
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
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      style={{
        minHeight: 62,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider,
      }}
    >
      <Feather name={icon} size={18} color={palette.iconTint} />
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '500',
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
    </Container>
  );
}

export function ChoiceRow({
  title,
  subtitle,
  selected,
  palette,
  onPress,
  noBorder,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  palette: AppThemePalette;
  onPress: () => void;
  noBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        minHeight: 56,
        paddingHorizontal: SPACING.lg,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: noBorder ? 0 : 1,
        borderBottomColor: palette.divider,
        backgroundColor: selected ? (palette.background === '#11161F' ? '#182131' : '#F6FAF7') : palette.surface,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.text }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 2, lineHeight: 16 }}>{subtitle}</Text>
        ) : null}
      </View>
      {selected ? <Feather name="check" size={18} color={palette.tabActive} /> : null}
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
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        minHeight: 44,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: selected ? palette.tabActive : palette.border,
        backgroundColor: selected ? (palette.background === '#11161F' ? '#182131' : '#E8F3EC') : palette.surface,
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
    <Text style={{ fontSize: 11, fontWeight: '600', color: palette.textMuted, marginBottom: 4 }}>
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
    danger: { backgroundColor: '#CC3B2D', color: '#FFFFFF' },
    secondary: { backgroundColor: palette.surface, color: palette.text },
  } as const;
  const picked = styles[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: RADIUS.md,
        backgroundColor: picked.backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: variant === 'secondary' ? palette.border : 'transparent',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: picked.color }}>{label}</Text>
    </TouchableOpacity>
  );
}
