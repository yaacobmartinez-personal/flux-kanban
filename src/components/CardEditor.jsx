import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, Trash2, AlignLeft, Calendar, Tag } from "lucide-react";
import { useBoard } from "../store/boardStore";
import { LABEL_LIST } from "../lib/labels";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500";

export function CardEditor() {
  const editingCardId = useBoard((s) => s.editingCardId);
  const card = useBoard((s) => (editingCardId ? s.cards[editingCardId] : null));
  const updateCard = useBoard((s) => s.updateCard);
  const deleteCard = useBoard((s) => s.deleteCard);
  const closeCard = useBoard((s) => s.closeCard);
  const reduce = useReducedMotion();

  const open = Boolean(card);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeCard();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCard]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-slate-950/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCard}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Edit card"
            className="glass absolute inset-y-0 right-0 flex w-full max-w-md flex-col"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/50">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Edit card
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={closeCard}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <div className="space-y-2">
                <label htmlFor="card-title" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Title
                </label>
                <input
                  id="card-title"
                  value={card.title}
                  onChange={(e) => updateCard(card.id, { title: e.target.value })}
                  placeholder="What needs doing?"
                  className={inputCls}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="card-desc"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  <AlignLeft className="h-3.5 w-3.5" /> Description
                </label>
                <textarea
                  id="card-desc"
                  value={card.description}
                  onChange={(e) => updateCard(card.id, { description: e.target.value })}
                  rows={4}
                  placeholder="Add more detail…"
                  className={`${inputCls} resize-y leading-relaxed`}
                />
              </div>

              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Tag className="h-3.5 w-3.5" /> Label
                </span>
                <div className="flex flex-wrap gap-2">
                  {LABEL_LIST.map((l) => {
                    const active = card.color === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-label={l.name}
                        aria-pressed={active}
                        onClick={() => updateCard(card.id, { color: l.id })}
                        className={[
                          "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition",
                          active
                            ? "border-slate-400 text-slate-900 dark:border-slate-400 dark:text-slate-100"
                            : "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500",
                        ].join(" ")}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={
                            l.id === "none"
                              ? { border: `1.5px solid ${l.swatch}` }
                              : { backgroundColor: l.swatch }
                          }
                        />
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="card-due"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  <Calendar className="h-3.5 w-3.5" /> Due date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="card-due"
                    type="date"
                    value={card.dueDate ?? ""}
                    onChange={(e) =>
                      updateCard(card.id, { dueDate: e.target.value || null })
                    }
                    className={`${inputCls} max-w-[12rem] dark:[color-scheme:dark]`}
                  />
                  {card.dueDate && (
                    <button
                      type="button"
                      onClick={() => updateCard(card.id, { dueDate: null })}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/70 px-5 py-4 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => deleteCard(card.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-300"
              >
                <Trash2 className="h-4 w-4" /> Delete card
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
