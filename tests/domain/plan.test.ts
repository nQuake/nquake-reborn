import { describe, expect, it } from "vitest";

import type { Manifest } from "../../src/domain/manifest.ts";
import { defaultOptions } from "../../src/domain/options.ts";
import { buildPlan, renderTemplate } from "../../src/domain/plan.ts";
import type { Upstream } from "../../src/domain/upstream.ts";

function pkg(paths: [string, number][]) {
  return {
    bytes: paths.reduce((n, [, s]) => n + s, 0),
    files: paths.map(([path, size]) => ({ path, size, sha256: `h-${path}` })),
  };
}

const manifest: Manifest = {
  schema: 1,
  generated: "",
  commit: "abc",
  packages: {
    qsw106: pkg([
      ["ID1/PAK0.PAK", 18689235],
      ["QUAKE.EXE", 1],
    ]),
    gpl: pkg([
      ["ezquake.exe", 100],
      ["id1/gpl_maps.pk3", 200],
      ["id1/readme.txt", 10],
      ["ezquake/ezquake.pk3", 300],
    ]),
    "non-gpl": pkg([
      ["qw/nquake.pk3", 500],
      ["ezquake/sb/wget.exe", 50],
    ]),
    textures: pkg([["qw/textures.pk3", 1000]]),
    "addon-textures": pkg([["qw/qrp1.pk3", 5000]]),
    "addon-fortress": pkg([["fortress/pak0.pak", 700]]),
    "addon-clanarena": pkg([["arena/arena.pk3", 60]]),
    linux: pkg([
      ["ezquake/configs/platform.cfg", 5],
      ["ezquake-ubuntu-3.2.2.tar.gz", 999],
    ]),
    macosx: pkg([
      ["ezquake/configs/platform.cfg", 5],
      ["ezQuake.app/Contents/MacOS/ezQuake", 800],
    ]),
    "sv-gpl": pkg([
      ["ktx/port_template.cfg", 40],
      ["qtv/qtv_template.cfg", 30],
      ["addons/install_ffa.sh", 9],
      ["ktx/mvdfinish.qws", 3],
    ]),
    "sv-non-gpl": pkg([["ktx/progs/x.mdl", 20]]),
    "sv-configs": pkg([["ktx/server.cfg", 20]]),
    "sv-maps-gpl": pkg([["qw/maps/dm4.bsp", 20]]),
    "sv-maps": pkg([["qw/maps/aerowalk.bsp", 2000]]),
    "sv-bin-win32": pkg([
      ["mvdsv.exe", 11],
      ["ktx/qwprogs.dll", 12],
      ["qtv/qtv.exe", 13],
      ["qwfwd/qwfwd.exe", 14],
    ]),
    "sv-bin-x64": pkg([
      ["mvdsv", 11],
      ["ktx/qwprogs.so", 12],
      ["qtv/qtv.bin", 13],
      ["qwfwd/qwfwd.bin", 14],
    ]),
    "sv-ffa": pkg([
      ["ffa/port1.cfg", 8],
      ["ffa/ktx.cfg", 8],
    ]),
    "sv-ca": pkg([["cace/port1.cfg", 8]]),
    "sv-fortress": pkg([["fortress/port1.cfg", 8]]),
  },
};

const upstream: Upstream = {
  schema: 1,
  generated: "",
  components: {
    ezquake: {
      version: "3.6.9",
      publishedAt: "",
      targets: {
        "windows-x64": {
          asset: "w.zip",
          bytes: 1,
          files: [{ path: "ezquake.exe", size: 1, sha256: "e" }],
        },
        "linux-x86_64": {
          asset: "l.zip",
          bytes: 2,
          files: [{ path: "ezQuake-x86_64.AppImage", size: 2, sha256: "e" }],
        },
      },
    },
    mvdsv: {
      version: "1.11",
      publishedAt: "",
      targets: {
        "linux-amd64": {
          asset: "mvdsv_linux_amd64",
          bytes: 4,
          files: [{ path: "mvdsv", size: 4, sha256: "m" }],
        },
      },
    },
    ktx: {
      version: "1.47",
      publishedAt: "",
      targets: {
        "linux-amd64": {
          asset: "k.zip",
          bytes: 5,
          files: [{ path: "ktx/qwprogs.so", size: 5, sha256: "k" }],
        },
      },
    },
  },
};

