// `nquake-reborn.json`, written into the install folder when an install
// finishes. It records what was installed and from where, so a later run
// can offer an update (skip files that haven't changed upstream) and a
// future uninstaller knows what it may remove.

import type { InstallOptions } from "./options.ts";
import type { PlanItem } from "./plan.ts";

export const INSTALL_STATE_FILE = "nquake-reborn.json";

export interface InstalledFile {
  path: string;
  size: number;
  /** Upstream hash of the bytes as downloaded; null for generated/user files. */
  sha256: string | null;
  source: "distfiles" | "upstream" | "generated" | "user";
}

export interface InstallState {
  schema: 1;
  installedAt: string;
  installerVersion: string;
  options: InstallOptions;
  files: InstalledFile[];
}

export function describeSource(item: PlanItem): InstalledFile {
  const s = item.source;
  switch (s.kind) {
    case "distfiles":
      return {
        path: item.dest,
        size: item.size,
        sha256: s.file.sha256,
        source: "distfiles",
      };
    case "upstream":
      return {
        path: item.dest,
        size: item.size,
        sha256: s.file.sha256,
        source: "upstream",
      };
    case "template":
      return {
        path: item.dest,
        size: item.size,
        sha256: null,
        source: "distfiles",
      };
    case "generated":
      return {
        path: item.dest,
        size: item.size,
        sha256: null,
        source: "generated",
      };
    case "user":
      return { path: item.dest, size: item.size, sha256: null, source: "user" };
  }
}

export function createInstallState(
  options: InstallOptions,
  items: PlanItem[],
  installerVersion: string,
  now: Date,
): InstallState {
  return {
    schema: 1,
    installedAt: now.toISOString(),
    installerVersion,
    options,
    files: items.map(describeSource),
  };
}

export function parseInstallState(value: unknown): InstallState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.schema !== 1 || !Array.isArray(v.files) || !v.options) return null;
  return v as unknown as InstallState;
}

/**
 * Whether an item already on disk can be kept. A file is reused when the
 * previous install recorded the same upstream hash for it and the file on
 * disk still has the expected size — a cheap check that catches the common
 * cases (nothing changed; a download that was cut short) without hashing
 * hundreds of megabytes in the browser.
 */
export function canReuse(
  item: PlanItem,
  existingSize: number | null,
  previous: InstallState | null,
): boolean {
  if (existingSize === null || existingSize !== item.size) return false;
  const s = item.source;
  if (s.kind === "generated" || s.kind === "template") return false;
  if (s.kind === "user") return true;
  // Without a record of the previous install, trust size alone for the
  // big immutable data files (paks, pk3s, bsps): they never change in place.
  if (!previous)
    return /\.(pak|pk3|bsp|wav|mdl|lit|png|jpg|tga)$/i.test(item.dest);
  const prev = previous.files.find(
    (f) => f.path.toLowerCase() === item.dest.toLowerCase(),
  );
  if (!prev) return /\.(pak|pk3|bsp|wav|mdl|lit|png|jpg|tga)$/i.test(item.dest);
  return prev.sha256 !== null && prev.sha256 === s.file.sha256;
}
