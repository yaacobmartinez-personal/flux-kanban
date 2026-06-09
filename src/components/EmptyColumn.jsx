import { motion, useReducedMotion } from "motion/react";

/** Empty-state illustration shown when a column has no cards. */
export function EmptyColumn({ onAdd }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700/70"
    >
      <svg
        width="72"
        height="56"
        viewBox="0 0 72 56"
        fill="none"
        aria-hidden
        className="text-slate-400 dark:text-slate-600"
      >
        <rect
          x="8"
          y="14"
          width="56"
          height="34"
          rx="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 5"
        />
        <rect x="18" y="24" width="36" height="4" rx="2" fill="currentColor" opacity="0.5" />
        <rect x="18" y="33" width="24" height="4" rx="2" fill="currentColor" opacity="0.3" />
        <path
          d="M36 4v8M28 8l8-4 8 4"
          stroke="#0ea5e9"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No cards yet
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 text-xs font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Add the first one
        </button>
      </div>
    </motion.div>
  );
}
