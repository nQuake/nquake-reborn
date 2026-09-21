#!/usr/bin/env node
// Check the live distfiles manifest + upstream mirror against everything the
// installer silently assumes about them. Run it when a user reports a file
// that would not install, and after anyone changes nQuake/distfiles — the
// `.url` shortcut that broke browser installs would have shown up here.
//
//   node .agents/skills/debug/scripts/audit-catalog.mjs
//   node .agents/skills/debug/scripts/audit-catalog.mjs --manifest ../distfiles/manifest.json
//
// Exits non-zero when something is actually wrong, so it also works in CI.

import { args, bytes, loadCatalog, openSrc, optionsFrom } from "./_load.mjs";

// raw.githubusercontent.com will not serve a file bigger than this, and the
// installer has no other way in (release assets send no CORS header).
const RAW_LIMIT = 100 * 1024 * 1024;

const a = args();
const src = await openSrc();
let problems = 0;
const say = (kind, msg) => {
  if (kind === "bad") problems++;
  console.log(`  ${kind === "bad" ? "✗" : "·"} ${msg}`);
};

try {
  const { manifest, upstream } = await loadCatalog(src, a);
  const { buildPlan } = await src.load("/src/domain/plan.ts");
  const { archiveFor, browserBlockReason } = await src.load(
    "/src/domain/paths.ts",
  );

  console.log(
    `manifest: ${Object.keys(manifest.packages).length} packages @ ${manifest.commit ?? "?"}\n` +
      `upstream: ${
        upstream
          ? Object.entries(upstream.components)
              .map(([k, v]) => `${k} ${v.version}`)
              .join(", ")
          : "unavailable"
      }`,
  );

  // Every plan the wizard can produce, so a file that only appears for one
  // platform or one add-on is still covered.
  const combos = [];
  for (const platform of ["windows", "linux", "macos"]) {
    for (const target of ["client", "server", "both"]) {
      combos.push({ platform, target });
    }
  }

  const seen = new Map();
  for (const c of combos) {
    const o = await optionsFrom(src, {
      ...c,
      "hd-textures": true,
      tf: true,
      ca: true,
      ffa: true,
      pak1: true,
    });
    for (const item of buildPlan(manifest, upstream, o).items) {
      if (!seen.has(item.dest)) seen.set(item.dest, { item, combos: [] });
      seen.get(item.dest).combos.push(`${c.platform}/${c.target}`);
    }
  }
  console.log(
    `\nCHECKED ${seen.size} distinct destinations across ${combos.length} option sets`,
  );

  console.log("\nNames a browser cannot create (domain/paths.ts)");
  let blocked = 0;
  for (const { item, combos: where } of seen.values()) {
    const reason = browserBlockReason(item.dest, "browser-windows");
    if (!reason) continue;
    blocked++;
    // Known and handled: the installer drops these and says so. A *new* one
    // is worth a look — check it is really dispensable in a web install.
    say("note", `${item.dest} — ${reason} (${where.length} option sets)`);
  }
  if (!blocked) say("note", "none");

  // A client config outside archiveFor's game dirs cannot be packed, so it
  // falls back to the repair script and a Windows client install stops being
  // one-click. That is a distfiles change adding a game dir the allow-list in
  // domain/paths.ts has not been told about — one line fixes it.
  console.log("\nClient configs that would fall out of the pk3");
  let unpackable = 0;
  for (const { item, combos: where } of seen.values()) {
    if (item.side !== "client") continue;
    if (!browserBlockReason(item.dest, "browser-windows")) continue;
    if (archiveFor(item.dest, item.side)) continue;
    if (!item.dest.toLowerCase().endsWith(".cfg")) continue;
    unpackable++;
    say(
      "bad",
      `${item.dest} is a client config in a game dir MOD_GAMEDIRS does not list` +
        ` — a Windows web install would need nquake-finish.bat again` +
        ` (${where.length} option sets)`,
    );
  }
  if (!unpackable) say("ok", "every client config maps into an archive");

  // Two configs that strip to the same entry inside one archive: the
  // installer keeps the later one and warns, but distfiles should not be
  // creating the ambiguity in the first place.
  const entries = new Map();
  for (const { item } of seen.values()) {
    const packed = archiveFor(item.dest, item.side);
    if (!packed) continue;
    const key = `${packed.archive}#${packed.entry}`;
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(item.dest);
  }
  const clashes = [...entries].filter(([, list]) => list.length > 1);
  console.log("\nArchive entry collisions");
  for (const [key, list] of clashes) {
    say("bad", `${key} is claimed by ${list.join(" and ")}`);
  }
  if (!clashes.length) say("ok", "no two configs claim the same entry");

  console.log("\nFiles too big for raw.githubusercontent.com");
  let big = 0;
  for (const { item } of seen.values()) {
    if (item.size <= RAW_LIMIT) continue;
    big++;
    say(
      "bad",
      `${item.dest} is ${bytes(item.size)} > the ${bytes(RAW_LIMIT)} raw limit`,
    );
  }
  if (!big) say("note", `none (largest fits under ${bytes(RAW_LIMIT)})`);

  console.log("\nPackages the plan names but the manifest lacks");
  const missing = new Set();
  for (const c of combos) {
    const o = await optionsFrom(src, { ...c, tf: true, ca: true, ffa: true });
    for (const n of buildPlan(manifest, upstream, o).notes) {
      if (/missing from the manifest/.test(n)) missing.add(n);
    }
  }
  if (missing.size) for (const n of missing) say("bad", n);
  else say("note", "none");

  console.log("\nUpstream targets the plan expects");
  const { UPSTREAM_TARGET } = await src.load("/src/domain/platform.ts");
  for (const [component, byPlatform] of Object.entries(UPSTREAM_TARGET)) {
    for (const [platform, target] of Object.entries(byPlatform)) {
      if (!target) continue;
      const files = upstream?.components[component]?.targets[target]?.files;
      // No macOS server binaries exist anywhere upstream; that is expected.
      if (files?.length)
        say("note", `${component}/${target}: ${files.length} file(s)`);
      else
        say(
          component === "ezquake" ? "bad" : "note",
          `${component}/${target} (${platform}) has no files in the mirror`,
        );
    }
  }
} finally {
  await src.close();
}

console.log(problems ? `\n${problems} problem(s).` : "\nNothing wrong.");
process.exit(problems ? 1 : 0);
