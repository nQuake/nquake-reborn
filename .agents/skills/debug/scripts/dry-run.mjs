#!/usr/bin/env node
// Run a whole install in Node — no browser, no folder picker, no network.
//
// `runInstall` only ever talks to a `Destination` and a `Transport`, so
// swapping in the mock destination and a transport that invents bytes
// exercises the real code: the worker pool, the reuse check, the blocked-name
// drop, the record, the readme and every generated config. If a user reports
// a file that failed, is missing or has the wrong contents, reproduce it here
// first — it is seconds per attempt instead of a real 600 MB install.
//
//   node .agents/skills/debug/scripts/dry-run.mjs --platform linux --target both
//   node .agents/skills/debug/scripts/dry-run.mjs --restricted        # act like a browser
//   node .agents/skills/debug/scripts/dry-run.mjs --cat start_ezquake.sh
//   node .agents/skills/debug/scripts/dry-run.mjs --fail "\.pk3$"     # force failures
//
//   --restricted   refuse names the File System Access API refuses
//   --cat RE       print the contents of every generated text file matching RE
//   --fail RE      make the transport fail for sources matching RE
//   --tree         list every written path
// Plus all the plan flags (--platform, --target, --pak1, --tf, …).

import { args, bytes, loadCatalog, openSrc, optionsFrom } from "./_load.mjs";

const a = args();
const src = await openSrc();
try {
  const { manifest, upstream } = await loadCatalog(src, a);
  const { buildPlan } = await src.load("/src/domain/plan.ts");
  const { runInstall } = await src.load("/src/net/installer.ts");
  const { MockDestination } = await src.load("/src/platform/mock.ts");
  const o = await optionsFrom(src, a);
  const plan = buildPlan(manifest, upstream, o);

  // A transport that serves the exact number of bytes the manifest promised,
  // so a size mismatch in the plan shows up as a real failure here too.
  const failRe = a.fail ? new RegExp(a.fail, "i") : null;
  const transport = {
    async open(url, expectedSize) {
      if (failRe?.test(url)) throw new Error("forced failure (--fail)");
      return new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(expectedSize ?? 0));
          c.close();
        },
      });
    },
    async text(url) {
      if (failRe?.test(url)) throw new Error("forced failure (--fail)");
      return "// template text stood in by dry-run.mjs\n";
    },
  };

  const dest = new MockDestination("dry-run", Boolean(a.restricted));
  const logs = [];
  const result = await runInstall({
    plan,
    options: o,
    manifest,
    destination: dest,
    transport,
    pak1: o.pak1 ? new Blob([new Uint8Array(34257856)]) : null,
    installerVersion: "dry-run",
    onLog: (e) => logs.push(`${e.level}: ${e.message}`),
  });

  console.log(
    `${o.target} / ${o.platform}` +
      (a.restricted ? " · browser-style name rules" : "") +
      `\n  ok=${result.ok}  written=${result.written}  skipped=${result.skipped}` +
      `  failed=${result.failed.length}  blocked=${result.blocked.length}` +
      `  ${bytes(result.bytes)}`,
  );

  if (result.blocked.length) {
    console.log("\nBLOCKED (dropped before the run, reported as notes)");
    for (const b of result.blocked) console.log(`  ${b.dest}: ${b.reason}`);
  }
  if (result.failed.length) {
    console.log("\nFAILED");
    for (const f of result.failed.slice(0, 20))
      console.log(`  ${f.item.dest}: ${f.error}`);
    if (result.failed.length > 20)
      console.log(`  … ${result.failed.length - 20} more`);
  }
  if (logs.length) {
    console.log("\nLOG");
    for (const l of logs) console.log(`  ${l}`);
  }

  const written = await dest.list();
  if (a.tree) {
    console.log("\nWRITTEN");
    for (const p of written.map((e) => e.name).sort()) console.log(`  ${p}`);
  }

  if (a.cat) {
    // Generated text is where most "the config is wrong" reports land, and
    // it never touches the network — read it here rather than installing.
    const re = new RegExp(a.cat, "i");
    for (const item of plan.items.filter((i) => re.test(i.dest))) {
      const text = await dest.readText(item.dest);
      console.log(`\n===== ${item.dest} =====`);
      console.log(text ?? "(not a text file the mock kept)");
    }
    for (const name of ["README-nquake.txt", "nquake-reborn.json"]) {
      if (!re.test(name)) continue;
      console.log(`\n===== ${name} =====`);
      console.log(await dest.readText(name));
    }
  }
} finally {
  await src.close();
}
