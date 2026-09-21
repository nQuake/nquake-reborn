import { describe, expect, it } from "vitest";

import { defaultOptions } from "../../src/domain/options.ts";
import {
  captureSession,
  folderIsRestorable,
  parseSession,
  sanitizeOptions,
  SESSION_MAX_AGE_MS,
  SESSION_SCHEMA,
} from "../../src/domain/session.ts";

const NOW = 1_800_000_000_000;

function saved(overrides: Record<string, unknown> = {}) {
  const options = defaultOptions("linux");
  options.client.config.name = "empezar";
  options.target = "both";
  return {
    ...captureSession({
      build: "0.2.0.7",
      reason: "update",
      target: "0.2.0.8",
      mode: "advanced",
      step: "server",
      options,
      folder: {
        kind: "tauri",
        path: "/home/e/nquake",
        name: "nquake",
        useSubfolder: false,
      },
      pak1Name: "pak1.pak",
      now: NOW,
    }),
    ...overrides,
  };
}

describe("a session across a reload", () => {
  it("comes back exactly as it went in", () => {
    const back = parseSession(JSON.parse(JSON.stringify(saved())), {
      platform: "windows",
      now: NOW + 1000,
    });
    expect(back).not.toBeNull();
    expect(back?.mode).toBe("advanced");
    expect(back?.step).toBe("server");
    expect(back?.reason).toBe("update");
    expect(back?.target).toBe("0.2.0.8");
    // The platform stored in the options wins over what this load detected:
    // it is what the user's answers were built for.
    expect(back?.options.platform).toBe("linux");
    expect(back?.options.client.config.name).toBe("empezar");
    expect(back?.options.target).toBe("both");
    expect(back?.folder?.path).toBe("/home/e/nquake");
    expect(back?.pak1Name).toBe("pak1.pak");
  });

  it("keeps the generated passwords, which the user may have written down", () => {
    const s = saved();
    s.options.server.rconPassword = "hunter2hunter";
    s.options.server.qtvPassword = "qtvqtvqtvqtv";
    const back = parseSession(s, { platform: "linux", now: NOW });
    expect(back?.options.server.rconPassword).toBe("hunter2hunter");
    expect(back?.options.server.qtvPassword).toBe("qtvqtvqtvqtv");
  });

  it("never claims a pak1.pak came back — the file cannot", () => {
    const s = saved();
    s.options.pak1 = true;
    const back = parseSession(s, { platform: "linux", now: NOW });
    expect(back?.options.pak1).toBe(false);
    expect(back?.pak1Name).toBe("pak1.pak");
  });

  it("drops a session from another schema, a stale one, and rubbish", () => {
    expect(
      parseSession(saved({ schema: SESSION_SCHEMA + 1 }), {
        platform: "linux",
        now: NOW,
      }),
    ).toBeNull();
    expect(
      parseSession(saved(), {
        platform: "linux",
        now: NOW + SESSION_MAX_AGE_MS + 1,
      }),
    ).toBeNull();
    for (const junk of [null, "nope", 7, [], {}, { schema: SESSION_SCHEMA }]) {
      expect(parseSession(junk, { platform: "linux", now: NOW })).toBeNull();
    }
  });
});

describe("options out of storage", () => {
  // The whole point of the reload is that the *code* changed, so the options
  // it reads back were written by a build that knew a different set.
  it("fills in what an older build never saved", () => {
    const old = {
      target: "server",
      platform: "macos",
      client: { config: { name: "vvd" } },
      server: { hostname: "old server", ports: 3 },
    };
    const o = sanitizeOptions(old, "windows");
    expect(o.target).toBe("server");
    expect(o.platform).toBe("macos");
    expect(o.server.hostname).toBe("old server");
    expect(o.server.ports).toBe(3);
    expect(o.client.config.name).toBe("vvd");
    // Untouched by the stored blob: straight from today's defaults.
    expect(o.client.textures).toBe(true);
    expect(o.server.basePort).toBe(27500);
    expect(o.client.config.keys.forward).toBe("w");
  });

  it("refuses values that would build a broken plan", () => {
    const o = sanitizeOptions(
      {
        target: "everything",
        platform: "amiga",
        client: { textures: "yes", config: { layout: "dvorak" } },
        server: {
          ports: 900,
          basePort: 0,
          qtvPort: -1,
          qwfwdPort: 99999,
          binariesSource: "sideloaded",
        },
      },
      "linux",
    );
    expect(o.target).toBe("client");
    expect(o.platform).toBe("linux");
    expect(o.client.textures).toBe(true);
    expect(o.client.config.layout).toBe("wasd");
    expect(o.server.ports).toBe(64);
    expect(o.server.basePort).toBe(27500);
    expect(o.server.qtvPort).toBe(28000);
    expect(o.server.qwfwdPort).toBe(30000);
    expect(o.server.binariesSource).toBe("latest");
  });
});

describe("which folders survive a reload", () => {
  const folder = (kind: "fs-access" | "tauri" | "mock", path: string | null) =>
    ({ kind, path, name: "nquake", useSubfolder: false }) as const;

  it("is about whether the surface knows a path", () => {
    expect(folderIsRestorable(null)).toBe(true);
    expect(folderIsRestorable(folder("tauri", "/home/e/nquake"))).toBe(true);
    expect(folderIsRestorable(folder("mock", null))).toBe(true);
    // The File System Access API grants a handle to one page, not to an origin.
    expect(folderIsRestorable(folder("fs-access", null))).toBe(false);
    expect(folderIsRestorable(folder("tauri", null))).toBe(false);
  });
});
