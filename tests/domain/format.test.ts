import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration } from "../../src/domain/format.ts";
import { parseManifest } from "../../src/domain/manifest.ts";
import { passwordFromBytes } from "../../src/domain/options.ts";
import { FileCostMeter, RateMeter } from "../../src/domain/progress.ts";

describe("formatBytes", () => {
  it("picks sensible units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(404082070)).toBe("385 MB");
  });
});

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});

describe("RateMeter", () => {
  it("measures a rate over the window and predicts an ETA", () => {
    const m = new RateMeter(5000);
    m.add(0, 0);
    m.add(1000, 1000);
    m.add(1000, 2000);
    expect(m.rate(2000)).toBeCloseTo(1000);
    expect(m.eta(3000, 2000)).toBeCloseTo(3);
  });
});

describe("FileCostMeter", () => {
  // A file costs 150 ms of round trip plus 1 ms per 10 kB, downloaded 6 at
  // a time — the shape of a real install against raw.githubusercontent.com.
  const observe = (m: FileCostMeter, sizes: number[]) => {
    for (const bytes of sizes) m.add(bytes, 150 + bytes / 10_000);
  };

  it("says nothing until it has seen a few files", () => {
    const m = new FileCostMeter();
    expect(m.estimate(100, 1e6, 6)).toBeNull();
    observe(m, [1e6, 2e6, 5e5]);
    expect(m.estimate(100, 1e6, 6)).not.toBeNull();
  });

  it("charges the round trip for a tail of small files", () => {
    const m = new FileCostMeter();
    observe(m, [2e7, 1.5e7, 9e6, 8e6, 5e6, 1e6]);
    // 450 files of 20 kB: 450 × ~152 ms / 12 workers ≈ 5.7 s. Bytes alone
    // (9 MB at the ~130 kB/s those files transfer at) would say 70 s.
    const eta = m.estimate(450, 450 * 20_000, 12)!;
    expect(eta).toBeGreaterThan(4);
    expect(eta).toBeLessThan(8);
  });

  it("charges the bytes for a handful of big ones", () => {
    const m = new FileCostMeter();
    observe(m, [2e7, 1.5e7, 1e7, 9e6, 8e6, 5e6]);
    // 6 × 20 MB is 120 MB of transfer: ~2000 ms each, six at a time.
    const eta = m.estimate(6, 6 * 2e7, 6)!;
    expect(eta).toBeGreaterThan(1.5);
    expect(eta).toBeLessThan(3);
  });

  it("treats equal-sized samples as pure overhead, not a slope", () => {
    const m = new FileCostMeter();
    for (let i = 0; i < 5; i++) m.add(50_000, 200);
    // Nothing in the sample says what a byte costs, so an 80 MB file is not
    // extrapolated to a wild number; it is four files' worth of overhead.
    expect(m.estimate(4, 8e7, 4)).toBeCloseTo(0.2);
  });

  it("forgets what fell out of its window", () => {
    const m = new FileCostMeter(4);
    observe(m, [1e7, 1e7, 1e7]);
    for (let i = 0; i < 4; i++) m.add(10_000, 20);
    expect(m.estimate(4, 40_000, 1)).toBeCloseTo(0.08, 1);
  });
});

describe("parseManifest", () => {
  it("rejects wrong schemas and fills in bytes", () => {
    expect(() => parseManifest({ schema: 2, packages: {} })).toThrow();
    const m = parseManifest({
      schema: 1,
      packages: {
        gpl: {
          files: [
            { path: "a", size: 2 },
            { path: "b", size: 3 },
          ],
        },
      },
    });
    expect(m.packages.gpl?.bytes).toBe(5);
  });
});

describe("passwordFromBytes", () => {
  it("maps bytes onto the alphabet", () => {
    expect(passwordFromBytes(new Uint8Array([0, 1, 62]), 3)).toBe("ABA");
  });
});
