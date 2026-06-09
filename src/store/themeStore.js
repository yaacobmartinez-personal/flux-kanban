import { create } from "zustand";

const KEY = "flux-theme"; // matches the no-flash script in index.html
const mql = window.matchMedia("(prefers-color-scheme: dark)");

function resolve(theme) {
  return theme === "dark" || (theme === "system" && mql.matches);
}

function apply(theme) {
  document.documentElement.classList.toggle("dark", resolve(theme));
}

const initial = localStorage.getItem(KEY) || "system";

export const useTheme = create((set, get) => {
  // Keep "system" in sync with OS changes.
  mql.addEventListener("change", () => {
    if (get().theme === "system") apply("system");
  });

  return {
    theme: initial,
    setTheme: (theme) => {
      localStorage.setItem(KEY, theme);
      apply(theme);
      set({ theme });
    },
  };
});
