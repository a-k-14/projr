import { useCallback, useMemo, useState } from 'react';
import { AppConfirmDialog } from './AppConfirmDialog';
import type { AppThemePalette } from '../../lib/theme';

type DialogConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  showCancel?: boolean;
  onConfirm?: () => void | Promise<void>;
};

export function useAppDialog(palette: AppThemePalette) {
  const [config, setConfig] = useState<DialogConfig | null>(null);

  const closeDialog = useCallback(() => setConfig(null), []);

  const showAlert = useCallback((title: string, message: string, confirmLabel = 'OK') => {
    setConfig({ title, message, confirmLabel, showCancel: false });
  }, []);

  const showConfirm = useCallback((nextConfig: DialogConfig) => {
    setConfig({ ...nextConfig, showCancel: nextConfig.showCancel ?? true });
  }, []);

  const dialog = useMemo(() => {
    if (!config) return null;
    return (
      <AppConfirmDialog
        visible
        title={config.title}
        message={config.message}
        palette={palette}
        cancelLabel={config.cancelLabel}
        showCancel={config.showCancel}
        onCancel={closeDialog}
        confirm={{
          label: config.confirmLabel ?? 'OK',
          destructive: config.destructive,
          onPress: () => {
            const onConfirm = config.onConfirm;
            closeDialog();
            void onConfirm?.();
          },
        }}
      />
    );
  }, [closeDialog, config, palette]);

  return { showAlert, showConfirm, dialog };
}
