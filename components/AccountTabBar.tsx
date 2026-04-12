import { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SCREEN_GUTTER } from '../lib/design';
import { HOME_LAYOUT, HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../lib/layoutTokens';
import { AppThemePalette } from '../lib/theme';

export type AccountTab = {
  id: string | 'all';
  name: string;
};

type Props = {
  accounts: AccountTab[];
  selectedId: string | 'all';
  onSelect: (id: string | 'all') => void;
  /**
   * Pass the pager's Animated.Value here so tab animations track the swipe
   * in real-time (used by both Home and Activity screens). When omitted, the
   * component drives its own internal Animated.Value via Animated.timing on tap.
   */
  externalScrollX?: Animated.Value;
  palette: AppThemePalette;
};

export function AccountTabBar({ accounts, selectedId, onSelect, externalScrollX, palette }: Props) {
  const { width } = useWindowDimensions();
  const tabStripRef = useRef<ScrollView>(null);
  const internalScrollX = useRef(new Animated.Value(0)).current;

  // Real-time pager-driven value if available; else our own timing-driven value
  const scrollX = externalScrollX ?? internalScrollX;

  const TAB_GAP = HOME_LAYOUT.tabGap;
  const TAB_PADDING = HOME_SPACE.sm + 4;

  const tabWidths = accounts.map((account) =>
    Math.max(
      HOME_LAYOUT.tabMinWidth,
      Math.min(
        HOME_LAYOUT.tabMaxWidth,
        HOME_LAYOUT.tabWidthBase + account.name.length * HOME_LAYOUT.tabWidthPerChar,
      ),
    ),
  );
  const tabOffsets = tabWidths.map((_, i) =>
    tabWidths.slice(0, i).reduce((sum, w) => sum + w + TAB_GAP, 0),
  );

  // Guard: interpolation needs at least 2 points in inputRange / outputRange.
  const hasMultipleAccounts = accounts.length >= 2;
  const safeInputRange = hasMultipleAccounts ? accounts.map((_, i) => i * width) : [0, width];
  const safeOffsets = hasMultipleAccounts ? tabOffsets : [tabOffsets[0] ?? 0, tabOffsets[0] ?? 0];
  const safeWidths = hasMultipleAccounts ? tabWidths : [tabWidths[0] ?? HOME_LAYOUT.tabMinWidth, tabWidths[0] ?? HOME_LAYOUT.tabMinWidth];

  const underlineTranslateX = scrollX.interpolate({
    inputRange: safeInputRange,
    outputRange: safeOffsets,
    extrapolate: 'clamp',
  });
  const underlineWidth = scrollX.interpolate({
    inputRange: safeInputRange,
    outputRange: safeWidths,
    extrapolate: 'clamp',
  });

  const selectedIndex = Math.max(0, accounts.findIndex((a) => a.id === selectedId));

  // Only animate internalScrollX — never mutate the pager's externalScrollX
  useEffect(() => {
    if (externalScrollX) return;
    Animated.timing(internalScrollX, {
      toValue: selectedIndex * width,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [selectedIndex, width, externalScrollX]);

  // Keep the active tab centred in the strip
  useEffect(() => {
    const offset = tabOffsets[selectedIndex] ?? 0;
    const tw = tabWidths[selectedIndex] ?? HOME_LAYOUT.tabMinWidth;
    const targetX = Math.max(0, offset - (width - tw) / 2 + TAB_PADDING);
    tabStripRef.current?.scrollTo({ x: targetX, animated: true });
  }, [selectedIndex, width]);

  return (
    <ScrollView
      ref={tabStripRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{
        backgroundColor: palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: palette.divider,
        maxHeight: HOME_LAYOUT.tabHeight,
      }}
      contentContainerStyle={{ paddingHorizontal: SCREEN_GUTTER }}
    >
      {/* Animated sliding underline pill */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: TAB_PADDING,
          bottom: 0,
          height: HOME_LAYOUT.tabUnderlineHeight,
          borderRadius: HOME_RADIUS.full,
          backgroundColor: palette.brand,
          width: underlineWidth,
          transform: [{ translateX: underlineTranslateX }],
        }}
      />

      {accounts.map((account, index) => {
        // Per-tab text colour interpolation — guard against single-item list
        let textInputRange: number[];
        let textOutputRange: string[];

        if (!hasMultipleAccounts) {
          textInputRange = [0, width];
          textOutputRange = [palette.brand, palette.brand];
        } else {
          textInputRange =
            index === 0
              ? [0, width * 0.35, width * 0.8]
              : [Math.max(0, (index - 1) * width), index * width, (index + 1) * width];
          textOutputRange =
            index === 0
              ? [palette.brand, palette.brand, palette.inactive]
              : [palette.inactive, palette.brand, palette.inactive];
        }

        return (
          <TouchableOpacity
            key={account.id}
            onPress={() => onSelect(account.id)}
            style={{
              minWidth: HOME_LAYOUT.tabMinWidth,
              maxWidth: HOME_LAYOUT.tabMaxWidth,
              width: tabWidths[index],
              marginRight: TAB_GAP,
              paddingHorizontal: HOME_LAYOUT.tabItemPaddingX,
              paddingVertical: HOME_LAYOUT.tabItemPaddingY,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: '100%', paddingHorizontal: 2 }}>
              <Animated.Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  fontSize: HOME_TEXT.tab,
                  lineHeight: 18,
                  fontWeight: '500',
                  color: scrollX.interpolate({
                    inputRange: textInputRange,
                    outputRange: textOutputRange,
                    extrapolate: 'clamp',
                  }),
                }}
              >
                {account.name}
              </Animated.Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
