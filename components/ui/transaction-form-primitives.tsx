import { AppChevron } from '@/components/ui/AppChevron';
import { CalculatorTrigger } from '@/components/ui/CalculatorTrigger';
import { RefObject, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { TextInput, View , TouchableOpacity, Pressable } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { formatDate, APP_LOCALE } from '../../lib/dateUtils';
import { formatIndianNumberStr } from '../../lib/derived';
import { SCREEN_GUTTER , FONT_WEIGHT} from '../../lib/design';
import { HOME_TEXT , HOME_RADIUS} from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export const ROW_LABEL_WIDTH = 92;
export const ROW_MIN_HEIGHT = 62;
export const ROW_COLUMN_GAP = 16;
export const ROW_TRAILING_WIDTH = 24;

export function sanitizeDecimalInput(value: string): string {
  const trimVal = value.trim();
  const minusCount = (trimVal.match(/-/g) || []).length;
  // If it has exactly 1 minus, it is negative. If it has 2 minus, they toggle/cancel out to positive.
  const isNegative = minusCount === 1;

  let cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return isNegative ? '-' : '';
  const parts = cleaned.split('.');
  if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
  if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') cleaned = cleaned.substring(1);
  return `${isNegative ? '-' : ''}${cleaned}`;
}

export function SectionCard({
  children,
  palette,
  horizontalInset = SCREEN_GUTTER }: {
  children: React.ReactNode;
  palette: AppThemePalette;
  horizontalInset?: number;
}) {
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: HOME_RADIUS.large,
        marginHorizontal: horizontalInset,
        borderWidth: 1,
        borderColor: palette.border,
        overflow: 'hidden' }}
    >
      {children}
    </View>
  );
}

