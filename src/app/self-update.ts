// The app keeping itself current.
//
// A poll of `version.json` (cheap, same origin, cached by nothing — see
// `net/version.ts`) on load, every so often while the tab is being looked at,
// and whenever someone comes back to it. When the deployed build turns out to
// be a different one, `domain/update.ts` decides what may happen: take it
// now, offer it, or hold off. Taking it is `save()` and then
// `location.reload()` — the answers are in session storage before the page
// stops existing, and `useWizard` reads them back on the way up.

import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { BUILD_LABEL } from "../build-env.ts";
import {
  attemptsFor,
  countAttempt,
  isNewBuild,
  updateAction,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CHECK_MIN_GAP_MS,
  type InstallStatus,
  type UpdateAction,
} from "../domain/update.ts";
import { loadVersionInfo } from "../net/version.ts";
import { readAttempt, writeAttempt } from "./session-store.ts";

export interface SelfUpdateOptions {
  /** Off in the desktop shell, which carries its own bundle, and on `?update=off`. */
  enabled: boolean;
  installStatus: InstallStatus;
  /** Whether reloading would throw away something the user cannot get back. */
  losesInput: boolean;
  /** Write the wizard's answers down. Called immediately before the reload. */
  save: (target: string) => void;
}

export interface SelfUpdate {
  /** The deployed build label, once it is known to differ from this one. */
  latest: string | null;
  action: UpdateAction;
  /** Save the answers and load the new build. */
  apply: () => void;
  /** Stop offering this one. */
  dismiss: () => void;
}

export function useSelfUpdate(opts: SelfUpdateOptions): SelfUpdate {
  const [latest, setLatest] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const lastCheckRef = useRef(0);
  const checkingRef = useRef(false);
  // The poll outlives any one render, so what it needs is read through a ref
  // rather than captured.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    const now = Date.now();
    if (now - lastCheckRef.current < UPDATE_CHECK_MIN_GAP_MS) return;
    checkingRef.current = true;
    lastCheckRef.current = now;
    try {
      const info = await loadVersionInfo();
      setLatest(
        info && isNewBuild(BUILD_LABEL, info.version) ? info.version : null,
      );
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!opts.enabled) return;
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, UPDATE_CHECK_INTERVAL_MS);
    // Coming back to a tab that has been sitting open is the moment a stale
    // build is most likely, and the cheapest moment to replace it.
    const onWake = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [opts.enabled, check]);

  const apply = useCallback(() => {
    const to = latest;
    if (!to) return;
    // Remember the attempt before leaving: if the CDN is still serving the
    // old bundle, the page that comes back sees how many tries this build has
    // already had and stops reloading at itself.
    writeAttempt(countAttempt(readAttempt(), to, Date.now()));
    optsRef.current.save(to);
    window.location.reload();
  }, [latest]);

  const attempts = latest ? attemptsFor(readAttempt(), latest) : 0;
  const action: UpdateAction =
    !opts.enabled || !latest || dismissed === latest
      ? "hold"
      : updateAction({
          installStatus: opts.installStatus,
          losesInput: opts.losesInput,
          attempts,
        });

  useEffect(() => {
    if (action === "reload") apply();
  }, [action, apply]);

  const dismiss = useCallback(() => setDismissed(latest), [latest]);

  return { latest, action, apply, dismiss };
}
