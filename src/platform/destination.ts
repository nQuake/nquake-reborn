// The install folder, abstracted. The installer only ever talks to this
// interface; `fs-access.ts` (browser), `tauri.ts` (desktop app) and
// `mock.ts` (simulation) implement it.

import type { NameRules } from "../domain/paths.ts";

export interface DestinationEntry {
  name: string;
  kind: "file" | "directory";
}

export interface Destination {
  /** Folder name to show the user. */
  readonly name: string;
  /**
   * The full path, where the surface knows it. The desktop app does; a
   * browser deliberately does not — the File System Access API hands the page
   * a handle with nothing but a `name`, so there `~/nquake` and
   * `~/games/nquake` both read as "nquake". Display falls back to `name`.
   */
  readonly path?: string;
  readonly kind: "fs-access" | "tauri" | "mock";
  /** Size of an existing file, or null when absent. */
  stat(path: string): Promise<{ size: number } | null>;
  readText(path: string): Promise<string | null>;
  list(path?: string): Promise<DestinationEntry[]>;
  /** Open a file for writing (parents created), truncating any existing file. */
  openWrite(path: string): Promise<WritableStream<Uint8Array>>;
  writeText(path: string, text: string): Promise<void>;
  /** Rename within the same folder (used to back up an old config.cfg). */
  rename(path: string, newName: string): Promise<void>;
  /** Mark files executable where the surface can (a no-op elsewhere). */
  setExecutable(paths: string[]): Promise<void>;
  /** Whether `setExecutable` actually does anything here. */
  readonly canSetExecutable: boolean;
  /**
   * Which file names this surface refuses. The browser's file system API
   * refuses some outright, and the set depends on the OS it runs on (see
   * `domain/paths.ts`); the OS-backed ones refuse nothing.
   */
  readonly nameRules: NameRules;
}

/** The path separator a destination's own path uses. */
function separatorFor(path: string): string {
  return path.includes("\\") && !path.includes("/") ? "\\" : "/";
}

/**
 * How to show the install folder: the full path when the surface knows it,
 * the bare folder name otherwise, with the "nQuake" subfolder appended when
 * the wizard is going to create one.
 */
export function displayPath(dest: Destination, subfolder?: string): string {
  const base = dest.path ?? dest.name;
  if (!subfolder) return base;
  return `${base.replace(/[\\/]+$/, "")}${separatorFor(base)}${subfolder}`;
}

export function splitPath(path: string): { dirs: string[]; name: string } {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop() ?? "";
  return { dirs: parts, name };
}

/** What is already in a folder, as the wizard wants to describe it. */
export interface FolderSummary {
  empty: boolean;
  /** `id1/pak0.pak` present — an nQuake (or Quake) folder. */
  existingInstall: boolean;
  /** `nquake-reborn.json` present — installed by this installer before. */
  previousState: unknown | null;
  /** `ezquake/configs/config.cfg` present — a played-in client. */
  hasClientConfig: boolean;
  entries: number;
}

export async function summarizeFolder(
  dest: Destination,
): Promise<FolderSummary> {
  const entries = await dest.list();
  const pak0 = await dest.stat("id1/pak0.pak");
  const stateText = await dest.readText("nquake-reborn.json");
  let previousState: unknown | null = null;
  if (stateText) {
    try {
      previousState = JSON.parse(stateText);
    } catch {
      previousState = null;
    }
  }
  return {
    empty: entries.length === 0,
    existingInstall: pak0 !== null,
    previousState,
    hasClientConfig: (await dest.stat("ezquake/configs/config.cfg")) !== null,
    entries: entries.length,
  };
}
