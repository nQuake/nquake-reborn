// Everything the wizard asks, as one plain object. `buildPlan` turns it into
// the list of files to download and generate; the UI only ever edits this.

import type { Platform } from "./platform.ts";

export type InstallTarget = "client" | "server" | "both";

export type KeyLayout = "wasd" | "esdf" | "arrows" | "custom";

export interface MovementKeys {
  forward: string;
  back: string;
  left: string;
  right: string;
  jump: string;
}

export interface ClientConfig {
  /** In-game nickname (`name` cvar). */
  name: string;
  invertMouse: boolean;
  layout: KeyLayout;
  keys: MovementKeys;
}

export interface ClientOptions {
  /** `latest` pulls the newest ezQuake from the upstream mirror; `bundled` uses the copy in distfiles. */
  ezquakeSource: "latest" | "bundled";
  /** The standard 24-bit texture pack (`textures`, ~21 MB). */
  textures: boolean;
  /** The QRP high-resolution texture pack (`addon-textures`, ~400 MB). */
  hdTextures: boolean;
  teamFortress: boolean;
  clanArena: boolean;
  config: ClientConfig;
}

export interface ServerOptions {
  hostname: string;
  adminName: string;
  adminEmail: string;
  /** Public IP or FQDN; empty lets MVDSV work it out. */
  listenAddress: string;
  /** Number of KTX game ports to set up (1–64), starting at `basePort`. */
  ports: number;
  basePort: number;
  rconPassword: string;
  qtv: boolean;
  qtvPort: number;
  qtvPassword: string;
  qwfwd: boolean;
  qwfwdPort: number;
  /** `latest` pulls MVDSV + KTX from the upstream mirror; `bundled` uses `sv-bin-*` from distfiles. */
  binariesSource: "latest" | "bundled";
  /** The full community map pack (`sv-maps`, ~600 MB). GPL id1 maps always install. */
  fullMaps: boolean;
  ffa: boolean;
  clanArena: boolean;
  teamFortress: boolean;
}

export interface InstallOptions {
  target: InstallTarget;
  platform: Platform;
  /** Whether the user supplied a registered `pak1.pak` (the file itself lives outside the plan). */
  pak1: boolean;
  client: ClientOptions;
  server: ServerOptions;
}

export const KEY_LAYOUTS: Record<Exclude<KeyLayout, "custom">, MovementKeys> = {
  wasd: { forward: "w", back: "s", left: "a", right: "d", jump: "space" },
  esdf: { forward: "e", back: "d", left: "s", right: "f", jump: "space" },
  arrows: {
    forward: "uparrow",
    back: "downarrow",
    left: "leftarrow",
    right: "rightarrow",
    jump: "space",
  },
};

/** The keys the Windows installer let you pick from, plus the arrow keys. */
export const BINDABLE_KEYS: string[] = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
  "space",
  "shift",
  "ctrl",
  "alt",
  "capslock",
  "tab",
  "uparrow",
  "downarrow",
  "leftarrow",
  "rightarrow",
  "mouse1",
  "mouse2",
  "mouse3",
];

export const QUAKE_DEFAULT_PORT = 27500;
export const QTV_DEFAULT_PORT = 28000;
export const QWFWD_DEFAULT_PORT = 30000;
export const MAX_PORTS = 64;

export function defaultOptions(platform: Platform): InstallOptions {
  return {
    target: "client",
    platform,
    pak1: false,
    client: {
      ezquakeSource: "latest",
      textures: true,
      hdTextures: false,
      teamFortress: false,
      clanArena: false,
      config: {
        // ezQuake's own default; changeable in-game with /name.
        name: "player",
        invertMouse: false,
        layout: "wasd",
        keys: { ...KEY_LAYOUTS.wasd },
      },
    },
    server: {
      hostname: "nQuake KTX Server",
      adminName: "admin",
      adminEmail: "admin@example.com",
      listenAddress: "",
      ports: 2,
      basePort: QUAKE_DEFAULT_PORT,
      rconPassword: "",
      qtv: true,
      qtvPort: QTV_DEFAULT_PORT,
      qtvPassword: "",
      qwfwd: true,
      qwfwdPort: QWFWD_DEFAULT_PORT,
      binariesSource: "latest",
      fullMaps: true,
      ffa: false,
      clanArena: false,
      teamFortress: false,
    },
  };
}

export function wantsClient(o: InstallOptions): boolean {
  return o.target === "client" || o.target === "both";
}

export function wantsServer(o: InstallOptions): boolean {
  return o.target === "server" || o.target === "both";
}

/** Clamp the number of ports into the range MVDSV/KTX setups support. */
export function clampPorts(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_PORTS, Math.max(1, Math.round(n)));
}

/** Map random bytes onto the password alphabet the Linux installer used. */
export function passwordFromBytes(bytes: Uint8Array, length = 12): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length && i < bytes.length; i++) {
    out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  }
  return out;
}
