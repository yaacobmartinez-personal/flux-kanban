import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { supabase } from "../lib/supabase";

const toLocalCard = (row) => ({
  id: row.id,
  columnId: row.column_id,
  number: row.number ?? null,
  title: row.title,
  description: row.description ?? "",
  color: row.color ?? "none",
  labelText: row.label_text ?? null,
  dueDate: row.due_date ?? null,
  assigneeId: row.assignee_id ?? null,
  reporterId: row.reporter_id ?? null,
  epicId: row.epic_id ?? null,
  storyPoints: row.story_points ?? null,
  links: row.links ?? [],
  closedAt: row.closed_at ?? null,
});

// Columns touched during a drag, flushed to the DB on drop.
const dirtyColumns = new Set();
// Debounced card-field writes, keyed by card id.
const cardWriteTimers = new Map();
const cardPending = new Map();
// Snapshot of last-persisted field values per card, used to detect changes.
const cardSnapshots = new Map();
// Per-drag move tracking: cardId -> { fromTitle, toTitle }
const cardColumnMoves = new Map();

// Realtime subscription + debounce timers.
let realtimeChannel = null;
let resyncTimer = null;
let threadTimer = null;

const LOCAL_TO_DB = {
  title: "title",
  description: "description",
  color: "color",
  labelText: "label_text",
  dueDate: "due_date",
  assigneeId: "assignee_id",
  reporterId: "reporter_id",
  epicId: "epic_id",
  storyPoints: "story_points",
  links: "links",
  closedAt: "closed_at",
};

const TRACKED_FIELDS = [
  "title", "description", "color", "labelText", "dueDate",
  "assigneeId", "reporterId", "epicId", "storyPoints", "links",
];

function snapshotCard(card) {
  const snap = {};
  for (const f of TRACKED_FIELDS) snap[f] = card[f];
  return snap;
}

async function insertActivity(cardId, type, data = {}) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("card_activity").insert({
    card_id: cardId,
    actor_id: u.user?.id ?? null,
    type,
    data,
  });
}

const CARD_SELECT =
  "id, column_id, number, title, description, color, label_text, due_date, position, assignee_id, reporter_id, epic_id, story_points, links, closed_at";

// Fetch a project's columns + cards from the DB (no state mutation).
async function fetchBoardData(projectId) {
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
      .select(CARD_SELECT)
      .in("column_id", columnIds)
      .order("position", { ascending: true });
    cardRows = data ?? [];
  }
  return { cols: cols ?? [], cardRows };
}

// Build the local {columns, cards} shape from DB rows.
// `overlayPending` keeps any un-flushed local edits on top of remote rows so a
// realtime re-sync never clobbers what the user is currently typing.
function buildBoardState(cols, cardRows, { overlayPending = false } = {}) {
  const cards = {};
  const byColumn = {};
  cols.forEach((c) => (byColumn[c.id] = []));
  cardRows.forEach((row) => {
    const remote = toLocalCard(row);
    if (overlayPending && cardPending.has(row.id)) {
      cards[row.id] = { ...remote, ...cardPending.get(row.id) };
    } else {
      cards[row.id] = remote;
      cardSnapshots.set(row.id, snapshotCard(remote));
    }
    (byColumn[row.column_id] ??= []).push(row.id);
  });
  const columns = cols.map((c) => ({
    id: c.id,
    title: c.title,
    cardIds: byColumn[c.id] ?? [],
  }));
  return { columns, cards };
}

