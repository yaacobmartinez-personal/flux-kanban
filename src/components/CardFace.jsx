import { memo } from "react";
import { CalendarDays } from "lucide-react";
import { getLabel } from "../lib/labels";

function formatDue(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / 86400000);
  const label = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  let tone =
    "text-slate-500 bg-slate-200/70 dark:text-slate-400 dark:bg-slate-700/40";
  let text = label;
  if (diffDays < 0) {
    tone = "text-rose-600 bg-rose-500/10 dark:text-rose-300 dark:bg-rose-500/15";
    text = `${label} · overdue`;
  } else if (diffDays === 0) {
    tone = "text-amber-600 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-500/15";
    text = "Due today";
  } else if (diffDays === 1) {
    tone = "text-amber-600 bg-amber-500/10 dark:text-amber-200 dark:bg-amber-500/10";
    text = "Tomorrow";
  }
  return { text, tone };
}

function CardFaceBase({ card, dragging = false }) {
  const label = getLabel(card.color);
  const due = formatDue(card.dueDate);
  const labelled = card.color && card.color !== "none";

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-colors",
        "border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80",
        dragging
          ? "shadow-2xl shadow-black/20 ring-1 ring-sky-400/40 dark:shadow-black/50"
          : "shadow-sm shadow-slate-900/5 hover:border-slate-300 dark:shadow-black/20 dark:hover:border-slate-600 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      {labelled && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: label.bar }}
        />
      )}

      <p className="pl-1.5 text-[0.9rem] font-medium leading-snug text-slate-800 dark:text-slate-100">
        {card.title || "Untitled"}
      </p>

      {card.description && (
        <p className="mt-1 line-clamp-2 pl-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {card.description}
        </p>
      )}

      {(due || labelled) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-1.5">
          {labelled && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium"
              style={{ color: label.swatch, backgroundColor: label.swatch + "22" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: label.swatch }}
              />
              {label.name}
            </span>
          )}
          {due && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium ${due.tone}`}
            >
              <CalendarDays className="h-3 w-3" strokeWidth={2} />
              {due.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const CardFace = memo(CardFaceBase);
