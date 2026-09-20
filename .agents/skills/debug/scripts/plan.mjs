#!/usr/bin/env node
// What would this install actually write? `buildPlan` is pure, so this answers
// it in a second without downloading anything — the fastest way to check a
// "file X is missing / file Y should not be here" report.
//
//   node .agents/skills/debug/scripts/plan.mjs --platform linux --target both
//   node .agents/skills/debug/scripts/plan.mjs --grep AppImage --exec
//   node .agents/skills/debug/scripts/plan.mjs --upstream none      # mirror down
//
//   --grep RE   only destinations matching this regular expression
//   --exec      only items flagged as needing the executable bit
//   --source    show where each item's bytes come from

import { args, bytes, loadCatalog, openSrc, optionsFrom } from "./_load.mjs";

const a = args();
const src = await openSrc();
try {
  const { manifest, upstream } = await loadCatalog(src, a);
  const { buildPlan } = await src.load("/src/domain/plan.ts");
  const { browserBlockReason } = await src.load("/src/domain/paths.ts");
  const o = await optionsFrom(src, a);
  const plan = buildPlan(manifest, upstream, o);

  const re = a.grep ? new RegExp(a.grep, "i") : null;
  const items = plan.items.filter(
    (i) => (!re || re.test(i.dest)) && (!a.exec || i.executable),
  );

  console.log(
    `${o.target} / ${o.platform} · ${plan.items.length} files · ` +
      `${bytes(plan.totalBytes)} on disk · ${bytes(plan.downloadBytes)} downloaded` +
      (upstream ? "" : "  (no upstream mirror)"),
  );
  console.log(
    plan.groups
      .map((g) => `  ${g.label}: ${g.count} · ${bytes(g.bytes)}`)
      .join("\n"),
  );

  console.log(`\nFILES (${items.length}${re || a.exec ? " matching" : ""})`);
  for (const i of items) {
    const marks = [
      i.executable ? "+x" : null,
      browserBlockReason(i.dest, "browser-windows") ? "NO-BROWSER" : null,
    ].filter(Boolean);
    const from = a.source
      ? `  ← ${i.source.kind}${i.source.pkg ? `:${i.source.pkg}` : ""}`
      : "";
    console.log(
      `  ${i.dest}${marks.length ? `  [${marks.join(" ")}]` : ""}` +
        `  ${bytes(i.size)}${from}`,
    );
  }

  if (plan.servers.length) {
    console.log("\nSERVERS");
    for (const s of plan.servers)
      console.log(
        `  ${s.label}  UDP ${s.port}  -game ${s.game} +exec ${s.cfg}`,
      );
  }
  if (plan.notes.length) {
    console.log("\nNOTES");
    for (const n of plan.notes) console.log(`  * ${n}`);
  }
} finally {
  await src.close();
}
