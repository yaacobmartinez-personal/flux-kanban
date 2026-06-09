import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "../lib/supabase";

// Map a DB card row -> local card shape used by the UI.
const toLocalCard = (row) => ({
  id: row.id,
  columnId: row.column_id,
  title: row.title,
  description: row.description ?? "",
  color: row.color ?? "none",
  dueDate: row.due_date ?? null,
});

// Columns touched during a drag, flushed to the DB on drop.
const dirtyColumns = new Set();
// Debounced card-field writes, keyed by card id.
const cardWriteTimers = new Map();
const cardPending = new Map();

const LOCAL_TO_DB = { title: "title", description: "description", color: "color", dueDate: "due_date" };

export const useBoard = create((set, get) => ({
  projectId: null,
  loading: false,
  columns: [], // [{ id, title, cardIds: [] }]
  cards: {},
  editingCardId: null,

  // ---- Load ----
  loadBoard: async (projectId) => {
    set({ loading: true, projectId, columns: [], cards: {}, editingCardId: null });

    const { data: cols } = await supabase
      .from("columns")
      .select("id, title, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true });

    const columnIds = (cols ?? []).map((c) => c.id);
    let cardRows = [];
    if (columnIds.length) {
      const { data } = await supabase
        .from("cards")
        .select("id, column_id, title, description, color, due_date, position")
        .in("column_id", columnIds)
        .order("position", { ascending: true });
      cardRows = data ?? [];
    }

    const cards = {};
    const byColumn = {};
    columnIds.forEach((id) => (byColumn[id] = []));
    cardRows.forEach((row) => {
      cards[row.id] = toLocalCard(row);
      (byColumn[row.column_id] ??= []).push(row.id);
    });

    set({
      loading: false,
      columns: (cols ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        cardIds: byColumn[c.id] ?? [],
      })),
      cards,
    });
  },

  // ---- Columns ----
  addColumn: async (title = "New column") => {
    const { projectId, columns } = get();
    if (!projectId) return;
    const { data, error } = await supabase
      .from("columns")
      .insert({ project_id: projectId, title, position: columns.length })
      .select("id, title")
      .single();
    if (error) return;
    set((s) => ({
      columns: [...s.columns, { id: data.id, title: data.title, cardIds: [] }],
    }));
  },

  renameColumn: (columnId, title) => {
    set((s) => ({
      columns: s.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
    }));
    supabase.from("columns").update({ title }).eq("id", columnId).then(() => {});
  },

  deleteColumn: (columnId) => {
    set((s) => {
      const col = s.columns.find((c) => c.id === columnId);
      const cards = { ...s.cards };
      col?.cardIds.forEach((id) => delete cards[id]);
      return {
        columns: s.columns.filter((c) => c.id !== columnId),
        cards,
        editingCardId: col?.cardIds.includes(s.editingCardId) ? null : s.editingCardId,
      };
    });
    supabase.from("columns").delete().eq("id", columnId).then(() => {});
  },

  // ---- Cards ----
  addCard: async (columnId, title = "Untitled") => {
    const col = get().columns.find((c) => c.id === columnId);
    const position = col ? col.cardIds.length : 0;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("cards")
      .insert({ column_id: columnId, title, position, created_by: u.user?.id })
      .select("id, column_id, title, description, color, due_date, position")
      .single();
    if (error) return;
    const card = toLocalCard(data);
    set((s) => ({
      cards: { ...s.cards, [card.id]: card },
      columns: s.columns.map((c) =>
        c.id === columnId ? { ...c, cardIds: [...c.cardIds, card.id] } : c
      ),
      editingCardId: card.id,
    }));
  },

  updateCard: (id, patch) => {
    set((s) => ({ cards: { ...s.cards, [id]: { ...s.cards[id], ...patch } } }));

    // Debounce DB writes per card; merge patches in the meantime.
    const merged = { ...(cardPending.get(id) ?? {}), ...patch };
    cardPending.set(id, merged);
    clearTimeout(cardWriteTimers.get(id));
    cardWriteTimers.set(
      id,
      setTimeout(() => {
        const fields = cardPending.get(id) ?? {};
        cardPending.delete(id);
        cardWriteTimers.delete(id);
        const dbPatch = {};
        for (const [k, v] of Object.entries(fields)) {
          if (LOCAL_TO_DB[k]) dbPatch[LOCAL_TO_DB[k]] = v;
        }
        if (Object.keys(dbPatch).length)
          supabase.from("cards").update(dbPatch).eq("id", id).then(() => {});
      }, 500)
    );
  },

  deleteCard: (id) => {
    set((s) => {
      const cards = { ...s.cards };
      delete cards[id];
      return {
        cards,
        columns: s.columns.map((c) => ({
          ...c,
          cardIds: c.cardIds.filter((x) => x !== id),
        })),
        editingCardId: s.editingCardId === id ? null : s.editingCardId,
      };
    });
    supabase.from("cards").delete().eq("id", id).then(() => {});
  },

  // ---- Drag & drop (local now, persisted on drop) ----
  moveCardToColumn: (cardId, toColumnId, overId) =>
    set((s) => {
      const columns = s.columns.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
      const from = columns.find((c) => c.cardIds.includes(cardId));
      const to = columns.find((c) => c.id === toColumnId);
      if (!from || !to || from.id === to.id) return {};

      from.cardIds = from.cardIds.filter((id) => id !== cardId);
      let idx = to.cardIds.indexOf(overId);
      if (idx === -1) idx = to.cardIds.length;
      to.cardIds.splice(idx, 0, cardId);

      dirtyColumns.add(from.id);
      dirtyColumns.add(to.id);

      return {
        columns,
        cards: { ...s.cards, [cardId]: { ...s.cards[cardId], columnId: toColumnId } },
      };
    }),

  reorderCard: (columnId, fromIndex, toIndex) => {
    dirtyColumns.add(columnId);
    set((s) => ({
      columns: s.columns.map((c) =>
        c.id === columnId
          ? { ...c, cardIds: arrayMove(c.cardIds, fromIndex, toIndex) }
          : c
      ),
    }));
  },

  // Persist column_id + position for every card in the columns a drag touched.
  flushDragPersist: async () => {
    if (!dirtyColumns.size) return;
    const ids = [...dirtyColumns];
    dirtyColumns.clear();
    const { columns } = get();
    const writes = [];
    ids.forEach((colId) => {
      const col = columns.find((c) => c.id === colId);
      col?.cardIds.forEach((cardId, index) => {
        writes.push(
          supabase
            .from("cards")
            .update({ column_id: colId, position: index })
            .eq("id", cardId)
        );
      });
    });
    await Promise.all(writes);
  },

  // ---- Editor ----
  openCard: (id) => set({ editingCardId: id }),
  closeCard: () => set({ editingCardId: null }),
}));
