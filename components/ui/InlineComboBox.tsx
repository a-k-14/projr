/**
 * InlineComboBox — single reusable inline autocomplete component.
 *
 * Three usage modes:
 *   Person  → filterLocally + showAdd  (filters full list, offers "Add X")
 *   Payee   → default                  (parent provides pre-filtered suggestions)
 *   Notes   → multiline                (textarea layout, parent provides suggestions)
 */
import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../../lib/design';
import { HOME_TEXT } from '../../lib/layoutTokens';
import { normalizePerson } from '../../services/persons';
import type { AppThemePalette } from '../../lib/theme';
import {
  ROW_COLUMN_GAP,
  ROW_LABEL_WIDTH,
  ROW_MIN_HEIGHT,
} from './transaction-form-primitives';

const ROW_HEIGHT = 50;
const MAX_VISIBLE = 5;
const OPEN_MS = 210;

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Full list (filterLocally) or pre-filtered list (parent handles filtering) */
  suggestions: string[];
  palette: AppThemePalette;
  accentColor?: string;
  placeholder?: string;
  /** Filter suggestions locally by current query and normalise input */
  filterLocally?: boolean;
  /** Show "Add X" row when filterLocally is true and typed text has no exact match */
  showAdd?: boolean;
  /** Notes layout: label above, full-width multiline textarea */
  multiline?: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Force a specific keyboard (e.g. 'decimal-pad' for numeric fields). Default is text. */
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad';
  /** Short annotation shown to the right of the input (e.g. "% p.a.") */
  rightAnnotation?: string;
  required?: boolean;
  hasError?: boolean;
  leftIcon?: string;
  hideLabel?: boolean;
}