export const useBoard = create((set, get) => ({
  projectId: null,
  loading: false,
  columns: [], // [{ id, title, cardIds: [] }]
  cards: {},
  comments: {}, // { [cardId]: Comment[] }
  activity: {}, // { [cardId]: ActivityEvent[] }
  editingCardId: null,

  _resyncQueued: false,

  // ---- Load ----
  loadBoard: async (projectId) => {
    set({ loading: true, projectId, columns: [], cards: {}, comments: {}, activity: {}, editingCardId: null });
    cardSnapshots.clear();

    const { cols, cardRows } = await fetchBoardData(projectId);
    if (get().projectId !== projectId) return; // a faster project switch won

    const { columns, cards } = buildBoardState(cols, cardRows);
    set({ loading: false, columns, cards });
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

  reorderColumn: async (fromIndex, toIndex) => {
    const reordered = arrayMove(get().columns, fromIndex, toIndex);
    set({ columns: reordered });
    await Promise.all(
      reordered.map((col, idx) =>
        supabase.from("columns").update({ position: idx }).eq("id", col.id)
      )
    );
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
    const userId = u.user?.id;
    const { data, error } = await supabase
      .from("cards")
      .insert({ column_id: columnId, title, position, created_by: userId, reporter_id: userId })
      .select(CARD_SELECT)
      .single();
    if (error) return;
    const card = toLocalCard(data);
    cardSnapshots.set(card.id, snapshotCard(card));
    set((s) => ({
      cards: { ...s.cards, [card.id]: card },
      columns: s.columns.map((c) =>
        c.id === columnId ? { ...c, cardIds: [...c.cardIds, card.id] } : c
      ),
      editingCardId: card.id,
    }));
    insertActivity(card.id, "created", {});
  },

  updateCard: (id, patch) => {
    set((s) => ({ cards: { ...s.cards, [id]: { ...s.cards[id], ...patch } } }));

    // Debounce DB writes per card; merge patches in the meantime.
    const merged = { ...(cardPending.get(id) ?? {}), ...patch };
    cardPending.set(id, merged);
    clearTimeout(cardWriteTimers.get(id));
    cardWriteTimers.set(
      id,
      setTimeout(async () => {
        const fields = cardPending.get(id) ?? {};
        cardPending.delete(id);
        cardWriteTimers.delete(id);
        const dbPatch = {};
        for (const [k, v] of Object.entries(fields)) {
          if (LOCAL_TO_DB[k]) dbPatch[LOCAL_TO_DB[k]] = v;
        }
        if (!Object.keys(dbPatch).length) return;

        // Detect which tracked fields actually changed vs last persisted snapshot.
        const snapshot = cardSnapshots.get(id) ?? {};
        const changes = [];
        for (const [k, v] of Object.entries(fields)) {
          if (!TRACKED_FIELDS.includes(k)) continue;
          const old = snapshot[k];
          const isComplex = k === "links" || k === "description";
          const changed = isComplex
            ? JSON.stringify(old) !== JSON.stringify(v)
            : old !== v;
          if (changed) {
            changes.push({
              field: k,
              from: isComplex ? null : (old ?? null),
              to: isComplex ? null : (v ?? null),
            });
          }
        }

        await supabase.from("cards").update(dbPatch).eq("id", id);

        // Update snapshot so next flush compares against the new baseline.
        cardSnapshots.set(id, { ...(cardSnapshots.get(id) ?? {}), ...fields });

        for (const change of changes) {
          insertActivity(id, "field_changed", change);
        }
      }, 500)
    );
  },

  deleteCard: (id) => {
    clearTimeout(cardWriteTimers.get(id));
    cardWriteTimers.delete(id);
    cardPending.delete(id);
    cardSnapshots.delete(id);
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

      // Track the original column on first move; update destination on subsequent moves.
      if (!cardColumnMoves.has(cardId)) {
        cardColumnMoves.set(cardId, { fromTitle: from.title, toTitle: to.title });
      } else {
        cardColumnMoves.get(cardId).toTitle = to.title;
      }

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

    // Log move activity for cards that ended up in a different column.
    for (const [cardId, move] of cardColumnMoves.entries()) {
      if (move.fromTitle !== move.toTitle) {
        insertActivity(cardId, "moved", {
          from_column: move.fromTitle,
          to_column: move.toTitle,
        });
      }
    }
    cardColumnMoves.clear();

    // Realtime events that arrived mid-drag were deferred — apply them now.
    if (get()._resyncQueued) {
      set({ _resyncQueued: false });
      get().scheduleResync();
    }
  },

  // ---- Realtime sync ----
  subscribeRealtime: (projectId) => {
    if (!supabase || !projectId) return;
    get().unsubscribeRealtime();
    realtimeChannel = supabase
      .channel(`board:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "columns", filter: `project_id=eq.${projectId}` },
        () => get().scheduleResync()
      )
      // cards have no project_id column, so we can't filter here; RLS already
      // limits events to the user's orgs and scheduleResync re-reads only the
      // current project, so cross-project noise is just a coalesced no-op.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards" },
        () => get().scheduleResync()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => get()._onThreadChange()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "card_activity" },
        () => get()._onThreadChange()
      )
      .subscribe();
  },

  unsubscribeRealtime: () => {
    if (realtimeChannel && supabase) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    clearTimeout(resyncTimer);
    clearTimeout(threadTimer);
  },

  // Debounced board re-sync. Deferred while a drag is in flight (dnd-kit owns
  // the list during a drag; mutating it mid-drag would desync the sortable).
  scheduleResync: () => {
    if (document.body.classList.contains("dragging-active")) {
      set({ _resyncQueued: true });
      return;
    }
    clearTimeout(resyncTimer);
    resyncTimer = setTimeout(() => get()._resyncBoard(), 250);
  },

  _resyncBoard: async () => {
    const projectId = get().projectId;
    if (!projectId || !supabase) return;
    const { cols, cardRows } = await fetchBoardData(projectId);
    if (get().projectId !== projectId) return; // project switched mid-fetch
    const { columns, cards } = buildBoardState(cols, cardRows, { overlayPending: true });
    set({ columns, cards });
  },

  // Reload the open card's comments + activity when either thread changes.
  _onThreadChange: () => {
    if (!get().editingCardId) return;
    clearTimeout(threadTimer);
    threadTimer = setTimeout(() => {
      const id = get().editingCardId;
      if (id) {
        get().loadComments(id);
        get().loadActivity(id);
      }
    }, 250);
  },

  // ---- Editor ----
  openCard: (id) => {
    set({ editingCardId: id });
    get().loadComments(id);
    get().loadActivity(id);
  },
  closeCard: () => set({ editingCardId: null }),

  // ---- Card lifecycle (soft close / reopen) ----
  archiveCard: async (id) => {
    const closedAt = new Date().toISOString();
    set((s) => ({ cards: { ...s.cards, [id]: { ...s.cards[id], closedAt } } }));
    await supabase.from("cards").update({ closed_at: closedAt }).eq("id", id);
    await insertActivity(id, "closed", {});
    get().loadActivity(id);
  },

  unarchiveCard: async (id) => {
    set((s) => ({ cards: { ...s.cards, [id]: { ...s.cards[id], closedAt: null } } }));
    await supabase.from("cards").update({ closed_at: null }).eq("id", id);
    await insertActivity(id, "reopened", {});
    get().loadActivity(id);
  },

  // ---- Activity ----
  loadActivity: async (cardId) => {
    const { data } = await supabase
      .from("card_activity")
      .select("id, card_id, actor_id, type, data, created_at, profiles:actor_id(email, full_name, avatar_url)")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true });
    if (data) set((s) => ({ activity: { ...s.activity, [cardId]: data } }));
  },

  // ---- Comments ----
  loadComments: async (cardId) => {
    const { data } = await supabase
      .from("comments")
      .select("id, card_id, author_id, body, created_at, updated_at, profiles:author_id(email, full_name, avatar_url)")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true });
    if (data) set((s) => ({ comments: { ...s.comments, [cardId]: data } }));
  },

  addComment: async (cardId, body) => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("comments")
      .insert({ card_id: cardId, author_id: u.user?.id, body })
      .select("id, card_id, author_id, body, created_at, updated_at, profiles:author_id(email, full_name, avatar_url)")
      .single();
    if (error) return { error };
    set((s) => ({
      comments: { ...s.comments, [cardId]: [...(s.comments[cardId] ?? []), data] },
    }));
    return { data };
  },

  updateComment: async (commentId, cardId, body) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("comments")
      .update({ body, updated_at: now })
      .eq("id", commentId);
    if (!error)
      set((s) => ({
        comments: {
          ...s.comments,
          [cardId]: (s.comments[cardId] ?? []).map((c) =>
            c.id === commentId ? { ...c, body, updated_at: now } : c
          ),
        },
      }));
    return { error };
  },

  deleteComment: async (commentId, cardId) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (!error)
      set((s) => ({
        comments: {
          ...s.comments,
          [cardId]: (s.comments[cardId] ?? []).filter((c) => c.id !== commentId),
        },
      }));
    return { error };
  },
}));
