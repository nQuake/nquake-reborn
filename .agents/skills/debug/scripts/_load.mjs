// Load the installer's own TypeScript in plain Node, so a bug can be
// reproduced without a browser, a folder picker or the network.
//
// The project has no ts-node / vite-node, but it does have Vite, and Vite can
// transform and import a module server-side. That is all `vite-node` ever did.
// `configFile: false` keeps the Preact and Tailwind plugins out of the way —
// these scripts only ever load `src/domain`, `src/net` and `src/platform`,
// none of which contain JSX.

import { createServer } from "vite";

/**
 * @returns {Promise<{ load: (path: string) => Promise<any>, close: () => Promise<void> }>}
 */
export async function openSrc() {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });
  return {
    load: (path) => server.ssrLoadModule(path),
    close: () => server.close(),
  };
}

/** `--platform linux --target both --flag` → { platform: "linux", target: "both", flag: true } */
export function args(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export const bytes = (n) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(2)} GB`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)} MB`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(1)} kB`
        : `${n} B`;

/**
 * The two index files. Pass `--manifest`/`--upstream` to use a local copy
 * (a checkout of nQuake/distfiles, or `tests/fixtures/upstream.json`);
 * otherwise they are fetched live, exactly as the app fetches them.
 * `--upstream none` builds the plan as if the mirror were unavailable, which
 * is how you reproduce the "bundled fallback" notes.
 */
export async function loadCatalog(src, a) {
  const { parseManifest } = await src.load("/src/domain/manifest.ts");
  const { parseUpstream } = await src.load("/src/domain/upstream.ts");
  const { manifestUrl, upstreamJsonUrl } = await src.load(
    "/src/net/sources.ts",
  );
  const { readFileSync } = await import("node:fs");

  const read = async (where, fallbackUrl) => {
    if (where === "none") return null;
    if (where && !/^https?:/.test(where)) {
      return JSON.parse(readFileSync(where, "utf8"));
    }
    const url = where || fallbackUrl;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return res.json();
  };

  const manifest = parseManifest(await read(a.manifest, manifestUrl()));
  if (!manifest) throw new Error("the manifest did not parse — schema change?");
  const rawUpstream = await read(a.upstream ?? null, upstreamJsonUrl());
  return {
    manifest,
    upstream: rawUpstream ? parseUpstream(rawUpstream) : null,
  };
}

/**
 * Wizard answers from flags, starting from `defaultOptions`. Every flag here
 * exists because some bug only shows up for one combination — the plan is a
 * pure function of these, so reproducing a user's install starts by matching
 * their answers.
 *
 *   --platform windows|linux|macos   --target client|server|both
 *   --pak1   --hd-textures   --no-textures   --tf   --ca   --ffa
 *   --bundled-client   --bundled-binaries   --no-maps   --ports N
 */
export async function optionsFrom(src, a) {
  const { defaultOptions } = await src.load("/src/domain/options.ts");
  const o = defaultOptions(a.platform ?? "windows");
  if (a.target) o.target = a.target;
  o.pak1 = Boolean(a.pak1);
  if (a["no-textures"]) o.client.textures = false;
  if (a["hd-textures"]) o.client.hdTextures = true;
  if (a.tf) o.client.teamFortress = true;
  if (a.ca) o.client.clanArena = true;
  if (a["bundled-client"]) o.client.ezquakeSource = "bundled";
  if (a["bundled-binaries"]) o.server.binariesSource = "bundled";
  if (a["no-maps"]) o.server.fullMaps = false;
  if (a.ffa) o.server.ffa = true;
  if (a.tf) o.server.teamFortress = true;
  if (a.ca) o.server.clanArena = true;
  if (a.ports) o.server.ports = Number(a.ports);
  o.server.rconPassword ||= "debugrcon";
  o.server.qtvPassword ||= "debugqtv";
  return o;
}
