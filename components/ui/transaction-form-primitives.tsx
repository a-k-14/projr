import { AppIcon } from '@/components/ui/AppIcon';
import { RefObject, useState } from 'react';
import { Text } from '@/components/ui/AppText';
import { Platform, TextInput, View , TouchableOpacity } from 'react-native';
import { formatDate } from '../../lib/dateUtils';
import { formatIndianNumberStr } from '../../lib/derived';
import { SCREEN_GUTTER } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

export const ROW_LABEL_WIDTH = 92;
export const ROW_MIN_HEIGHT = 62;
export const ROW_COLUMN_GAP = 16;
export const ROW_TRAILING_WIDTH = 24;

function sanitizeDecimalInput(value: string): string {
  const isNegative = value.trim().startsWith('-');
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
        borderRadius: 24,
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
  showChevron = true }: {
  label: string;
  value: string | React.ReactNode;
  subtitle?: string;
  placeholder?: boolean;
  onPress: () => void;
  palette: AppThemePalette;
  custom?: boolean;
  showChevron?: boolean;
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
          fontWeight: '700',
          color: palette.textMuted,
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
          minHeight: ROW_MIN_HEIGHT,
          paddingLeft: 4,
        }}
      >
        {custom ? (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>{value}</View>
            {showChevron ? (
              <View style={{ width: ROW_TRAILING_WIDTH, alignItems: 'flex-start', justifyContent: 'center' }}>
                <AppIcon name="chevron-right" size={15} color={palette.textSoft} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: HOME_TEXT.sectionTitle,
                  fontWeight: '400',
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
                    fontSize: HOME_TEXT.bodySmall,
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
            <View style={{ width: ROW_TRAILING_WIDTH, alignItems: 'flex-start', justifyContent: 'center' }}>
              <AppIcon name="chevron-right" size={15} color={palette.textSoft} />
            </View>
          </>
        )}
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
          fontWeight: '700',
          color: palette.textMuted,
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
            fontSize: HOME_TEXT.sectionTitle,
            fontWeight: '400',
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
  noBorder }: {
  label: string;
  children: React.ReactNode;
  palette: AppThemePalette;
  noBorder?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: SCREEN_GUTTER,
        paddingVertical: 14,
        borderBottomWidth: noBorder === false ? 1 : 0,
        borderBottomColor: palette.border }}
    >
      <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.textMuted, marginBottom: 8 }}>
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
          fontWeight: '700',
          color: palette.textMuted,
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
                borderRadius: 14,
                borderWidth: 1.5,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
                backgroundColor: option.selected ? option.activeBg : palette.inputBg,
                borderColor: option.selected ? option.activeColor : palette.divider }}
            >
              <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '700', color: option.selected ? option.activeColor : palette.text }}>
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
  const timeStr = dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

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
          fontWeight: '700',
          color: palette.textMuted,
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
            backgroundColor: palette.inputBg,
            paddingVertical: 9,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center' }}
        >
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text }}>{dateStr}</Text>
        </TouchableOpacity>
        <TouchableOpacity delayPressIn={0}
          onPress={onOpenTime}
          style={{
            flex: 0.9,
            backgroundColor: palette.inputBg,
            paddingVertical: 9,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center' }}
        >
          <Text style={{ fontSize: HOME_TEXT.bodySmall, fontWeight: '600', color: palette.text }}>{timeStr}</Text>
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
  onPressAmount,
  autoFocus = false,
  calculatorButtonVariant = 'large',
  editable = true,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
}: {
  sym: string;
  amountStr: string;
  setAmountStr: (value: string) => void;
  palette: AppThemePalette;
  accentColor: string;
  onOpenCalculator?: () => void;
  onPressAmount?: () => void;
  autoFocus?: boolean;
  calculatorButtonVariant?: 'compact' | 'large';
  editable?: boolean;
  inputRef?: RefObject<TextInput | null>;
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: React.ComponentProps<typeof TextInput>['onSubmitEditing'];
  blurOnSubmit?: boolean;
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
          fontWeight: '700',
          color: palette.textMuted,
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
            placeholderTextColor={palette.textSoft}
            editable={editable && !onPressAmount}
            style={{
              flex: 1,
              fontSize: HOME_TEXT.sectionTitle,
              fontWeight: '500',
              color: editable ? accentColor : palette.text,
              paddingBottom: 2,
              paddingTop: 0,
              paddingLeft: 4,
              textAlign: 'left',
              lineHeight: 24,
              borderBottomWidth: editable ? (isFocused ? 1.5 : 1) : 1,
              borderBottomColor: editable ? (isFocused ? accentColor : palette.borderSoft ?? palette.border) : palette.borderSoft ?? palette.border,
              opacity: editable ? 1 : 0.92 }}
            onFocus={() => editable && setIsFocused(true)}
            onBlur={() => editable && setIsFocused(false)}
            cursorColor={editable ? accentColor : palette.text}
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
          <TouchableOpacity delayPressIn={0}
            onPress={onOpenCalculator}
            style={{
              marginLeft: isLargeButton ? SCREEN_GUTTER : 0,
              width: isLargeButton ? ROW_TRAILING_WIDTH + 24 : ROW_TRAILING_WIDTH + 16,
              height: isLargeButton ? 48 : undefined,
              minHeight: ROW_MIN_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center' }}
          >
            <View
              style={{
                width: isLargeButton ? 44 : 34,
                height: isLargeButton ? 44 : 34,
                borderRadius: isLargeButton ? 14 : 12,
                backgroundColor: palette.inputBg,
                alignItems: 'center',
                justifyContent: 'center' }}
            >
              <AppIcon name="calculator"
                size={isLargeButton ? 22 : 18}
                color={isLargeButton ? palette.textSecondary : palette.textMuted}
              />
            </View>
          </TouchableOpacity>
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
}) {
  const [isFocused, setIsFocused] = useState(false);

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
          fontWeight: '700',
          color: palette.textMuted,
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
          placeholderTextColor={palette.textSoft}
          cursorColor={accentColor || palette.tabActive}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: HOME_TEXT.sectionTitle,
            fontWeight: '400',
            color: palette.text,
            paddingBottom: 2,
            paddingTop: 0,
            paddingLeft: 4,
            textAlign: 'left',
            lineHeight: 20,
            borderBottomWidth: isFocused ? 1.5 : 1,
            borderBottomColor: isFocused ? accentColor || palette.tabActive : palette.borderSoft }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
  onFocus }: {
  note: string;
  onChangeNote: (value: string) => void;
  palette: AppThemePalette;
  accentColor?: string;
  onFocus?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: SCREEN_GUTTER, paddingVertical: 14 }}>
      <Text appWeight="medium" style={{ fontSize: HOME_TEXT.body, fontWeight: '700', color: palette.textMuted, marginBottom: 10 }}>
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
          fontSize: HOME_TEXT.sectionTitle,
          color: palette.text,
          paddingVertical: 0,
          textAlignVertical: 'top' }}
        multiline
      />
    </View>
  );
}
