// Where a saved session is kept: `sessionStorage`, one tab's worth.
//
// Deliberately not `localStorage`. This is a half-finished form, not a
// setting: it should follow a reload and disappear when the tab does, and two
// tabs open on the installer should not be filling in each other's answers.
// Every access is wrapped — storage throws in private mode and in a sandboxed
// frame, and losing the ability to remember an answer must never be the thing
// that breaks the page.
//
// `domain/session.ts` decides what a session is and how to read one back;
// this file only moves strings.

import type { Platform } from "../domain/platform.ts";
import { parseSession, type SavedSession } from "../domain/session.ts";
import { parseAttempt, type ReloadAttempt } from "../domain/update.ts";

const SESSION_KEY = "nquake-reborn.session";
const ATTEMPT_KEY = "nquake-reborn.update";

function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Full, private mode, or no storage at all. The wizard still works; a
    // reload just starts from the top.
  }
}

export function readSavedSession(platform: Platform): SavedSession | null {
  return parseSession(readJson(SESSION_KEY), { platform });
}

export function writeSavedSession(session: SavedSession): void {
  writeJson(SESSION_KEY, session);
}

export function clearSavedSession(): void {
  try {
    store()?.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function readAttempt(): ReloadAttempt | null {
  return parseAttempt(readJson(ATTEMPT_KEY));
}

export function writeAttempt(attempt: ReloadAttempt): void {
  writeJson(ATTEMPT_KEY, attempt);
}
