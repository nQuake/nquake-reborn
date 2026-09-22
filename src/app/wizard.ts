// The wizard's state and flow: which steps exist for the current answers,
// the loaded catalog (manifest + upstream mirror), the computed plan, the
// chosen folder, and the running install. `App.tsx` owns one of these and
// hands it to every step as `ctx`.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { APP_VERSION, BUILD_LABEL } from "../build-env.ts";
import type { Manifest } from "../domain/manifest.ts";
import {
  defaultOptions,
  passwordFromBytes,
  wantsClient,
  wantsServer,
  type InstallOptions,
} from "../domain/options.ts";
import type { Platform } from "../domain/platform.ts";
import { buildPlan, type InstallPlan } from "../domain/plan.ts";
import {
  captureSession,
  folderIsRestorable,
  type SaveReason,
  type SavedFolder,
  type SavedSession,
  type WizardMode,
} from "../domain/session.ts";
import type { Upstream } from "../domain/upstream.ts";
import {
  DEFAULT_CONCURRENCY,
  runInstall,
  type InstallLogEntry,
  type InstallProgress,
  type InstallResult,
} from "../net/installer.ts";
import { loadManifest, loadUpstream } from "../net/sources.ts";
import { createHttpTransport } from "../net/transport.ts";
import type { Capabilities } from "../platform/capabilities.ts";
import {
  summarizeFolder,
  type Destination,
  type FolderSummary,
} from "../platform/destination.ts";
import type { NameRules } from "../domain/paths.ts";
import { MockDestination, createMockTransport } from "../platform/mock.ts";
import type { StepInfo } from "../ui/Stepper.tsx";
import {
  clearSavedSession,
  readSavedSession,
  writeSavedSession,
} from "./session-store.ts";

export type StepId =
  | "welcome"
  | "target"
  | "client"
  | "config"
  | "server"
  | "folder"
  | "review"
  | "install"
  | "done";

const STEP_LABELS: Record<StepId, string> = {
  welcome: "Welcome",
  target: "What to install",
  client: "Client",
  config: "Your setup",
  server: "Server",
  folder: "Folder",
  review: "Review",
  install: "Install",
  done: "Done",
};

/**
 * Simple mode is Next, Next, Next on the defaults in `defaultOptions`
 * (QuakeWorld's standard ports, the newest ezQuake, the 24-bit textures,
 * WASD). Advanced mode adds the steps that let you change any of it.
 *
 * The type itself lives in `domain/session.ts`, with the rest of what a
 * reload has to carry.
 */
export type { WizardMode };

export function stepsFor(
  options: InstallOptions,
  mode: WizardMode,
): (StepInfo & { id: StepId })[] {
  const ids: StepId[] = ["welcome", "target"];
  if (mode === "advanced") {
    if (wantsClient(options)) ids.push("client", "config");
    if (wantsServer(options)) ids.push("server");
  }
  ids.push("folder", "review", "install", "done");
  return ids.map((id) => ({ id, label: STEP_LABELS[id] }));
}

export interface CatalogState {
  manifest: Manifest | null;
  upstream: Upstream | null;
  loading: boolean;
  error: string | null;
}

export interface InstallRunState {
  status: "idle" | "running" | "done" | "failed" | "cancelled";
  progress: InstallProgress | null;
  log: InstallLogEntry[];
  result: InstallResult | null;
}

export interface FolderChoice {
  /** The folder the user picked. */
  picked: Destination;
  summary: FolderSummary;
  /** Install into a fresh `nQuake` subfolder instead of straight into `picked`. */
  useSubfolder: boolean;
}

