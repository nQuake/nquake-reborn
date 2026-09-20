import { describe, expect, it } from "vitest";

import { stepsFor } from "../../src/app/wizard.ts";
import { defaultOptions } from "../../src/domain/options.ts";

describe("stepsFor", () => {
  it("is Next-Next-Next in simple mode", () => {
    const o = defaultOptions("windows");
    o.target = "both";
    expect(stepsFor(o, "simple").map((s) => s.id)).toEqual([
      "welcome",
      "target",
      "folder",
      "review",
      "install",
      "done",
    ]);
  });

  it("unfolds the client and server steps in advanced mode", () => {
    const o = defaultOptions("windows");
    o.target = "both";
    expect(stepsFor(o, "advanced").map((s) => s.id)).toEqual([
      "welcome",
      "target",
      "client",
      "config",
      "server",
      "folder",
      "review",
      "install",
      "done",
    ]);
    o.target = "server";
    expect(stepsFor(o, "advanced").map((s) => s.id)).not.toContain("config");
  });

  it("starts from QuakeWorld's standard ports and the newest builds", () => {
    const o = defaultOptions("linux");
    expect(o.server.basePort).toBe(27500);
    expect(o.server.qtvPort).toBe(28000);
    expect(o.server.qwfwdPort).toBe(30000);
    expect(o.client.ezquakeSource).toBe("latest");
    expect(o.server.binariesSource).toBe("latest");
    expect(o.client.textures).toBe(true);
    expect(o.client.config.keys.forward).toBe("w");
  });
});
