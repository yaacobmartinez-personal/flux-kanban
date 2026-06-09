// Color labels for cards. `none` = unlabeled.
// Each entry carries the swatch + the tinted bar/glow used on the card.
export const LABELS = {
  none: { id: "none", name: "No label", swatch: "#475569", bar: "transparent" },
  sky: { id: "sky", name: "Sky", swatch: "#38bdf8", bar: "#38bdf8" },
  emerald: { id: "emerald", name: "Emerald", swatch: "#34d399", bar: "#34d399" },
  amber: { id: "amber", name: "Amber", swatch: "#fbbf24", bar: "#fbbf24" },
  rose: { id: "rose", name: "Rose", swatch: "#fb7185", bar: "#fb7185" },
  violet: { id: "violet", name: "Violet", swatch: "#a78bfa", bar: "#a78bfa" },
  slate: { id: "slate", name: "Slate", swatch: "#94a3b8", bar: "#94a3b8" },
};

export const LABEL_LIST = Object.values(LABELS);

export function getLabel(id) {
  return LABELS[id] ?? LABELS.none;
}
