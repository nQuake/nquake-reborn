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

/**
 * What the browser paints its own chrome with — Safari's address bar, and
 * the toolbar it puts at the bottom of a phone. It is the bar the Next
 * button sits in that it borders, so that is the colour it gets: `--surface`
 * rather than the page behind it, which left a visible seam under the
 * sticky nav. The literals are only the fallback for a page whose CSS has
 * not landed yet; `index.html` carries the same two for the first paint.
 */
const CHROME_FALLBACK: Record<Theme, string> = {
  dark: "#303030",
  light: "#ffffff",
};

function applyBrowserChrome(theme: Theme): void {
  const root = document.documentElement;
  const surface = getComputedStyle(root).getPropertyValue("--surface").trim();
  // index.html's two metas follow the OS. Once the app is running, the
  // header's toggle decides, and a media-scoped meta would override the one
  // we set — the browser takes the first whose media matches.
  for (const m of document.querySelectorAll('meta[name="theme-color"][media]'))
    m.remove();
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = surface || CHROME_FALLBACK[theme];
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  applyBrowserChrome(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode etc. — the toggle still works for this page load.
  }
}
