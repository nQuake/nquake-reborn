import { describe, expect, it } from "vitest";

import {
  PLATFORMS,
  platformsDetectedFirst,
} from "../../src/domain/platform.ts";

describe("the platform buttons", () => {
  it("offers the detected OS first", () => {
    expect(platformsDetectedFirst("macos").map((p) => p.id)).toEqual([
      "macos",
      "windows",
      "linux",
    ]);
    expect(platformsDetectedFirst("linux").map((p) => p.id)).toEqual([
      "linux",
      "windows",
      "macos",
    ]);
  });

  it("keeps the declared order when nothing was detected", () => {
    expect(platformsDetectedFirst(null)).toEqual(PLATFORMS);
    expect(platformsDetectedFirst("windows")).toEqual(PLATFORMS);
  });

  it("offers every platform exactly once", () => {
    const ids = platformsDetectedFirst("macos").map((p) => p.id);
    expect(new Set(ids).size).toBe(PLATFORMS.length);
  });
});
