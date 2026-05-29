import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { Text } from './AppText';
import { AppIcon } from './AppIcon';
import { PillIconButton } from './PillIconButton';
import { ACTIVITY_LAYOUT, BUTTON_TOKENS, HOME_TEXT } from '../../lib/layoutTokens';
import { type AppThemePalette } from '../../lib/theme';

interface HeaderSearchTriggerProps {
  onPress: () => void;
  palette: AppThemePalette;
}

/**
 * HeaderSearchTrigger — Centralized header button to activate search.
 */
export function HeaderSearchTrigger({ onPress, palette }: HeaderSearchTriggerProps) {
  return (
    <PillIconButton
      icon="search"
      onPress={onPress}
      palette={palette}
    />
  );
}

interface HeaderSearchBarProps {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClose: () => void;
  palette: AppThemePalette;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: any) => void;
}

/**
 * HeaderSearchBar — Reusable, beautifully animated search input bar for screen headers.
 * Copy-pastes and preserves exact dimensions and padding without guessing or shifts.
 */
export function HeaderSearchBar({
  visible,
  value,
  onChangeText,
  placeholder,
  onClose,
  palette,
  style,
  onLayout,
}: HeaderSearchBarProps) {
  if (!visible) return null;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.topBar,
        {
          backgroundColor: palette.background,
          borderBottomColor: palette.divider,
          flexDirection: 'row',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: palette.surface,
            borderColor: palette.divider,
            flex: 1,
          },
        ]}
      >
        <AppIcon name="search" size={15} color={palette.textMuted} />
        <TextInput
          autoFocus
          placeholder={placeholder}
          placeholderTextColor={palette.textSoft}
          value={value}
          onChangeText={onChangeText}
          style={{ flex: 1, fontSize: HOME_TEXT.body, color: palette.text, padding: 0 }}
          returnKeyType="search"
        />
        {value.length > 0 ? (
          <TouchableOpacity delayPressIn={0} onPress={() => onChangeText('')}>
            <AppIcon name="x-circle" size={16} color={palette.textSoft} />
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity delayPressIn={0} onPress={onClose}>
        <Text
          appWeight="medium"
          style={{
            fontSize: HOME_TEXT.body,
            fontWeight: BUTTON_TOKENS.text.compactLabelWeight,
            color: palette.brand,
            marginLeft: 12,
          }}
        >
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 0,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: ACTIVITY_LAYOUT.chipRadius,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
});
