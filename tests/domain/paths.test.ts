import { describe, expect, it } from "vitest";

import { browserBlockReason } from "../../src/domain/paths.ts";

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

  it("blocks the other names the API rejects", () => {
    expect(
      browserBlockReason("qw/x.{2559a1f2-21d7-11d4-bdaf-00c04f60b9f0}"),
    ).toMatch(/CLSID/);
    expect(browserBlockReason("qw/trailing.")).toMatch(/dot/);
    expect(browserBlockReason("qw/NUL.txt")).toMatch(/reserved/);
  });
});
