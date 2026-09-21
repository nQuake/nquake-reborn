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
import { renderFixupScript, type SidecarRename } from "../domain/configs.ts";
import { timestampSlug } from "../domain/format.ts";
import type { Manifest } from "../domain/manifest.ts";
import type { InstallOptions } from "../domain/options.ts";
import {
  SIDECAR_SUFFIX,
  browserBlockReason,
  resolveName,
} from "../domain/paths.ts";
import { buildPk3, type ArchiveEntry } from "../domain/pk3.ts";
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
  /** Planned files this surface cannot name at all, with the reason why. */
  blocked: { dest: string; reason: string }[];
  /**
   * Files written beside their destination under a temporary name because
   * this surface refuses the real one — a browser on Windows and every
   * `.cfg`. `fixupScript` renames them.
   */
  sidecars: SidecarRename[];
  /** The generated script that puts the sidecars in place, or null. */
  fixupScript: string | null;
  /**
   * Configs packed into an archive instead of written loose, because this
   * surface refuses to name them — ezQuake reads them out of it either way,
   * so unlike a sidecar this costs the player nothing.
   */
  archived: { dest: string; entry: string }[];
  /** The archives written, in the order they were built. */
  archives: string[];
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

  // Names this surface will not create. A browser refuses `.url` (nQuake's
  // `ezquake/Online Manual.url` shortcut) everywhere, and on Windows it
  // refuses `.cfg` and `.dll` too — which is every config nQuake ships. The
  // ones that can be parked under a `.nqinstall` name are, and the fixup
  // script written at the end moves them into place; the rest are dropped
  // here, which keeps them out of the totals and out of the failure list,
  // where the user could do nothing about them anyway.
  const rules = destination.nameRules;
  const blocked: InstallResult["blocked"] = [];
  const sidecars: SidecarRename[] = [];
  const writePath = new Map<string, string>();
  // dest -> which archive it is packed into and where inside it.
  const archiveOf = new Map<string, { archive: string; entry: string }>();
  const archiveBytes = new Map<string, Uint8Array>();
  const planItems: PlanItem[] = [];
  for (const it of plan.items) {
    const resolved = resolveName(it.dest, rules);
    if (resolved.kind === "drop") {
      blocked.push({ dest: it.dest, reason: resolved.reason });
      continue;
    }
    if (resolved.kind === "archive") {
      archiveOf.set(it.dest, {
        archive: resolved.archive,
        entry: resolved.entry,
      });
    }
    if (resolved.kind === "sidecar") {
      writePath.set(it.dest, resolved.path);
      sidecars.push({ from: resolved.path, to: it.dest });
    }
    planItems.push(it);
  }
  // The plan item keeps its real destination everywhere the user or the
  // install record can see it; only the write goes to the sidecar.
  const pathFor = (dest: string) => writePath.get(dest) ?? dest;
  let fixupScript: string | null = null;
  const archives: string[] = [];
  const bytesTotal = planItems.reduce((n, it) => n + it.size, 0);

  const items = new Map<string, ItemProgress>();
  for (const it of planItems)
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
      bytesTotal,
      filesDone,
      filesTotal: planItems.length,
      rate: meter.rate(t),
      eta: meter.eta(bytesTotal - bytesDone, t),
      active: [...active],
      items,
    });
  };

  for (const b of blocked) {
    log("warn", `${b.dest} was not installed: ${b.reason}.`);
  }

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

  // Back up a played-in config.cfg, as the Windows installer did. A surface
  // that refuses to name a `.cfg` can neither see nor rename this one, so
  // there the fixup script moves it aside just before it puts the new one in
  // place — otherwise the rename would quietly eat the user's config.
  const CLIENT_CONFIG = "ezquake/configs/config.cfg";
  let fixupBackup: { path: string; to: string } | null = null;
  if (wantsClient(options)) {
    const backup = `config-${timestampSlug(new Date(now()))}.cfg`;
    if (browserBlockReason(CLIENT_CONFIG, rules)) {
      if (sidecars.some((s) => s.to === CLIENT_CONFIG))
        fixupBackup = { path: CLIENT_CONFIG, to: backup };
    } else if (await destination.stat(CLIENT_CONFIG)) {
      await destination.rename(CLIENT_CONFIG, backup);
      log(
        "info",
        `Backed up your existing config.cfg as ezquake/configs/${backup}.`,
      );
    }
  }

  const setItem = (it: PlanItem, patch: Partial<ItemProgress>) => {
    const cur = items.get(it.dest) ?? { status: "pending", bytes: 0 };
    items.set(it.dest, { ...cur, ...patch });
  };

  /** Bytes bound for the archive are held in memory instead of written. */
  const collectInto = (dest: string): WritableStream<Uint8Array> => {
    const chunks: Uint8Array[] = [];
    return new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
      close() {
        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        const joined = new Uint8Array(total);
        let at = 0;
        for (const c of chunks) {
          joined.set(c, at);
          at += c.byteLength;
        }
        archiveBytes.set(dest, joined);
      },
    });
  };

  const writeOrCollect = async (dest: string, text: string) => {
    if (archiveOf.has(dest)) {
      archiveBytes.set(dest, new TextEncoder().encode(text));
      return;
    }
    await destination.writeText(pathFor(dest), text);
  };

  const pipeToDestination = async (
    it: PlanItem,
    stream: ReadableStream<Uint8Array>,
  ) => {
    const writable = archiveOf.has(it.dest)
      ? collectInto(it.dest)
      : await destination.openWrite(pathFor(it.dest));
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
    const existing = archiveOf.has(it.dest)
      ? null
      : await destination.stat(pathFor(it.dest));
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
          await writeOrCollect(it.dest, s.text);
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
          await writeOrCollect(it.dest, rendered);
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
  const queue = [...planItems].sort((a, b) => b.size - a.size);
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
    const okItems = planItems.filter(
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
    // Configs a browser cannot name, packed where ezQuake will still read
    // them. Grouped in plan order so the bytes are reproducible run to run.
    const packs = new Map<string, ArchiveEntry[]>();
    for (const it of planItems) {
      const where = archiveOf.get(it.dest);
      const bytes = archiveBytes.get(it.dest);
      if (!where || !bytes) continue;
      const list = packs.get(where.archive) ?? [];
      list.push({ path: where.entry, bytes });
      packs.set(where.archive, list);
    }
    let packed = 0;
    for (const [path, entries] of packs) {
      const w = await destination.openWrite(path);
      const writer = w.getWriter();
      await writer.write(buildPk3(entries));
      await writer.close();
      archives.push(path);
      packed += entries.length;
    }
    if (packed) {
      log(
        "info",
        `${packed} config(s) could not be created under their own names here, so they ` +
          `were packed into ${archives.join(", ")} — ezQuake reads them from there.`,
      );
    }

    // The one step a browser install on Windows cannot take itself.
    if (sidecars.length) {
      const script = renderFixupScript(sidecars, fixupBackup);
      await destination.writeText(script.path, script.text);
      fixupScript = script.path;
      log(
        "warn",
        `${sidecars.length} file(s) could not be created under their real names here, ` +
          `so they were written with a ${SIDECAR_SUFFIX} suffix. ` +
          `Double-click ${script.path} in the install folder to put them in place.`,
      );
    }
    await destination.writeText(
      "README-nquake.txt",
      renderInstallReadme(options, plan, installerVersion, new Date(now()), {
        executableBitsSet: destination.canSetExecutable,
        fixupScript,
        archives,
        folderName: destination.name,
      }),
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
    blocked,
    sidecars,
    fixupScript,
    archived: [...archiveOf].map(([dest, w]) => ({ dest, entry: w.entry })),
    archives,
    skipped,
    written,
    bytes: bytesDone,
    durationMs: now() - started,
    cancelled,
  };
}
