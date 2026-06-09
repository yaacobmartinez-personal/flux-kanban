export function ConfigNotice() {
  return (
    <div className="app-canvas flex min-h-[100dvh] items-center justify-center px-4">
      <div className="glass w-full max-w-lg rounded-2xl p-7">
        <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 font-bold text-slate-900">
          F
        </div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Connect Supabase to continue
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Flux needs Supabase credentials for auth and storage. Create a project,
          run the migration in{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-xs dark:bg-slate-700">
            supabase/migrations
          </code>
          , then add a{" "}
          <code className="rounded bg-slate-200 px-1 py-0.5 text-xs dark:bg-slate-700">
            .env.local
          </code>{" "}
          file:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-200">
          {`VITE_SUPABASE_URL=https://your-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Full steps are in <span className="font-medium">README.md</span>. Restart
          the dev server after adding the file.
        </p>
      </div>
    </div>
  );
}
