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

import { APP_VERSION } from "../build-env.ts";
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
import type { Upstream } from "../domain/upstream.ts";
import {
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
 */
export type WizardMode = "simple" | "advanced";

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
  steps: (StepInfo & { id: StepId })[];
  stepIndex: number;
  step: StepId;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
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
  mode: WizardMode | null;
  names: NameRules | null;
} {
  const q = new URLSearchParams(window.location.search);
  const p = q.get("platform");
  const m = q.get("mode");
  const n = q.get("names");
  return {
    mock: q.get("mock") === "1" || q.get("mock") === "true",
    platform: p === "windows" || p === "linux" || p === "macos" ? p : null,
    theme: q.get("theme"),
    mode: m === "simple" || m === "advanced" ? m : null,
    // `?names=browser-windows` makes the simulation refuse what a browser on
    // Windows refuses — the only way to see that install without one.
    names:
      n === "browser" || n === "browser-windows" || n === "none" ? n : null,
  };
}

export const QUERY =
  typeof window !== "undefined"
    ? readQuery()
    : {
        mock: false,
        platform: null,
        theme: null,
        mode: null,
        names: null,
      };

export function useWizard(caps: Capabilities): WizardCtx {
  const initialPlatform = QUERY.platform ?? caps.platform ?? "windows";
  const [options, setOptionsState] = useState<InstallOptions>(() => {
    const o = defaultOptions(initialPlatform);
    o.server.rconPassword = randomPassword();
    o.server.qtvPassword = randomPassword();
    return o;
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

  // ---- Steps
  const [mode, setMode] = useState<WizardMode>(QUERY.mode ?? "simple");
  const steps = useMemo(() => stepsFor(options, mode), [options, mode]);
  const [stepIndex, setStepIndex] = useState(0);
  const clamped = Math.min(stepIndex, steps.length - 1);
  const step = steps[clamped]?.id ?? "welcome";
  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo({ top: 0 });
  }, [steps.length]);
  const back = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0 });
  }, []);
  const goTo = useCallback((index: number) => {
    setStepIndex(index);
    window.scrollTo({ top: 0 });
  }, []);

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
    const concurrency = mock ? 4 : 6;
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
    steps,
    stepIndex: clamped,
    step,
    next,
    back,
    goTo,
  };
}

/** A simulated folder for mock mode. */
export function mockDestination(): Destination {
  return new MockDestination(undefined, QUERY.names ?? "none");
}

/** Whether the current step's answers are complete enough to move on. */
export function canProceed(ctx: WizardCtx): boolean {
  switch (ctx.step) {
    case "welcome":
      return !ctx.catalog.loading && ctx.catalog.manifest !== null;
    case "config":
      return ctx.options.client.config.name.trim().length > 0;
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
