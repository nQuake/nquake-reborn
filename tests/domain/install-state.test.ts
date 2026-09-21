import { describe, expect, it } from "vitest";

import {
  canReuse,
  createInstallState,
} from "../../src/domain/install-state.ts";
import { defaultOptions } from "../../src/domain/options.ts";
import type { PlanItem } from "../../src/domain/plan.ts";

const file = (dest: string, size: number, sha: string): PlanItem => ({
  dest,
  size,
  group: "client",
  side: "client" as const,
  source: {
    kind: "distfiles",
    pkg: "gpl",
    file: { path: dest, size, sha256: sha },
  },
});

describe("canReuse", () => {
  it("never reuses a missing or wrong-sized file", () => {
    expect(canReuse(file("a.pk3", 10, "x"), null, null)).toBe(false);
    expect(canReuse(file("a.pk3", 10, "x"), 9, null)).toBe(false);
  });

  it("trusts size alone for immutable data files without a record", () => {
    expect(canReuse(file("id1/pak0.pak", 10, "x"), 10, null)).toBe(true);
    expect(canReuse(file("ezquake.exe", 10, "x"), 10, null)).toBe(false);
  });

  it("compares hashes against the previous install", () => {
    const prev = createInstallState(
      defaultOptions("linux"),
      [file("ezquake.exe", 10, "old")],
      "0.1.0",
      new Date(0),
    );
    expect(canReuse(file("ezquake.exe", 10, "old"), 10, prev)).toBe(true);
    expect(canReuse(file("ezquake.exe", 10, "new"), 10, prev)).toBe(false);
  });

  it("always regenerates generated files", () => {
    const gen: PlanItem = {
      dest: "x.cfg",
      size: 3,
      group: "config",
      side: "client",
      source: { kind: "generated", text: "abc" },
    };
    expect(canReuse(gen, 3, null)).toBe(false);
  });
});
