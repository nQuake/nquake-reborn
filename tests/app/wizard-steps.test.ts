import { describe, expect, it } from "vitest";

import {
  canProceed,
  hasNickname,
  restoredStepIndex,
  stepsFor,
  type WizardCtx,
} from "../../src/app/wizard.ts";
import {
  defaultOptions,
  type InstallOptions,
} from "../../src/domain/options.ts";

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

  it("ships no nickname — the user has to type one", () => {
    expect(defaultOptions("linux").client.config.name).toBe("");
  });
});

describe("where a restored session lands", () => {
  const steps = () => {
    const o = defaultOptions("linux");
    o.target = "both";
    return stepsFor(o, "advanced");
  };
  const at = (step: string, folderRestorable = true) =>
    steps()[restoredStepIndex(steps(), step, { folderRestorable })]?.id;

  it("puts the user back on the step they were on", () => {
    expect(at("server")).toBe("server");
    expect(at("folder")).toBe("folder");
  });

  it("never restores into a run — review is as far as it goes", () => {
    expect(at("install")).toBe("review");
    expect(at("done")).toBe("review");
  });

  it("stops at the folder step when the folder cannot be reopened", () => {
    expect(at("review", false)).toBe("folder");
    expect(at("install", false)).toBe("folder");
    // Anything before the folder step is unaffected.
    expect(at("client", false)).toBe("client");
  });

  it("starts from the top for a step this build no longer has", () => {
    expect(at("gorehouse")).toBe("welcome");
  });
});

describe("the nickname is obligatory", () => {
  // Only the two fields `canProceed` looks at for these steps.
  const ctx = (step: "target" | "config", o: InstallOptions, mode = "simple") =>
    ({ step, options: o, mode }) as unknown as WizardCtx;

  it("blocks the simple target step until one is entered", () => {
    const o = defaultOptions("linux");
    expect(hasNickname(o)).toBe(false);
    expect(canProceed(ctx("target", o))).toBe(false);
    o.client.config.name = "  ";
    expect(canProceed(ctx("target", o))).toBe(false);
    o.client.config.name = "empezar";
    expect(canProceed(ctx("target", o))).toBe(true);
  });

  it("asks on the config step instead in advanced mode", () => {
    const o = defaultOptions("linux");
    // Advanced has its own nickname field further on, so target itself is fine.
    expect(canProceed(ctx("target", o, "advanced"))).toBe(true);
    expect(canProceed(ctx("config", o, "advanced"))).toBe(false);
    o.client.config.name = "empezar";
    expect(canProceed(ctx("config", o, "advanced"))).toBe(true);
  });

  it("does not ask a server-only install", () => {
    const o = defaultOptions("linux");
    o.target = "server";
    expect(canProceed(ctx("target", o))).toBe(true);
  });
});
