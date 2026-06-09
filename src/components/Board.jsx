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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion } from "motion/react";
import { useBoard } from "../store/boardStore";
import { Column } from "./Column";
import { CardFace } from "./CardFace";

const findColAndOver = (cols, activeId, overId) => {
  const activeCol = cols.find((c) => c.cardIds.includes(activeId));
  const overCol = cols.find((c) => c.id === overId || c.cardIds.includes(overId));
  return { activeCol, overCol };
};

export function Board() {
  const columns = useBoard((s) => s.columns);
  const loading = useBoard((s) => s.loading);
  const moveCardToColumn = useBoard((s) => s.moveCardToColumn);
  const reorderCard = useBoard((s) => s.reorderCard);
  const flushDragPersist = useBoard((s) => s.flushDragPersist);

  const [activeCard, setActiveCard] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(({ active }) => {
    setActiveCard(active.data.current?.card ?? null);
    document.body.classList.add("dragging-active");
  }, []);

  const handleDragOver = useCallback(
    ({ active, over }) => {
      if (!over) return;
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
    document.body.classList.remove("dragging-active");
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      cleanup();
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
    [cleanup, reorderCard, flushDragPersist]
  );

  if (loading) {
    return (
      <div className="scroll-thin flex h-full gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-full w-[85vw] shrink-0 animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-800/40 sm:w-80"
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={cleanup}
    >
      <div className="scroll-thin flex h-full gap-4 overflow-x-auto px-4 pb-4 sm:px-6">
        {columns.map((column) => (
          <Column key={column.id} column={column} />
        ))}
        <AddColumn />
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
        ) : null}
      </DragOverlay>
    </DndContext>
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
