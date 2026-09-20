import { describe, expect, it } from "vitest";

import { formatBytes, formatDuration } from "../../src/domain/format.ts";
import { parseManifest } from "../../src/domain/manifest.ts";
import { passwordFromBytes } from "../../src/domain/options.ts";
import { RateMeter } from "../../src/domain/progress.ts";

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
