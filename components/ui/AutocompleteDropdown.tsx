/**
 * AutocompleteDropdown — floating suggestion popup that overlays the form.
 *
 * Renders inside a transparent, non-dismissing Modal so the list is never
 * clipped by parent scroll views or hidden under the keyboard.
 *
 * Smart placement:
 *   If `screenHeight - keyboardHeight - inputBottomY >= MIN_BELOW_SPACE`
 *   the dropdown opens BELOW the anchor, otherwise ABOVE.
 */
import { Text } from '@/components/ui/AppText';
import React, { RefObject, useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { HOME_RADIUS, HOME_SHADOW, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

const ROW_HEIGHT = 44;
const MIN_BELOW_SPACE = 200;
const HORIZONTAL_MARGIN = 16;

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  suggestions: string[];
  onSelect: (value: string) => void;
  anchorRef: RefObject<View | null>;
  keyboardHeight: number;
  palette: AppThemePalette;
  visible: boolean;
  onRequestClose?: () => void;
  maxItems?: number;
}

export function AutocompleteDropdown({
  suggestions,
  onSelect,
  anchorRef,
  keyboardHeight,
  palette,
  visible,
  onRequestClose,
  maxItems = 6,
}: Props) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const measure = useCallback(() => {
    const node = anchorRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, width, height) => {
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(width) &&
        Number.isFinite(height)
      ) {
        setAnchor({ x, y, width, height });
      }
    });
  }, [anchorRef]);

  // Re-measure whenever the dropdown becomes visible, the suggestion set
  // changes, or the keyboard height shifts.
  useEffect(() => {
    if (!visible) return;
    measure();
    // A second pass after layout settles avoids stale coords when the input
    // just received focus and the keyboard is animating in.
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [visible, suggestions.length, keyboardHeight, measure]);

  if (!visible || suggestions.length === 0 || !anchor) return null;

  const screen = Dimensions.get('window');
  const screenH = screen.height;
  const screenW = screen.width;

  const inputBottomY = anchor.y + anchor.height;
  const spaceBelow = screenH - keyboardHeight - inputBottomY;
  const placeBelow = spaceBelow >= MIN_BELOW_SPACE;

  const items = suggestions.slice(0, maxItems);
  const listHeight = items.length * ROW_HEIGHT;

  const left = Math.max(HORIZONTAL_MARGIN, anchor.x);
  const maxWidth = screenW - HORIZONTAL_MARGIN * 2;
  const width = Math.min(Math.max(anchor.width, 200), maxWidth);

  const top = placeBelow
    ? inputBottomY + 4
    : Math.max(HORIZONTAL_MARGIN, anchor.y - listHeight - 4);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      {/* Backdrop — taps outside dismiss the dropdown but DO NOT dismiss the keyboard. */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'transparent' }}
        onPress={onRequestClose}
      >
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top,
            left,
            width,
          }}
        >
          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: HOME_RADIUS.medium,
              borderWidth: 1,
              borderColor: palette.divider,
              overflow: 'hidden',
              ...HOME_SHADOW.card,
            }}
          >
            {items.map((item, i) => {
              const last = i === items.length - 1;
              return (
                <TouchableOpacity
                  key={`${item}-${i}`}
                  activeOpacity={0.6}
                  onPress={() => onSelect(item)}
                  style={{
                    height: ROW_HEIGHT,
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                    borderBottomWidth: last ? 0 : 1,
                    borderBottomColor: palette.divider,
                    backgroundColor: palette.card,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: HOME_TEXT.body,
                      color: palette.text,
                    }}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
