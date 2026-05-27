import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { ScreenHeader, HeaderAddButton } from '@/components/ui/ScreenHeader';
import { ScreenScaffold } from '@/components/ui/ScreenScaffold';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCompactScrollableBottomPadding } from '../components/ui/safeBottom';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../lib/design';
import { HOME_RADIUS, HOME_TEXT, HOME_SPACE } from '../lib/layoutTokens';
import { useAppTheme } from '../lib/theme';
import { useNotesStore, type NotePreview } from '../stores/useNotesStore';
import * as notesService from '../services/notes';
import { formatDateFull } from '../lib/ui-format';

function NoteCard({
  note,
  palette,
  onPress,
  dimmed,
}: {
  note: NotePreview;
  palette: ReturnType<typeof useAppTheme>['palette'];
  onPress: () => void;
  dimmed?: boolean;
}) {
  const preview = note.firstItem || note.title || '';

  return (
    <TouchableOpacity
      onPress={onPress}
      delayPressIn={0}
      activeOpacity={0.72}
      style={{
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.card,
        borderWidth: 1,
        borderColor: palette.divider,
        paddingVertical: 20,
        paddingHorizontal: 16,
        marginBottom: 10,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          appWeight="medium"
          numberOfLines={1}
          style={{ flex: 1, fontSize: HOME_TEXT.sectionTitle, fontWeight: FONT_WEIGHT.semibold, color: palette.text }}
        >
          {preview || 'Empty note'}
        </Text>
        <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary }}>
          {formatDateFull(note.updatedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { notes, isLoaded, load, create } = useNotesStore();
  const [archivedNotes, setArchivedNotes] = useState<NotePreview[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      load();
    }
  }, [isFocused, load]);

  const handleToggleArchived = async () => {
    if (showArchived) {
      setShowArchived(false);
      return;
    }
    setArchivedLoading(true);
    const archived = await notesService.getNotes(true);
    setArchivedNotes(archived);
    setArchivedLoading(false);
    setShowArchived(true);
  };

  const handleCreate = async () => {
    const note = await create('text');
    await notesService.addNoteItem(note.id, '', 0);
    router.push(`/note/${note.id}` as any);
  };

  return (
    <ScreenScaffold palette={palette} style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Notes"
        palette={palette}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        rightAction={<HeaderAddButton onPress={handleCreate} palette={palette} />}
      />

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          paddingTop: HOME_SPACE.md,
          paddingBottom: getCompactScrollableBottomPadding(insets),
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            palette={palette}
            onPress={() => router.push(`/note/${item.id}` as any)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <AppIcon name="list-todo" size={40} color={palette.textMuted} strokeWidth={1.4} />
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.sectionTitle, marginTop: HOME_SPACE.md }}>
              No notes yet
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: HOME_TEXT.bodySmall, marginTop: HOME_SPACE.xs }}>
              Tap + to add a note
            </Text>
          </View>
        }
        ListFooterComponentStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
        ListFooterComponent={
          <View style={{ marginTop: HOME_SPACE.lg }}>
            <TouchableOpacity
              onPress={handleToggleArchived}
              delayPressIn={0}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}
            >
              <AppIcon
                name={showArchived ? 'chevron-down' : 'chevron-right'}
                size={15}
                color={palette.textSecondary}
                strokeWidth={2}
              />
              <Text style={{ fontSize: HOME_TEXT.bodySmall, color: palette.textSecondary, fontWeight: FONT_WEIGHT.semibold }}>
                {archivedLoading ? 'Loading…' : `Archived${archivedNotes.length > 0 ? ` (${archivedNotes.length})` : ''}`}
              </Text>
            </TouchableOpacity>
            {showArchived && archivedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                palette={palette}
                dimmed
                onPress={() => router.push(`/note/${note.id}` as any)}
              />
            ))}
          </View>
        }
      />
    </ScreenScaffold>
  );
}
