import { useState } from "react";
import {
  ChevronDown,
  Plus,
  Users,
  LogOut,
  Check,
  Building2,
  LayoutGrid,
  Trash2,
  Loader2,
} from "lucide-react";
import { useWorkspace } from "../store/workspaceStore";
import { useAuth } from "../store/authStore";
import { ThemeToggle } from "./ThemeToggle";
import { MembersPanel } from "./MembersPanel";
import { Modal } from "./Modal";

function Dropdown({ open, onClose, children, align = "left" }) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        className={`glass absolute top-full z-50 mt-1.5 w-60 rounded-xl p-1.5 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </>
  );
}

export function TopBar() {
  const orgs = useWorkspace((s) => s.orgs);
  const currentOrgId = useWorkspace((s) => s.currentOrgId);
  const selectOrg = useWorkspace((s) => s.selectOrg);
  const createOrg = useWorkspace((s) => s.createOrg);
  const projects = useWorkspace((s) => s.projects);
  const currentProjectId = useWorkspace((s) => s.currentProjectId);
  const selectProject = useWorkspace((s) => s.selectProject);
  const createProject = useWorkspace((s) => s.createProject);
  const deleteProject = useWorkspace((s) => s.deleteProject);
  const myRole = useWorkspace((s) => s.myRole);

  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);

  const canManage = myRole === "owner" || myRole === "admin";

  const [menu, setMenu] = useState(null); // 'org' | 'project' | 'account'
  const [modal, setModal] = useState(null); // 'org' | 'project'
  const [membersOpen, setMembersOpen] = useState(false);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const currentProject = projects.find((p) => p.id === currentProjectId);

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-slate-900">
          F
        </div>

        {/* Org switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "org" ? null : "org")}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 hover:bg-white/60 dark:text-slate-100 dark:hover:bg-slate-800/60"
          >
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="max-w-[7rem] truncate sm:max-w-[12rem]">
              {currentOrg?.name ?? "No organization"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <Dropdown open={menu === "org"} onClose={() => setMenu(null)}>
            {orgs.map((o) => (
              <MenuItem
                key={o.id}
                active={o.id === currentOrgId}
                onClick={() => {
                  selectOrg(o.id);
                  setMenu(null);
                }}
              >
                {o.name}
              </MenuItem>
            ))}
            <Divider />
            <MenuItem
              icon={Plus}
              onClick={() => {
                setMenu(null);
                setModal("org");
              }}
            >
              New organization
            </MenuItem>
          </Dropdown>
        </div>

        {currentOrg && (
          <>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            {/* Project switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu(menu === "project" ? null : "project")}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-slate-800/60"
              >
                <LayoutGrid className="h-4 w-4 text-slate-400" />
                <span className="max-w-[7rem] truncate sm:max-w-[12rem]">
                  {currentProject?.name ?? "No project"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <Dropdown open={menu === "project"} onClose={() => setMenu(null)}>
                {projects.map((p) => (
                  <MenuItem
                    key={p.id}
                    active={p.id === currentProjectId}
                    onClick={() => {
                      selectProject(p.id);
                      setMenu(null);
                    }}
                  >
                    <span className="mr-1.5 rounded bg-slate-200 px-1 text-[0.6rem] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                      {p.key}
                    </span>
                    {p.name}
                  </MenuItem>
                ))}
                <Divider />
                <MenuItem
                  icon={Plus}
                  onClick={() => {
                    setMenu(null);
                    setModal("project");
                  }}
                >
                  New project
                </MenuItem>
                {canManage && currentProject && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      setModal("deleteProject");
                    }}
                    className="flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="flex-1 truncate">Delete “{currentProject.name}”</span>
                  </button>
                )}
              </Dropdown>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {currentOrg && (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </button>
        )}

        <ThemeToggle />

        {/* Account */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === "account" ? null : "account")}
            aria-label="Account"
            className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-xs font-semibold text-slate-800 dark:from-slate-600 dark:to-slate-700 dark:text-slate-100"
          >
            {(profile?.full_name || profile?.email || "?").slice(0, 2).toUpperCase()}
          </button>
          <Dropdown open={menu === "account"} onClose={() => setMenu(null)} align="right">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {profile?.full_name || "Account"}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {profile?.email}
              </p>
            </div>
            <Divider />
            <MenuItem icon={LogOut} onClick={signOut}>
              Sign out
            </MenuItem>
          </Dropdown>
        </div>
      </div>

      <MembersPanel open={membersOpen} onClose={() => setMembersOpen(false)} />
      <CreateOrgModal open={modal === "org"} onClose={() => setModal(null)} onCreate={createOrg} />
      <CreateProjectModal
        open={modal === "project"}
        onClose={() => setModal(null)}
        onCreate={createProject}
      />
      <DeleteProjectModal
        open={modal === "deleteProject"}
        onClose={() => setModal(null)}
        project={currentProject}
        onDelete={deleteProject}
      />
    </header>
  );
}

function MenuItem({ children, onClick, active, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-700/50"
    >
      {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      <span className="flex-1 truncate">{children}</span>
      {active && <Check className="h-4 w-4 text-sky-500" />}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-slate-200/70 dark:bg-slate-700/50" />;
}

function CreateOrgModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    setName("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New organization">
      <form onSubmit={submit} className="space-y-3">
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
        />
        <SubmitBtn busy={busy}>Create organization</SubmitBtn>
      </form>
    </Modal>
  );
}

function CreateProjectModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onCreate(name.trim(), key.trim());
    setBusy(false);
    setName("");
    setKey("");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New project">
      <form onSubmit={submit} className="space-y-3">
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marketing site"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
        />
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="Key (e.g. MKT) — optional"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase text-slate-900 placeholder:text-slate-400 placeholder:normal-case outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
        />
        <SubmitBtn busy={busy}>Create project</SubmitBtn>
      </form>
    </Modal>
  );
}

function DeleteProjectModal({ open, onClose, project, onDelete }) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!project) return;
    setBusy(true);
    await onDelete(project.id);
    setBusy(false);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Delete project">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Permanently delete <strong className="font-semibold">{project?.name}</strong> and
          all of its columns, cards, comments, and history? This can't be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-60 dark:text-rose-300"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete project
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SubmitBtn({ busy, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-900 dark:hover:bg-sky-400"
    >
      {children}
    </button>
  );
}
