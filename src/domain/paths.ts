// Names a browser install cannot create, and how to get the bytes there
// anyway.
//
// Chromium validates every path component before the File System Access API
// hands out a handle (`content/browser/file_system_access/
// file_system_access_manager_impl.cc`, `IsSafePathComponent`). Three rules
// bite here:
//
//   * `.lnk`, `.scf` and `.url` are refused outright — `.url` because such a
//     file can be made to read arbitrary files (crbug.com/1307930) — as are
//     CLSID extensions, names ending in a dot and the Windows device names.
//     These apply whatever the OS underneath.
//   * Any extension the Safe Browsing file-type list marks `DANGEROUS` is
//     refused too (`components/safe_browsing/content/resources/
//     download_file_types.asciipb`), and that list is *per platform*. On
//     Windows it marks `cfg`, `dll`, `ini` and `manifest` — `.local` is on it
//     as well but Chromium exempts it by name. So a browser running on
//     Windows cannot create a single one of nQuake's 150-odd `.cfg` files,
//     nor `ktx/qwprogs.dll`, while the same browser on Linux or macOS
//     creates them without complaint.
//   * `move()` validates the new name the same way, so renaming a file into
//     place afterwards is not a way out either.
//
// A browser *can* create a `.pk3`, though, and ezQuake reads configs out of a
// pk3 exactly as it reads them off disk. So the configs go into one archive,
// `id1/configs.pk3`, and a browser install on Windows needs no repair step at
// all. `id1` is the slot that makes this safe: ezQuake registers id1, then
// ezquake, then qw, each prepended (`fs.c#FS_InitFilesystem`), so id1 is the
// *lowest* priority game dir and the `ezquake/configs/config.cfg` that
// ezQuake writes on quit always wins over the copy in the archive. Put the
// same archive in `ezquake/` and it would shadow the player's saved settings
// on every launch.
//
// What is left over after the archive is server-side: `ktx/qwprogs.dll`, which
// MVDSV loads with `LoadLibrary` and so must be a real file, and the KTX / QTV
// / QWFWD configs. Those are written beside their destination under a
// `.nqinstall` suffix (only the final extension counts, and `nqinstall` is on
// no list) and moved into place by the generated `nquake-finish.bat`, which
// `start_servers.bat` runs itself. A server install is started from a script
// either way, so a repair step costs nothing there; a client install is
// double-clicked, so it must not need one.
//
// Shortcut formats are the exception to all of this: `.lnk`, `.scf` and `.url`
// are refused on every OS, nothing in nQuake reads them, and repairing one is
// not worth making a player run a batch file. nQuake ships one,
// `ezquake/Online Manual.url` — a bookmark to the ezQuake manual, which the
// readme links anyway — so browser installs simply leave it out and say so.

import type { InstallSide } from "./plan.ts";

/** Which name rules a destination enforces. `domain` decides what they mean. */
export type NameRules = "none" | "browser" | "browser-windows";

/** Suffix a blocked file is written under until `FIXUP_SCRIPT` renames it. */
export const SIDECAR_SUFFIX = ".nqinstall";

/** The generated script that puts sidecar files under their real names. */
export const FIXUP_SCRIPT = "nquake-finish.bat";

/**
 * The archive the client configs are packed into. It sits in `id1`, the
 * lowest-priority game dir, so a loose file always beats the packed copy.
 */
export const CONFIG_PK3 = "id1/configs.pk3";

/**
 * Game dirs ezQuake always has in its search path. A path under one of these
 * maps into `CONFIG_PK3` by dropping the prefix, because entries in a pack
 * are resolved relative to the game dir the pack sits in, not to the install
 * folder.
 */
const CORE_GAMEDIRS = ["id1/", "ezquake/", "qw/"];

/**
 * Mod dirs, each of which gets its own `configs.pk3` rather than sharing the
 * one in `id1`: strip `prox/` from `prox/configs/config.cfg` and it collides
 * with `ezquake/configs/config.cfg`. A pack beside the mod's own `pak0.pak` /
 * `prox.pk3` has exactly the precedence the loose file it replaces had, and
 * is only in the search path under `-game`.
 *
 * The *side* decides whether any of this applies, not the directory — a path
 * cannot tell you. `fortress/` holds both a client config (`addon-fortress`)
 * and the TF server's (`sv-fortress`); packing the server's into a pk3 would
 * hide it from MVDSV, which reads `.pak` but no zip at all. So only items the
 * plan marked `client` are ever packed, and this list just says where.
 */
