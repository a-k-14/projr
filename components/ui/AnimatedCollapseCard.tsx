import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated } from 'react-native';

const COLLAPSE_GAP = 8;

export type CollapseHandle = { collapse: () => void };

export const AnimatedCollapseCard = forwardRef<
  CollapseHandle,
  { onRemoved: () => void; children: React.ReactNode }
>(({ onRemoved, children }, ref) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const marginBottom = useRef(new Animated.Value(0)).current;
  const measuredHeight = useRef(0);

  useImperativeHandle(ref, () => ({
    collapse: () => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }),
        Animated.timing(marginBottom, {
          toValue: -(measuredHeight.current + COLLAPSE_GAP),
          duration: 220,
          useNativeDriver: false,
        }),
      ]).start(() => onRemoved());
    },
  }));

  return (
    <Animated.View
      onLayout={(e) => { measuredHeight.current = e.nativeEvent.layout.height; }}
      style={{ opacity, marginBottom }}
    >
      {children}
    </Animated.View>
  );
});
