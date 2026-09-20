import { describe, expect, it } from "vitest";

import {
  applyPlaceholders,
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
