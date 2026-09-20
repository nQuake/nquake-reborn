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

    const dest = new MockDestination("browser", true);
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