export interface WizardCtx {
  caps: Capabilities;
  mode: WizardMode;
  setMode: (mode: WizardMode) => void;
  options: InstallOptions;
  setOptions: (update: (o: InstallOptions) => InstallOptions) => void;
  catalog: CatalogState;
  reloadCatalog: () => void;
  plan: InstallPlan | null;
  folder: FolderChoice | null;
  chooseFolder: (dest: Destination | null) => Promise<void>;
  setUseSubfolder: (v: boolean) => void;
  pak1: File | null;
  setPak1: (f: File | null) => void;
  run: InstallRunState;
  startInstall: () => void;
  cancelInstall: () => void;
  reset: () => void;
  /**
   * The session this page load picked up where a previous one left off, if
   * any — the app reloads itself when a newer build is deployed, and this is
   * what came back across that reload.
   */
  restored: SavedSession | null;
  /** Write the answers down now. The last thing that happens before a reload. */
  saveNow: (reason: SaveReason, target?: string | null) => void;
  steps: (StepInfo & { id: StepId })[];
  stepIndex: number;
  step: StepId;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  /**
   * Next was pressed while this step was still missing an answer the user
   * can give here. The step that owns the answer turns it red and puts the
   * cursor in it — a dead button says nothing, least of all on a phone,
   * where the field it is waiting for may be off screen. Cleared on every
   * move between steps.
   */
  flagged: boolean;
  /** What Next calls instead of moving on. */
  flagMissing: () => void;
}

export function randomPassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return passwordFromBytes(bytes, 12);
}

function readQuery(): {
  mock: boolean;
  platform: Platform | null;
  theme: string | null;
  text: string | null;
  mode: WizardMode | null;
  names: NameRules | null;
  fresh: boolean;
  update: boolean;
} {
  const q = new URLSearchParams(window.location.search);
  const p = q.get("platform");
  const m = q.get("mode");
  const n = q.get("names");
  return {
    mock: q.get("mock") === "1" || q.get("mock") === "true",
    platform: p === "windows" || p === "linux" || p === "macos" ? p : null,
    theme: q.get("theme"),
    // `?text=large` picks a text size for this page load, for screenshots.
    text: q.get("text"),
    mode: m === "simple" || m === "advanced" ? m : null,
    // `?names=browser-windows` makes the simulation refuse what a browser on
    // Windows refuses — the only way to see that install without one.
    names:
      n === "browser" || n === "browser-windows" || n === "none" ? n : null,
    // `?fresh=1` ignores a saved session; `?update=off` stops the app
    // reloading itself. Both exist for debugging the two things that are
    // otherwise hard to observe from the outside.
    fresh: q.get("fresh") === "1",
    update: q.get("update") !== "off",
  };
}

export const QUERY =
  typeof window !== "undefined"
    ? readQuery()
    : {
        mock: false,
        platform: null,
        theme: null,
        text: null,
        mode: null,
        names: null,
        fresh: false,
        update: true,
      };

/**
 * Where a restored session picks back up. The step is looked up by id rather
 * than by number, because the build that saved it may have had a different
 * list of steps; and two steps are never restored into:
 *
 * - `install` and `done` describe a run that this page load is not doing, so
 *   they fall back to review, with every answer still filled in;
 * - anything past `folder` when the folder itself could not be reopened —
 *   a browser's folder handle dies with the page, so the one thing the user
 *   has to do again is the one thing the wizard puts them back in front of.
 */
export function restoredStepIndex(
  steps: { id: StepId }[],
  savedStep: string,
  opts: { folderRestorable: boolean },
): number {
  const saved = steps.findIndex((s) => s.id === savedStep);
  if (saved < 0) return 0;
  const install = steps.findIndex((s) => s.id === "install");
  let index = install > 0 ? Math.min(saved, install - 1) : saved;
  if (!opts.folderRestorable) {
    const folder = steps.findIndex((s) => s.id === "folder");
    if (folder >= 0) index = Math.min(index, folder);
  }
  return index;
}

/**
 * Whether a saved folder comes back on *this* surface. `folderIsRestorable`
 * answers it for the folder alone; this adds the page load's own side of it,
 * since a simulated folder saved under `?mock=1` means nothing to a tab that
 * can write for real, and a path means nothing outside the desktop app.
 */
