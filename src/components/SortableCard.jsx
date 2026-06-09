import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardFace } from "./CardFace";
import { useBoard } from "../store/boardStore";

function SortableCardBase({ card }) {
  const openCard = useBoard((s) => s.openCard);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", card } });

  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : undefined}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => openCard(card.id)}
        className="block w-full cursor-grab rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 active:cursor-grabbing"
      >
        <CardFace card={card} />
      </button>
    </li>
  );
}

export const SortableCard = memo(SortableCardBase);
