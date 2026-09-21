import { describe, expect, it } from "vitest";

import {
  attemptsFor,
  countAttempt,
  isNewBuild,
  MAX_RELOAD_ATTEMPTS,
  parseAttempt,
  parseVersionInfo,
  updateAction,
  type UpdateSituation,
} from "../../src/domain/update.ts";

describe("what counts as a new build", () => {
  it("is any difference, in either direction", () => {
    expect(isNewBuild("0.2.0.7", "0.2.0.8")).toBe(true);
    // A rollback is an update too: the deployed build is the right one.
    expect(isNewBuild("0.3.0.9", "0.2.0.8")).toBe(true);
    expect(isNewBuild("0.2.0.7", "0.2.0.7")).toBe(false);
    expect(isNewBuild("", "0.2.0.8")).toBe(false);
    expect(isNewBuild("0.2.0.7", "")).toBe(false);
  });

  it("reads version.json, and says so when it cannot", () => {
    expect(parseVersionInfo({ version: " 0.2.0.8 " })).toEqual({
      version: "0.2.0.8",
    });
    for (const junk of [null, {}, { version: 3 }, { version: "  " }, "x"]) {
      expect(() => parseVersionInfo(junk)).toThrow();
    }
  });
});

describe("when the app may reload itself", () => {
  const situation = (o: Partial<UpdateSituation> = {}): UpdateSituation => ({
    installStatus: "idle",
    losesInput: false,
    attempts: 0,
    ...o,
  });

  it("takes it quietly when nothing is at stake", () => {
    expect(updateAction(situation())).toBe("reload");
  });

  it("never interrupts a running install", () => {
    expect(updateAction(situation({ installStatus: "running" }))).toBe("hold");
    // Not even once the wizard has something to lose by waiting.
    expect(
      updateAction(situation({ installStatus: "running", losesInput: true })),
    ).toBe("hold");
  });

  it("leaves a finished install alone", () => {
    expect(updateAction(situation({ installStatus: "done" }))).toBe("hold");
  });

  it("asks instead of taking when a reload would cost the user something", () => {
    expect(updateAction(situation({ losesInput: true }))).toBe("ask");
  });

  it("offers the new build after a failed or cancelled run — it may be the fix", () => {
    expect(updateAction(situation({ installStatus: "failed" }))).toBe("ask");
    expect(updateAction(situation({ installStatus: "cancelled" }))).toBe("ask");
  });

  it("stops reloading at itself when the new build never arrives", () => {
    // A CDN can announce a build it is not serving yet; without a limit that
    // is a reload loop for as long as the caches disagree.
    expect(updateAction(situation({ attempts: MAX_RELOAD_ATTEMPTS }))).toBe(
      "ask",
    );
    expect(updateAction(situation({ attempts: MAX_RELOAD_ATTEMPTS - 1 }))).toBe(
      "reload",
    );
  });
});

describe("counting the attempts", () => {
  it("counts per target build and resets for a different one", () => {
    const first = countAttempt(null, "0.2.0.8", 10);
    expect(first).toEqual({ to: "0.2.0.8", attempts: 1, at: 10 });
    const second = countAttempt(first, "0.2.0.8", 20);
    expect(second.attempts).toBe(2);
    expect(countAttempt(second, "0.2.0.9", 30).attempts).toBe(1);
    expect(attemptsFor(second, "0.2.0.8")).toBe(2);
    expect(attemptsFor(second, "0.2.0.9")).toBe(0);
    expect(attemptsFor(null, "0.2.0.8")).toBe(0);
  });

  it("ignores a stored attempt that is not one", () => {
    expect(parseAttempt({ to: "0.2.0.8", attempts: 2, at: 1 })).toEqual({
      to: "0.2.0.8",
      attempts: 2,
      at: 1,
    });
    expect(parseAttempt({ to: "0.2.0.8", attempts: -5, at: "x" })).toEqual({
      to: "0.2.0.8",
      attempts: 0,
      at: 0,
    });
    for (const junk of [null, {}, { to: "" }, "nope"]) {
      expect(parseAttempt(junk)).toBeNull();
    }
  });
});