export function InlineComboBox({
  label,
  value,
  onChange,
  suggestions,
  palette,
  accentColor,
  placeholder,
  filterLocally = false,
  showAdd = false,
  multiline = false,
  autoFocus = false,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  keyboardType = 'default',
  rightAnnotation,
  hasError = false,
  leftIcon,
  hideLabel = false,
}: Props) {
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const suppressBlurRef = useRef(false);
  const listH = useSharedValue(0);
  const listAlpha = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  // Sync query when value changes externally (editing mode)
  useEffect(() => { setQuery(value); }, [value]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const normalized = filterLocally ? normalizePerson(query) : query.trim();

  const displayList = useMemo(() => {
    if (!filterLocally) return suggestions;
    if (!query.trim()) return [];
    return suggestions.filter(
      (person) =>
        normalizePerson(person).includes(normalized) &&
        normalizePerson(person) !== normalized
    );
  }, [suggestions, query, filterLocally, normalized]);

  const showAddRow =
    showAdd &&
    filterLocally &&
    query.trim() !== '' &&
    !suggestions.map(normalizePerson).includes(normalized);

  const rowCount = displayList.length + (showAddRow ? 1 : 0);

  // ── Collapsible animations ──────────────────────────────────────────────────
  const expand = useCallback(() => {
    'worklet';
    listH.value = withTiming(Math.min(rowCount, MAX_VISIBLE) * ROW_HEIGHT, {
      duration: OPEN_MS,
      easing: Easing.out(Easing.ease),
    });
    listAlpha.value = withTiming(1, { duration: OPEN_MS });
  }, [rowCount, listH, listAlpha]);

  const collapse = useCallback(() => {
    'worklet';
    listH.value = 0;
    listAlpha.value = 0;
  }, [listH, listAlpha]);

  useEffect(() => {
    if (isFocused && rowCount > 0) expand();
    else collapse();
  }, [isFocused, rowCount, expand, collapse]);

  const animStyle = useAnimatedStyle(() => ({
    height: listH.value,
    opacity: listAlpha.value,
  }));

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChangeText = (text: string) => {
    setQuery(text);
    onChange(text);
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocusProp?.();
  };

  const handleBlur = () => {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      return;
    }
    setIsFocused(false);
    onBlurProp?.();
  };

  const handleSelect = (name: string) => {
    setQuery(name);
    onChange(name);
    setIsFocused(false);
    collapse();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const focusedColor = accentColor ?? palette.tabActive;

  const inputBaseStyle = {
    fontSize: HOME_TEXT.bodyLarge,
    color: palette.text,
    paddingTop: 0,
    paddingBottom: 2,
    borderBottomWidth: isFocused ? 1.5 : 1,
    borderBottomColor: hasError ? palette.negative : (isFocused ? focusedColor : palette.borderSoft),
  } as const;

  return (
    <View>
      {/* Input row */}
      {multiline ? (
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={leftIcon ? {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 12,
          } : {
            paddingHorizontal: SCREEN_GUTTER,
            paddingVertical: 14,
          }}
        >
          {leftIcon ? (
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <AppIcon name={leftIcon} size={18} color={palette.text} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            {!hideLabel && (
              <Text
                appWeight="medium"
                style={{
                  fontSize: HOME_TEXT.body,
                  fontWeight: FONT_WEIGHT.medium,
                  color: hasError ? palette.negative : palette.textSecondary,
                  marginBottom: 10,
                }}
              >
                {label}
              </Text>
            )}
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder ?? 'Add a note…'}
              placeholderTextColor={palette.textSoft}
              cursorColor={hasError ? palette.negative : (palette.isDark ? '#FFFFFF' : '#000000')}
              autoFocus={autoFocus}
              multiline
              style={{
                fontSize: HOME_TEXT.bodyLarge,
                color: palette.text,
                paddingVertical: 0,
                minHeight: 72,
                textAlignVertical: 'top',
                lineHeight: 20,
              }}
            />
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={{
            paddingHorizontal: SCREEN_GUTTER,
            minHeight: ROW_MIN_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text
            appWeight="medium"
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
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder ?? ''}
              placeholderTextColor={hasError ? palette.negative : palette.textSoft}
              autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
              keyboardType={keyboardType}
              cursorColor={hasError ? palette.negative : (palette.isDark ? '#FFFFFF' : '#000000')}
              autoFocus={autoFocus}
              style={[inputBaseStyle, {
                flex: 1,
                paddingLeft: 4,
                fontWeight: FONT_WEIGHT.regular,
                lineHeight: 20,
              }]}
            />
            {rightAnnotation ? (
              <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.medium, color: palette.textSecondary, marginLeft: 6, paddingBottom: 2 }}>
                {rightAnnotation}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}

      {/* Animated dropdown */}
      <Animated.View
        style={[
          {
            overflow: 'hidden',
            backgroundColor: palette.background,
            borderTopWidth: rowCount > 0 ? 1 : 0,
            borderBottomWidth: rowCount > 0 ? 1 : 0,
            borderColor: palette.divider,
          },
          animStyle,
        ]}
      >
        <View style={{ position: 'relative', backgroundColor: palette.background }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            scrollEnabled={rowCount > MAX_VISIBLE}
            nestedScrollEnabled
            bounces={rowCount <= MAX_VISIBLE}
          >
            {/* "Add X" row — person only */}
            {showAddRow ? (
              <TouchableOpacity
                delayPressIn={0}
                onPressIn={() => { suppressBlurRef.current = true; }}
                onPress={() => handleSelect(normalized)}
                activeOpacity={0.6}
                style={{
                  height: ROW_HEIGHT,
                  paddingHorizontal: SCREEN_GUTTER,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: palette.background,
                  borderBottomWidth: displayList.length > 0 ? 1 : 0,
                  borderBottomColor: palette.divider,
                }}
              >
                <AppIcon name="plus-circle" size={16} color={palette.brand} />
                <Text style={{ fontSize: HOME_TEXT.bodyLarge, fontWeight: FONT_WEIGHT.regular, color: palette.brand }}>
                  Add "{normalized}"
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Suggestion rows */}
            {displayList.map((item, i) => {
              const selected = item.toLowerCase() === value.toLowerCase();
              const last = i === displayList.length - 1;
              return (
                <TouchableOpacity
                  key={item}
                  delayPressIn={0}
                  onPressIn={() => { suppressBlurRef.current = true; }}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.6}
                  style={{
                    height: ROW_HEIGHT,
                    paddingHorizontal: SCREEN_GUTTER,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: selected ? palette.brandSoft : palette.background,
                    borderBottomWidth: last ? 0 : 1,
                    borderBottomColor: palette.divider,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: HOME_TEXT.body,
                      fontWeight: selected ? FONT_WEIGHT.medium : FONT_WEIGHT.regular,
                      color: selected ? palette.tabActive : palette.text,
                    }}
                  >
                    {item}
                  </Text>
                  {selected ? (
                    <AppIcon name="check" size={16} color={palette.tabActive} />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {/* Empty state — only for person (filterLocally) when list is empty */}
            {filterLocally && rowCount === 0 ? (
              <View style={{ height: ROW_HEIGHT, paddingHorizontal: SCREEN_GUTTER, justifyContent: 'center' }}>
                <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted }}>
                  Start typing to add a person
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

