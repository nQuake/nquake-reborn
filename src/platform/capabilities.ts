// The single answer to "which surface is this and can it really install?".
// Every other module asks here instead of sniffing the browser itself.
//
//   web    — a normal browser tab. A real install needs the File System
//            Access API (`showDirectoryPicker`), which only Chromium-based
//            desktop browsers ship. Elsewhere the wizard runs in MOCK mode:
//            the whole flow, simulated downloads, nothing written.
//   tauri  — the desktop app under `tauri/`. Folder picking and writing go
//            through Tauri's dialog/fs plugins, so it always installs for real.

import type { Platform } from "../domain/platform.ts";

export type Surface = "web" | "tauri";

export type MockReason =
  null | "forced" | "mobile" | "no-fs-access" | "insecure-context";

export interface Capabilities {
  surface: Surface;
  /** True when the wizard can pick a folder and write into it. */
  realInstall: boolean;
  mockReason: MockReason;
  /** Best guess at the OS the user is on; null on phones/unknowns. */
  platform: Platform | null;
  mobile: boolean;
}

interface NavigatorUA extends Navigator {
  userAgentData?: { platform?: string; mobile?: boolean };
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function detectPlatform(nav: Navigator = navigator): Platform | null {
  const uad = (nav as NavigatorUA).userAgentData;
  const p = (uad?.platform ?? nav.platform ?? "").toLowerCase();
  const ua = nav.userAgent.toLowerCase();
  if (p.startsWith("win") || ua.includes("windows")) return "windows";
  if (p.startsWith("mac") || ua.includes("mac os")) return "macos";
  if (p.includes("linux") || p.includes("x11") || ua.includes("linux")) {
    if (ua.includes("android")) return null;
    return "linux";
  }
  return null;
}

export function detectMobile(nav: Navigator = navigator): boolean {
  const uad = (nav as NavigatorUA).userAgentData;
  if (uad?.mobile !== undefined) return uad.mobile;
  const ua = nav.userAgent;
  return (
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|Opera Mini/i.test(ua) ||
    // iPadOS reports itself as a Mac; touch points give it away.
    (/Mac/i.test(ua) && nav.maxTouchPoints > 1)
  );
}

export function detectCapabilities(
  opts: { forceMock?: boolean } = {},
): Capabilities {
  const mobile = detectMobile();
  const platform = detectPlatform();
  if (isTauri()) {
    return {
      surface: "tauri",
      realInstall: !opts.forceMock,
      mockReason: opts.forceMock ? "forced" : null,
      platform,
      mobile: false,
    };
  }
  let mockReason: MockReason = null;
  if (opts.forceMock) mockReason = "forced";
  else if (mobile) mockReason = "mobile";
  else if (!window.isSecureContext) mockReason = "insecure-context";
  else if (typeof window.showDirectoryPicker !== "function")
    mockReason = "no-fs-access";
  return {
    surface: "web",
    realInstall: mockReason === null,
    mockReason,
    platform,
    mobile,
  };
}
