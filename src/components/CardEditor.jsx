import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  X, Trash2, AlignLeft, Calendar, Tag,
  User2, UserCheck, Layers, Hash, Link2,
  MessageSquare, Plus, ExternalLink,
  History, CheckCircle2, RotateCcw,
} from "lucide-react";
import { useBoard } from "../store/boardStore";
import { useWorkspace } from "../store/workspaceStore";
import { useAuth } from "../store/authStore";
import { LABEL_LIST } from "../lib/labels";

// ─── shared styles ───────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500";

const selectCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";

// ─── helpers ─────────────────────────────────────────────────────────────────
function FieldLabel({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Avatar({ profile, className = "h-7 w-7" }) {
  const name = profile?.full_name || profile?.email || "?";
  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (profile?.avatar_url)
    return <img src={profile.avatar_url} alt={name} className={`${className} rounded-full object-cover`} />;
  return (
    <span className={`${className} inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[0.65rem] font-semibold text-sky-700 dark:text-sky-300`}>
      {initials}
    </span>
  );
}

function relativeTime(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── activity feed ────────────────────────────────────────────────────────────
const FIELD_LABELS = {
  title: "title",
  description: "description",
  color: "label",
  labelText: "label text",
  dueDate: "due date",
  assigneeId: "assignee",
  reporterId: "reporter",
  epicId: "parent",
  storyPoints: "story points",
  links: "links",
};

function activityText(event, { getProfile, getCard }) {
  const { type, data } = event;
  switch (type) {
    case "created":
      return "created this card";
    case "field_changed": {
      const field = data.field;
      if (field === "description") return "updated description";
      if (field === "links") return "updated links";
      if (field === "assigneeId" || field === "reporterId") {
        const label = FIELD_LABELS[field];
        if (!data.to) return `removed ${label}`;
        const p = getProfile(data.to);
        const name = p?.full_name || p?.email?.split("@")[0] || "someone";
        return `set ${label} to ${name}`;
      }
      if (field === "epicId") {
        if (!data.to) return "removed parent";
        const title = getCard(data.to)?.title || "a card";
        return `set parent to "${title}"`;
      }
      if (field === "color") {
        if (!data.to || data.to === "none") return "removed label";
        return `set label to ${data.to}`;
      }
      const label = FIELD_LABELS[field] ?? field;
      if (!data.to) return `cleared ${label}`;
      if (!data.from) return `set ${label} to "${data.to}"`;
      return `changed ${label} to "${data.to}"`;
    }
    case "moved":
      return `moved from "${data.from_column}" to "${data.to_column}"`;
    case "closed":
      return "closed this card";
    case "reopened":
      return "reopened this card";
    default:
      return type;
  }
}

function ActivityFeed({ cardId }) {
  const events = useBoard((s) => s.activity[cardId] ?? []);
  const members = useWorkspace((s) => s.members);
  const allCards = useBoard((s) => s.cards);

  const getProfile = (userId) =>
    userId ? (members.find((m) => m.user_id === userId)?.profiles ?? null) : null;
  const getCard = (cardId) => allCards[cardId] ?? null;

  if (!events.length) return null;

  return (
    <div className="space-y-3">
      <FieldLabel icon={History}>History</FieldLabel>
      <div className="space-y-2">
        {events.map((event) => {
          const profile = event.profiles;
          const name = profile?.full_name || profile?.email?.split("@")[0] || "Someone";
          return (
            <div key={event.id} className="flex items-start gap-2 text-xs">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">{name}</span>{" "}
                {activityText(event, { getProfile, getCard })}{" "}
                <span className="text-slate-400 dark:text-slate-500">{relativeTime(event.created_at)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── comment item ─────────────────────────────────────────────────────────────
function CommentItem({ comment, isOwn, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const profile = comment.profiles;
  const name = profile?.full_name || profile?.email?.split("@")[0] || "Unknown";

  const save = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    await onUpdate(draft.trim());
    setEditing(false);
    setBusy(false);
  };

  return (
    <div className="flex gap-3">
      <Avatar profile={profile} className="h-7 w-7 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{name}</span>
          <span className="text-[0.65rem] text-slate-400 dark:text-slate-500">
            {relativeTime(comment.created_at)}{comment.updated_at ? " · edited" : ""}
          </span>
        </div>
        {editing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
              rows={3}
              className={`${inputCls} resize-none`}
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy || !draft.trim()}
                className="rounded-md bg-sky-500 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(comment.body); }}
                className="rounded-md px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {comment.body}
          </p>
        )}
        {isOwn && !editing && (
          <div className="mt-1 flex gap-3">
            <button
              onClick={() => { setDraft(comment.body); setEditing(true); }}
              className="text-[0.65rem] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-[0.65rem] text-slate-400 hover:text-rose-500 dark:hover:text-rose-300"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── comments section ─────────────────────────────────────────────────────────
function CommentsSection({ cardId }) {
  const comments = useBoard((s) => s.comments[cardId] ?? []);
  const addComment = useBoard((s) => s.addComment);
  const updateComment = useBoard((s) => s.updateComment);
  const deleteComment = useBoard((s) => s.deleteComment);
  const currentUser = useAuth((s) => s.user);
  const myProfile = useAuth((s) => s.profile);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    await addComment(cardId, draft.trim());
    setDraft("");
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <FieldLabel icon={MessageSquare}>
        Comments
        {comments.length > 0 && (
          <span className="ml-0.5 text-slate-400">({comments.length})</span>
        )}
      </FieldLabel>

      {comments.length > 0 && (
        <div className="space-y-5">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={c.author_id === currentUser?.id}
              onDelete={() => deleteComment(c.id, cardId)}
              onUpdate={(body) => updateComment(c.id, cardId, body)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Avatar profile={myProfile} className="h-7 w-7 mt-1 shrink-0" />
        <div className="flex-1 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="Add a comment… (⌘↵ to post)"
            rows={draft ? 3 : 2}
            className={`${inputCls} resize-none`}
          />
          {draft.trim() && (
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={busy}
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
              >
                Post
              </button>
              <button
                onClick={() => setDraft("")}
                className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── main editor panel ────────────────────────────────────────────────────────
export function CardEditor() {
  const editingCardId = useBoard((s) => s.editingCardId);
  const card = useBoard((s) => (editingCardId ? s.cards[editingCardId] : null));
  const updateCard = useBoard((s) => s.updateCard);
  const deleteCard = useBoard((s) => s.deleteCard);
  const closeCard = useBoard((s) => s.closeCard);
  const archiveCard = useBoard((s) => s.archiveCard);
  const unarchiveCard = useBoard((s) => s.unarchiveCard);
  const allCards = useBoard((s) => s.cards);
  const columns = useBoard((s) => s.columns);
  const members = useWorkspace((s) => s.members);
  const projectKey = useWorkspace(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.key
  );
  const reduce = useReducedMotion();

  const open = Boolean(card);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeCard();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCard]);

  if (!open) return null;

  const getProfile = (userId) =>
    userId ? (members.find((m) => m.user_id === userId)?.profiles ?? null) : null;

  const otherCards = columns.flatMap((col) =>
    col.cardIds
      .map((id) => allCards[id])
      .filter((c) => c && c.id !== card.id)
  );

  const reporterProfile = getProfile(card.reporterId);
  const assigneeProfile = getProfile(card.assigneeId);

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
            className="glass absolute inset-y-0 right-0 flex w-full max-w-lg flex-col"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {projectKey && card.number != null
                    ? `${projectKey}-${card.number}`
                    : "Card details"}
                </span>
                {card.closedAt && (
                  <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500 dark:text-slate-400">
                    Closed
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeCard}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">

              {/* Title */}
              <div className="space-y-1.5">
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

              {/* Description */}
              <div className="space-y-1.5">
                <FieldLabel icon={AlignLeft}>Description</FieldLabel>
                <textarea
                  value={card.description}
                  onChange={(e) => updateCard(card.id, { description: e.target.value })}
                  rows={3}
                  placeholder="Add more detail…"
                  className={`${inputCls} resize-y leading-relaxed`}
                />
              </div>

              {/* Metadata 2-column grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">

                {/* Assignee */}
                <div className="space-y-1.5">
                  <FieldLabel icon={User2}>Assignee</FieldLabel>
                  <select
                    value={card.assigneeId ?? ""}
                    onChange={(e) => updateCard(card.id, { assigneeId: e.target.value || null })}
                    className={selectCls}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name || m.profiles?.email?.split("@")[0] || "Unknown"}
                      </option>
                    ))}
                  </select>
                  {assigneeProfile && (
                    <div className="flex items-center gap-1.5 px-0.5">
                      <Avatar profile={assigneeProfile} className="h-5 w-5" />
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {assigneeProfile.full_name || assigneeProfile.email?.split("@")[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Reporter (read-only) */}
                <div className="space-y-1.5">
                  <FieldLabel icon={UserCheck}>Reporter</FieldLabel>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                    <Avatar profile={reporterProfile} className="h-5 w-5 shrink-0" />
                    <span className="truncate text-sm text-slate-700 dark:text-slate-300">
                      {reporterProfile?.full_name || reporterProfile?.email?.split("@")[0] || "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Epic / Parent */}
                <div className="space-y-1.5">
                  <FieldLabel icon={Layers}>Epic / Parent</FieldLabel>
                  <select
                    value={card.epicId ?? ""}
                    onChange={(e) => updateCard(card.id, { epicId: e.target.value || null })}
                    className={selectCls}
                  >
                    <option value="">No epic</option>
                    {otherCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || "Untitled"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Story Points */}
                <div className="space-y-1.5">
                  <FieldLabel icon={Hash}>Story points</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={card.storyPoints ?? ""}
                    onChange={(e) =>
                      updateCard(card.id, {
                        storyPoints: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                    placeholder="—"
                    className={inputCls}
                  />
                  {card.storyPoints != null && (
                    <button
                      type="button"
                      onClick={() => updateCard(card.id, { storyPoints: null })}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Label */}
              <div className="space-y-2">
                <FieldLabel icon={Tag}>Label</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {LABEL_LIST.map((l) => {
                    const active = card.color === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateCard(card.id, { color: l.id })}
                        className={[
                          "flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition",
                          active
                            ? "border-slate-400 text-slate-900 dark:border-slate-400 dark:text-slate-100"
                            : "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500",
                        ].join(" ")}
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={l.id === "none" ? { border: `1.5px solid ${l.swatch}` } : { backgroundColor: l.swatch }}
                        />
                        {l.name}
                      </button>
                    );
                  })}
                </div>
                {card.color && card.color !== "none" && (
                  <input
                    value={card.labelText ?? ""}
                    onChange={(e) => updateCard(card.id, { labelText: e.target.value || null })}
                    placeholder={`Caption (default: ${LABEL_LIST.find((l) => l.id === card.color)?.name ?? ""})`}
                    className={inputCls}
                  />
                )}
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <FieldLabel icon={Calendar}>Due date</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={card.dueDate ?? ""}
                    onChange={(e) => updateCard(card.id, { dueDate: e.target.value || null })}
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

              {/* Links */}
              <div className="space-y-1.5">
                <FieldLabel icon={Link2}>Links</FieldLabel>
                <div className="space-y-2">
                  {(card.links ?? []).map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={url}
                        onChange={(e) => {
                          const links = [...(card.links ?? [])];
                          links[i] = e.target.value;
                          updateCard(card.id, { links });
                        }}
                        placeholder="https://…"
                        className={inputCls}
                      />
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-700/60 dark:hover:text-sky-400"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          updateCard(card.id, { links: (card.links ?? []).filter((_, j) => j !== i) });
                        }}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-700/60 dark:hover:text-rose-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateCard(card.id, { links: [...(card.links ?? []), ""] })}
                    className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add link
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200/70 dark:border-slate-700/50" />

              {/* Activity history */}
              <ActivityFeed cardId={card.id} />

              {/* Comments */}
              <CommentsSection cardId={card.id} />
            </div>

            {/* Footer */}
            <div className="space-y-2 border-t border-slate-200/70 px-5 py-4 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => card.closedAt ? unarchiveCard(card.id) : archiveCard(card.id)}
                className={[
                  "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  card.closedAt
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
                    : "border-slate-300/60 bg-slate-500/8 text-slate-600 hover:bg-slate-500/15 dark:border-slate-600/40 dark:text-slate-300",
                ].join(" ")}
              >
                {card.closedAt
                  ? <><RotateCcw className="h-4 w-4" /> Reopen card</>
                  : <><CheckCircle2 className="h-4 w-4" /> Close card</>
                }
              </button>
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
