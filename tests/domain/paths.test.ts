import { describe, expect, it } from "vitest";

import { browserBlockReason, resolveName } from "../../src/domain/paths.ts";

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

  it("parks a blocked name beside its destination on Windows, drops it elsewhere", () => {
    expect(resolveName("qw/autoexec.cfg", "none")).toEqual({
      kind: "write",
      path: "qw/autoexec.cfg",
    });
    expect(resolveName("qw/autoexec.cfg", "browser")).toEqual({
      kind: "write",
      path: "qw/autoexec.cfg",
    });
    const parked = resolveName("qw/autoexec.cfg", "browser-windows");
    expect(parked.kind).toBe("sidecar");
    expect(parked.kind === "sidecar" && parked.path).toBe(
      "qw/autoexec.cfg.nqinstall",
    );
    // The suffix has to be a name the same rules allow, or this is no help.
    expect(
      browserBlockReason("qw/autoexec.cfg.nqinstall", "browser-windows"),
    ).toBeNull();

    // A `.url` shortcut is worth nothing off Windows, so there it is dropped.
    expect(resolveName("ezquake/Online Manual.url", "browser").kind).toBe(
      "drop",
    );
    expect(
      resolveName("ezquake/Online Manual.url", "browser-windows").kind,
    ).toBe("sidecar");
  });

  it("blocks the other names the API rejects", () => {
    expect(
      browserBlockReason("qw/x.{2559a1f2-21d7-11d4-bdaf-00c04f60b9f0}"),
    ).toMatch(/CLSID/);
    expect(browserBlockReason("qw/trailing.")).toMatch(/dot/);
    expect(browserBlockReason("qw/NUL.txt")).toMatch(/reserved/);
  });
});
