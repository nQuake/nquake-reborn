// What survives a reload.
//
// The installer is a static deploy that updates itself by reloading the page
// (see `update.ts`), and a wizard is nothing but the answers you have typed
// into it, so everything the user has entered is written down before that
// reload and read back on the way up. Only that reload: any other one is a
// fresh start (`sessionToResume`).
//
// This is the pure half: the shape of a saved session and how to read one
// back. Reading is the interesting direction — the state was written by a
// *different build* of the app, quite possibly an older one, so nothing in it
// is trusted. Every field is checked and merged over `defaultOptions`, which
// is what lets a build that adds an option pick up a session written before
// that option existed.

import {
  clampPorts,
  defaultOptions,
  type InstallOptions,
  type InstallTarget,
  type KeyLayout,
  type MovementKeys,
} from "./options.ts";
import type { Platform } from "./platform.ts";

/** Bumped when a saved session can no longer be read; older ones are dropped. */
export const SESSION_SCHEMA = 1;

/** A session older than this is ignored — a tab left open over a weekend. */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Longest string accepted out of storage, so a tampered blob stays small. */
const MAX_STRING = 256;

/**
 * Simple mode is Next, Next, Next on the defaults; Advanced unfolds the
 * client, setup and server steps. It lives here because it is part of what a
 * reload has to carry; `app/wizard.ts` re-exports it.
 */
export type WizardMode = "simple" | "advanced";

/** Why the session was written: routinely, or on the way into an update. */
export type SaveReason = "autosave" | "update";

export interface SavedFolder {
  kind: "fs-access" | "tauri" | "mock";
  /**
   * The full path, where the surface knows it. This is the whole difference
   * between a folder that comes back after a reload and one that does not:
   * the desktop app hands us a path we can re-open, while a browser hands us
   * a handle that only lives as long as the page does.
   */
  path: string | null;
  name: string;
  useSubfolder: boolean;
}

export interface SavedSession {
  schema: number;
  /** The build that wrote it. */
  build: string;
  savedAt: number;
  reason: SaveReason;
  /** The build a reload is reaching for, when `reason` is `"update"`. */
  target: string | null;
  mode: WizardMode;
  /** The wizard step's id. The app resolves it against its own step list. */
  step: string;
  options: InstallOptions;
  folder: SavedFolder | null;
  /**
   * A chosen `pak1.pak` is a `File` handed to the page by a file dialog and
   * cannot be written down; only its name is, so the folder step can say what
   * to pick again.
   */
  pak1Name: string | null;
}

export interface SessionInput {
  build: string;
  reason: SaveReason;
  target?: string | null;
  mode: WizardMode;
  step: string;
  options: InstallOptions;
  folder?: SavedFolder | null;
  pak1Name?: string | null;
  now?: number;
}

export function captureSession(input: SessionInput): SavedSession {
  return {
    schema: SESSION_SCHEMA,
    build: input.build,
    savedAt: input.now ?? Date.now(),
    reason: input.reason,
    target: input.target ?? null,
    mode: input.mode,
    step: input.step,
    options: input.options,
    folder: input.folder ?? null,
    pak1Name: input.pak1Name ?? null,
  };
}

// ---- Reading one back

function isRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v.slice(0, MAX_STRING) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function port(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const n = Math.round(v);
  return n >= 1 && n <= 65535 ? n : fallback;
}

function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

const TARGETS: readonly InstallTarget[] = ["client", "server", "both"];
const LAYOUTS: readonly KeyLayout[] = ["wasd", "esdf", "arrows", "custom"];
const PLATFORMS: readonly Platform[] = ["windows", "linux", "macos"];
const SOURCES = ["latest", "bundled"] as const;

function keys(v: unknown, fallback: MovementKeys): MovementKeys {
  const k = isRecord(v);
  return {
    forward: str(k.forward, fallback.forward),
    back: str(k.back, fallback.back),
    left: str(k.left, fallback.left),
    right: str(k.right, fallback.right),
    jump: str(k.jump, fallback.jump),
  };
}

/**
 * Merge a stored blob over the current defaults. Anything missing, of the
 * wrong type or out of range falls back to the default rather than failing
 * the restore: a session is a convenience, and half the answers back is
 * better than none.
 */
