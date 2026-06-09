import { memo, useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Trash2, Check, X } from "lucide-react";
import { useBoard } from "../store/boardStore";
import { SortableCard } from "./SortableCard";
import { EmptyColumn } from "./EmptyColumn";

function ColumnBase({ column }) {
  const cardsById = useBoard((s) => s.cards);
  const addCard = useBoard((s) => s.addCard);
  const renameColumn = useBoard((s) => s.renameColumn);
  const deleteColumn = useBoard((s) => s.deleteColumn);

  const cards = column.cardIds.map((id) => cardsById[id]).filter(Boolean);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    renameColumn(column.id, next || column.title);
    if (!next) setDraft(column.title);
    setEditing(false);
  };

  return (
    <section className="flex h-full w-[85vw] shrink-0 flex-col sm:w-80">
      <header className="glass sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5">
        {editing ? (
          <form
            className="flex flex-1 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(column.title);
                  setEditing(false);
                }
              }}
              className="w-full rounded-md bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none ring-1 ring-sky-500/60 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(column.title);
              setEditing(true);
            }}
            className="flex flex-1 items-center gap-2 truncate text-left"
            title="Rename column"
          >
            <h2 className="truncate text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              {column.title}
            </h2>
            <span className="rounded-full bg-slate-200 px-1.5 text-[0.65rem] font-medium tabular-nums text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
              {cards.length}
            </span>
          </button>
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Confirm delete column"
              onClick={() => deleteColumn(column.id)}
              className="rounded-md p-1 text-rose-500 hover:bg-rose-500/15"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Cancel delete"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${column.title} column`}
            onClick={() => setConfirmDelete(true)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-500 dark:hover:bg-slate-700/60 dark:hover:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={[
          "scroll-thin flex-1 space-y-2.5 overflow-y-auto rounded-xl p-1 transition-colors",
          isOver ? "bg-sky-500/5 ring-1 ring-sky-500/20" : "",
        ].join(" ")}
      >
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.length > 0 ? (
            <ul className="space-y-2.5">
              {cards.map((card) => (
                <SortableCard key={card.id} card={card} />
              ))}
            </ul>
          ) : (
            <EmptyColumn onAdd={() => addCard(column.id)} />
          )}
        </SortableContext>
      </div>

      <button
        type="button"
        onClick={() => addCard(column.id)}
        className="mt-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
      >
        <Plus className="h-4 w-4" />
        Add a card
      </button>
    </section>
  );
}

export const Column = memo(ColumnBase);