const dests = (plan: ReturnType<typeof buildPlan>) =>
  plan.items.map((i) => i.dest);

describe("buildPlan — client", () => {
  it("takes only pak0 from the shareware and renames it", () => {
    const plan = buildPlan(manifest, upstream, defaultOptions("windows"));
    expect(dests(plan)).toContain("id1/pak0.pak");
    expect(dests(plan)).not.toContain("QUAKE.EXE");
  });

  it("replaces the bundled ezquake.exe with the upstream one on Windows", () => {
    const plan = buildPlan(manifest, upstream, defaultOptions("windows"));
    const exe = plan.items.filter((i) => i.dest === "ezquake.exe");
    expect(exe).toHaveLength(1);
    expect(exe[0]?.source.kind).toBe("upstream");
    expect(plan.notes).toHaveLength(0);
  });

  it("falls back to the bundled ezquake.exe when the mirror is unavailable", () => {
    const plan = buildPlan(manifest, null, defaultOptions("windows"));
    const exe = plan.items.find((i) => i.dest === "ezquake.exe");
    expect(exe?.source.kind).toBe("distfiles");
    expect(plan.notes[0]).toMatch(/bundled/);
  });

  it("skips Windows-only files and the old tarball on Linux", () => {
    const plan = buildPlan(manifest, upstream, defaultOptions("linux"));
    const d = dests(plan);
    expect(d).not.toContain("ezquake.exe");
    expect(d).not.toContain("ezquake/sb/wget.exe");
    expect(d).not.toContain("ezquake-ubuntu-3.2.2.tar.gz");
    expect(d).toContain("ezquake/configs/platform.cfg");
    const app = plan.items.find((i) => i.dest === "ezQuake-x86_64.AppImage");
    expect(app?.executable).toBe(true);
    // A browser cannot chmod that AppImage, so the launcher does it instead.
    const launch = plan.items.find((i) => i.dest === "start_ezquake.sh");
    expect(launch?.executable).toBe(true);
    expect(launch?.source.kind).toBe("generated");
  });

  it("generates the client launcher on macOS but not on Windows", () => {
    const mac = dests(buildPlan(manifest, upstream, defaultOptions("macos")));
    expect(mac).toContain("start_ezquake.sh");
    const win = dests(buildPlan(manifest, upstream, defaultOptions("windows")));
    expect(win).not.toContain("start_ezquake.sh");
  });

  it("drops the GPL maps and readme when pak1 is supplied", () => {
    const o = defaultOptions("windows");
    o.pak1 = true;
    const plan = buildPlan(manifest, upstream, o);
    const d = dests(plan);
    expect(d).toContain("id1/pak1.pak");
    expect(d).not.toContain("id1/gpl_maps.pk3");
    expect(d).not.toContain("id1/readme.txt");
    expect(plan.items.find((i) => i.dest === "id1/pak1.pak")?.source.kind).toBe(
      "user",
    );
  });

  it("adds addons and textures on request and counts bytes", () => {
    const o = defaultOptions("windows");
    o.client.hdTextures = true;
    o.client.teamFortress = true;
    o.client.clanArena = true;
    const plan = buildPlan(manifest, upstream, o);
    const d = dests(plan);
    expect(d).toContain("qw/qrp1.pk3");
    expect(d).toContain("fortress/pak0.pak");
    expect(d).toContain("arena/arena.pk3");
    expect(d).toContain("ezquake/configs/preset.cfg");
    const groups = Object.fromEntries(plan.groups.map((g) => [g.id, g.bytes]));
    expect(groups["hd-textures"]).toBe(5000);
    // QRP overrides the 24-bit pack, so that one is left out.
    expect(groups.textures).toBeUndefined();
    expect(plan.downloadBytes).toBeLessThan(plan.totalBytes);
  });

  it("does not install any server files for a client install", () => {
    const plan = buildPlan(manifest, upstream, defaultOptions("windows"));
    expect(dests(plan).some((d) => d.startsWith("ktx/"))).toBe(false);
    expect(plan.servers).toHaveLength(0);
  });
});

