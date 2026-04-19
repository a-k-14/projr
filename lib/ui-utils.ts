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
