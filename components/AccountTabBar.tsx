import { useEffect, useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedReaction,
  useAnimatedRef,
  scrollTo,
  interpolateColor,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
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
  externalScrollX?: SharedValue<number>;
  palette: AppThemePalette;
};

export function AccountTabBar({ accounts, selectedId, onSelect, externalScrollX, palette }: Props) {
  const { width } = useWindowDimensions();
  const tabStripRef = useAnimatedRef<Animated.ScrollView>();
  const internalScrollX = useSharedValue(0);

  const scrollX = externalScrollX ?? internalScrollX;

  const TAB_GAP = HOME_LAYOUT.tabGap;
  const TAB_PADDING = HOME_SPACE.sm + 4;

  const tabWidths = useMemo(() => accounts.map((account) =>
    Math.max(
      HOME_LAYOUT.tabMinWidth,
      Math.min(
        HOME_LAYOUT.tabMaxWidth,
        HOME_LAYOUT.tabWidthBase + account.name.length * HOME_LAYOUT.tabWidthPerChar,
      ),
    ),
  ), [accounts]);
  
  const tabOffsets = useMemo(() => tabWidths.map((_, i) =>
    tabWidths.slice(0, i).reduce((sum, w) => sum + w + TAB_GAP, 0),
  ), [tabWidths, TAB_GAP]);

  const hasMultipleAccounts = accounts.length >= 2;
  const safeInputRange = useMemo(() => hasMultipleAccounts ? accounts.map((_, i) => i * width) : [0, width], [accounts, width, hasMultipleAccounts]);
  const safeOffsets = useMemo(() => hasMultipleAccounts ? tabOffsets : [tabOffsets[0] ?? 0, tabOffsets[0] ?? 0], [hasMultipleAccounts, tabOffsets]);
  const safeWidths = useMemo(() => hasMultipleAccounts ? tabWidths : [tabWidths[0] ?? HOME_LAYOUT.tabMinWidth, tabWidths[0] ?? HOME_LAYOUT.tabMinWidth], [hasMultipleAccounts, tabWidths]);

  const underlineAnimatedStyle = useAnimatedStyle(() => {
    const tx = interpolate(scrollX.value, safeInputRange, safeOffsets, Extrapolation.CLAMP);
    const tw = interpolate(scrollX.value, safeInputRange, safeWidths, Extrapolation.CLAMP);
    return {
      width: tw,
      transform: [{ translateX: tx }],
    };
  });

  const selectedIndex = Math.max(0, accounts.findIndex((a) => a.id === selectedId));

  useEffect(() => {
    if (externalScrollX) return;
    internalScrollX.value = withTiming(selectedIndex * width, { duration: 200 });
  }, [selectedIndex, width, externalScrollX, internalScrollX]);

  // Keep the active tab centred in the strip smoothly!
  useAnimatedReaction(
    () => scrollX.value,
    (currentScrollX) => {
      let targetX = 0;
      if (!hasMultipleAccounts) {
        targetX = Math.max(0, (safeOffsets[0] ?? 0) - (width - (safeWidths[0] ?? 0)) / 2 + TAB_PADDING);
      } else {
        const targetOffsets = safeInputRange.map((_, i) =>
          Math.max(0, (tabOffsets[i] ?? 0) - (width - (tabWidths[i] ?? 0)) / 2 + TAB_PADDING)
        );
        targetX = interpolate(currentScrollX, safeInputRange, targetOffsets, Extrapolation.CLAMP);
      }
      scrollTo(tabStripRef, targetX, 0, false);
    },
    [width, safeInputRange, tabOffsets, tabWidths, TAB_PADDING, hasMultipleAccounts]
  );

  return (
    <Animated.ScrollView
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
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: TAB_PADDING,
            bottom: 0,
            height: HOME_LAYOUT.tabUnderlineHeight,
            borderRadius: HOME_RADIUS.full,
            backgroundColor: palette.brand,
          },
          underlineAnimatedStyle
        ]}
      />

      {accounts.map((account, index) => (
        <AccountTabItem
          key={account.id}
          account={account}
          index={index}
          width={width}
          scrollX={scrollX}
          tabWidth={tabWidths[index] ?? HOME_LAYOUT.tabMinWidth}
          TAB_GAP={TAB_GAP}
          onSelect={onSelect}
          palette={palette}
          hasMultipleAccounts={hasMultipleAccounts}
        />
      ))}
    </Animated.ScrollView>
  );
}

function AccountTabItem({
  account,
  index,
  width,
  scrollX,
  tabWidth,
  TAB_GAP,
  onSelect,
  palette,
  hasMultipleAccounts
}: {
  account: AccountTab;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  tabWidth: number;
  TAB_GAP: number;
  onSelect: (id: string | 'all') => void;
  palette: AppThemePalette;
  hasMultipleAccounts: boolean;
}) {
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

  const textAnimatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(scrollX.value, textInputRange, textOutputRange);
    return {
      color,
    };
  });

  return (
    <TouchableOpacity
      onPress={() => onSelect(account.id)}
      style={{
        minWidth: HOME_LAYOUT.tabMinWidth,
        maxWidth: HOME_LAYOUT.tabMaxWidth,
        width: tabWidth,
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
          style={[
            {
              fontSize: HOME_TEXT.tab,
              lineHeight: 18,
              fontWeight: '500',
            },
            textAnimatedStyle,
          ]}
        >
          {account.name}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}