describe("buildPlan — server", () => {
  it("lays out ports, addons, binaries and generated configs on Linux", () => {
    const o = defaultOptions("linux");
    o.target = "server";
    o.server.ports = 2;
    o.server.ffa = true;
    o.server.teamFortress = true;
    const plan = buildPlan(manifest, upstream, o);
    const d = dests(plan);
    expect(plan.servers.map((s) => [s.id, s.port])).toEqual([
      ["ktx1", 27500],
      ["ktx2", 27501],
      ["ffa", 27502],
      ["fortress", 27503],
    ]);
    expect(d).toContain("ktx/port1.cfg");
    expect(d).toContain("ktx/port2.cfg");
    expect(d).toContain("ktx/pwd.cfg");
    expect(d).toContain("qtv/qtv.cfg");
    expect(d).toContain("qwfwd/qwfwd.cfg");
    expect(d).toContain("start_servers.sh");
    expect(d).toContain("run/ffa_27502.sh");
    expect(d).not.toContain("addons/install_ffa.sh");
    expect(d).toContain("qw/maps/aerowalk.bsp");
    // Upstream mvdsv + ktx replace the bundled ones; qtv/qwfwd stay bundled.
    const mvdsv = plan.items.filter((i) => i.dest === "mvdsv");
    expect(mvdsv).toHaveLength(1);
    expect(mvdsv[0]?.source.kind).toBe("upstream");
    expect(
      plan.items.find((i) => i.dest === "ktx/qwprogs.so")?.source.kind,
    ).toBe("upstream");
    expect(plan.items.find((i) => i.dest === "qtv/qtv.bin")?.source.kind).toBe(
      "distfiles",
    );
    // Addon cfgs are templated.
    const ffaCfg = plan.items.find((i) => i.dest === "ffa/port1.cfg");
    expect(ffaCfg?.source.kind).toBe("template");
    expect(d).not.toContain("ezquake/configs/preset.cfg");
    expect(
      plan.notes.some((n) => n.includes("UDP 27500, 27501, 27502, 27503")),
    ).toBe(true);
  });

  it("uses win32 bundled binaries when the mirror lacks Windows builds", () => {
    const o = defaultOptions("windows");
    o.target = "server";
    o.server.qtv = false;
    o.server.qwfwd = false;
    o.server.fullMaps = false;
    const plan = buildPlan(manifest, upstream, o);
    const d = dests(plan);
    expect(plan.items.find((i) => i.dest === "mvdsv.exe")?.source.kind).toBe(
      "distfiles",
    );
    expect(d).not.toContain("qtv/qtv.exe");
    expect(d).not.toContain("qwfwd/qwfwd.exe");
    expect(d).not.toContain("qw/maps/aerowalk.bsp");
    expect(d).toContain("start_servers.bat");
    expect(plan.notes.some((n) => n.includes("MVDSV/KTX"))).toBe(true);
  });

  it("installs both client and server in one folder", () => {
    const o = defaultOptions("linux");
    o.target = "both";
    const plan = buildPlan(manifest, upstream, o);
    const d = dests(plan);
    expect(d).toContain("ezquake/configs/preset.cfg");
    expect(d).toContain("ktx/port1.cfg");
    expect(d.filter((x) => x === "id1/pak0.pak")).toHaveLength(1);
  });

  it("renders templates through the transform", () => {
    const o = defaultOptions("linux");
    o.target = "server";
    const plan = buildPlan(manifest, upstream, o);
    const item = plan.items.find((i) => i.dest === "ktx/port1.cfg")!;
    if (item.source.kind !== "template") throw new Error("expected template");
    const text = renderTemplate(
      'set k_motd2 "x"\n',
      item.source.transform,
      o,
      plan.servers,
    );
    expect(text).toContain('hostname "nQuake KTX Server:27500"');
  });
});