const MOD_GAMEDIRS = ["fortress/", "prox/", "arena/", "cace/"];

/** Refused by the File System Access API on every platform. */
const BLOCKED_EXTENSIONS = new Set(["lnk", "scf", "url"]);

/** `DANGEROUS` on Windows in Safe Browsing's download_file_types.asciipb. */
const BLOCKED_EXTENSIONS_ON_WINDOWS = new Set([
  "cfg",
  "dll",
  "ini",
  "manifest",
]);

const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function componentBlockReason(name: string, rules: NameRules): string | null {
  const ext = extensionOf(name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `browsers are not allowed to create .${ext} files`;
  }
  if (rules === "browser-windows" && BLOCKED_EXTENSIONS_ON_WINDOWS.has(ext)) {
    return `browsers on Windows are not allowed to create .${ext} files`;
  }
  if (ext.startsWith("{") && ext.endsWith("}")) {
    return "browsers are not allowed to create CLSID file extensions";
  }
  if (name.endsWith(".")) {
    return "browsers are not allowed to create names ending in a dot";
  }
  if (RESERVED_DEVICE_NAME.test(name)) {
    return `"${name}" is a reserved device name`;
  }
  return null;
}

/**
 * Why a destination with these name rules cannot create `path`, phrased for
 * the user, or null when it can.
 */
export function browserBlockReason(
  path: string,
  rules: NameRules = "browser",
): string | null {
  if (rules === "none") return null;
  for (const component of path.split("/")) {
    if (!component) continue;
    const reason = componentBlockReason(component, rules);
    if (reason) return reason;
  }
  return null;
}

/** Where a blocked file is parked until the fixup script renames it. */
export function sidecarPath(path: string): string {
  return path + SIDECAR_SUFFIX;
}

/** `sidecarPath` undone — the real destination a sidecar stands in for. */
export function realPath(path: string): string {
  return path.endsWith(SIDECAR_SUFFIX)
    ? path.slice(0, -SIDECAR_SUFFIX.length)
    : path;
}

/**
 * Which archive a config belongs in and where inside it, or null when it
 * cannot be packed — ezQuake only reads `.cfg` files out of a pack through
 * the VFS, only for game dirs it actually searches, and only the client runs
 * ezQuake at all.
 */
export function archiveFor(
  dest: string,
  side: InstallSide = "client",
): { archive: string; entry: string } | null {
  if (side !== "client") return null;
  if (!dest.toLowerCase().endsWith(".cfg")) return null;
  for (const dir of CORE_GAMEDIRS) {
    if (dest.startsWith(dir)) {
      return { archive: CONFIG_PK3, entry: dest.slice(dir.length) };
    }
  }
  for (const dir of MOD_GAMEDIRS) {
    if (dest.startsWith(dir)) {
      return { archive: `${dir}configs.pk3`, entry: dest.slice(dir.length) };
    }
  }
  return null;
}

/** Whether any component is a shortcut format — refused everywhere, read by nothing. */
function isShortcut(path: string): boolean {
  return path
    .split("/")
    .some((c) => c && BLOCKED_EXTENSIONS.has(extensionOf(c)));
}

export type NameResolution =
  /** Write it straight to `path`. */
  | { kind: "write"; path: string }
  /** Pack it into `archive` at `entry` instead of writing it loose. */
  | { kind: "archive"; archive: string; entry: string; reason: string }
  /** Write it to `path`; the fixup script renames it to the real one. */
  | { kind: "sidecar"; path: string; reason: string }
  /** Cannot be installed here at all. */
  | { kind: "drop"; reason: string };

/**
 * How to write `dest` on a surface with these name rules, in the order that
 * costs the player least: straight to disk, else packed into the archive
 * ezQuake can read, else parked for the fixup script a server install runs
 * anyway, else left out with a note.
 */
export function resolveName(
  dest: string,
  rules: NameRules,
  side: InstallSide = "client",
): NameResolution {
  const reason = browserBlockReason(dest, rules);
  if (!reason) return { kind: "write", path: dest };

  // Nothing reads a shortcut, so never make a repair step out of one.
  if (isShortcut(dest)) return { kind: "drop", reason };

  const packed = archiveFor(dest, side);
  if (packed) return { kind: "archive", ...packed, reason };

  const parked = sidecarPath(dest);
  if (rules === "browser-windows" && !browserBlockReason(parked, rules)) {
    return { kind: "sidecar", path: parked, reason };
  }
  return { kind: "drop", reason };
}
