import { useState } from "react";
import { motion } from "motion/react";
import { Building2, LayoutGrid, Loader2 } from "lucide-react";
import { useWorkspace } from "../store/workspaceStore";

export function Onboarding({ mode }) {
  const createOrg = useWorkspace((s) => s.createOrg);
  const createProject = useWorkspace((s) => s.createProject);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const isOrg = mode === "org";

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    if (isOrg) await createOrg(name.trim());
    else await createProject(name.trim(), key.trim());
    setBusy(false);
  };

  return (
    <div className="flex h-full items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass w-full max-w-sm rounded-2xl p-7 text-center"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/15 text-sky-500">
          {isOrg ? <Building2 className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />}
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {isOrg ? "Create your organization" : "Create your first project"}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {isOrg
            ? "An organization holds your team, members, and projects."
            : "A project is a board your team works on together."}
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3 text-left">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isOrg ? "Acme Inc." : "Marketing site"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
          />
          {!isOrg && (
            <input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="Key (e.g. MKT) — optional"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 placeholder:text-slate-400 placeholder:normal-case outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            />
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-900 dark:hover:bg-sky-400"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isOrg ? "Create organization" : "Create project"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
