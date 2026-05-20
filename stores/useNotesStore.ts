import { create } from 'zustand';
import type { Note, NoteWithItems, NoteType } from '../types';

export type NotePreview = Note & { firstItem: string | null };
import * as notesService from '../services/notes';

interface NotesStore {
  notes: NotePreview[];
  isLoaded: boolean;
  showArchived: boolean;
  load: (showArchived?: boolean) => Promise<void>;
  create: (type?: NoteType) => Promise<Note>;
  remove: (id: string) => Promise<void>;
  archive: (id: string, archived: boolean) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
  updateBody: (id: string, body: string | null) => Promise<void>;
  updateType: (id: string, type: NoteType) => Promise<void>;
  getNoteWithItems: (id: string) => Promise<NoteWithItems | null>;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  isLoaded: false,
  showArchived: false,

  load: async (showArchived) => {
    const archived = showArchived ?? get().showArchived;
    const notes = await notesService.getNotes(archived);
    set({ notes, isLoaded: true, showArchived: archived });
  },

  create: async (type = 'text') => {
    const note = await notesService.createNote(type);
    set((s) => ({ notes: [{ ...note, firstItem: null }, ...s.notes] }));
    return note;
  },

  remove: async (id) => {
    await notesService.deleteNote(id);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  archive: async (id, archived) => {
    await notesService.archiveNote(id, archived);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  updateTitle: async (id, title) => {
    await notesService.updateNote(id, { title });
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, title, updatedAt: new Date().toISOString() } : n
      ),
    }));
  },

  updateBody: async (id, body) => {
    await notesService.updateNote(id, { body });
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, body, updatedAt: new Date().toISOString() } : n
      ),
    }));
  },

  updateType: async (id, type) => {
    await notesService.updateNote(id, { type });
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, type } : n)),
    }));
  },

  getNoteWithItems: async (id) => {
    return notesService.getNoteWithItems(id);
  },
}));
