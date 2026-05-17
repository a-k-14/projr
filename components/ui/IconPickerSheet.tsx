import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/AppText';
import { BottomSheet } from './BottomSheet';
import { IconGrid } from '../settings-ui';
import {
  CATEGORY_EMOJI_GROUPS,
  CATEGORY_ICONS,
  suggestCategoryEmojis,
} from '../../lib/settings-shared';
import { HOME_RADIUS } from '../../lib/layoutTokens';
import { SPACING, TYPE, FONT_WEIGHT } from '../../lib/design';
import { AppThemePalette } from '../../lib/theme';

interface IconPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (icon: string) => void;
  selectedIcon: string;
  palette: AppThemePalette;
  name?: string;
}

export function IconPickerSheet({
  visible,
  onClose,
  onSelect,
  selectedIcon,
  palette,
  name = '',
}: IconPickerSheetProps) {
  const [tab, setTab] = useState<'icons' | 'emojis'>('icons');
  const suggestedEmojis = useMemo(() => suggestCategoryEmojis(name), [name]);

  if (!visible) return null;

  return (
    <BottomSheet
      title="Choose Icon"
      palette={palette}
      onClose={onClose}
    >
      <View style={{ padding: SPACING.md }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['icons', 'emojis'] as const).map((t) => {
            const selected = tab === t;
            return (
              <TouchableOpacity
                delayPressIn={0}
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  minHeight: 38,
                  borderRadius: HOME_RADIUS.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: selected ? palette.tabActive : palette.border,
                  backgroundColor: selected ? palette.brandSoft : palette.surface,
                }}
              >
                <Text
                  appWeight="medium"
                  style={{
                    fontSize: TYPE.body,
                    fontWeight: FONT_WEIGHT.bold,
                    color: selected ? palette.tabActive : palette.textMuted,
                  }}
                >
                  {t === 'icons' ? 'Icons' : 'Emojis'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'emojis' ? (
          <>
            {suggestedEmojis.length > 0 && (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: TYPE.body, fontWeight: FONT_WEIGHT.bold, color: palette.textMuted }}>
                  Suggested For "{name.trim()}"
                </Text>
                <IconGrid
                  icons={suggestedEmojis}
                  selectedIcon={selectedIcon}
                  onSelect={(ic) => {
                    onSelect(ic);
                    onClose();
                  }}
                  palette={palette}
                />
              </View>
            )}
            {CATEGORY_EMOJI_GROUPS.map((group) => (
              <View key={group.name} style={{ gap: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: TYPE.body, fontWeight: FONT_WEIGHT.bold, color: palette.textMuted }}>
                  {group.name}
                </Text>
                <IconGrid
                  icons={group.emojis}
                  selectedIcon={selectedIcon}
                  onSelect={(ic) => {
                    onSelect(ic);
                    onClose();
                  }}
                  palette={palette}
                />
              </View>
            ))}
          </>
        ) : (
          <IconGrid
            icons={CATEGORY_ICONS}
            selectedIcon={selectedIcon}
            onSelect={(ic) => {
              onSelect(ic);
              onClose();
            }}
            palette={palette}
          />
        )}
      </View>
    </BottomSheet>
  );
}
