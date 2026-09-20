// Runs an `InstallPlan` against a `Destination` through a `Transport`: a
// worker pool downloads and writes files, generated texts are rendered,
// progress is reported, failures are collected rather than fatal (the
// original installer's "Ignore" button, made the default), and the install
// record + readme are written at the end.

import {
  INSTALL_STATE_FILE,
  canReuse,
  createInstallState,
  parseInstallState,
  type InstallState,
} from "../domain/install-state.ts";
import { timestampSlug } from "../domain/format.ts";
import type { Manifest } from "../domain/manifest.ts";
import type { InstallOptions } from "../domain/options.ts";
import {
  renderTemplate,
  type InstallPlan,
  type PlanItem,
} from "../domain/plan.ts";
import { RateMeter } from "../domain/progress.ts";
import { renderInstallReadme } from "../domain/readme.ts";
import { wantsClient } from "../domain/options.ts";
import type { Destination } from "../platform/destination.ts";
import { itemUrl } from "./sources.ts";
import type { Transport } from "./transport.ts";

export type ItemStatus = "pending" | "active" | "done" | "skipped" | "failed";

export interface ItemProgress {
  status: ItemStatus;
  bytes: number;
  error?: string;
}

export interface InstallProgress {
  bytesDone: number;
  bytesTotal: number;
  filesDone: number;
  filesTotal: number;
  /** Bytes per second, smoothed. */
  rate: number;
  /** Seconds remaining, null until measurable. */
  eta: number | null;
  active: string[];
  items: ReadonlyMap<string, ItemProgress>;
}

export interface InstallLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  at: number;
}

export interface InstallResult {
  ok: boolean;
  failed: { item: PlanItem; error: string }[];
  skipped: number;
  written: number;
  bytes: number;
  durationMs: number;
  cancelled: boolean;
}

export interface RunInstallArgs {
  plan: InstallPlan;
  options: InstallOptions;
  manifest: Manifest;
  destination: Destination;
  transport: Transport;
  /** The user's pak1.pak, when `options.pak1` is set. */
  pak1?: Blob | null;
  installerVersion: string;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (p: InstallProgress) => void;
  onLog?: (entry: InstallLogEntry) => void;
  now?: () => number;
}

