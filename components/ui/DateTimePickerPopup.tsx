import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { AppThemePalette } from '../../lib/theme';

type PickerMode = 'date' | 'time';

export function DateTimePickerPopup({
  visible,
  mode,
  value,
  palette,
  accentColor,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  mode: PickerMode;
  value: Date;
  palette: AppThemePalette;
  accentColor?: string;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}) {
  if (!visible) return null;

  return (
    <DateTimePicker
      value={value}
      mode={mode}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      themeVariant={palette.isDark ? 'dark' : 'light'}
      onChange={(event, date) => {
        if (event.type === 'set' && date) {
          onConfirm(date);
          if (Platform.OS === 'android') {
            onClose();
          }
        } else {
          onClose(); // Handles 'dismissed' on Android or Cancel
        }
      }}
      textColor={palette.text}
      accentColor={accentColor}
    />
  );
}
