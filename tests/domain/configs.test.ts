import { describe, expect, it } from "vitest";

import {
  applyPlaceholders,
  renderClientLaunchScript,
  renderFixupScript,
  renderKtxPortCfg,
  renderPresetCfg,
  renderPwdCfg,
  renderQtvCfg,
  renderStartScripts,
  serverPlaceholders,
} from "../../src/domain/configs.ts";
import { defaultOptions } from "../../src/domain/options.ts";

describe("renderPresetCfg", () => {
  it("writes name, mouse and movement binds", () => {
    const o = defaultOptions("windows");
    o.client.config.name = "Empezar";
    o.client.config.invertMouse = true;
    const cfg = renderPresetCfg(o.client.config, "windows");
    expect(cfg).toContain('name "Empezar"');
    expect(cfg).toContain('m_pitch "-0.022"');
    expect(cfg).toContain('bind w "+forward"');
    expect(cfg).toContain('bind space "+jump"');
    expect(cfg).toContain("\r\n");
  });

  it("uses LF on Linux and escapes quotes in the name", () => {
    const o = defaultOptions("linux");
    o.client.config.name = 'a"b';
    const cfg = renderPresetCfg(o.client.config, "linux");
    expect(cfg).not.toContain("\r\n");
    expect(cfg).toContain('name "a\'b"');
    expect(cfg).toContain('cl_fakename "a\'b"');
    // (Three characters long already, so the abbreviation is the whole name.)
  });

  it("abbreviates the nickname into cl_fakename, and says why", () => {
    // nquake_default.cfg sets cl_fakename "pla", and ezQuake rewrites every
    // say_team as <cl_fakename><suffix><message> — so without this every
    // team message reads "PLA: ..." no matter what `name` says. Three
    // characters is nQuake's own length, and the point of the cvar: a team
    // message is only so wide, and the width belongs to the message.
    const o = defaultOptions("linux");
    o.client.config.name = "terryb";
    const cfg = renderPresetCfg(o.client.config, "linux");
    expect(cfg).toContain('name "terryb"');
    expect(cfg).toContain('cl_fakename "ter"');
    // It only wins because preset.cfg is exec'd after nquake_default.cfg,
    // which is worth a comment in a file a player will open one day.
    expect(cfg).toMatch(/\/\/ Team messages \(say_team\)/);
    expect(cfg).toContain("PLA:");

    // An empty nickname falls back to the default, abbreviated the same way.
    o.client.config.name = "   ";
    const fallback = renderPresetCfg(o.client.config, "linux");
    expect(fallback).toContain('name "Player"');
    expect(fallback).toContain('cl_fakename "Pla"');

    // A nickname shorter than the abbreviation is used whole, and a cut that
    // lands after a space does not leave the space behind.
    o.client.config.name = "ic";
    expect(renderPresetCfg(o.client.config, "linux")).toContain(
      'cl_fakename "ic"',
    );
    o.client.config.name = "ab cd";
    expect(renderPresetCfg(o.client.config, "linux")).toContain(
      'cl_fakename "ab"',
    );
  });
});

describe("server configs", () => {
  const o = defaultOptions("linux");
  o.server.hostname = "Test Server";
  o.server.adminName = "bob";
  o.server.adminEmail = "bob@example.com";
  o.server.rconPassword = "secret";
  o.server.qtvPassword = "qtvsecret";

  it("appends generated info to the KTX port template", () => {
    const cfg = renderKtxPortCfg(
      'set k_motd2 "x"\r\n',
      o.server,
      27500,
      "linux",
    );
    expect(cfg.startsWith('set k_motd2 "x"\n')).toBe(true);
    expect(cfg).toContain('hostname "Test Server:27500"');
    expect(cfg).toContain('sv_admininfo "bob <bob@example.com>"');
    expect(cfg).toContain('qtv_streamport "27500"');
    expect(cfg).not.toContain("sv_serverip");
  });

  it("includes the listen address when given", () => {
    const withIp = { ...o.server, listenAddress: "1.2.3.4" };
    const cfg = renderKtxPortCfg("", withIp, 27501, "windows");
    expect(cfg).toContain('sv_serverip "1.2.3.4"');
    expect(cfg).toContain('set hostport "1.2.3.4:27501"');
    expect(cfg).toContain("\r\n");
  });

  it("writes passwords", () => {
    expect(renderPwdCfg(o.server, "linux")).toContain('rcon_password "secret"');
  });

  it("lists every game server in qtv.cfg", () => {
    const cfg = renderQtvCfg(
      "maxclients 100",
      o.server,
      [
        {
          id: "ktx1",
          label: "KTX #1",
          port: 27500,
          game: "ktx",
          cfg: "port1.cfg",
        },
        { id: "ffa", label: "FFA", port: 27501, game: "ffa", cfg: "port1.cfg" },
      ],
      "linux",
    );
    expect(cfg).toContain("qtv 127.0.0.1:27500");
    expect(cfg).toContain("qtv 127.0.0.1:27501");
    expect(cfg).toContain('admin_password "qtvsecret"');
    expect(cfg).toContain("mvdport 28000");
  });

  it("fills the addon placeholders", () => {
    const vars = serverPlaceholders(o.server, 27600);
    const out = applyPlaceholders(
      'hostname "NQUAKESV_HOSTNAME" // NQUAKESV_PORT NQUAKESV_ADMIN NQUAKESV_IP',
      vars,
    );
    expect(out).toBe('hostname "Test Server" // 27600 bob <bob@example.com> ');
  });
});

