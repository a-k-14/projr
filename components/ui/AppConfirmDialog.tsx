import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { Modal, Pressable, View } from 'react-native';
import { TextButton } from './AppButton';
import { HOME_RADIUS, HOME_SPACE, HOME_TEXT } from '../../lib/layoutTokens';
import type { AppThemePalette } from '../../lib/theme';

type ConfirmAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function AppConfirmDialog({
  visible,
  title,
  message,
  palette,
  confirm,
  cancelLabel = 'Cancel',
  onCancel,
  showCancel = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  palette: AppThemePalette;
  confirm: ConfirmAction;
  cancelLabel?: string;
  onCancel: () => void;
  showCancel?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: palette.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: HOME_RADIUS.tab,
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.divider,
            padding: HOME_SPACE.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: HOME_SPACE.md }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: HOME_RADIUS.full,
                backgroundColor: confirm.destructive ? palette.outBg : palette.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="alert-circle" size={16} color={confirm.destructive ? palette.negative : palette.brand} />
            </View>
            <Text appWeight="medium" style={{ flex: 1, fontSize: HOME_TEXT.rowLabel, fontWeight: '600', color: palette.text }}>
              {title}
            </Text>
          </View>
          <Text style={{ fontSize: HOME_TEXT.body, lineHeight: 19, color: palette.text }}>
            {message}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: HOME_SPACE.lg }}>
            {showCancel ? (
              <TextButton label={cancelLabel} onPress={onCancel} palette={palette} tone="muted" />
            ) : null}
            <TextButton
              label={confirm.label}
              onPress={confirm.onPress}
              palette={palette}
              tone={confirm.destructive ? 'danger' : 'brand'}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
