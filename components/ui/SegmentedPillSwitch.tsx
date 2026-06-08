import { Text } from '@/components/ui/AppText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';

const SWITCH_INSET = 2;

function getIndicatorX(width: number, selectedIndex: number, optionCount: number) {
  const innerWidth = Math.max(width - 2, 0);
  const segmentWidth = innerWidth / Math.max(optionCount, 1);
  const isLast = selectedIndex === optionCount - 1;
  return selectedIndex * segmentWidth + (isLast ? 0.5 : 0);
}

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
  options: ReadonlyArray<{ key: string; label: string; icon?: string }>;
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
  const selectedIndex = Math.max(0, options.findIndex((option) => option.key === value));
  const optionCount = Math.max(options.length, 1);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const hasLaidOut = useRef(false);

  const innerWidth = Math.max(controlWidth - 2, 0);
  const segmentWidth = controlWidth > 0 ? innerWidth / optionCount : 0;
  const pillRadius = Math.max(radius - SWITCH_INSET, 0);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const nextX = getIndicatorX(controlWidth, selectedIndex, optionCount);
    // Skip animation on first layout so the selected pill is present immediately.
    if (!animated || !hasLaidOut.current) {
      indicatorX.setValue(nextX);
      hasLaidOut.current = true;
      return;
    }
    Animated.spring(indicatorX, {
      toValue: nextX,
      damping: 20,
      mass: 0.7,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [animated, controlWidth, indicatorX, optionCount, segmentWidth, selectedIndex]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      if (!hasLaidOut.current) {
        indicatorX.setValue(getIndicatorX(width, selectedIndex, optionCount));
        hasLaidOut.current = true;
      }
      setControlWidth(width);
    }
  };

  const highlightStyle = useMemo(
    () => {
      if (controlWidth === 0) {
        const pctLeft = `${(selectedIndex * 100) / optionCount}%`;
        const pctWidth = `${100 / optionCount}%`;
        return {
          left: pctLeft,
          width: pctWidth,
        } as any;
      }
      return {
        left: 0,
        width: segmentWidth,
        transform: [{ translateX: indicatorX }],
      } as any;
    },
    [controlWidth, selectedIndex, optionCount, segmentWidth, indicatorX],
  );

  return (
    <View
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
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
          },
          highlightStyle,
        ]}
      >
        <View
          style={{
            flex: 1,
            marginTop: SWITCH_INSET,
            marginBottom: SWITCH_INSET,
            marginLeft: SWITCH_INSET,
            marginRight: SWITCH_INSET,
            borderRadius: pillRadius,
            backgroundColor: pillColor,
            borderColor,
            borderWidth: 1,
          }}
        />
      </Animated.View>
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
            {option.icon ? (
              <AppIcon
                name={option.icon}
                size={fontSize + 6}
                color={selected ? activeTextColor : inactiveTextColor}
              />
            ) : (
              <Text
                numberOfLines={1}
                appWeight="medium"
                style={{
                  fontSize,
                  fontWeight: selected ? '600' : '500',
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  color: selected ? activeTextColor : inactiveTextColor,
                  zIndex: 2,
                }}
              >
                {option.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
