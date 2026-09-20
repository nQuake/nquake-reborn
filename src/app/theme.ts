// Dark/light: follows the OS unless the user toggled, remembered per browser.

export type Theme = "dark" | "light";

const KEY = "nquake-reborn.theme";

function read(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

export function initialTheme(override?: string | null): Theme {
  if (override === "dark" || override === "light") return override;
  const stored = read();
  if (stored) return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode etc. — the toggle still works for this page load.
  }
}
