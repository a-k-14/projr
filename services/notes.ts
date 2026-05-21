import { eq, desc } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { notes, noteItems } from '../db/schema';
import { generateId } from '../lib/ids';
import type { Note, NoteItem, NoteWithItems, NoteType } from '../types';

function rowToNote(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    type: row.type as NoteType,
    body: row.body ?? null,
    archived: row.archived === 1 || row.archived === true,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

function rowToItem(row: typeof noteItems.$inferSelect): NoteItem {
  return {
    id: row.id,
    noteId: row.noteId,
    text: row.text,
    checked: row.checked === 1,
    sortOrder: row.sortOrder,
  };
}

export async function getNotes(showArchived = false): Promise<(Note & { firstItem: string | null })[]> {
  type Row = Parameters<typeof rowToNote>[0] & { first_item: string | null };
  const rows = await sqlite.getAllAsync<Row>(`
    SELECT n.*,
      (SELECT text FROM note_items WHERE note_id = n.id AND trim(text) != '' ORDER BY sort_order ASC LIMIT 1) AS first_item
    FROM notes n
    WHERE n.archived = ?
    ORDER BY n.updated_at DESC
  `, [showArchived ? 1 : 0]);
  return rows.map((r) => ({ ...rowToNote(r), firstItem: r.first_item ?? null }));
}

export async function getNoteWithItems(id: string): Promise<NoteWithItems | null> {
  const noteRows = await db.select().from(notes).where(eq(notes.id, id));
  if (!noteRows.length) return null;
  const note = rowToNote(noteRows[0]);
  const itemRows = await db
    .select()
    .from(noteItems)
    .where(eq(noteItems.noteId, id))
    .orderBy(noteItems.sortOrder);
  return { ...note, items: itemRows.map(rowToItem) };
}

export async function createNote(type: NoteType = 'text'): Promise<Note> {
  const now = new Date().toISOString();
  const id = generateId();
  await db.insert(notes).values({ id, title: '', type, body: null, archived: 0, createdAt: now, updatedAt: now });
  return { id, title: '', type, body: null, archived: false, createdAt: now, updatedAt: now };
}

export async function updateNote(id: string, patch: { title?: string; body?: string | null; type?: NoteType }): Promise<void> {
  await db
    .update(notes)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(notes.id, id));
}

export async function archiveNote(id: string, archived: boolean): Promise<void> {
  await db.update(notes).set({ archived: archived ? 1 : 0 }).where(eq(notes.id, id));
}

export async function deleteNote(id: string): Promise<void> {
  await db.delete(notes).where(eq(notes.id, id));
}

export async function addNoteItem(noteId: string, text: string, sortOrder: number): Promise<NoteItem> {
  const id = generateId();
  await db.insert(noteItems).values({ id, noteId, text, checked: 0, sortOrder });
  await db.update(notes).set({ updatedAt: new Date().toISOString() }).where(eq(notes.id, noteId));
  return { id, noteId, text, checked: false, sortOrder };
}

export async function updateNoteItem(id: string, patch: { text?: string; checked?: boolean; sortOrder?: number }): Promise<void> {
  const dbPatch: Partial<typeof noteItems.$inferInsert> = {};
  if (patch.text !== undefined) dbPatch.text = patch.text;
  if (patch.checked !== undefined) dbPatch.checked = patch.checked ? 1 : 0;
  if (patch.sortOrder !== undefined) dbPatch.sortOrder = patch.sortOrder;
  await db.update(noteItems).set(dbPatch).where(eq(noteItems.id, id));
}

export async function deleteNoteItem(id: string, noteId: string): Promise<void> {
  await db.delete(noteItems).where(eq(noteItems.id, id));
  await db.update(notes).set({ updatedAt: new Date().toISOString() }).where(eq(notes.id, noteId));
}
