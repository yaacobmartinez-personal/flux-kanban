import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion } from "motion/react";
import { Tag, Users, Calendar, MousePointer2, PenLine, Sparkles, GitBranch, LayoutDashboard, List } from "lucide-react";
import { useBoard } from "../store/boardStore";
import { Column } from "./Column";
import { CardFace } from "./CardFace";
import { ListView } from "./ListView";

const findColAndOver = (cols, activeId, overId) => {
  const activeCol = cols.find((c) => c.cardIds.includes(activeId));
  const overCol = cols.find((c) => c.id === overId || c.cardIds.includes(overId));
  return { activeCol, overCol };
};

export function Board() {
  const columns = useBoard((s) => s.columns);
  const cards = useBoard((s) => s.cards);
  const loading = useBoard((s) => s.loading);
  const moveCardToColumn = useBoard((s) => s.moveCardToColumn);
  const reorderCard = useBoard((s) => s.reorderCard);
  const reorderColumn = useBoard((s) => s.reorderColumn);
  const flushDragPersist = useBoard((s) => s.flushDragPersist);

  const [activeCard, setActiveCard] = useState(null);
  const [activeColumn, setActiveColumn] = useState(null);
  const [groupByParent, setGroupByParent] = useState(true);
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("flux-view") ?? "board"
  );

  const switchView = (mode) => {
    setViewMode(mode);
    localStorage.setItem("flux-view", mode);
  };

  const hasParentCards = Object.values(cards).some((c) => c.epicId);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(({ active }) => {
    if (active.data.current?.type === "column") {
      setActiveColumn(active.data.current.column);
    } else {
      setActiveCard(active.data.current?.card ?? null);
    }
    document.body.classList.add("dragging-active");
  }, []);

  const handleDragOver = useCallback(
    ({ active, over }) => {
      if (!over || active.data.current?.type === "column") return;
      const activeId = active.id;
      const overId = over.id;
      if (activeId === overId) return;
      const cols = useBoard.getState().columns;
      const { activeCol, overCol } = findColAndOver(cols, activeId, overId);
      if (!activeCol || !overCol || activeCol.id === overCol.id) return;
      moveCardToColumn(activeId, overCol.id, overId);
    },
    [moveCardToColumn]
  );

  const cleanup = useCallback(() => {
    setActiveCard(null);
    setActiveColumn(null);
    document.body.classList.remove("dragging-active");
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      cleanup();

      if (active.data.current?.type === "column") {
        if (over) {
          const cols = useBoard.getState().columns;
          const oldIndex = cols.findIndex((c) => c.id === active.id);
          // over might be a column or a card — find the target column either way
          const targetColId =
            cols.find((c) => c.id === over.id)?.id ??
            cols.find((c) => c.cardIds.includes(over.id))?.id;
          const newIndex = targetColId ? cols.findIndex((c) => c.id === targetColId) : -1;
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            reorderColumn(oldIndex, newIndex);
          }
        }
        return;
      }

      if (over) {
        const activeId = active.id;
        const overId = over.id;
        const cols = useBoard.getState().columns;
        const { activeCol, overCol } = findColAndOver(cols, activeId, overId);
        if (activeCol && overCol && activeCol.id === overCol.id) {
          const oldIndex = activeCol.cardIds.indexOf(activeId);
          let newIndex = overCol.cardIds.indexOf(overId);
          if (newIndex === -1) newIndex = overCol.cardIds.length - 1;
          if (oldIndex !== newIndex) reorderCard(activeCol.id, oldIndex, newIndex);
        }
      }
      flushDragPersist();
    },
    [cleanup, reorderCard, reorderColumn, flushDragPersist]
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <ViewToolbar viewMode={viewMode} onSwitch={switchView} />
        <div className="scroll-thin flex flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-full w-[85vw] shrink-0 animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-800/40 sm:w-80"
            />
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex h-full flex-col">
        <ViewToolbar viewMode={viewMode} onSwitch={switchView} />
        <ListView />
      </div>
    );
  }

  if (columns.length === 0) return <EmptyBoard onSwitchView={switchView} viewMode={viewMode} />;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={cleanup}
    >
      <div className="flex h-full flex-col">
        <ViewToolbar viewMode={viewMode} onSwitch={switchView}>
          {hasParentCards && (
            <button
              type="button"
              onClick={() => setGroupByParent((g) => !g)}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                groupByParent
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200",
              ].join(" ")}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Group by parent
            </button>
          )}
        </ViewToolbar>

        <div className="scroll-thin flex flex-1 gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                groupByParent={groupByParent}
                isCardActive={Boolean(activeCard)}
              />
            ))}
          </SortableContext>
          <AddColumn />
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2,0.8,0.3,1)" }}>
        {activeCard ? (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: 1.04, rotate: 1.5 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-[80vw] max-w-[19rem] cursor-grabbing"
          >
            <CardFace card={activeCard} dragging />
          </motion.div>
        ) : activeColumn ? (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: 1.03, rotate: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-[85vw] sm:w-80 cursor-grabbing"
          >
            <div className="glass overflow-hidden rounded-xl shadow-xl">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {activeColumn.title}
                </span>
                <span className="rounded-full bg-slate-200 px-1.5 text-[0.65rem] font-medium tabular-nums text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
                  {activeColumn.cardIds?.length ?? 0}
                </span>
              </div>
              <div className="space-y-1.5 px-2 pb-2">
                {[...Array(Math.min(3, activeColumn.cardIds?.length ?? 0))].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-slate-200/60 dark:bg-slate-700/40" />
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ViewToolbar({ viewMode, onSwitch, children }) {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-0 sm:px-6">
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
        <button
          type="button"
          onClick={() => onSwitch("board")}
          title="Board view"
          className={[
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
            viewMode === "board"
              ? "bg-white shadow-sm text-slate-800 dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          ].join(" ")}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Board
        </button>
        <button
          type="button"
          onClick={() => onSwitch("list")}
          title="List view"
          className={[
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
            viewMode === "list"
              ? "bg-white shadow-sm text-slate-800 dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          ].join(" ")}
        >
          <List className="h-3.5 w-3.5" />
          List
        </button>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

function AddColumn() {
  const addColumn = useBoard((s) => s.addColumn);
  return (
    <div className="shrink-0 pt-[3.25rem]">
      <button
        type="button"
        onClick={() => addColumn("New column")}
        className="flex h-12 w-[85vw] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:bg-white/60 hover:text-slate-700 dark:border-slate-700/70 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800/40 dark:hover:text-slate-200 sm:w-72"
      >
        + Add column
      </button>
    </div>
  );
}

const TIPS = [
  {
    Icon: MousePointer2,
    label: "Drag & drop",
    desc: "Grab any card and drop it into another column to update its status.",
  },
  {
    Icon: PenLine,
    label: "Rename columns",
    desc: "Click a column title to rename it to whatever fits your workflow.",
  },
  {
    Icon: Tag,
    label: "Labels & colors",
    desc: "Tag cards with colors to highlight priority, type, or team.",
  },
  {
    Icon: Calendar,
    label: "Due dates",
    desc: "Set a due date on any card so nothing slips through the cracks.",
  },
  {
    Icon: Users,
    label: "Invite your team",
    desc: "Add teammates from the Members panel so you can collaborate.",
  },
  {
    Icon: Sparkles,
    label: "Stay organized",
    desc: "Reorder cards within a column by dragging them up or down.",
  },
];

function EmptyBoard({ onSwitchView, viewMode }) {
  const addColumn = useBoard((s) => s.addColumn);

  const applyTemplate = () => {
    ["To Do", "In Progress", "Done"].forEach((name) => addColumn(name));
  };

  return (
    <div className="flex h-full flex-col">
      <ViewToolbar viewMode={viewMode} onSwitch={onSwitchView} />
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-12 text-center"
    >
      {/* Mini board illustration */}
      <svg
        width="168"
        height="96"
        viewBox="0 0 168 96"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${i * 58}, 0)`}>
            <rect width="50" height="90" rx="8" className="fill-slate-100 dark:fill-slate-800" />
            <rect x="8" y="8" width="34" height="5" rx="2.5" className="fill-slate-300 dark:fill-slate-600" />
            {[20, 30, 40, 50, 60].slice(0, 3 - (i === 2 ? 1 : 0)).map((y, j) => (
              <rect
                key={j}
                x="8"
                y={y}
                width="34"
                height="7"
                rx="3"
                className={
                  i === 0
                    ? "fill-sky-200 dark:fill-sky-900"
                    : i === 1
                    ? "fill-violet-200 dark:fill-violet-900"
                    : "fill-emerald-200 dark:fill-emerald-900"
                }
              />
            ))}
          </g>
        ))}
      </svg>

      {/* Heading */}
      <div className="max-w-sm space-y-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Your board is a blank canvas
        </h2>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Start by adding <strong className="font-medium text-slate-700 dark:text-slate-300">columns</strong> to
          represent stages in your workflow, then add <strong className="font-medium text-slate-700 dark:text-slate-300">cards</strong> to
          track each task. Drag cards between columns as work progresses.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={applyTemplate}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-sky-500 dark:text-slate-900 dark:hover:bg-sky-400"
        >
          <Sparkles className="h-4 w-4" />
          Use "To Do / In Progress / Done"
        </button>
        <button
          type="button"
          onClick={() => addColumn("New column")}
          className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-white/60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800/60"
        >
          + Add a blank column
        </button>
      </div>

      {/* Tips grid */}
      <div className="grid w-full max-w-lg grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
        {TIPS.map(({ Icon, label, desc }) => (
          <div
            key={label}
            className="flex gap-3 rounded-xl bg-slate-100/70 p-3 dark:bg-slate-800/40"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
    </div>
  );
}
