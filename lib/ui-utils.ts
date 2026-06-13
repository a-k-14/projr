import { Keyboard, InteractionManager } from 'react-native';

/**
 * Ensures the keyboard is dismissed and all pending animations/interactions
 * are complete before executing the provided action.
 *
 * Crucial for opening BottomSheets/Modals smoothly without layout jumps.
 */
export function runAfterKeyboardDismiss(action: () => void) {
  Keyboard.dismiss();
  InteractionManager.runAfterInteractions(action);
}

/**
 * Converts a hex color string to an rgba/rgb color string with the specified opacity.
 */
export function hexToRGBA(hex: string, alpha: number): string {
  if (!hex) return 'transparent';
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  const num = parseInt(clean, 16);
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
}

