// The operating system an install is *for*. Detected from the browser by
// `platform/capabilities.ts`, overridable in the UI (you may well be
// preparing a server folder on a laptop that isn't the server).

export type Platform = "windows" | "linux" | "macos";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
  { id: "macos", label: "macOS" },
];

export function platformLabel(p: Platform): string {
  return PLATFORMS.find((x) => x.id === p)?.label ?? p;
}

/** Upstream mirror target ids per component and platform. */
export const UPSTREAM_TARGET: Record<
  "ezquake" | "mvdsv" | "ktx",
  Record<Platform, string | null>
> = {
  ezquake: {
    windows: "windows-x64",
    linux: "linux-x86_64",
    macos: "macos-universal",
  },
  // MVDSV/KTX publish no macOS binaries; a macOS *server* keeps the
  // bundled files only (there are none for macOS either — see plan.ts).
  mvdsv: { windows: "windows-x64", linux: "linux-amd64", macos: null },
  ktx: { windows: "windows-x64", linux: "linux-amd64", macos: null },
};