export async function runInstall(args: RunInstallArgs): Promise<InstallResult> {
  const {
    plan,
    options,
    manifest,
    destination,
    transport,
    signal,
    installerVersion,
  } = args;
  const now = args.now ?? (() => Date.now());
  const concurrency = args.concurrency ?? 6;
  const started = now();
  const meter = new RateMeter();
  const items = new Map<string, ItemProgress>();
  for (const it of plan.items)
    items.set(it.dest, { status: "pending", bytes: 0 });
  const failed: InstallResult["failed"] = [];
  let skipped = 0;
  let written = 0;
  let bytesDone = 0;
  let filesDone = 0;
  const active = new Set<string>();
  let lastEmit = 0;

  const log = (level: InstallLogEntry["level"], message: string) =>
    args.onLog?.({ level, message, at: now() });

  const emit = (force = false) => {
    const t = now();
    if (!force && t - lastEmit < 100) return;
    lastEmit = t;
    args.onProgress?.({
      bytesDone,
      bytesTotal: plan.totalBytes,
      filesDone,
      filesTotal: plan.items.length,
      rate: meter.rate(t),
      eta: meter.eta(plan.totalBytes - bytesDone, t),
      active: [...active],
      items,
    });
  };

  // Previous install record, for the "unchanged file" skip.
  let previous: InstallState | null = null;
  const prevText = await destination.readText(INSTALL_STATE_FILE);
  if (prevText) {
    try {
      previous = parseInstallState(JSON.parse(prevText));
      if (previous)
        log(
          "info",
          `Found a previous install from ${previous.installedAt}; unchanged files will be kept.`,
        );
    } catch {
      previous = null;
    }
  }

  // Back up a played-in config.cfg, as the Windows installer did.
  if (
    wantsClient(options) &&
    (await destination.stat("ezquake/configs/config.cfg"))
  ) {
    const backup = `config-${timestampSlug(new Date(now()))}.cfg`;
    await destination.rename("ezquake/configs/config.cfg", backup);
    log(
      "info",
      `Backed up your existing config.cfg as ezquake/configs/${backup}.`,
    );
  }

  const setItem = (it: PlanItem, patch: Partial<ItemProgress>) => {
    const cur = items.get(it.dest) ?? { status: "pending", bytes: 0 };
    items.set(it.dest, { ...cur, ...patch });
  };

  const pipeToDestination = async (
    it: PlanItem,
    stream: ReadableStream<Uint8Array>,
  ) => {
    const writable = await destination.openWrite(it.dest);
    let itemBytes = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        itemBytes += chunk.byteLength;
        bytesDone += chunk.byteLength;
        meter.add(chunk.byteLength, now());
        setItem(it, { bytes: itemBytes });
        controller.enqueue(chunk);
        emit();
      },
    });
    await stream.pipeThrough(counter).pipeTo(writable, { signal });
    return itemBytes;
  };

  const installOne = async (it: PlanItem) => {
    if (signal?.aborted) return;
    const existing = await destination.stat(it.dest);
    if (canReuse(it, existing?.size ?? null, previous)) {
      skipped++;
      filesDone++;
      bytesDone += it.size;
      setItem(it, { status: "skipped", bytes: it.size });
      emit();
      return;
    }
    active.add(it.dest);
    setItem(it, { status: "active" });
    emit(true);
    try {
      const s = it.source;
      switch (s.kind) {
        case "generated":
          await destination.writeText(it.dest, s.text);
          bytesDone += it.size;
          break;
        case "template": {
          const url = itemUrl(it, manifest)!;
          const text = await transport.text(url, signal);
          const rendered = renderTemplate(
            text,
            s.transform,
            options,
            plan.servers,
          );
          await destination.writeText(it.dest, rendered);
          bytesDone += it.size;
          break;
        }
        case "user": {
          if (!args.pak1) throw new Error("pak1.pak was not provided");
          const got = await pipeToDestination(
            it,
            args.pak1.stream() as ReadableStream<Uint8Array>,
          );
          bytesDone += Math.max(0, it.size - got);
          break;
        }
        case "distfiles":
        case "upstream": {
          const url = itemUrl(it, manifest)!;
          const stream = await transport.open(url, s.file.size, signal);
          const got = await pipeToDestination(it, stream);
          if (got !== s.file.size) {
            throw new Error(`Expected ${s.file.size} bytes, received ${got}`);
          }
          break;
        }
      }
      written++;
      filesDone++;
      setItem(it, { status: "done", bytes: it.size });
    } catch (e) {
      if (signal?.aborted) {
        setItem(it, { status: "pending", bytes: 0 });
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      failed.push({ item: it, error: message });
      filesDone++;
      setItem(it, { status: "failed", error: message });
      log("error", `${it.dest}: ${message}`);
    } finally {
      active.delete(it.dest);
      emit(true);
    }
  };

  // Worker pool. Big files first so the tail of the install isn't one
  // 100 MB texture pack downloading alone.
  const queue = [...plan.items].sort((a, b) => b.size - a.size);
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (index < queue.length && !signal?.aborted) {
        const it = queue[index++]!;
        await installOne(it);
      }
    },
  );
  await Promise.all(workers);

  const cancelled = signal?.aborted ?? false;
  if (!cancelled) {
    const okItems = plan.items.filter(
      (i) => items.get(i.dest)?.status !== "failed",
    );
    const state = createInstallState(
      options,
      okItems,
      installerVersion,
      new Date(now()),
    );
    // Never persist the passwords into a plain-text record next to the
    // configs that already hold them.
    state.options = {
      ...state.options,
      server: { ...state.options.server, rconPassword: "", qtvPassword: "" },
    };
    await destination.writeText(
      INSTALL_STATE_FILE,
      JSON.stringify(state, null, 2) + "\n",
    );
    await destination.writeText(
      "README-nquake.txt",
      renderInstallReadme(options, plan, installerVersion, new Date(now())),
    );
    const executables = okItems.filter((i) => i.executable).map((i) => i.dest);
    if (executables.length && destination.canSetExecutable) {
      try {
        await destination.setExecutable(executables);
        log("info", `Marked ${executables.length} file(s) executable.`);
      } catch (e) {
        log(
          "warn",
          `Could not set executable bits: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  emit(true);
  return {
    ok: !cancelled && failed.length === 0,
    failed,
    skipped,
    written,
    bytes: bytesDone,
    durationMs: now() - started,
    cancelled,
  };
}
