import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CARD_PADDING, FONT_WEIGHT, HOME_TEXT, RADIUS, SCREEN_GUTTER, SPACING } from '../../lib/design';
import { useAppTheme } from '../../lib/theme';
import { useUIStore } from '../../stores/useUIStore';
import { exportBackup, importBackup, pickBackupFolder } from '../../services/backup';
import { APP_LOCALE } from '../../lib/dateUtils';
import { useAppDialog } from '../../components/ui/useAppDialog';
import { STRINGS } from '../../lib/strings';

const FREQUENCY_OPTIONS = [
  { label: 'Daily', days: 1 },
  { label: '3 Days', days: 3 },
  { label: 'Weekly', days: 7 },
  { label: 'Monthly', days: 30 },
] as const;

const KEEP_OPTIONS = [
  { label: '3 backups', count: 3 },
  { label: '7 backups', count: 7 },
  { label: '14 backups', count: 14 },
  { label: '30 backups', count: 30 },
] as const;

export default function BackupScreen() {
  const { palette } = useAppTheme();
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const { showConfirm, showAlert, dialog } = useAppDialog(palette);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [showFreqPicker, setShowFreqPicker] = useState(false);
  const [showKeepPicker, setShowKeepPicker] = useState(false);

  const hasFolder = !!settings.autoBackupFolderUri;
  const freqLabel = FREQUENCY_OPTIONS.find((o) => o.days === settings.autoBackupFrequencyDays)?.label ?? 'Daily';
  const keepLabel = KEEP_OPTIONS.find((o) => o.count === settings.autoBackupKeepCount)?.label ?? '7 backups';
  const lastManualBackup = settings.lastManualBackupAt
    ? new Date(settings.lastManualBackupAt).toLocaleString(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const lastRestore = settings.lastRestoreAt
    ? new Date(settings.lastRestoreAt).toLocaleString(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const lastAutoBackup = settings.lastAutoBackupAt
    ? new Date(settings.lastAutoBackupAt).toLocaleString(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : STRINGS.backup.labels.lastAutoBackupNever;
  const folderDisplayPath = decodeSafUri(settings.autoBackupFolderUri);

  const warnColor = palette.isDark ? '#FBBF24' : '#92400E';

  const handleExport = async () => {
    setExporting(true);
    try {
      const success = await exportBackup();
      if (success) {
        updateSettings({ lastManualBackupAt: new Date().toISOString() }).catch(() => undefined);
      }
    } catch (e: any) {
      showAlert(STRINGS.backup.alerts.exportFailedTitle, e?.message ?? STRINGS.backup.alerts.exportFailedMessage);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    showConfirm({
      title: STRINGS.backup.alerts.restoreConfirmTitle,
      message: STRINGS.backup.alerts.restoreConfirmMessage,
      confirmLabel: STRINGS.backup.alerts.restoreConfirmLabel,
      destructive: true,
      onConfirm: async () => {
        setImporting(true);
        try {
          const success = await importBackup();
          if (success) {
            // Do NOT write to the DB here — the open connection still points at
            // the pre-restore database, so any write could checkpoint stale data
            // over the file we just restored. Close the app immediately so it
            // reopens with a fresh connection on the restored file.
            showConfirm({
              title: STRINGS.backup.alerts.restoreCompleteTitle,
              message: STRINGS.backup.alerts.restoreCompleteMessage,
              confirmLabel: STRINGS.backup.alerts.restoreCompleteConfirmLabel,
              showCancel: false,
              onConfirm: () => BackHandler.exitApp()
            });
          }
        } catch (e: any) {
          showAlert(STRINGS.backup.alerts.restoreFailedTitle, e?.message ?? STRINGS.backup.alerts.restoreFailedMessage);
        } finally {
          setImporting(false);
        }
      }
    });
  };

  const handlePickFolder = async () => {
    setPickingFolder(true);
    try {
      const uri = await pickBackupFolder();
      if (uri) {
        updateSettings({ autoBackupFolderUri: uri, autoBackupEnabled: true, lastAutoBackupError: '' }).catch(() => undefined);
      }
    } catch (e: any) {
      showAlert(STRINGS.backup.alerts.folderPickErrorTitle, e?.message ?? STRINGS.backup.alerts.folderPickErrorMessage);
    } finally {
      setPickingFolder(false);
    }
  };

  const handleToggleAutoBackup = async (value: boolean) => {
    if (value && !hasFolder) {
      await handlePickFolder();
      return;
    }
    updateSettings({ autoBackupEnabled: value, ...(!value ? { lastAutoBackupError: '' } : {}) }).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Manual backup */}
        <SectionHeading label={STRINGS.backup.labels.manualSection} palette={palette} />
        <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
          <ActionCard
            icon="upload"
            title={STRINGS.backup.labels.exportCardTitle}
            stat={lastManualBackup ? `${STRINGS.backup.labels.exportLastPrefix} ${lastManualBackup}` : undefined}
            palette={palette}
            loading={exporting}
            onPress={handleExport}
            tone="brand"
          />
          <ActionCard
            icon="download"
            title={STRINGS.backup.labels.restoreCardTitle}
            stat={lastRestore ? `${STRINGS.backup.labels.restoreLastPrefix} ${lastRestore}` : undefined}
            warn={STRINGS.backup.labels.restoreWarning}
            palette={palette}
            loading={importing}
            onPress={handleImport}
            tone="negative"
            warnColor={warnColor}
          />
        </View>

        {/* Auto backup */}
        <SectionHeading label={STRINGS.backup.labels.autoSection} palette={palette} />
        <View style={{ backgroundColor: palette.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', marginBottom: SPACING.xl }}>

          {/* Enable toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>{STRINGS.backup.labels.enableAutoBackup}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <AppIcon name="info" size={12} color={warnColor} strokeWidth={2} />
                <Text style={{ fontSize: HOME_TEXT.caption, color: warnColor, fontWeight: FONT_WEIGHT.regular }}>
                  {STRINGS.backup.labels.autoBackupInfo}
                </Text>
              </View>
            </View>
            <AppSwitch
              value={settings.autoBackupEnabled}
              onValueChange={handleToggleAutoBackup}
              palette={palette}
            />
          </View>

          {/* Folder */}
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.7}
            onPress={handlePickFolder}
            disabled={pickingFolder}
            style={{ paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasFolder ? 6 : 0 }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>{STRINGS.backup.labels.backupFolder}</Text>
              <AppIcon name="folder" size={18} color={hasFolder ? palette.brand : palette.textSoft} strokeWidth={1.8} />
            </View>
            {pickingFolder ? (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>{STRINGS.backup.labels.folderPicking}</Text>
            ) : hasFolder ? (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular, lineHeight: 17 }}>
                {folderDisplayPath}
              </Text>
            ) : (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>{STRINGS.backup.labels.folderNotSet}</Text>
            )}
          </TouchableOpacity>

          {/* Backup Frequency */}
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.7}
            onPress={() => setShowFreqPicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>{STRINGS.backup.labels.backupFrequency}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>{freqLabel}</Text>
              <AppIcon name="chevron-right" size={14} color={palette.textSoft} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* Backups to Keep */}
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.7}
            onPress={() => setShowKeepPicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>{STRINGS.backup.labels.backupsToKeep}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>{keepLabel}</Text>
              <AppIcon name="chevron-right" size={14} color={palette.textSoft} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* Last auto backup */}
          <View style={{ paddingHorizontal: CARD_PADDING, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>{STRINGS.backup.labels.lastAutoBackup}</Text>
              <Text style={{ fontSize: HOME_TEXT.body, color: settings.lastAutoBackupAt ? palette.positive : palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>
                {lastAutoBackup}
              </Text>
            </View>
            {!!settings.lastAutoBackupError && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 5 }}>
                <AppIcon name="info" size={12} color={warnColor} strokeWidth={2} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: HOME_TEXT.caption, color: warnColor, lineHeight: 17, fontWeight: FONT_WEIGHT.regular }}>
                  {STRINGS.backup.alerts.autoBackupFailedMessage}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {showFreqPicker && (
        <BottomSheet title={STRINGS.backup.labels.backupFrequency} palette={palette} onClose={() => setShowFreqPicker(false)}>
          {FREQUENCY_OPTIONS.map((o, i) => (
            <ChoiceRow
              key={o.days}
              title={o.label}
              selected={settings.autoBackupFrequencyDays === o.days}
              palette={palette}
              noBorder={i === FREQUENCY_OPTIONS.length - 1}
              onPress={() => {
                updateSettings({ autoBackupFrequencyDays: o.days }).catch(() => undefined);
                setShowFreqPicker(false);
              }}
            />
          ))}
        </BottomSheet>
      )}

      {showKeepPicker && (
        <BottomSheet title={STRINGS.backup.labels.backupsToKeep} palette={palette} onClose={() => setShowKeepPicker(false)}>
          {KEEP_OPTIONS.map((o, i) => (
            <ChoiceRow
              key={o.count}
              title={o.label}
              selected={settings.autoBackupKeepCount === o.count}
              palette={palette}
              noBorder={i === KEEP_OPTIONS.length - 1}
              onPress={() => {
                updateSettings({ autoBackupKeepCount: o.count }).catch(() => undefined);
                setShowKeepPicker(false);
              }}
            />
          ))}
        </BottomSheet>
      )}
      {dialog}
    </SafeAreaView>
  );
}

function decodeSafUri(uri: string): string {
  if (!uri) return '';
  try {
    const decoded = decodeURIComponent(uri);
    const treeMatch = decoded.match(/\/tree\/([^/]+.*)$/);
    const raw = treeMatch ? treeMatch[1] : decoded;
    const colonIdx = raw.indexOf(':');
    if (colonIdx < 0) return raw;
    const storage = raw.slice(0, colonIdx).toLowerCase() === 'primary' ? 'Internal Storage' : raw.slice(0, colonIdx);
    const path = raw.slice(colonIdx + 1);
    return path ? `${storage} / ${path.replace(/\//g, ' / ')}` : storage;
  } catch {
    return uri;
  }
}

function SectionHeading({ label, palette }: { label: string; palette: any }) {
  return (
    <Text style={{ fontSize: HOME_TEXT.caption, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.3, color: palette.textSecondary, marginBottom: 6, marginLeft: 4 }}>
      {label}
    </Text>
  );
}

function ActionCard({ icon, title, description, stat, warn, warnColor, palette, loading, onPress, tone }: {
  icon: string; title: string; description?: string; stat?: string; warn?: string; warnColor?: string; palette: any;
  loading: boolean; onPress: () => void; tone: 'brand' | 'negative';
}) {
  const toneColor = tone === 'brand' ? palette.brand : palette.negative;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      delayPressIn={0}
      disabled={loading}
      onPress={onPress}
      style={{ backgroundColor: palette.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: palette.border, padding: CARD_PADDING, flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, opacity: loading ? 0.6 : 1 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: `${toneColor}14`, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <ActivityIndicator color={toneColor} size="small" /> : <AppIcon name={icon} size={20} color={toneColor} strokeWidth={1.8} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>{title}</Text>
        {description && (
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, marginTop: 3, lineHeight: 17, fontWeight: FONT_WEIGHT.regular }}>{description}</Text>
        )}
        {stat && (
          <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textSecondary, marginTop: 7, lineHeight: 17, fontWeight: FONT_WEIGHT.regular }}>{stat}</Text>
        )}
        {warn && warnColor && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 5 }}>
            <AppIcon name="info" size={12} color={warnColor} strokeWidth={2} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: HOME_TEXT.caption, color: warnColor, lineHeight: 17, fontWeight: FONT_WEIGHT.regular }}>{warn}</Text>
          </View>
        )}
      </View>
      <AppIcon name="chevron-right" size={16} color={palette.textSoft} strokeWidth={2} />
    </TouchableOpacity>
  );
}
