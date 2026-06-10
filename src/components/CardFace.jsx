import { memo } from "react";
import { getLabel } from "../lib/labels";
import { useWorkspace } from "../store/workspaceStore";

function AssigneeChip({ userId }) {
  const member = useWorkspace((s) => s.members.find((m) => m.user_id === userId));
  if (!userId || !member) return null;
  const p = member.profiles;
  const name = p?.full_name || p?.email?.split("@")[0] || "?";
  const initials = name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (p?.avatar_url)
    return <img src={p.avatar_url} alt={name} title={name} className="h-5 w-5 rounded-full object-cover ring-1 ring-white dark:ring-slate-800" />;
  return (
    <span
      title={name}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-[0.55rem] font-bold text-sky-700 ring-1 ring-white dark:bg-sky-500/15 dark:text-sky-300 dark:ring-slate-800"
    >
      {initials}
    </span>
  );
}

function CardFaceBase({ card, dragging = false }) {
  const label = getLabel(card.color);
  const labelled = card.color && card.color !== "none";
  const hasFooter = labelled || card.storyPoints != null || card.assigneeId;
  const projectKey = useWorkspace(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.key
  );
  const ticket = projectKey && card.number != null ? `${projectKey}-${card.number}` : null;

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

      {ticket && (
        <p className="pl-1.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {ticket}
        </p>
      )}

      <p className="pl-1.5 text-[0.9rem] font-medium leading-snug text-slate-800 dark:text-slate-100">
        {card.title || "Untitled"}
      </p>

      {hasFooter && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-1.5">
          {labelled && (
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium"
              style={{ color: label.swatch, backgroundColor: label.swatch + "22" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.swatch }} />
              {card.labelText || label.name}
            </span>
          )}
          {card.storyPoints != null && (
            <span className="inline-flex items-center rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              {card.storyPoints}
            </span>
          )}
          {card.assigneeId && <AssigneeChip userId={card.assigneeId} />}
        </div>
      )}
    </div>
  );
}

export const CardFace = memo(CardFaceBase);
