// Names a browser install can never create, whatever the OS underneath.
//
// Chromium validates every path component before the File System Access API
// hands out a handle (`content/browser/file_system_access/
// file_system_access_manager_impl.cc`, `IsSafePathComponent`). `.lnk`, `.scf`
// and `.url` are refused outright — `.url` because such a file can be made to
// read arbitrary files (crbug.com/1307930) — as are CLSID extensions, names
// ending in a dot and the Windows device names. It is the API's rule, not the
// filesystem's, so it bites on Linux and macOS exactly as it does on Windows.
//
// nQuake ships one such file: `ezquake/Online Manual.url`, a 135-byte Windows
// shortcut to the ezQuake manual. Spaces in a name are fine — `ktx/configs/
// usermodes/dmm4cfgs for Rocket Arena maps.txt` installs without complaint —
// it is the extension that is rejected. The installer asks here so it can
// leave such a file out of a browser install instead of reporting a failure
// the user can do nothing about; surfaces that write through the OS (the
// desktop app) still get it.

/** Extensions Chromium refuses to create through the File System Access API. */
const BLOCKED_EXTENSIONS = new Set(["lnk", "scf", "url"]);

const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function componentBlockReason(name: string): string | null {
  const ext = extensionOf(name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `browsers are not allowed to create .${ext} files`;
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
 * Why a destination that goes through the browser's file system API cannot
 * create `path`, phrased for the user, or null when it can.
 */
export function browserBlockReason(path: string): string | null {
  for (const component of path.split("/")) {
    if (!component) continue;
    const reason = componentBlockReason(component);
    if (reason) return reason;
  }
  return null;
}