describe("renderStartScripts", () => {
  const servers = [
    { id: "ktx1", label: "KTX #1", port: 27500, game: "ktx", cfg: "port1.cfg" },
    {
      id: "fortress",
      label: "Team Fortress",
      port: 27501,
      game: "fortress",
      cfg: "port1.cfg",
    },
  ];

  it("writes batch files on Windows", () => {
    const o = defaultOptions("windows");
    const files = renderStartScripts("windows", o.server, servers);
    const start = files.find((f) => f.path === "start_servers.bat");
    expect(start?.text).toContain(
      "mvdsv.exe -port 27500 -game ktx +exec port1.cfg",
    );
    expect(start?.text).toContain("-game fortress");
    expect(start?.text).toContain("qtv.exe");
    // A browser install on Windows cannot name qwprogs.dll or any port cfg;
    // starting the servers runs the fixup first so the user never has to.
    expect(start?.text).toContain(
      'if exist "%~dp0nquake-finish.bat" call "%~dp0nquake-finish.bat" /quiet',
    );
    expect(files.some((f) => f.path === "start_ktx1_27500.bat")).toBe(true);
    expect(files.every((f) => !f.executable)).toBe(true);
  });

  it("writes restart-loop runners and chmods them on Linux", () => {
    const o = defaultOptions("linux");
    o.server.qwfwd = false;
    const files = renderStartScripts("linux", o.server, servers);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("run/ktx1_27500.sh");
    expect(paths).toContain("run/qtv.sh");
    expect(paths).not.toContain("run/qwfwd.sh");
    const start = files.find((f) => f.path === "start_servers.sh")!;
    expect(start.executable).toBe(true);
    expect(start.text).toContain("chmod +x mvdsv");
    expect(start.text).not.toContain("qwfwd.bin");
  });
});

describe("renderClientLaunchScript", () => {
  it("chmods the AppImage and itself before running it on Linux", () => {
    const script = renderClientLaunchScript("linux")!;
    expect(script.path).toBe("start_ezquake.sh");
    expect(script.executable).toBe(true);
    expect(script.text).toContain("APP=./ezQuake-x86_64.AppImage");
    // The bit is set before the launch, and on the script itself so that a
    // browser install needs `sh start_ezquake.sh` only the first time.
    const chmod = script.text.indexOf('chmod +x "$0" "$APP"');
    expect(chmod).toBeGreaterThan(-1);
    expect(script.text.indexOf('exec "$APP"')).toBeGreaterThan(chmod);
    // Any AppImage will do when the mirror named a different one.
    expect(script.text).toContain("*.AppImage");
  });

  it("clears the quarantine flag as well on macOS", () => {
    const script = renderClientLaunchScript("macos")!;
    expect(script.executable).toBe(true);
    expect(script.text).toContain('chmod +x "$0" ezQuake.app/Contents/MacOS/*');
    expect(script.text).toContain("xattr -dr com.apple.quarantine ezQuake.app");
    expect(script.text).toContain("exec open ezQuake.app");
  });

  it("writes nothing on Windows, where the bit does not exist", () => {
    expect(renderClientLaunchScript("windows")).toBeNull();
  });
});

describe("renderFixupScript", () => {
  const renames = [
    { from: "qw/autoexec.cfg.nqinstall", to: "qw/autoexec.cfg" },
    { from: "ktx/qwprogs.dll.nqinstall", to: "ktx/qwprogs.dll" },
  ];

  it("moves every parked file back under its real name", () => {
    const script = renderFixupScript(renames);
    expect(script.path).toBe("nquake-finish.bat");
    expect(script.text).toContain("\r\n");
    expect(script.text).toContain('cd /d "%~dp0"');
    expect(script.text).toContain(
      'if exist "qw\\autoexec.cfg.nqinstall" move /y "qw\\autoexec.cfg.nqinstall" "qw\\autoexec.cfg" >nul',
    );
    expect(script.text).toContain(
      'if exist "ktx\\qwprogs.dll.nqinstall" move /y "ktx\\qwprogs.dll.nqinstall" "ktx\\qwprogs.dll" >nul',
    );
    // Every step is guarded, so running it twice is harmless.
    expect(
      script.text.split("\r\n").filter((l) => l.startsWith("move ")),
    ).toEqual([]);
    expect(script.text).toContain("pause");
  });

  it("moves a played-in config.cfg aside before overwriting it", () => {
    const script = renderFixupScript(
      [
        {
          from: "ezquake/configs/config.cfg.nqinstall",
          to: "ezquake/configs/config.cfg",
        },
      ],
      { path: "ezquake/configs/config.cfg", to: "config-20260920-1200.cfg" },
    );
    const ren = script.text.indexOf(
      'ren "ezquake\\configs\\config.cfg" "config-20260920-1200.cfg"',
    );
    expect(ren).toBeGreaterThan(-1);
    expect(script.text.indexOf("move /y")).toBeGreaterThan(ren);
  });

  it("stays quiet when a start script calls it", () => {
    expect(renderFixupScript(renames).text).toContain(
      'if /i "%~1"=="/quiet" exit /b 0',
    );
  });
});
