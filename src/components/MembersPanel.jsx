import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, UserPlus, Loader2, LogOut } from "lucide-react";
import { useWorkspace } from "../store/workspaceStore";
import { useAuth } from "../store/authStore";

const ROLES = ["owner", "admin", "member"];

function initials(name, email) {
  const base = name || email || "?";
  return base.slice(0, 2).toUpperCase();
}

export function MembersPanel({ open, onClose }) {
  const reduce = useReducedMotion();
  const members = useWorkspace((s) => s.members);
  const myRole = useWorkspace((s) => s.myRole);
  const addMember = useWorkspace((s) => s.addMember);
  const updateMemberRole = useWorkspace((s) => s.updateMemberRole);
  const removeMember = useWorkspace((s) => s.removeMember);
  const leaveOrg = useWorkspace((s) => s.leaveOrg);
  const myId = useAuth((s) => s.user?.id);

  const canManage = myRole === "owner" || myRole === "admin";
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isSoleOwner = myRole === "owner" && ownerCount === 1;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState(null);

  const doLeave = async () => {
    setLeaveBusy(true);
    setLeaveError(null);
    const { error } = await leaveOrg();
    setLeaveBusy(false);
    if (error) setLeaveError(error.message);
    else {
      setConfirmLeave(false);
      onClose();
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await addMember(email.trim(), role);
    setBusy(false);
    if (error) setError(error.message);
    else {
      setEmail("");
      setRole("member");
    }
  };

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
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Members"
            className="glass absolute inset-y-0 right-0 flex w-full max-w-md flex-col"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/50">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Members
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {members.length} in this organization
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {canManage && (
              <form
                onSubmit={submit}
                className="space-y-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/50"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Add a member by email
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {error && (
                  <p role="alert" className="text-xs font-medium text-rose-500">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-900 dark:hover:bg-sky-400"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Add member
                </button>
                <p className="text-[0.7rem] text-slate-400">
                  The person must already have a Flux account.
                </p>
              </form>
            )}

            <ul className="flex-1 divide-y divide-slate-200/70 overflow-y-auto dark:divide-slate-700/40">
              {members.map((m) => {
                const p = m.profiles || {};
                const isSelf = m.user_id === myId;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400/80 to-indigo-500/80 text-xs font-semibold text-slate-900">
                      {initials(p.full_name, p.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {p.full_name || p.email || "Unknown"}
                        {isSelf && (
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {p.email}
                      </p>
                    </div>

                    {canManage && !isSelf ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={m.role}
                          onChange={(e) => updateMemberRole(m.id, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label="Remove member"
                          onClick={() => removeMember(m.id)}
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] font-medium capitalize text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
                        {m.role}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Footer: leave organization */}
            <div className="border-t border-slate-200/70 px-5 py-4 dark:border-slate-700/50">
              {confirmLeave ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Leave this organization? You'll lose access to its projects and
                    boards until someone re-invites you.
                  </p>
                  {leaveError && (
                    <p role="alert" className="text-xs font-medium text-rose-500">
                      {leaveError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={doLeave}
                      disabled={leaveBusy}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-60 dark:text-rose-300"
                    >
                      {leaveBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Yes, leave
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveError(null);
                      setConfirmLeave(true);
                    }}
                    disabled={isSoleOwner}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 dark:text-slate-400 dark:disabled:text-slate-500"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave organization
                  </button>
                  {isSoleOwner && (
                    <p className="mt-1.5 text-[0.7rem] text-slate-400">
                      You're the only owner. Make another member an owner first, or
                      delete the organization.
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
