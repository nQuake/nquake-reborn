// Text size: small / medium / large, remembered per browser.
//
// The page turns pinch-zoom off (`index.html`'s viewport meta) because a
// wizard whose sticky phone nav can be scaled off screen is worse than one
// that cannot be scaled at all — so the zoom a phone would otherwise give
// you has to come from somewhere. This is it: `<html data-text-size>` moves
// the root font size, and since every size and most spacing in the UI is in
// rem, the whole layout grows and shrinks with the type.

export type TextSize = "small" | "medium" | "large";

const KEY = "nquake-reborn.text-size";

function isTextSize(v: unknown): v is TextSize {
  return v === "small" || v === "medium" || v === "large";
}

export function initialTextSize(override?: string | null): TextSize {
  if (isTextSize(override)) return override;
  try {
    const v = localStorage.getItem(KEY);
    if (isTextSize(v)) return v;
  } catch {
    // Private mode etc.
  }
  return "medium";
}

/** The next size the button offers: small → medium → large → small. */
export function nextTextSize(size: TextSize): TextSize {
  const next: Record<TextSize, TextSize> = {
    small: "medium",
    medium: "large",
    large: "small",
  };
  return next[size];
}

export function applyTextSize(size: TextSize): void {
  document.documentElement.setAttribute("data-text-size", size);
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // The toggle still works for this page load.
  }
}