export function sanitizeOptions(
  raw: unknown,
  platform: Platform,
): InstallOptions {
  const o = isRecord(raw);
  const d = defaultOptions(oneOf(o.platform, PLATFORMS, platform));
  const c = isRecord(o.client);
  const cfg = isRecord(c.config);
  const s = isRecord(o.server);
  return {
    target: oneOf(o.target, TARGETS, d.target),
    platform: d.platform,
    pak1: false, // the file itself cannot survive a reload; see SavedSession.
    client: {
      ezquakeSource: oneOf(c.ezquakeSource, SOURCES, d.client.ezquakeSource),
      textures: bool(c.textures, d.client.textures),
      hdTextures: bool(c.hdTextures, d.client.hdTextures),
      teamFortress: bool(c.teamFortress, d.client.teamFortress),
      clanArena: bool(c.clanArena, d.client.clanArena),
      config: {
        name: str(cfg.name, d.client.config.name),
        invertMouse: bool(cfg.invertMouse, d.client.config.invertMouse),
        layout: oneOf(cfg.layout, LAYOUTS, d.client.config.layout),
        keys: keys(cfg.keys, d.client.config.keys),
      },
    },
    server: {
      hostname: str(s.hostname, d.server.hostname),
      adminName: str(s.adminName, d.server.adminName),
      adminEmail: str(s.adminEmail, d.server.adminEmail),
      listenAddress: str(s.listenAddress, d.server.listenAddress),
      ports: clampPorts(typeof s.ports === "number" ? s.ports : d.server.ports),
      basePort: port(s.basePort, d.server.basePort),
      rconPassword: str(s.rconPassword, d.server.rconPassword),
      qtv: bool(s.qtv, d.server.qtv),
      qtvPort: port(s.qtvPort, d.server.qtvPort),
      qtvPassword: str(s.qtvPassword, d.server.qtvPassword),
      qwfwd: bool(s.qwfwd, d.server.qwfwd),
      qwfwdPort: port(s.qwfwdPort, d.server.qwfwdPort),
      binariesSource: oneOf(s.binariesSource, SOURCES, d.server.binariesSource),
      fullMaps: bool(s.fullMaps, d.server.fullMaps),
      ffa: bool(s.ffa, d.server.ffa),
      clanArena: bool(s.clanArena, d.server.clanArena),
      teamFortress: bool(s.teamFortress, d.server.teamFortress),
    },
  };
}

function sanitizeFolder(raw: unknown): SavedFolder | null {
  if (raw === null || raw === undefined) return null;
  const f = isRecord(raw);
  const kind = oneOf(f.kind, ["fs-access", "tauri", "mock"] as const, "mock");
  if (typeof f.name !== "string") return null;
  return {
    kind,
    path: typeof f.path === "string" ? f.path.slice(0, 4096) : null,
    name: str(f.name, ""),
    useSubfolder: bool(f.useSubfolder, false),
  };
}

export interface ParseSessionOptions {
  /** The platform to fall back to — what this surface detected. */
  platform: Platform;
  now?: number;
  maxAgeMs?: number;
}

/**
 * Read a stored session, or null when there is nothing usable: a different
 * schema, a blob that is not a session at all, or one old enough that the
 * user has long since moved on.
 */
export function parseSession(
  raw: unknown,
  opts: ParseSessionOptions,
): SavedSession | null {
  const r = isRecord(raw);
  if (r.schema !== SESSION_SCHEMA) return null;
  const savedAt = typeof r.savedAt === "number" ? r.savedAt : 0;
  const now = opts.now ?? Date.now();
  const maxAge = opts.maxAgeMs ?? SESSION_MAX_AGE_MS;
  if (!savedAt || now - savedAt > maxAge) return null;
  if (typeof r.step !== "string") return null;
  return {
    schema: SESSION_SCHEMA,
    build: str(r.build, ""),
    savedAt,
    reason: oneOf(r.reason, ["autosave", "update"] as const, "autosave"),
    target: typeof r.target === "string" ? str(r.target, "") : null,
    mode: oneOf(r.mode, ["simple", "advanced"] as const, "simple"),
    step: str(r.step, "welcome"),
    options: sanitizeOptions(r.options, opts.platform),
    folder: sanitizeFolder(r.folder),
    pak1Name: typeof r.pak1Name === "string" ? str(r.pak1Name, "") : null,
  };
}

/**
 * The session a page load resumes, if any: only one written on the way into
 * a self-update. A refresh, a click on the wordmark or a reopened tab is
 * somebody asking for a clean installer, and gets one; the update is the one
 * reload the user did not ask for, so it is the one that must not cost them
 * their answers.
 */
export function sessionToResume(
  session: SavedSession | null,
): SavedSession | null {
  return session?.reason === "update" ? session : null;
}

/**
 * Whether a saved folder can be opened again from what was written down. A
 * path can (the desktop app), a simulated folder always can, a browser's
 * handle cannot — so a web install that has already picked a folder is the
 * one case where a reload costs the user a click.
 */
export function folderIsRestorable(folder: SavedFolder | null): boolean {
  if (!folder) return true;
  if (folder.kind === "mock") return true;
  return folder.kind === "tauri" && !!folder.path;
}
