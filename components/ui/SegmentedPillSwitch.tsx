import { Text } from '@/components/ui/AppText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';

const SWITCH_INSET = 2;

export function SegmentedPillSwitch({
  options,
  value,
  onChange,
  backgroundColor,
  pillColor,
  borderColor,
  activeTextColor,
  inactiveTextColor,
  style,
  height = 36,
  radius = 15,
  fontSize = 12,
  itemMinWidth = 68,
  animated = true,
}: {
  options: ReadonlyArray<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
  backgroundColor: string;
  pillColor: string;
  borderColor: string;
  activeTextColor: string;
  inactiveTextColor: string;
  style?: StyleProp<ViewStyle>;
  height?: number;
  radius?: number;
  fontSize?: number;
  itemMinWidth?: number;
  animated?: boolean;
}) {
  const [controlWidth, setControlWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === value));
  const innerWidth = Math.max(controlWidth - 2, 0);
  const segmentWidth = controlWidth > 0 ? innerWidth / options.length : 0;
  const pillRadius = Math.max(radius - SWITCH_INSET, 0);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const isLast = selectedIndex === options.length - 1;
    const nextX = selectedIndex * segmentWidth + (isLast ? 0.5 : 0);
    if (!animated) {
      indicatorX.setValue(nextX);
      return;
    }
    Animated.spring(indicatorX, {
      toValue: nextX,
      damping: 20,
      mass: 0.7,
      stiffness: 220,
      useNativeDriver: false,
    }).start();
  }, [animated, indicatorX, segmentWidth, selectedIndex, options.length]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setControlWidth(event.nativeEvent.layout.width);
  };

  const highlightStyle = useMemo(
    () => ({
      width: Math.max(segmentWidth - SWITCH_INSET * 2, 0),
      backgroundColor: pillColor,
      borderColor,
      transform: [{ translateX: indicatorX }],
    }),
    [borderColor, indicatorX, pillColor, segmentWidth],
  );

  return (
    <View
      onStartShouldSetResponder={() => true}
      onLayout={handleLayout}
      style={[
        {
          flexDirection: 'row',
          backgroundColor,
          borderRadius: radius,
          borderWidth: 1,
          borderColor,
          height,
          overflow: 'hidden',
          position: 'relative',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: SWITCH_INSET,
              bottom: SWITCH_INSET,
              left: SWITCH_INSET,
              borderRadius: pillRadius,
              borderWidth: 1,
            },
            highlightStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            delayPressIn={0}
            activeOpacity={0.8}
            onPress={() => onChange(option.key)}
            style={{
              flex: 1,
              minWidth: itemMinWidth,
              height,
              paddingHorizontal: 12,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <Text
              numberOfLines={1}
              appWeight="medium"
              style={{
                fontSize,
                fontWeight: selected ? '700' : '600',
                textAlign: 'center',
                textAlignVertical: 'center',
                includeFontPadding: false,
                color: selected ? activeTextColor : inactiveTextColor,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
