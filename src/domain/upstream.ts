// The upstream mirror: what `.github/workflows/mirror-upstream.yml` writes to
// `upstream.json` on the `upstream-mirror` branch. The latest release of each
// upstream project, already extracted, one target per platform, so the
// installer can offer "newest ezQuake" without touching GitHub release
// assets (which a browser cannot fetch — no CORS).

import type { ManifestFile } from "./manifest.ts";

export type UpstreamComponent = "ezquake" | "mvdsv" | "ktx";

export interface UpstreamTarget {
  /** The release asset the files were extracted from. */
  asset: string;
  files: ManifestFile[];
  bytes: number;
}

export interface UpstreamRelease {
  version: string;
  publishedAt: string;
  /** Keyed by target id, e.g. `windows-x64`, `linux-x86_64`, `macos-universal`. */
  targets: Record<string, UpstreamTarget>;
}

export interface Upstream {
  schema: 1;
  generated: string;
  components: Partial<Record<UpstreamComponent, UpstreamRelease>>;
}

export function parseUpstream(value: unknown): Upstream {
  if (!value || typeof value !== "object") {
    throw new Error("upstream: not an object");
  }
  const v = value as Record<string, unknown>;
  if (v.schema !== 1)
    throw new Error(`upstream: unsupported schema ${v.schema}`);
  const components: Upstream["components"] = {};
  const raw = (v.components ?? {}) as Record<string, unknown>;
  for (const [name, rel] of Object.entries(raw)) {
    const r = rel as Record<string, unknown>;
    const targets: Record<string, UpstreamTarget> = {};
    for (const [tid, t] of Object.entries(
      (r.targets ?? {}) as Record<string, unknown>,
    )) {
      const target = t as Record<string, unknown>;
      const files = Array.isArray(target.files)
        ? (target.files as ManifestFile[])
        : [];
      targets[tid] = {
        asset: typeof target.asset === "string" ? target.asset : "",
        files,
        bytes:
          typeof target.bytes === "number"
            ? target.bytes
            : files.reduce((n, f) => n + f.size, 0),
      };
    }
    components[name as UpstreamComponent] = {
      version: typeof r.version === "string" ? r.version : "",
      publishedAt: typeof r.publishedAt === "string" ? r.publishedAt : "",
      targets,
    };
  }
  return {
    schema: 1,
    generated: typeof v.generated === "string" ? v.generated : "",
    components,
  };
}
