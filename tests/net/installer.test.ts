import { describe, expect, it } from "vitest";

import type { Manifest } from "../../src/domain/manifest.ts";
import { defaultOptions } from "../../src/domain/options.ts";
import { buildPlan } from "../../src/domain/plan.ts";
import { runInstall } from "../../src/net/installer.ts";
import {
  createHttpTransport,
  type Transport,
} from "../../src/net/transport.ts";
import {
  MockDestination,
  createMockTransport,
} from "../../src/platform/mock.ts";

const manifest: Manifest = {
  schema: 1,
  generated: "",
  commit: "abc",
  packages: {
    qsw106: {
      bytes: 10,
      files: [{ path: "ID1/PAK0.PAK", size: 10, sha256: "p0" }],
    },
    gpl: {
      bytes: 30,
      files: [
        { path: "ezquake.exe", size: 20, sha256: "exe" },
        { path: "id1/gpl_maps.pk3", size: 10, sha256: "maps" },
      ],
    },
    "non-gpl": {
      bytes: 5,
      files: [{ path: "qw/nquake.pk3", size: 5, sha256: "nq" }],
    },
    textures: {
      bytes: 7,
      files: [{ path: "qw/textures.pk3", size: 7, sha256: "tx" }],
    },
  },
};

function fakeTransport(
  sizes: (url: string) => number,
  fail?: (url: string) => boolean,
): Transport {
  return {
    async open(url, expectedSize) {
      if (fail?.(url)) throw new Error("boom");
      const wanted = sizes(url);
      const n = Number.isNaN(wanted) ? expectedSize : wanted;
      return new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new Uint8Array(n));
          c.close();
        },
      });
    },
    async text() {
      return "// template\n";
    },
  };
}

