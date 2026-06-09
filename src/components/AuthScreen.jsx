import { useState } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../store/authStore";
import { ThemeToggle } from "./ThemeToggle";

export function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const error = useAuth((s) => s.error);
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const clearError = useAuth((s) => s.clearError);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    if (mode === "signup") {
      const { error } = await signUp(email, password, fullName);
      if (!error)
        setNotice(
          "Account created. If email confirmation is enabled, check your inbox, then sign in."
        );
    } else {
      await signIn(email, password);
    }
    setBusy(false);
  };

  const swap = (next) => {
    setMode(next);
    setNotice(null);
    clearError();
  };

  return (
    <div className="app-canvas flex min-h-[100dvh] items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass w-full max-w-sm rounded-2xl p-7"
      >
        <div className="mb-5 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 font-bold text-slate-900">
            F
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Flux — team kanban
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {mode === "signup" && (
            <Field
              label="Full name"
              type="text"
              value={fullName}
              onChange={setFullName}
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
          />

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-500">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-xs font-medium text-emerald-500">{notice}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-900 dark:hover:bg-sky-400"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === "signin" ? "New to Flux?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => swap(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, ...props }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
        {...props}
      />
    </label>
  );
}