function folderComesBack(
  saved: SavedFolder | null,
  caps: Capabilities,
): boolean {
  if (!saved) return true;
  if (!folderIsRestorable(saved)) return false;
  if (saved.kind === "mock") return !caps.realInstall;
  return caps.surface === "tauri";
}

/** Reopen a folder a previous page load had picked, where that is possible. */
async function reopenFolder(
  saved: SavedFolder,
  caps: Capabilities,
): Promise<Destination | null> {
  if (saved.kind === "mock") {
    // Only if this page load is still simulating; `?mock=1` may be gone.
    return caps.realInstall ? null : mockDestination();
  }
  if (saved.kind === "tauri" && saved.path && caps.surface === "tauri") {
    const { TauriDestination } = await import("../platform/tauri.ts");
    return new TauriDestination(saved.path);
  }
  // A File System Access handle exists only for the life of the page that was
  // granted it, so there is nothing here to reopen.
  return null;
}

export function useWizard(caps: Capabilities): WizardCtx {
  const initialPlatform = QUERY.platform ?? caps.platform ?? "windows";
  // Read once, at mount, before the autosave below writes over it. State
  // rather than a memo so "start over" can forget it was ever restored.
  const [restored, setRestored] = useState<SavedSession | null>(() =>
    QUERY.fresh ? null : readSavedSession(initialPlatform),
  );
  const [options, setOptionsState] = useState<InstallOptions>(() => {
    const base = restored?.options ?? defaultOptions(initialPlatform);
    return {
      ...base,
      server: {
        ...base.server,
        // Kept across a reload when there is one: the advanced server step
        // shows the rcon and QTV passwords, and somebody may already have
        // written them down. Generated only when there is nothing to keep.
        rconPassword: base.server.rconPassword || randomPassword(),
        qtvPassword: base.server.qtvPassword || randomPassword(),
      },
    };
  });
  const setOptions = useCallback(
    (update: (o: InstallOptions) => InstallOptions) =>
      setOptionsState((o) => update(o)),
    [],
  );

  // ---- Catalog
  const [catalog, setCatalog] = useState<CatalogState>({
    manifest: null,
    upstream: null,
    loading: true,
    error: null,
  });
  const [catalogNonce, setCatalogNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCatalog((c) => ({ ...c, loading: true, error: null }));
    Promise.all([loadManifest(), loadUpstream()])
      .then(([manifest, upstream]) => {
        if (!cancelled)
          setCatalog({ manifest, upstream, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setCatalog({
            manifest: null,
            upstream: null,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalogNonce]);
  const reloadCatalog = useCallback(() => setCatalogNonce((n) => n + 1), []);

  const plan = useMemo(
    () =>
      catalog.manifest
        ? buildPlan(catalog.manifest, catalog.upstream, options)
        : null,
    [catalog.manifest, catalog.upstream, options],
  );

  // ---- Folder + pak1
  const [folder, setFolder] = useState<FolderChoice | null>(null);
  const chooseFolder = useCallback(async (dest: Destination | null) => {
    if (!dest) {
      setFolder(null);
      return;
    }
    const summary = await summarizeFolder(dest);
    setFolder({
      picked: dest,
      summary,
      // A folder that already holds something unrelated gets its own
      // nQuake subfolder by default; an empty one or an existing install
      // is used as-is.
      useSubfolder: !summary.empty && !summary.existingInstall,
    });
  }, []);
  const setUseSubfolder = useCallback(
    (v: boolean) => setFolder((f) => (f ? { ...f, useSubfolder: v } : f)),
    [],
  );
  const [pak1, setPak1State] = useState<File | null>(null);
  const setPak1 = useCallback((f: File | null) => {
    setPak1State(f);
    setOptionsState((o) => ({ ...o, pak1: f !== null }));
  }, []);

  // A folder the previous page load had chosen, where the surface knows it
  // well enough to open it again (see `reopenFolder`). Once, on mount.
  const restoredFolder = restored?.folder ?? null;
  useEffect(() => {
    if (!restoredFolder || !folderComesBack(restoredFolder, caps)) return;
    let cancelled = false;
    void (async () => {
      try {
        const dest = await reopenFolder(restoredFolder, caps);
        if (!dest || cancelled) return;
        await chooseFolder(dest);
        if (!cancelled) setUseSubfolder(restoredFolder.useSubfolder);
      } catch {
        // The folder moved, or the app cannot read it any more; the folder
        // step will ask for it again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoredFolder, caps, chooseFolder, setUseSubfolder]);

  // ---- Steps
  const [mode, setMode] = useState<WizardMode>(
    QUERY.mode ?? restored?.mode ?? "simple",
  );
  const steps = useMemo(() => stepsFor(options, mode), [options, mode]);
  const [stepIndex, setStepIndex] = useState(() =>
    restored
      ? restoredStepIndex(steps, restored.step, {
          folderRestorable: folderComesBack(restored.folder, caps),
        })
      : 0,
  );
  const clamped = Math.min(stepIndex, steps.length - 1);
  const step = steps[clamped]?.id ?? "welcome";
  // Whether Next has been pressed on a step that is not ready yet; the step
  // shows the user what it is waiting for. A move of any kind clears it.
  const [flagged, setFlagged] = useState(false);
  const next = useCallback(() => {
    setFlagged(false);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo({ top: 0 });
  }, [steps.length]);
  const back = useCallback(() => {
    setFlagged(false);
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0 });
  }, []);
  const goTo = useCallback((index: number) => {
    setFlagged(false);
    setStepIndex(index);
    window.scrollTo({ top: 0 });
  }, []);
  const flagMissing = useCallback(() => setFlagged(true), []);

  // ---- Saving the answers
  //
  // Written on every change rather than only on the way into an update: a
  // reload we did not start (a refresh, a crashed tab, a laptop lid) costs
  // the user the same typing, and `sessionStorage` is a few hundred bytes
  // and a synchronous write.
  const saveNow = useCallback(
    (reason: SaveReason, target?: string | null) => {
      writeSavedSession(
        captureSession({
          build: BUILD_LABEL,
          reason,
          target: target ?? null,
          mode,
          // A run is not a saved answer. Coming back to the review step with
          // everything filled in is what a restored install looks like.
          step: step === "install" || step === "done" ? "review" : step,
          options,
          folder: folder
            ? {
                kind: folder.picked.kind,
                path: folder.picked.path ?? null,
                name: folder.picked.name,
                useSubfolder: folder.useSubfolder,
              }
            : null,
          pak1Name: pak1?.name ?? null,
        }),
      );
    },
    [mode, step, options, folder, pak1],
  );
  useEffect(() => saveNow("autosave"), [saveNow]);

  // ---- Install run
  const [run, setRun] = useState<InstallRunState>({
    status: "idle",
    progress: null,
    log: [],
    result: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const startInstall = useCallback(() => {
    if (!plan || !catalog.manifest || !folder || run.status === "running")
      return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRun({ status: "running", progress: null, log: [], result: null });
    const manifest = catalog.manifest;
    const mock = folder.picked.kind === "mock";
    // The simulation keeps its own small pool: its "downloads" are a timer,
    // so more of them only makes the pretend install finish sooner than the
    // real one ever could.
    const concurrency = mock ? 4 : DEFAULT_CONCURRENCY;
    const transport = mock
      ? createMockTransport({ totalBytes: plan.totalBytes, concurrency })
      : createHttpTransport();
    (async () => {
      let destination = folder.picked;
      if (folder.useSubfolder && "subfolder" in destination) {
        destination = await (
          destination as Destination & {
            subfolder: (n: string) => Promise<Destination>;
          }
        ).subfolder("nQuake");
      }
      return runInstall({
        plan,
        options,
        manifest,
        destination,
        transport,
        pak1,
        installerVersion: APP_VERSION,
        concurrency,
        signal: ctrl.signal,
        onProgress: (progress) => setRun((r) => ({ ...r, progress })),
        onLog: (entry) => setRun((r) => ({ ...r, log: [...r.log, entry] })),
      });
    })()
      .then((result) => {
        setRun((r) => ({
          ...r,
          result,
          status: result.cancelled
            ? "cancelled"
            : result.ok
              ? "done"
              : "failed",
        }));
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setRun((r) => ({
          ...r,
          status: "failed",
          log: [...r.log, { level: "error", message, at: Date.now() }],
          result: {
            ok: false,
            failed: [],
            blocked: [],
            sidecars: [],
            fixupScript: null,
            archived: [],
            archives: [],
            skipped: 0,
            written: 0,
            bytes: 0,
            durationMs: 0,
            cancelled: false,
          },
        }));
      });
  }, [plan, catalog.manifest, folder, options, pak1, run.status]);

  const cancelInstall = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    // Starting over means starting over: the autosave effect writes the fresh
    // state back a tick later, so nothing stale survives.
    clearSavedSession();
    setRestored(null);
    setRun({ status: "idle", progress: null, log: [], result: null });
    setFolder(null);
    setPak1State(null);
    setOptionsState((o) => ({
      ...defaultOptions(o.platform),
      server: {
        ...defaultOptions(o.platform).server,
        rconPassword: randomPassword(),
        qtvPassword: randomPassword(),
      },
    }));
    setStepIndex(0);
    setFlagged(false);
    window.scrollTo({ top: 0 });
  }, []);

  return {
    caps,
    mode,
    setMode,
    options,
    setOptions,
    catalog,
    reloadCatalog,
    plan,
    folder,
    chooseFolder,
    setUseSubfolder,
    pak1,
    setPak1,
    run,
    startInstall,
    cancelInstall,
    reset,
    restored,
    saveNow,
    steps,
    stepIndex: clamped,
    step,
    next,
    back,
    goTo,
    flagged,
    flagMissing,
  };
}

/** A simulated folder for mock mode. */
export function mockDestination(): Destination {
  return new MockDestination(undefined, QUERY.names ?? "none");
}

/** The nickname is obligatory for any install that includes the client. */
export function hasNickname(o: InstallOptions): boolean {
  return o.client.config.name.trim().length > 0;
}

/**
 * Whether what the current step is missing is something the user can see and
 * fix on it — today only the player name. Next stays live for these so that
 * pressing it points at the field (`WizardCtx.flagMissing`) instead of doing
 * nothing; everything else (a folder nobody has picked, a catalog still
 * loading) keeps the button disabled, because there is nothing on the step
 * to point at.
 */
export function missingHere(ctx: WizardCtx): boolean {
  if (canProceed(ctx)) return false;
  return (
    (ctx.step === "target" || ctx.step === "config") &&
    !hasNickname(ctx.options)
  );
}

/** Whether the current step's answers are complete enough to move on. */
export function canProceed(ctx: WizardCtx): boolean {
  switch (ctx.step) {
    case "welcome":
      return !ctx.catalog.loading && ctx.catalog.manifest !== null;
    case "target":
      // Simple mode has no config step, so the nickname it asks for here is
      // the only chance to get one — and the installer insists on one.
      return (
        ctx.mode !== "simple" ||
        !wantsClient(ctx.options) ||
        hasNickname(ctx.options)
      );
    case "config":
      return hasNickname(ctx.options);
    case "server": {
      const s = ctx.options.server;
      return (
        s.hostname.trim().length > 0 &&
        s.ports >= 1 &&
        s.ports <= 64 &&
        s.basePort > 1024
      );
    }
    case "folder":
      return ctx.folder !== null;
    case "review":
      return ctx.plan !== null && ctx.folder !== null;
    default:
      return true;
  }
}
