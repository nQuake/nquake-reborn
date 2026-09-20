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
// A `.url` shortcut is no loss on Linux or macOS, so there it is simply left
// out of the install. Losing every config on Windows is a different matter:
// the install would not be nQuake. So on Windows those files are written
// beside their real destination under a `.nqinstall` suffix (only the final
// extension counts, and `nqinstall` is on no list), and the installer drops a
// small `nquake-finish.bat` that moves them into place — the same shape as
// the `start_*.sh` scripts that chmod what a browser could not.

/** Which name rules a destination enforces. `domain` decides what they mean. */
export type NameRules = "none" | "browser" | "browser-windows";

/** Suffix a blocked file is written under until `FIXUP_SCRIPT` renames it. */
export const SIDECAR_SUFFIX = ".nqinstall";

/** The generated script that puts sidecar files under their real names. */
export const FIXUP_SCRIPT = "nquake-finish.bat";

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

export type NameResolution =
  /** Write it straight to `path`. */
  | { kind: "write"; path: string }
  /** Write it to `path`; the fixup script renames it to the real one. */
  | { kind: "sidecar"; path: string; reason: string }
  /** Cannot be installed here at all. */
  | { kind: "drop"; reason: string };

/**
 * How to write `dest` on a surface with these name rules. Only Windows gets
 * the sidecar treatment: it is the only place the fixup script runs, and the
 * only place the files it rescues are worth anything.
 */
export function resolveName(dest: string, rules: NameRules): NameResolution {
  const reason = browserBlockReason(dest, rules);
  if (!reason) return { kind: "write", path: dest };
  const side = sidecarPath(dest);
  if (rules === "browser-windows" && !browserBlockReason(side, rules)) {
    return { kind: "sidecar", path: side, reason };
  }
  return { kind: "drop", reason };
}
