import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/AppText';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_PADDING , FONT_WEIGHT} from '../../lib/design';
import { HOME_TEXT , HOME_RADIUS} from '../../lib/layoutTokens';
import { normalizePerson } from '../../services/persons';
import type { AppThemePalette } from '../../lib/theme';
import { getSheetBottomPadding } from './safeBottom';

interface PersonPickerSheetProps {
  persons: string[];
  value: string;
  palette: AppThemePalette;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function PersonPickerSheet({
  persons,
  value,
  palette,
  onSelect,
  onClose,
}: PersonPickerSheetProps) {
  const [query, setQuery] = useState(value);
  const insets = useSafeAreaInsets();

  const normalized = normalizePerson(query);

  const filtered = useMemo(() => {
    if (!normalized) return persons;
    return persons.filter((p) =>
      p.toLowerCase().includes(normalized.toLowerCase()),
    );
  }, [persons, normalized]);

  const exactMatch = persons.some(
    (p) => p.toLowerCase() === normalized.toLowerCase(),
  );
  const showAddRow = normalized.length > 0 && !exactMatch;

  function handleSelect(name: string) {
    onSelect(name);
    onClose();
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Backdrop — tap outside to dismiss */}
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: getSheetBottomPadding(insets, 16),
          }}
          onPress={onClose}
        >
          {/* Card — stop backdrop tap propagating through */}
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: palette.surface,
              borderRadius: HOME_RADIUS.large,
              borderWidth: 1,
              borderColor: palette.border,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: palette.isDark ? 0.5 : 0.14,
              shadowRadius: 24,
              elevation: 16,
            }}
          >
            {/* Search row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: CARD_PADDING,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: palette.divider,
                gap: 10,
              }}
            >
              <AppIcon name="search" size={17} color={palette.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search or type a name…"
                placeholderTextColor={palette.textSoft}
                autoFocus
                autoCapitalize="words"
                cursorColor={palette.brand}
                style={{
                  flex: 1,
                  fontSize: HOME_TEXT.body,
                  color: palette.text,
                  paddingVertical: 0,
                }}
              />
              {query.length > 0 ? (
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppIcon name="x" size={16} color={palette.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Results list */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 320 }}
              bounces={false}
            >
              {/* Add new row — shown when typed text has no exact match */}
              {showAddRow ? (
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => handleSelect(normalized)}
                  activeOpacity={0.6}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: CARD_PADDING,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderBottomWidth: filtered.length > 0 ? 1 : 0,
                    borderBottomColor: palette.divider,
                    backgroundColor: palette.brandSoft,
                  }}
                >
                  <AppIcon name="plus-circle" size={17} color={palette.brand} />
                  <Text
                    style={{
                      fontSize: HOME_TEXT.body,
                      fontWeight: FONT_WEIGHT.medium,
                      color: palette.brand,
                    }}
                  >
                    Add "{normalized}"
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Existing persons */}
              {filtered.map((name, i) => {
                const isSelected = name.toLowerCase() === value.toLowerCase();
                const isLast = i === filtered.length - 1;
                return (
                  <TouchableOpacity
                    key={name}
                    delayPressIn={0}
                    onPress={() => handleSelect(name)}
                    activeOpacity={0.6}
                    style={{
                      minHeight: 52,
                      paddingHorizontal: CARD_PADDING,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? palette.brandSoft : 'transparent',
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: palette.divider,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: HOME_TEXT.body,
                        fontWeight: isSelected ? '500' : '400',
                        color: isSelected ? palette.tabActive : palette.text,
                      }}
                    >
                      {name}
                    </Text>
                    {isSelected ? (
                      <AppIcon name="check" size={16} color={palette.tabActive} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {/* Empty state */}
              {filtered.length === 0 && !showAddRow ? (
                <View
                  style={{
                    paddingHorizontal: CARD_PADDING,
                    paddingVertical: 24,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted }}>
                    No persons found
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
