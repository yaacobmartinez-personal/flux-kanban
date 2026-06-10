import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";

let nextId = 1;

/**
 * Listens for `flux:ratelimit` events (dispatched by the request limiter when
 * the server-side rate limit returns HTTP 429) and shows a transient toast.
 * Uses aria-live so it's announced without stealing focus.
 */
export function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let lastShown = 0;
    const onLimit = (e) => {
      // Coalesce: a burst of blocked writes shouldn't spawn 20 toasts.
      const now = Date.now();
      if (now - lastShown < 2500) return;
      lastShown = now;

      const id = nextId++;
      const message = e.detail?.message || "You're doing that too fast.";
      setToasts((t) => [...t, { id, message }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4000);
    };

    window.addEventListener("flux:ratelimit", onLimit);
    return () => window.removeEventListener("flux:ratelimit", onLimit);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm shadow-lg shadow-black/10"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-slate-700 dark:text-slate-200">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
