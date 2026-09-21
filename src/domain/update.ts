// Loading the newest build of the installer.
//
// The page is a static deploy that can sit open for hours — someone opens it,
// wanders off, comes back the next day and installs from whatever bundle
// their browser happened to fetch. Every fix we ship after that point is a
// fix they do not get, and an installer is exactly the kind of page where
// "reload it first" is advice nobody receives. So the app checks for a newer
// deploy (`version.json` next to the bundle, written by `vite.config.ts`) and
// reloads itself, having first written the wizard's answers down (`session.ts`).
//
// This module holds the decisions: what counts as a new build, when a reload
// may happen behind the user's back, and when to stop reloading and ask.

/** How often a page that is being looked at re-checks for a new deploy. */
export const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** Shortest gap between checks triggered by coming back to the tab. */
export const UPDATE_CHECK_MIN_GAP_MS = 60 * 1000;

/**
 * How many times we will reload towards the same build before giving up on
 * doing it quietly. raw's CDN and GitHub Pages both cache, so `version.json`
 * can announce a build the HTML is not serving yet; without this, those few
 * minutes would be a reload loop.
 */
export const MAX_RELOAD_ATTEMPTS = 2;

export interface VersionInfo {
  /** The build label, exactly as `BUILD_LABEL` carries it. */
  version: string;
}

export function parseVersionInfo(raw: unknown): VersionInfo {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as {
    version?: unknown;
  };
  if (typeof r.version !== "string" || !r.version.trim()) {
    throw new Error("version.json: no version");
  }
  return { version: r.version.trim() };
}

/**
 * Any difference is a new build: the label carries the CI run number, so it
 * changes on every deploy, and it is the deployed one that is right — a
 * rollback is an update too.
 */
export function isNewBuild(current: string, latest: string): boolean {
  return !!current && !!latest && current !== latest;
}

export type InstallStatus =
  "idle" | "running" | "done" | "failed" | "cancelled";

export interface UpdateSituation {
  installStatus: InstallStatus;
  /**
   * True when a reload would cost the user something it cannot put back — a
   * folder handle a browser only grants for the life of the page, or a
   * `pak1.pak` picked from a file dialog.
   */
  losesInput: boolean;
  /** Reloads already spent reaching for this build. */
  attempts: number;
}

/**
 * - `reload` — take it now; nothing on screen is worth more than the fix.
 * - `ask` — offer it; reloading would throw away something the user did.
 * - `hold` — not now. An install in flight is never interrupted: the files
 *   landing in the folder are the whole point, and the newest installer is
 *   worth nothing next to half of one.
 */
export type UpdateAction = "reload" | "ask" | "hold";

export function updateAction(s: UpdateSituation): UpdateAction {
  if (s.installStatus === "running") return "hold";
  // A finished install has nothing left to gain and a Done screen full of
  // instructions to lose.
  if (s.installStatus === "done") return "hold";
  if (s.attempts >= MAX_RELOAD_ATTEMPTS) return "ask";
  if (s.installStatus === "idle" && !s.losesInput) return "reload";
  // Idle-but-would-lose-something, or a run that failed or was cancelled —
  // the new build may well be the fix, so offer it rather than take it.
  return "ask";
}

/** What has been tried towards one build, so a stale CDN cannot loop us. */
export interface ReloadAttempt {
  to: string;
  attempts: number;
  at: number;
}

export function parseAttempt(raw: unknown): ReloadAttempt | null {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as {
    to?: unknown;
    attempts?: unknown;
    at?: unknown;
  };
  if (typeof r.to !== "string" || !r.to) return null;
  const attempts = typeof r.attempts === "number" ? Math.trunc(r.attempts) : 0;
  return {
    to: r.to,
    attempts: attempts > 0 ? attempts : 0,
    at: typeof r.at === "number" ? r.at : 0,
  };
}

/** Attempts already spent on `to` — zero once a different build is offered. */
export function attemptsFor(prev: ReloadAttempt | null, to: string): number {
  return prev && prev.to === to ? prev.attempts : 0;
}

export function countAttempt(
  prev: ReloadAttempt | null,
  to: string,
  now: number,
): ReloadAttempt {
  return { to, attempts: attemptsFor(prev, to) + 1, at: now };
}