export function PickerRow({
  label,
  value,
  subtitle,
  placeholder,
  onPress,
  palette,
  custom = false,
  showChevron = true,
  hasError = false }: {
  label: string;
  value: string | React.ReactNode;
  subtitle?: string;
  placeholder?: boolean;
  onPress: () => void;
  palette: AppThemePalette;
  custom?: boolean;
  showChevron?: boolean;
  hasError?: boolean;
}) {
  return (
    <TouchableOpacity
      delayPressIn={0}
      onPress={onPress}
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: hasError ? palette.negative : palette.textSecondary,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: 0,
          paddingLeft: 4,
        }}
      >
        {custom ? (
          <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, justifyContent: 'center' }}>
            {value}
          </View>
        ) : (
          <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, justifyContent: 'center' }}>
            <Text
              appWeight="medium"
              style={{
                fontSize: HOME_TEXT.body,
                fontWeight: FONT_WEIGHT.medium,
                color: placeholder ? palette.textMuted : palette.text,
                textAlign: 'left',
              }}
              numberOfLines={1}
            >
              {value}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontSize: HOME_TEXT.body,
                  color: palette.textMuted,
                  marginTop: 2,
                  lineHeight: 17,
                }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}
        {showChevron ? (
          <View style={{ width: ROW_TRAILING_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
            <AppChevron direction="right" size={18} tone="secondary" palette={palette} />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function DisplayRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: AppThemePalette;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center' }}
    >
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: palette.textSecondary,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          minHeight: ROW_MIN_HEIGHT,
          paddingLeft: 4 }}
      >
        <Text
          style={{
            fontSize: HOME_TEXT.bodyLarge,
            fontWeight: FONT_WEIGHT.medium,
            color: palette.text,
            textAlign: 'left',
            flexShrink: 1 }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export function FieldRow({
  label,
  children,
  palette,
  noBorder,
  hasError = false }: {
  label: string;
  children: React.ReactNode;
  palette: AppThemePalette;
  noBorder?: boolean;
  hasError?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingVertical: 14,
        borderBottomWidth: noBorder === false ? 1 : 0,
        borderBottomColor: palette.border }}
    >
      <Text
        appWeight="medium"
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: hasError ? palette.negative : palette.textSecondary,
          marginBottom: 8
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {children}
      </View>
    </View>
  );
}

export function OptionChipRow({
  label,
  palette,
  options,
  helperText }: {
  label: string;
  palette: AppThemePalette;
  options: { label: string; selected: boolean; onPress: () => void; activeColor: string; activeBg: string }[];
  helperText?: string;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 18, paddingBottom: 14 }}>
      <Text
        appWeight="medium"
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: palette.textSecondary,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP,
          paddingTop: 10 }}
      >
        {label}
      </Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {options.map((option) => (
            <TouchableOpacity delayPressIn={0}
              key={option.label}
              onPress={option.onPress}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: HOME_RADIUS.pill,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
                backgroundColor: option.selected ? option.activeBg : palette.inputBg,
                borderColor: option.selected ? option.activeColor : palette.divider }}
            >
              <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.bold, color: option.selected ? option.activeColor : palette.text }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {helperText ? (
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted }}>
            {helperText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function InteractiveDateTimeRow({
  date,
  palette,
  onOpenDate,
  onOpenTime }: {
  date: string;
  palette: AppThemePalette;
  onOpenDate: () => void;
  onOpenTime: () => void;
}) {
  const dt = new Date(date);
  const dateStr = formatDate(date);
  const timeStr = dt.toLocaleTimeString(APP_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  const chipBg = palette.states.interactiveChipBg;

  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center' }}
    >
      <Text
        appWeight="medium"
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: palette.textSecondary,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP }}
      >
        Date
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: ROW_MIN_HEIGHT,
          paddingLeft: 4,
          gap: 8 }}
      >
        <TouchableOpacity delayPressIn={0}
          onPress={onOpenDate}
          style={{
            flex: 1.5,
            backgroundColor: chipBg,
            paddingVertical: 9,
            borderRadius: HOME_RADIUS.chip,
            alignItems: 'center',
            justifyContent: 'center' }}
        >
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{dateStr}</Text>
        </TouchableOpacity>
        <TouchableOpacity delayPressIn={0}
          onPress={onOpenTime}
          style={{
            flex: 0.9,
            backgroundColor: chipBg,
            paddingVertical: 9,
            borderRadius: HOME_RADIUS.chip,
            alignItems: 'center',
            justifyContent: 'center' }}
        >
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}>{timeStr}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function AmountRow({
  sym,
  amountStr,
  setAmountStr,
  palette,
  accentColor,
  onOpenCalculator,
  onDelete,
  onPressAmount,
  autoFocus = false,
  calculatorButtonVariant = 'large',
  editable = true,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  hasError = false,
}: {
  sym: string;
  amountStr: string;
  setAmountStr: (value: string) => void;
  palette: AppThemePalette;
  accentColor: string;
  onOpenCalculator?: () => void;
  onDelete?: () => void;
  onPressAmount?: () => void;
  autoFocus?: boolean;
  calculatorButtonVariant?: 'compact' | 'large';
  editable?: boolean;
  inputRef?: RefObject<TextInput | null>;
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: React.ComponentProps<typeof TextInput>['onSubmitEditing'];
  blurOnSubmit?: boolean;
  hasError?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const isLargeButton = calculatorButtonVariant === 'large';

  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center' }}
    >
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: hasError ? palette.negative : palette.textSecondary,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP }}
      >
        Amount {sym ? `(${sym})` : ''}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            position: 'relative' }}
        >
          <TextInput
            ref={inputRef}
            value={amountStr}
            onChangeText={(value) => setAmountStr(formatIndianNumberStr(sanitizeDecimalInput(value)))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={hasError ? palette.negative : palette.textSoft}
            editable={editable && !onPressAmount}
            style={{
              flex: 1,
              fontSize: HOME_TEXT.sectionTitle,
              fontWeight: FONT_WEIGHT.medium,
              color: editable ? (hasError ? palette.negative : accentColor) : palette.text,
              paddingBottom: 2,
              paddingTop: 0,
              paddingLeft: 4,
              textAlign: 'left',
              lineHeight: 24,
              borderBottomWidth: editable ? (isFocused ? 1.5 : 1) : 1,
              borderBottomColor: hasError
                ? palette.negative
                : editable
                ? (isFocused ? accentColor : palette.borderSoft ?? palette.border)
                : palette.borderSoft ?? palette.border,
              opacity: editable ? 1 : 0.92 }}
            onFocus={() => editable && setIsFocused(true)}
            onBlur={() => editable && setIsFocused(false)}
            cursorColor={editable ? (hasError ? palette.negative : accentColor) : palette.text}
            autoFocus={autoFocus && !onPressAmount}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={blurOnSubmit}
          />
          {onPressAmount ? (
            <TouchableOpacity
              delayPressIn={0}
              activeOpacity={0.72}
              onPress={onPressAmount}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              }}
            />
          ) : null}
        </View>
        {onOpenCalculator ? (
          <View
            style={{
              marginLeft: isLargeButton ? SCREEN_GUTTER : 0,
              width: isLargeButton ? ROW_TRAILING_WIDTH + 24 : ROW_TRAILING_WIDTH + 16,
              height: isLargeButton ? 48 : undefined,
              minHeight: ROW_MIN_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center' }}
          >
            <CalculatorTrigger
              palette={palette}
              onPress={onOpenCalculator}
              size={isLargeButton ? 'large' : 'compact'}
            />
          </View>
        ) : null}
        {onDelete ? (
          <View
            style={{
              marginLeft: isLargeButton ? SCREEN_GUTTER : 0,
              width: isLargeButton ? ROW_TRAILING_WIDTH + 24 : ROW_TRAILING_WIDTH + 16,
              height: isLargeButton ? 48 : undefined,
              minHeight: ROW_MIN_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center' }}
          >
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => ({
                width: isLargeButton ? 44 : 30,
                height: isLargeButton ? 44 : 30,
                borderRadius: isLargeButton ? HOME_RADIUS.button : HOME_RADIUS.chip,
                backgroundColor: pressed ? palette.surface : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <View
                style={{
                  width: isLargeButton ? 44 : 30,
                  height: isLargeButton ? 44 : 30,
                  borderRadius: isLargeButton ? HOME_RADIUS.button : HOME_RADIUS.chip,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.divider,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppIcon name="trash-2" size={isLargeButton ? 20 : 16} color={palette.negative} strokeWidth={1.8} />
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function TextInputRow({
  label,
  value,
  onChangeText,
  palette,
  placeholder,
  accentColor,
  autoFocus = false,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  onFocus,
  onBlur,
  hasError = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  palette: AppThemePalette;
  placeholder?: string;
  accentColor?: string;
  autoFocus?: boolean;
  inputRef?: RefObject<TextInput | null>;
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: React.ComponentProps<typeof TextInput>['onSubmitEditing'];
  blurOnSubmit?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  hasError?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const activeColor = accentColor || palette.brand;

  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        minHeight: ROW_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center' }}
    >
      <Text
        appWeight="medium"
        numberOfLines={1}
        style={{
          fontSize: HOME_TEXT.body,
          fontWeight: FONT_WEIGHT.medium,
          color: hasError ? palette.negative : palette.textSecondary,
          width: ROW_LABEL_WIDTH,
          paddingRight: ROW_COLUMN_GAP }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center' }}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={hasError ? palette.negative : palette.textSoft}
          cursorColor={hasError ? palette.negative : activeColor}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: HOME_TEXT.bodyLarge,
            fontWeight: FONT_WEIGHT.regular,
            color: hasError ? palette.negative : palette.text,
            paddingBottom: 2,
            paddingTop: 0,
            paddingLeft: 4,
            textAlign: 'left',
            lineHeight: 20,
            borderBottomWidth: isFocused ? 1.5 : 1,
            borderBottomColor: hasError
              ? palette.negative
              : isFocused
              ? activeColor
              : palette.borderSoft }}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
        />
      </View>
    </View>
  );
}

export function NotesSection({
  note,
  onChangeNote,
  palette,
  accentColor,
  onFocus,
  onBlur }: {
  note: string;
  onChangeNote: (value: string) => void;
  palette: AppThemePalette;
  accentColor?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14 }}>
      <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginBottom: 10 }}>
        Notes
      </Text>
      <TextInput
        value={note}
        onChangeText={onChangeNote}
        onFocus={onFocus}
        placeholder="Add a note..."
        placeholderTextColor={palette.textSoft}
        cursorColor={accentColor || palette.tabActive}
        style={{
          minHeight: 72,
          fontSize: HOME_TEXT.bodyLarge,
          color: palette.text,
          paddingVertical: 0,
          textAlignVertical: 'top' }}
        onBlur={onBlur}
        multiline
      />
    </View>
  );
}
