// The app's own deploy marker. `vite.config.ts` emits `dist/version.json`
// next to the bundle on every build, so asking "is there a newer installer
// than the one running?" is one small fetch of a file on the same origin —
// no API, no CORS, and it works at whatever base path the deploy sits on
// (`/nquake-reborn/`, `/nquake-reborn/preview/`, or `/` behind the custom
// domain).

import { parseVersionInfo, type VersionInfo } from "../domain/update.ts";

export function versionUrl(): string {
  const base: string = import.meta.env.BASE_URL;
  return `${base.endsWith("/") ? base : `${base}/`}version.json`;
}

/**
 * The deployed build label, or null when it cannot be read — a dev server
 * (which emits no `version.json`), the desktop shell, or simply being
 * offline. An update check that fails is a non-event: the page keeps running.
 *
 * `no-store` plus a cache-busting query because the point is to see a file
 * *change*, and both the browser's HTTP cache and the Pages CDN in front of
 * it are happy to hand back the copy from when the page first loaded.
 */
export async function loadVersionInfo(
  fetchImpl: typeof fetch = fetch,
): Promise<VersionInfo | null> {
  try {
    const res = await fetchImpl(`${versionUrl()}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseVersionInfo(await res.json());
  } catch {
    return null;
  }
}
