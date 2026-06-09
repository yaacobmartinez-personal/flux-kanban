import { useBoard } from "../store/boardStore";
import { useWorkspace } from "../store/workspaceStore";
import { getLabel } from "../lib/labels";

function AssigneeAvatar({ userId }) {
  const member = useWorkspace((s) => s.members.find((m) => m.user_id === userId));
  if (!member) return null;
  const p = member.profiles;
  const name = p?.full_name || p?.email?.split("@")[0] || "?";
  const initials = name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (p?.avatar_url)
    return (
      <img
        src={p.avatar_url}
        alt={name}
        title={name}
        className="h-6 w-6 rounded-full object-cover ring-1 ring-white dark:ring-slate-800"
      />
    );
  return (
    <span
      title={name}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[0.55rem] font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
    >
      {initials}
    </span>
  );
}

function TicketRow({ card, columnTitle }) {
  const openCard = useBoard((s) => s.openCard);
  const label = getLabel(card.color);
  const labelled = card.color && card.color !== "none";

  return (
    <li
      onClick={() => openCard(card.id)}
      className="flex cursor-pointer items-center gap-3 border-b border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40 sm:px-6"
    >
      {/* Left: label chip + title */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {labelled && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium"
            style={{ color: label.swatch, backgroundColor: label.swatch + "22" }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: label.swatch }}
            />
            {card.labelText || label.name}
          </span>
        )}
        <span
          className={[
            "truncate text-sm font-medium",
            card.closedAt
              ? "text-slate-400 line-through dark:text-slate-500"
              : "text-slate-800 dark:text-slate-100",
          ].join(" ")}
        >
          {card.title || "Untitled"}
        </span>
      </div>

      {/* Right: status · points · assignee */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-300">
          {columnTitle}
        </span>
        {card.storyPoints != null && (
          <span className="inline-flex items-center rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            {card.storyPoints}
          </span>
        )}
        {card.assigneeId && <AssigneeAvatar userId={card.assigneeId} />}
      </div>
    </li>
  );
}

export function ListView() {
  const columns = useBoard((s) => s.columns);
  const cardsById = useBoard((s) => s.cards);

  const rows = columns.flatMap((col) =>
    col.cardIds
      .map((id) => ({ card: cardsById[id], columnTitle: col.title }))
      .filter(({ card }) => Boolean(card))
  );

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">No cards yet</p>
      </div>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <ul>
        {rows.map(({ card, columnTitle }) => (
          <TicketRow key={card.id} card={card} columnTitle={columnTitle} />
        ))}
      </ul>
    </div>
  );
}
