#!/usr/bin/env node
// Fetch the latest release of each upstream QuakeWorld project, extract the
// per-platform binaries, and lay them out — with an `upstream.json` index —
// the way the installer expects them on the `upstream-mirror` branch. Run
// by `.github/workflows/mirror-upstream.yml`; needs `gh` (authenticated)
// and `unzip` on PATH.
//
//   node scripts/mirror-upstream.mjs <outdir>
//
// The file paths recorded for each target are install-root-relative: what
// the installer writes into the nQuake folder, verbatim. See
// `src/domain/upstream.ts` for the index shape.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import process from "node:process";

const out = process.argv[2];
if (!out) {
  console.error("usage: mirror-upstream.mjs <outdir>");
  process.exit(2);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// component → target id → { repo, asset matcher, how to lay it out }.
// `place` receives the extraction directory (or the raw asset for
// single-file assets) and moves what the install folder needs into `dest`.
const COMPONENTS = {
  ezquake: {
    repo: "QW-Group/ezquake-source",
    targets: {
      "windows-x64": {
        asset: /^ezQuake-windows-x64\.zip$/i,
        kind: "zip",
        place: flatten,
      },
      "linux-x86_64": {
        asset: /^ezQuake-linux-x86_64\.zip$/i,
        kind: "zip",
        place: flatten,
      },
      "macos-universal": {
        asset: /^ezQuake-macOS-universal\.zip$/i,
        kind: "zip",
        place: flatten,
      },
    },
  },
  mvdsv: {
    repo: "QW-Group/mvdsv",
    targets: {
      "windows-x64": {
        asset: /^mvdsv_windows_x64\.exe$/i,
        kind: "file",
        name: "mvdsv.exe",
      },
      "linux-amd64": {
        asset: /^mvdsv_linux_amd64$/i,
        kind: "file",
        name: "mvdsv",
      },
    },
  },
  ktx: {
    repo: "QW-Group/ktx",
    targets: {
      "windows-x64": {
        asset: /^qwprogs-windows-x64\.zip$/i,
        kind: "zip",
        place: (dir, dest) => flatten(dir, join(dest, "ktx")),
      },
      "linux-amd64": {
        asset: /^qwprogs-linux-amd64\.zip$/i,
        kind: "zip",
        place: (dir, dest) => flatten(dir, join(dest, "ktx")),
      },
    },
  },
};

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Move every file out of `dir` into `dest`, collapsing a single top-level
// wrapper directory (zips often carry one) but keeping deeper structure
// (an .app bundle must stay intact).
function flatten(dir, dest) {
  let entries = readdirSync(dir).filter((n) => !n.startsWith("__MACOSX"));
  while (
    entries.length === 1 &&
    statSync(join(dir, entries[0])).isDirectory() &&
    !entries[0].endsWith(".app")
  ) {
    dir = join(dir, entries[0]);
    entries = readdirSync(dir).filter((n) => !n.startsWith("__MACOSX"));
  }
  mkdirSync(dest, { recursive: true });
  for (const e of entries) renameSync(join(dir, e), join(dest, e));
}

function walk(dir) {
  const files = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else if (e.isFile()) files.push(p);
  }
  return files.sort();
}

const index = {
  schema: 1,
  generated: new Date().toISOString(),
  components: {},
};

for (const [component, spec] of Object.entries(COMPONENTS)) {
  const release = JSON.parse(gh(["api", `repos/${spec.repo}/releases/latest`]));
  const entry = {
    version: release.tag_name,
    publishedAt: release.published_at,
    targets: {},
  };
  for (const [target, t] of Object.entries(spec.targets)) {
    const asset = release.assets.find((a) => t.asset.test(a.name));
    if (!asset) {
      console.error(
        `${component}/${target}: no asset matching ${t.asset} in ${release.tag_name}`,
      );
      continue;
    }
    const dest = join(out, component, target);
    const tmp = join(out, ".tmp", component, target);
    mkdirSync(tmp, { recursive: true });
    const download = join(tmp, asset.name);
    execFileSync(
      "gh",
      [
        "release",
        "download",
        release.tag_name,
        "--repo",
        spec.repo,
        "--pattern",
        asset.name,
        "--dir",
        tmp,
      ],
      { stdio: "inherit" },
    );
    if (t.kind === "zip") {
      const extracted = join(tmp, "x");
      mkdirSync(extracted);
      execFileSync("unzip", ["-q", download, "-d", extracted]);
      t.place(extracted, dest);
    } else {
      mkdirSync(dest, { recursive: true });
      renameSync(download, join(dest, t.name));
    }
    const files = walk(dest).map((f) => {
      const data = readFileSync(f);
      // Executable bits don't survive git anyway; the installer restores them.
      try {
        chmodSync(f, 0o644);
      } catch {
        /* windows */
      }
      return {
        path: relative(dest, f).split(sep).join("/"),
        size: data.byteLength,
        sha256: createHash("sha256").update(data).digest("hex"),
      };
    });
    entry.targets[target] = {
      asset: asset.name,
      bytes: files.reduce((n, f) => n + f.size, 0),
      files,
    };
    console.error(
      `${component}/${target}: ${asset.name} → ${files.length} file(s)`,
    );
  }
  index.components[component] = entry;
}

rmSync(join(out, ".tmp"), { recursive: true, force: true });
writeFileSync(
  join(out, "upstream.json"),
  JSON.stringify(index, null, 1) + "\n",
);
writeFileSync(
  join(out, "README.md"),
  "# upstream-mirror\n\nAuto-generated by `.github/workflows/mirror-upstream.yml` in nQuake/nquake-reborn: the latest ezQuake, MVDSV and KTX release binaries, extracted, so the web installer can fetch them with CORS. Do not edit — the branch is force-pushed.\n",
);
console.error("wrote upstream.json");
