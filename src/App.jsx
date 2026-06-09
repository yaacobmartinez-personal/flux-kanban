import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { isConfigured } from "./lib/supabase";
import { useAuth } from "./store/authStore";
import { useWorkspace } from "./store/workspaceStore";
import { useBoard } from "./store/boardStore";
import { ConfigNotice } from "./components/ConfigNotice";
import { AuthScreen } from "./components/AuthScreen";
import { TopBar } from "./components/TopBar";
import { Board } from "./components/Board";
import { CardEditor } from "./components/CardEditor";
import { Onboarding } from "./components/Onboarding";

function FullScreen({ children }) {
  return (
    <div className="app-canvas flex min-h-[100dvh] items-center justify-center">
      {children}
    </div>
  );
}

export default function App() {
  const ready = useAuth((s) => s.ready);
  const session = useAuth((s) => s.session);
  const userId = useAuth((s) => s.user?.id);
  const init = useAuth((s) => s.init);

  const wsLoading = useWorkspace((s) => s.loading);
  const currentOrgId = useWorkspace((s) => s.currentOrgId);
  const currentProjectId = useWorkspace((s) => s.currentProjectId);
  const loadOrgs = useWorkspace((s) => s.loadOrgs);
  const resetWorkspace = useWorkspace((s) => s.reset);

  const loadBoard = useBoard((s) => s.loadBoard);

  useEffect(() => {
    init();
  }, [init]);

  // Load (or clear) the workspace whenever the signed-in user changes.
  useEffect(() => {
    if (userId) loadOrgs();
    else resetWorkspace();
  }, [userId, loadOrgs, resetWorkspace]);

  // Load the board for the selected project.
  useEffect(() => {
    if (currentProjectId) loadBoard(currentProjectId);
  }, [currentProjectId, loadBoard]);

  if (!isConfigured) return <ConfigNotice />;

  if (!ready)
    return (
      <FullScreen>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </FullScreen>
    );

  if (!session) return <AuthScreen />;

  return (
    <div className="app-canvas flex h-[100dvh] flex-col overflow-hidden">
      <TopBar />
      <main className="min-h-0 flex-1">
        {wsLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : !currentOrgId ? (
          <Onboarding mode="org" />
        ) : !currentProjectId ? (
          <Onboarding mode="project" />
        ) : (
          <Board />
        )}
      </main>
      <CardEditor />
    </div>
  );
}
