import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [visible, setVisible] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const closeDialog = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      if (isMountedRef.current) {
        setConfig(null);
      }
    }, 150);
  }, []);

  const showAlert = useCallback((title: string, message: string, confirmLabel = 'OK') => {
    setConfig({ title, message, confirmLabel, showCancel: false });
    setVisible(true);
  }, []);

  const showConfirm = useCallback((nextConfig: DialogConfig) => {
    setConfig({ ...nextConfig, showCancel: nextConfig.showCancel ?? true });
    setVisible(true);
  }, []);

  const dialog = useMemo(() => {
    if (!config) return null;
    return (
      <AppConfirmDialog
        visible={visible}
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
            if (onConfirm) {
              setTimeout(() => {
                void onConfirm();
              }, 160);
            }
          },
        }}
      />
    );
  }, [closeDialog, config, palette, visible]);

  return { showAlert, showConfirm, dialog };
}
