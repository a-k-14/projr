import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { ChoiceRow } from '../../components/settings-ui';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { CARD_PADDING, FONT_WEIGHT, HOME_TEXT, RADIUS, SCREEN_GUTTER, SPACING } from '../../lib/design';
import { useAppTheme } from '../../lib/theme';
import { useUIStore } from '../../stores/useUIStore';
import { exportBackup, importBackup, pickBackupFolder } from '../../services/backup';
import { APP_LOCALE } from '../../lib/dateUtils';

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
    : 'Never';
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
      Alert.alert('Export Failed', e?.message ?? 'Could not export backup.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    Alert.alert(
      'Restore Backup',
      'This will replace all current data with the selected backup. You will need to restart the app to complete the restore.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose File',
          style: 'destructive',
          onPress: async () => {
            setImporting(true);
            try {
              const success = await importBackup();
              if (success) {
                // Do NOT write to the DB here — the open connection still points at
                // the pre-restore database, so any write could checkpoint stale data
                // over the file we just restored. Close the app immediately so it
                // reopens with a fresh connection on the restored file.
                Alert.alert(
                  'Restore Complete',
                  'Your backup has been restored. The app will now close — reopen it to load your restored data.',
                  [{ text: 'Close App', onPress: () => BackHandler.exitApp() }],
                  { cancelable: false }
                );
              }
            } catch (e: any) {
              Alert.alert('Restore Failed', e?.message ?? 'Could not restore backup.');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const handlePickFolder = async () => {
    setPickingFolder(true);
    try {
      const uri = await pickBackupFolder();
      if (uri) {
        updateSettings({ autoBackupFolderUri: uri, autoBackupEnabled: true }).catch(() => undefined);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not select folder.');
    } finally {
      setPickingFolder(false);
    }
  };

  const handleToggleAutoBackup = async (value: boolean) => {
    if (value && !hasFolder) {
      await handlePickFolder();
      return;
    }
    updateSettings({ autoBackupEnabled: value }).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: SCREEN_GUTTER, paddingTop: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Manual backup */}
        <SectionHeading label="Manual" palette={palette} />
        <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
          <ActionCard
            icon="upload"
            title="Export Backup"
            stat={lastManualBackup ? `Last export: ${lastManualBackup}` : undefined}
            palette={palette}
            loading={exporting}
            onPress={handleExport}
            tone="brand"
          />
          <ActionCard
            icon="download"
            title="Restore Backup"
            stat={lastRestore ? `Last restore: ${lastRestore}` : undefined}
            warn="Restoring replaces all current data."
            palette={palette}
            loading={importing}
            onPress={handleImport}
            tone="negative"
            warnColor={warnColor}
          />
        </View>

        {/* Auto backup */}
        <SectionHeading label="Auto Backup" palette={palette} />
        <View style={{ backgroundColor: palette.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', marginBottom: SPACING.xl }}>

          {/* Enable toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>Enable Auto Backup</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <AppIcon name="info" size={12} color={warnColor} strokeWidth={2} />
                <Text style={{ fontSize: HOME_TEXT.caption, color: warnColor, fontWeight: FONT_WEIGHT.regular }}>
                  Runs only when the app is open
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
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>Backup Folder</Text>
              <AppIcon name="folder" size={18} color={hasFolder ? palette.brand : palette.textSoft} strokeWidth={1.8} />
            </View>
            {pickingFolder ? (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>Picking folder…</Text>
            ) : hasFolder ? (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular, lineHeight: 17 }}>
                {folderDisplayPath}
              </Text>
            ) : (
              <Text style={{ fontSize: HOME_TEXT.caption, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>Not set — tap to choose</Text>
            )}
          </TouchableOpacity>

          {/* Backup Frequency */}
          <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.7}
            onPress={() => setShowFreqPicker(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CARD_PADDING, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.divider }}
          >
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>Backup Frequency</Text>
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
            <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>Backups to Keep</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: HOME_TEXT.body, color: palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>{keepLabel}</Text>
              <AppIcon name="chevron-right" size={14} color={palette.textSoft} strokeWidth={2} />
            </View>
          </TouchableOpacity>

          {/* Last auto backup */}
          <View style={{ paddingHorizontal: CARD_PADDING, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: HOME_TEXT.body, fontWeight: FONT_WEIGHT.regular, color: palette.text }}>Last Auto Backup</Text>
              <Text style={{ fontSize: HOME_TEXT.body, color: settings.lastAutoBackupAt ? palette.positive : palette.textMuted, fontWeight: FONT_WEIGHT.regular }}>
                {lastAutoBackup}
              </Text>
            </View>
            {!!settings.lastAutoBackupError && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 5 }}>
                <AppIcon name="info" size={12} color={warnColor} strokeWidth={2} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: HOME_TEXT.caption, color: warnColor, lineHeight: 17, fontWeight: FONT_WEIGHT.regular }}>
                  {settings.lastAutoBackupError}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {showFreqPicker && (
        <BottomSheet title="Backup Frequency" palette={palette} onClose={() => setShowFreqPicker(false)}>
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
        <BottomSheet title="Backups to Keep" palette={palette} onClose={() => setShowKeepPicker(false)}>
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
