// Where the bytes come from. Both sources are GitHub repositories read
// through raw.githubusercontent.com — the one GitHub host that serves files
// with `Access-Control-Allow-Origin: *`. (Release assets don't, which is why
// there are no zips anywhere in this installer.)

import { parseManifest, type Manifest } from "../domain/manifest.ts";
import { parseUpstream, type Upstream } from "../domain/upstream.ts";
import type { PlanItem } from "../domain/plan.ts";

const RAW = "https://raw.githubusercontent.com";

export const DISTFILES_REPO =
  import.meta.env.VITE_DISTFILES_REPO || "nQuake/distfiles";
export const DISTFILES_REF = import.meta.env.VITE_DISTFILES_REF || "master";
export const UPSTREAM_REPO =
  import.meta.env.VITE_UPSTREAM_REPO || "nQuake/web-installer";
export const UPSTREAM_REF =
  import.meta.env.VITE_UPSTREAM_REF || "upstream-mirror";

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// Build-time overrides for the two index files, so a checkout can be pointed
// at a local manifest (the screenshot harness does this) or a fork's copy.
// The files themselves still come from the repositories above.
const MANIFEST_URL_OVERRIDE = import.meta.env.VITE_MANIFEST_URL || "";
const UPSTREAM_URL_OVERRIDE = import.meta.env.VITE_UPSTREAM_URL || "";

export function manifestUrl(): string {
  return (
    MANIFEST_URL_OVERRIDE ||
    `${RAW}/${DISTFILES_REPO}/${DISTFILES_REF}/manifest.json`
  );
}

export function upstreamJsonUrl(): string {
  return (
    UPSTREAM_URL_OVERRIDE ||
    `${RAW}/${UPSTREAM_REPO}/${UPSTREAM_REF}/upstream.json`
  );
}

/** Files are fetched at the commit the manifest was built from, so a
 *  manifest and the bytes it describes can never disagree mid-install. */
export function distfilesUrl(
  manifest: Manifest,
  pkg: string,
  path: string,
): string {
  const ref = manifest.commit ?? DISTFILES_REF;
  return `${RAW}/${DISTFILES_REPO}/${ref}/${pkg}/${encodePath(path)}`;
}

export function upstreamFileUrl(
  component: string,
  target: string,
  path: string,
): string {
  return `${RAW}/${UPSTREAM_REPO}/${UPSTREAM_REF}/${component}/${target}/${encodePath(path)}`;
}

/** The URL a plan item downloads from, or null for generated/user files. */
export function itemUrl(item: PlanItem, manifest: Manifest): string | null {
  const s = item.source;
  switch (s.kind) {
    case "distfiles":
    case "template":
      return distfilesUrl(manifest, s.pkg, s.file.path);
    case "upstream":
      return upstreamFileUrl(s.component, s.target, s.file.path);
    default:
      return null;
  }
}

export async function loadManifest(
  fetchImpl: typeof fetch = fetch,
): Promise<Manifest> {
  const res = await fetchImpl(manifestUrl(), { cache: "no-cache" });
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  return parseManifest(await res.json());
}

/** The upstream mirror is optional: absent until its workflow has run once. */
export async function loadUpstream(
  fetchImpl: typeof fetch = fetch,
): Promise<Upstream | null> {
  try {
    const res = await fetchImpl(upstreamJsonUrl(), { cache: "no-cache" });
    if (!res.ok) return null;
    return parseUpstream(await res.json());
  } catch {
    return null;
  }
}
