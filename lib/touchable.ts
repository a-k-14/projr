/**
 * Centralised touch primitives — single source of truth.
 *
 * WHY THIS FILE EXISTS:
 * React Native Gesture Handler's `TouchableOpacity` runs on the UI thread (no JS-bridge
 * round-trip), making every tap feel instant. However, it wraps children in a Reanimated
 * `Animated.View`, which can suppress `flex: 1` / `width` / `height: '100%'` inherited from
 * a flex container.  For those layout-critical cases we use React Native's `Pressable`, which
 * has identical layout behaviour to a plain `View`.
 *
 * USAGE:
 *   import { Touchable, TouchableFlex } from '../lib/touchable';
 *
 *   • Touchable      — fixed-size / non-flex buttons (FAB, icon buttons, list rows, chips)
 *   • TouchableFlex  — buttons that must participate in flex layout (columns, full-width rows)
 *
 * Centralising here means: if we ever swap the underlying library, ONE file changes.
 */

export { TouchableOpacity as Touchable } from 'react-native-gesture-handler';
export { Pressable as TouchableFlex } from 'react-native';