/** Parse a store-only zip via its central directory — an independent read. */
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("no end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdStart = view.getUint32(eocd + 16, true);
  // A reader that trusts the size field (Python's zipfile does, to allow for
  // prepended data) lands in the wrong place if it disagrees with the offset.
  if (cdStart + cdSize !== eocd) {
    throw new Error(
      `central directory size ${cdSize} disagrees with offsets ${cdStart}..${eocd}`,
    );
  }
  let at = cdStart;
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50)
      throw new Error("bad central header");
    const method = view.getUint16(at + 10, true);
    if (method !== 0) throw new Error(`entry is not stored: method ${method}`);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLen),
    );
    const localNameLen = view.getUint16(local + 26, true);
    const localExtraLen = view.getUint16(local + 28, true);
    const from = local + 30 + localNameLen + localExtraLen;
    out.set(name, bytes.subarray(from, from + size));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe("runInstall", () => {
  it("writes every planned file, the record and the readme", async () => {
    const options = defaultOptions("windows");
    const plan = buildPlan(manifest, null, options);
    const dest = new MockDestination();
    const logs: string[] = [];
    let last = 0;
    const result = await runInstall({
      plan,
      options,
      manifest,
      destination: dest,
      transport: fakeTransport((_u) => NaN),
      installerVersion: "0.1.0",
      onLog: (e) => logs.push(e.message),
      onProgress: (p) => {
        expect(p.bytesDone).toBeGreaterThanOrEqual(last);
        last = p.bytesDone;
      },
    });
    expect(result.ok).toBe(true);
    expect(result.written).toBe(plan.items.length);
    const w = dest.written();
    expect(w).toContain("id1/pak0.pak");
    expect(w).toContain("ezquake/configs/preset.cfg");
    expect(w).toContain("nquake-reborn.json");
    expect(w).toContain("README-nquake.txt");
    const state = JSON.parse((await dest.readText("nquake-reborn.json"))!);
    expect(state.files.length).toBe(plan.items.length);
    expect(last).toBe(plan.totalBytes);
  });

  it("collects failures and short downloads instead of aborting", async () => {
    const options = defaultOptions("windows");
    const plan = buildPlan(manifest, null, options);
    const dest = new MockDestination();
    const result = await runInstall({
      plan,
      options,
      manifest,
      destination: dest,
      transport: fakeTransport(
        (u) => (u.endsWith("textures.pk3") ? 3 : NaN),
        (u) => u.endsWith("ezquake.exe"),
      ),
      installerVersion: "0.1.0",
    });
    expect(result.ok).toBe(false);
    expect(result.failed.map((f) => f.item.dest).sort()).toEqual([
      "ezquake.exe",
      "qw/textures.pk3",
    ]);
    expect(
      result.failed.find((f) => f.item.dest === "qw/textures.pk3")?.error,
    ).toMatch(/Expected 7 bytes/);
    // The record only lists what actually landed.
    const state = JSON.parse((await dest.readText("nquake-reborn.json"))!);
    expect(
      state.files.some((f: { path: string }) => f.path === "ezquake.exe"),
    ).toBe(false);
  });

  it("leaves out names a browser cannot create, without failing the run", async () => {
    // Chromium refuses to create `.url` files at all, which is how nQuake's
    // `ezquake/Online Manual.url` shortcut turned into an install error.
    const withShortcut: Manifest = {
      ...manifest,
      packages: {
        ...manifest.packages,
        gpl: {
          bytes: 165,
          files: [
            ...manifest.packages.gpl!.files,
            { path: "ezquake/Online Manual.url", size: 135, sha256: "url" },
          ],
        },
      },
    };
    const options = defaultOptions("windows");
    const plan = buildPlan(withShortcut, null, options);
    expect(plan.items.some((i) => i.dest.endsWith(".url"))).toBe(true);

    const dest = new MockDestination("browser", "browser");
    const logs: string[] = [];
    let lastTotal = 0;
    const result = await runInstall({
      plan,
      options,
      manifest: withShortcut,
      destination: dest,
      transport: fakeTransport(() => NaN),
      installerVersion: "0.1.0",
      onLog: (e) => logs.push(e.message),
      onProgress: (p) => {
        lastTotal = p.filesTotal;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.failed).toEqual([]);
    expect(result.blocked.map((b) => b.dest)).toEqual([
      "ezquake/Online Manual.url",
    ]);
    expect(logs.some((m) => m.includes("Online Manual.url"))).toBe(true);
    // It is out of the totals and out of the record, not a missing file.
    expect(lastTotal).toBe(plan.items.length - 1);
    const state = JSON.parse((await dest.readText("nquake-reborn.json"))!);
    expect(
      state.files.some((f: { path: string }) => f.path.endsWith(".url")),
    ).toBe(false);

    // A surface that writes through the OS still gets it.
    const plain = new MockDestination();
    const full = await runInstall({
      plan,
      options,
      manifest: withShortcut,
      destination: plain,
      transport: fakeTransport(() => NaN),
      installerVersion: "0.1.0",
    });
    expect(full.blocked).toEqual([]);
    expect(await plain.stat("ezquake/Online Manual.url")).not.toBeNull();
  });

  it("packs the configs a browser on Windows cannot name into a pk3", async () => {
    // Chromium's Safe Browsing file-type list marks `.cfg` DANGEROUS on
    // Windows, so a browser there cannot create one of nQuake's configs. It
    // can create a `.pk3`, and ezQuake reads configs out of one just the
    // same, so they go in there and the install needs no repair step.
    const withConfigs: Manifest = {
      ...manifest,
      packages: {
        ...manifest.packages,
        gpl: {
          bytes: 40,
          files: [
            ...manifest.packages.gpl!.files,
            { path: "qw/autoexec.cfg", size: 10, sha256: "ae" },
            { path: "ezquake/configs/config.cfg", size: 4, sha256: "cc" },
            { path: "ezquake/Online Manual.url", size: 135, sha256: "url" },
          ],
        },
      },
    };
    const options = defaultOptions("windows");
    const plan = buildPlan(withConfigs, null, options);
    const dest = new MockDestination("browser", "browser-windows");
    const logs: string[] = [];
    const result = await runInstall({
      plan,
      options,
      manifest: withConfigs,
      destination: dest,
      transport: fakeTransport(() => NaN),
      installerVersion: "0.1.0",
      onLog: (e) => logs.push(e.message),
    });

    expect(result.ok).toBe(true);
    expect(result.failed).toEqual([]);

    // A client install needs no repair step at all now.
    expect(result.sidecars).toEqual([]);
    expect(result.fixupScript).toBeNull();
    expect(result.archives).toEqual(["id1/configs.pk3"]);

    const packed = result.archived.map((a) => a.dest);
    expect(packed).toContain("qw/autoexec.cfg");
    expect(packed).toContain("ezquake/configs/preset.cfg");
    expect(packed).toContain("ezquake/configs/config.cfg");

    const w = dest.written();
    expect(w).toContain("id1/configs.pk3");
    expect(w).not.toContain("qw/autoexec.cfg");
    expect(w.some((p) => p.endsWith(".nqinstall"))).toBe(false);
    // Files the browser can name are untouched.
    expect(w).toContain("ezquake.exe");

    // The archive is a real zip, with the paths relative to the game dir —
    // entries in a pack resolve against the dir the pack sits in.
    const entries = readZip(dest.bytesAt("id1/configs.pk3")!);
    expect([...entries.keys()].sort()).toEqual([
      "autoexec.cfg",
      "configs/config.cfg",
      "configs/preset.cfg",
    ]);
    expect(
      new TextDecoder().decode(entries.get("configs/preset.cfg")),
    ).toContain('name "player"');

    // The record still names the real destination, not the archive.
    const state = JSON.parse((await dest.readText("nquake-reborn.json"))!);
    expect(
      state.files.some((f: { path: string }) => f.path === "qw/autoexec.cfg"),
    ).toBe(true);

    // The `.url` shortcut is left out rather than dragging a script back in.
    expect(result.blocked.map((b) => b.dest)).toEqual([
      "ezquake/Online Manual.url",
    ]);
    const readme = (await dest.readText("README-nquake.txt"))!;
    expect(readme).not.toContain("FIRST: FINISH THE INSTALL");
    expect(logs.some((m) => m.includes("id1/configs.pk3"))).toBe(true);

    // The same plan on a surface that writes through the OS packs nothing.
    const plain = new MockDestination();
    const full = await runInstall({
      plan,
      options,
      manifest: withConfigs,
      destination: plain,
      transport: fakeTransport(() => NaN),
      installerVersion: "0.1.0",
    });
    expect(full.archives).toEqual([]);
    expect(full.archived).toEqual([]);
    expect(await plain.stat("qw/autoexec.cfg")).not.toBeNull();
    expect(await plain.stat("id1/configs.pk3")).toBeNull();
    expect(await plain.stat("ezquake/Online Manual.url")).not.toBeNull();
  });

  it("still parks server files, which no pack can carry", async () => {
    // MVDSV reads no zips at all, and LoadLibrary needs a real file, so a
    // server install keeps the repair script — it is started from a script
    // anyway, and start_servers.bat runs it.
    const options = defaultOptions("windows");
    options.target = "both";
    const plan = buildPlan(manifest, null, options);
    const dest = new MockDestination("browser", "browser-windows");
    const result = await runInstall({
      plan,
      options,
      manifest,
      destination: dest,
      transport: fakeTransport(() => NaN),
      installerVersion: "0.1.0",
    });
    const parked = result.sidecars.map((s) => s.to);
    expect(parked.some((p) => p.startsWith("ktx/"))).toBe(true);
    expect(result.fixupScript).toBe("nquake-finish.bat");
    // Client configs still went into the archive, not the script.
    expect(result.archives).toContain("id1/configs.pk3");
    expect(parked).not.toContain("ezquake/configs/preset.cfg");
  });

  it("keeps unchanged files on a second run and backs up config.cfg", async () => {
    const options = defaultOptions("windows");
    const plan = buildPlan(manifest, null, options);
    const dest = new MockDestination();
    const transport = fakeTransport(() => NaN);
    await runInstall({
      plan,
      options,
      manifest,
      destination: dest,
      transport,
      installerVersion: "0.1.0",
    });
    await dest.writeText("ezquake/configs/config.cfg", "bind x y");
    const logs: string[] = [];
    const second = await runInstall({
      plan,
      options,
      manifest,
      destination: dest,
      transport,
      installerVersion: "0.1.0",
      onLog: (e) => logs.push(e.message),
      now: () => new Date(2026, 8, 20, 13, 15, 0).getTime(),
    });
    expect(second.skipped).toBeGreaterThan(0);
    // Generated files are always rewritten.
    expect(second.written).toBeGreaterThan(0);
    expect(
      dest
        .written()
        .some((p) => p.startsWith("ezquake/configs/config-20260920-131500")),
    ).toBe(true);
    expect(logs.some((l) => l.includes("Backed up"))).toBe(true);
  });

  it("stops on cancel", async () => {
    const options = defaultOptions("windows");
    const plan = buildPlan(manifest, null, options);
    const dest = new MockDestination();
    const ctrl = new AbortController();
    const transport = createMockTransport({
      totalBytes: plan.totalBytes,
      concurrency: 2,
      bytesPerSecond: 1,
    });
    const run = runInstall({
      plan,
      options,
      manifest,
      destination: dest,
      transport,
      installerVersion: "0.1.0",
      signal: ctrl.signal,
      concurrency: 2,
    });
    setTimeout(() => ctrl.abort(), 30);
    const result = await run;
    expect(result.cancelled).toBe(true);
    expect(dest.written()).not.toContain("nquake-reborn.json");
  });
});

describe("createHttpTransport", () => {
  it("retries transient failures and gives up on 404", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls++;
      const url = String(input);
      if (url.endsWith("flaky")) {
        return calls < 3
          ? new Response("", { status: 503 })
          : new Response("ok");
      }
      return new Response("", { status: 404 });
    };
    const t = createHttpTransport(fetchImpl, { attempts: 4, baseDelayMs: 1 });
    expect(await t.text("https://x/flaky")).toBe("ok");
    expect(calls).toBe(3);
    calls = 0;
    await expect(t.text("https://x/missing")).rejects.toThrow(/HTTP 404/);
    expect(calls).toBe(1);
  });
});
