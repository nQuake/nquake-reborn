import { describe, expect, it } from "vitest";

import {
  archiveFor,
  browserBlockReason,
  resolveName,
} from "../../src/domain/paths.ts";

describe("browserBlockReason", () => {
  it("blocks the extensions Chromium's file system API refuses", () => {
    // The file that made a real install report a failure.
    expect(browserBlockReason("ezquake/Online Manual.url")).toMatch(/\.url/);
    expect(browserBlockReason("qw/shortcut.LNK")).toMatch(/\.lnk/);
    expect(browserBlockReason("qw/x.scf")).toMatch(/\.scf/);
  });

  it("allows spaces — they were never the problem", () => {
    expect(
      browserBlockReason(
        "ktx/configs/usermodes/dmm4cfgs for Rocket Arena maps.txt",
      ),
    ).toBeNull();
    expect(browserBlockReason("ktx/modes/DONT EDIT")).toBeNull();
  });

  it("allows everything else nQuake ships", () => {
    for (const path of [
      "id1/pak0.pak",
      "ezquake.exe",
      "ezQuake-x86_64.AppImage",
      "ezQuake.app/Contents/MacOS/ezQuake",
      "qw/nquake.pk3",
      "ktx/qwprogs.so",
      "start_servers.sh",
      ".gitkeep",
    ]) {
      expect(browserBlockReason(path)).toBeNull();
    }
  });

  it("blocks .cfg and .dll for a browser running on Windows only", () => {
    // Safe Browsing's download_file_types.asciipb marks cfg/dll/ini/manifest
    // DANGEROUS on PLATFORM_TYPE_WINDOWS, and IsSafePathComponent refuses
    // anything DANGEROUS. The same browser on Linux writes them happily.
    for (const path of [
      "qw/autoexec.cfg",
      "ezquake/configs/config.cfg",
      "ktx/qwprogs.dll",
      "qw/settings.ini",
      "qw/app.manifest",
    ]) {
      expect(browserBlockReason(path, "browser-windows")).toMatch(/Windows/);
      expect(browserBlockReason(path, "browser")).toBeNull();
      expect(browserBlockReason(path, "none")).toBeNull();
    }
    // Not on the list, whatever it looks like.
    expect(browserBlockReason("qw/qwprogs.so", "browser-windows")).toBeNull();
    expect(
      browserBlockReason("start_servers.bat", "browser-windows"),
    ).toBeNull();
  });

  it("packs a blocked config into the archive ezQuake can read", () => {
    expect(resolveName("qw/autoexec.cfg", "none")).toEqual({
      kind: "write",
      path: "qw/autoexec.cfg",
    });
    expect(resolveName("qw/autoexec.cfg", "browser")).toEqual({
      kind: "write",
      path: "qw/autoexec.cfg",
    });

    // The three dirs ezQuake always searches share one archive, and it goes
    // in id1 so a loose config.cfg written on quit outranks the packed copy.
    for (const [dest, entry] of [
      ["qw/autoexec.cfg", "autoexec.cfg"],
      ["ezquake/configs/config.cfg", "configs/config.cfg"],
      ["id1/x.cfg", "x.cfg"],
    ] as const) {
      expect(resolveName(dest, "browser-windows")).toEqual({
        kind: "archive",
        archive: "id1/configs.pk3",
        entry,
        reason: expect.stringContaining("Windows"),
      });
    }

    // A mod dir gets its own, or prox's config.cfg would collide with
    // ezquake's once the prefix is gone.
    expect(archiveFor("prox/configs/config.cfg")).toEqual({
      archive: "prox/configs.pk3",
      entry: "configs/config.cfg",
    });
    expect(archiveFor("fortress/default.cfg")).toEqual({
      archive: "fortress/configs.pk3",
      entry: "default.cfg",
    });

    // Server dirs are never packed: MVDSV reads no zips, and the mod library
    // has to be a real file for LoadLibrary. Those keep the repair script.
    expect(archiveFor("ktx/port1.cfg")).toBeNull();
    expect(archiveFor("qtv/qtv.cfg")).toBeNull();
    expect(resolveName("ktx/qwprogs.dll", "browser-windows")).toEqual({
      kind: "sidecar",
      path: "ktx/qwprogs.dll.nqinstall",
      reason: expect.stringContaining("Windows"),
    });
  });

  it("packs only the client's half — a path cannot tell you which it is", () => {
    // `fortress/` holds a client config (addon-fortress) *and* the TF
    // server's (sv-fortress). Packing the server's would hide it from MVDSV,
    // which reads .pak but no zip at all, so the side decides, not the dir.
    expect(archiveFor("fortress/default.cfg", "client")).toEqual({
      archive: "fortress/configs.pk3",
      entry: "default.cfg",
    });
    expect(archiveFor("fortress/default.cfg", "server")).toBeNull();
    expect(archiveFor("cace/ca.cfg", "server")).toBeNull();
    expect(archiveFor("qw/autoexec.cfg", "server")).toBeNull();

    // A server config falls through to the repair script it was always going
    // to need, rather than into a pack nothing on that side can open.
    expect(resolveName("cace/ca.cfg", "browser-windows", "server")).toEqual({
      kind: "sidecar",
      path: "cace/ca.cfg.nqinstall",
      reason: expect.stringContaining("Windows"),
    });
  });

  it("drops a shortcut rather than making anyone run a script for it", () => {
    // `.url` is refused on every OS and nothing in nQuake reads it, so it is
    // left out everywhere — a bookmark is not worth a repair step.
    for (const rules of ["browser", "browser-windows"] as const) {
      expect(resolveName("ezquake/Online Manual.url", rules).kind).toBe("drop");
    }
    // The desktop app writes it, like everything else.
    expect(resolveName("ezquake/Online Manual.url", "none")).toEqual({
      kind: "write",
      path: "ezquake/Online Manual.url",
    });
  });

  it("never packs anything on a surface that writes through the OS", () => {
    for (const dest of [
      "qw/autoexec.cfg",
      "ezquake/configs/preset.cfg",
      "prox/configs/config.cfg",
      "ktx/qwprogs.dll",
      "ezquake/Online Manual.url",
    ]) {
      expect(resolveName(dest, "none")).toEqual({ kind: "write", path: dest });
    }
  });

  it("blocks the other names the API rejects", () => {
    expect(
      browserBlockReason("qw/x.{2559a1f2-21d7-11d4-bdaf-00c04f60b9f0}"),
    ).toMatch(/CLSID/);
    expect(browserBlockReason("qw/trailing.")).toMatch(/dot/);
    expect(browserBlockReason("qw/NUL.txt")).toMatch(/reserved/);
  });
});
