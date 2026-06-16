import { Text } from '@/components/ui/AppText';
import { AppIcon } from '@/components/ui/AppIcon';
import { ScreenHeader, HeaderMoreButton } from '@/components/ui/ScreenHeader';
import { ActionStrip } from '@/components/ui/ActionStrip';
import { ActionChip } from '@/components/ui/AppButton';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SystemBottomGuard } from '../../components/ui/safeBottom';
import { SCREEN_GUTTER, FONT_WEIGHT } from '../../lib/design';
import { HOME_SPACE, HOME_RADIUS, HOME_TEXT } from '../../lib/layoutTokens';
import { useAppTheme } from '../../lib/theme';
import { useNotesStore } from '../../stores/useNotesStore';
import * as notesService from '../../services/notes';
import type { NoteItem, NoteWithItems } from '../../types';
import { formatDateFull } from '../../lib/ui-format';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const { remove, archive, load } = useNotesStore();

  const [note, setNote] = useState<NoteWithItems | null>(null);
  const [showActions, setShowActions] = useState(false);

  // Keep a ref to the latest note state to read during unmount without stale closures
  const latestNoteRef = useRef<NoteWithItems | null>(null);
  useEffect(() => {
    latestNoteRef.current = note;
  }, [note]);

  // Discard note if it is left completely empty on unmount
  useEffect(() => {
    return () => {
      const currentNote = latestNoteRef.current;
      if (currentNote) {
        const isEmpty = (!currentNote.title || !currentNote.title.trim()) &&
          (!currentNote.items || currentNote.items.length === 0 || currentNote.items.every(item => !item.text || !item.text.trim()));
        if (isEmpty) {
          useNotesStore.getState().remove(currentNote.id);
        }
      }
    };
  }, []);

  // Map of item id → TextInput ref for focusing newly added items
  const itemRefs = useRef<Map<string, TextInput | null>>(new Map());
  const pendingFocusId = useRef<string | null>(null);

  const panelProgress = useSharedValue(0);
  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    height: panelProgress.value * 56,
    opacity: panelProgress.value,
  }));

  const toggleActions = () => {
    const next = !showActions;
    setShowActions(next);
    panelProgress.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  const closePanel = () => {
    setShowActions(false);
    panelProgress.value = withTiming(0, { duration: 200 });
  };

  useEffect(() => {
    if (!id) return;
    notesService.getNoteWithItems(id).then((n) => {
      if (!n) return;
      setNote(n);
    });
  }, [id]);

  const handleToggleItem = useCallback(async (item: NoteItem) => {
    const checked = !item.checked;
    await notesService.updateNoteItem(item.id, { checked });
    setNote((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, checked } : i)) } : prev
    );
  }, []);

  const handleItemTextChange = useCallback(async (item: NoteItem, text: string) => {
    setNote((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, text } : i)) } : prev
    );
    await notesService.updateNoteItem(item.id, { text });
  }, []);

  const handleDeleteItem = useCallback(async (item: NoteItem) => {
    await notesService.deleteNoteItem(item.id, id!);
    itemRefs.current.delete(item.id);
    setNote((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id) } : prev
    );
  }, [id]);

  const handleAddItem = async () => {
    if (!id || !note) return;
    if (note.type !== 'checklist') {
      await notesService.updateNote(id, { type: 'checklist' });
    }
    const item = await notesService.addNoteItem(id, '', note.items.length);
    pendingFocusId.current = item.id;
    setNote((prev) =>
      prev ? { ...prev, type: 'checklist', items: [...prev.items, item] } : prev
    );
  };

  const handleArchive = async () => {
    closePanel();
    await archive(id!, !(note?.archived ?? false));
    await load();
    router.canGoBack() ? router.back() : router.replace('/notes' as any);
  };

  const handleDelete = () => {
    closePanel();
    Alert.alert('Delete note', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(id!);
          router.canGoBack() ? router.back() : router.replace('/notes' as any);
        },
      },
    ]);
  };

  if (!note) return null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      {/* Header on screen bg — shows date */}
      <ScreenHeader
        title={formatDateFull(note.updatedAt)}
        titleSize={14}
        titleWeight={FONT_WEIGHT.regular}
        titleColor={palette.text}
        backgroundColor={palette.background}
        palette={palette}
        showBack
        onBack={() => {
          Keyboard.dismiss();
          router.canGoBack() ? router.back() : router.replace('/notes' as any);
        }}
        rightAction={
          <HeaderMoreButton palette={palette} isOpen={showActions} onPress={toggleActions} />
        }
      />

      <ActionStrip palette={palette} animatedStyle={actionsAnimatedStyle}>
        <ActionChip
          icon={note.archived ? 'archive-restore' : 'archive'}
          label={note.archived ? 'Unarchive' : 'Archive'}
          palette={palette}
          onPress={handleArchive}
        />
        <ActionChip
          icon="trash-2"
          label="Delete"
          destructive
          palette={palette}
          onPress={handleDelete}
        />
      </ActionStrip>

      {/* Floating card with gaps on all sides */}
      <View style={{
        flex: 1,
        marginHorizontal: 12,
        marginBottom: insets.bottom + 12,
        marginTop: 2,
        backgroundColor: palette.card,
        borderRadius: HOME_RADIUS.large,
        overflow: 'hidden',
      }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SCREEN_GUTTER,
            paddingTop: HOME_SPACE.md,
            paddingBottom: HOME_SPACE.lg,
          }}
        >
          {/* Items */}
          {note.items.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <TouchableOpacity
                onPress={() => handleToggleItem(item)}
                delayPressIn={0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: HOME_RADIUS.small,
                  borderWidth: 2,
                  borderColor: palette.brand,
                  backgroundColor: item.checked ? palette.brand : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.checked && <AppIcon name="check" size={11} color="#fff" strokeWidth={2.5} />}
                </View>
              </TouchableOpacity>
              <TextInput
                ref={(r) => {
                  itemRefs.current.set(item.id, r);
                  if (pendingFocusId.current === item.id && r) {
                    r.focus();
                    pendingFocusId.current = null;
                  }
                }}
                value={item.text}
                onChangeText={(text) => {
                  if (text.includes('\n')) {
                    const cleanText = text.replace(/\n/g, '');
                    handleItemTextChange(item, cleanText).then(() => {
                      handleAddItem();
                    });
                  } else {
                    handleItemTextChange(item, text);
                  }
                }}
                placeholderTextColor={palette.textMuted}
                style={{
                  flex: 1,
                  fontSize: HOME_TEXT.rowLabel,
                  color: item.checked ? palette.textMuted : palette.text,
                  textDecorationLine: item.checked ? 'line-through' : 'none',
                  paddingVertical: 2,
                }}
                multiline={true}
                blurOnSubmit={false}
                textBreakStrategy="simple"
              />
              <TouchableOpacity
                onPress={() => handleDeleteItem(item)}
                delayPressIn={0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AppIcon name="x" size={17} color={palette.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Item button */}
          <TouchableOpacity
            onPress={handleAddItem}
            delayPressIn={0}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginTop: HOME_SPACE.sm,
              paddingVertical: 8,
              alignSelf: 'flex-start',
            }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: HOME_RADIUS.full,
              backgroundColor: palette.brand,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <AppIcon name="plus" size={11} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={{ fontSize: HOME_TEXT.sectionTitle, color: palette.brand, fontWeight: FONT_WEIGHT.semibold }}>
              Add Item
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <SystemBottomGuard />
    </View>
  );
}
