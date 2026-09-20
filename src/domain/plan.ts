// Turn the wizard's answers into the exact list of files to put in the
// install folder. Every item names its destination and where its bytes come
// from: a distfiles file, an upstream-mirror file, a text the installer
// renders itself, a distfiles text file with a transform applied, or a file
// the user handed over (pak1.pak). The installer walks this list; nothing
// downstream re-derives a decision made here.

import {
  renderKtxPortCfg,
  renderPresetCfg,
  renderPwdCfg,
  renderQtvCfg,
  renderQwfwdCfg,
  renderStartScripts,
  serverPlaceholders,
  type GameServer,
} from "./configs.ts";
import type { Manifest, ManifestFile } from "./manifest.ts";
import { wantsClient, wantsServer, type InstallOptions } from "./options.ts";
import { UPSTREAM_TARGET, type Platform } from "./platform.ts";
import type { Upstream, UpstreamComponent } from "./upstream.ts";

export const PAK0_SIZE = 18689235;
export const PAK1_SIZE = 34257856;

export type PlanSource =
  | { kind: "distfiles"; pkg: string; file: ManifestFile }
  | {
      kind: "upstream";
      component: UpstreamComponent;
      target: string;
      file: ManifestFile;
    }
  | { kind: "generated"; text: string }
  | {
      kind: "template";
      pkg: string;
      file: ManifestFile;
      /** Applied to the fetched text before writing. */
      transform: TemplateTransform;
    }
  | { kind: "user"; id: "pak1" };

export type TemplateTransform =
  | { kind: "placeholders"; vars: Record<string, string> }
  | { kind: "ktx-port"; port: number }
  | { kind: "qtv" };

export interface PlanItem {
  /** Destination path relative to the install folder, forward slashes. */
  dest: string;
  size: number;
  source: PlanSource;
  /** Progress group id (see `PlanGroup`). */
  group: string;
  /** Needs the executable bit on Linux/macOS (browsers can't set it — the start script does). */
  executable?: boolean;
}

export interface PlanGroup {
  id: string;
  label: string;
  bytes: number;
  count: number;
}

export interface InstallPlan {
  items: PlanItem[];
  groups: PlanGroup[];
  /** Bytes that come over the network. */
  downloadBytes: number;
  /** Bytes written to disk (downloads + generated + user files). */
  totalBytes: number;
  /** Things the user should know that the plan decided on their behalf. */
  notes: string[];
  /** The MVDSV processes a server install runs (empty for a client-only install). */
  servers: GameServer[];
}

const GROUP_LABELS: Record<string, string> = {
  shareware: "Quake shareware data",
  pak1: "Registered Quake data",
  client: "nQuake client files",
  textures: "Textures",
  "hd-textures": "High-resolution textures",
  "addon-fortress": "Team Fortress",
  "addon-clanarena": "Clan Arena",
  ezquake: "ezQuake",
  config: "Configuration",
  server: "nQuake server files",
  "server-bin": "Server binaries",
  "server-maps": "Map pack",
  "sv-ffa": "FFA server",
  "sv-ca": "Clan Arena server",
  "sv-fortress": "Team Fortress server",
};

function isCfg(path: string): boolean {
  return /\.cfg$/i.test(path);
}

class PlanBuilder {
  items: PlanItem[] = [];
  notes: string[] = [];
  private seen = new Set<string>();

  constructor(
    private manifest: Manifest,
    private upstream: Upstream | null,
  ) {}

  private push(item: PlanItem) {
    const key = item.dest.toLowerCase();
    // Later items win: an upstream binary replaces the bundled one, a
    // generated config replaces a template of the same name.
    if (this.seen.has(key)) {
      this.items = this.items.filter((i) => i.dest.toLowerCase() !== key);
    }
    this.seen.add(key);
    this.items.push(item);
  }

  /** Add every file of a distfiles package, with optional per-file rules. */
  pkg(
    name: string,
    group: string,
    opts: {
      skip?: (path: string) => boolean;
      dest?: (path: string) => string;
      only?: (path: string) => boolean;
      transform?: (path: string) => TemplateTransform | null;
      executable?: (path: string) => boolean;
    } = {},
  ): boolean {
    const pkg = this.manifest.packages[name];
    if (!pkg) {
      this.notes.push(
        `Package "${name}" is missing from the manifest and was skipped.`,
      );
      return false;
    }
    for (const file of pkg.files) {
      if (opts.only && !opts.only(file.path)) continue;
      if (opts.skip?.(file.path)) continue;
      const dest = opts.dest ? opts.dest(file.path) : file.path;
      const transform = opts.transform?.(file.path) ?? null;
      this.push({
        dest,
        size: file.size,
        group,
        executable: opts.executable?.(file.path) || undefined,
        source: transform
          ? { kind: "template", pkg: name, file, transform }
          : { kind: "distfiles", pkg: name, file },
      });
    }
    return true;
  }

  /** Add an upstream component's files for a platform; false when unavailable. */
  upstreamFiles(
    component: UpstreamComponent,
    platform: Platform,
    group: string,
    opts: { executable?: (path: string) => boolean } = {},
  ): { ok: boolean; version?: string } {
    const targetId = UPSTREAM_TARGET[component][platform];
    const release = this.upstream?.components[component];
    const target = targetId ? release?.targets[targetId] : undefined;
    if (!release || !targetId || !target || target.files.length === 0) {
      return { ok: false };
    }
    for (const file of target.files) {
      this.push({
        dest: file.path,
        size: file.size,
        group,
        executable: opts.executable?.(file.path) || undefined,
        source: { kind: "upstream", component, target: targetId, file },
      });
    }
    return { ok: true, version: release.version };
  }

  generated(dest: string, text: string, group: string, executable = false) {
    this.push({
      dest,
      size: new TextEncoder().encode(text).byteLength,
      group,
      executable: executable || undefined,
      source: { kind: "generated", text },
    });
  }
}

export function buildPlan(
  manifest: Manifest,
  upstream: Upstream | null,
  o: InstallOptions,
): InstallPlan {
  const b = new PlanBuilder(manifest, upstream);
  const { platform } = o;
  const windows = platform === "windows";
  const servers: GameServer[] = [];

  // ---- Shared: shareware pak0 (only the pak itself; the rest of qsw106 is
  // the DOS installer) and the user's pak1.
  b.pkg("qsw106", "shareware", {
    only: (p) => p.toLowerCase() === "id1/pak0.pak",
    dest: () => "id1/pak0.pak",
  });
  if (o.pak1) {
    b.items.push({
      dest: "id1/pak1.pak",
      size: PAK1_SIZE,
      group: "pak1",
      source: { kind: "user", id: "pak1" },
    });
  }

  // ---- Client
  if (wantsClient(o)) {
    const c = o.client;
    let ezquake: { ok: boolean; version?: string } = { ok: false };
    if (c.ezquakeSource === "latest") {
      ezquake = b.upstreamFiles("ezquake", platform, "ezquake", {
        executable: (p) => /\.AppImage$/i.test(p) || /\/MacOS\/[^/]+$/.test(p),
      });
      if (!ezquake.ok) {
        b.notes.push(
          "The latest ezQuake build was not available from the mirror; " +
            (platform === "linux"
              ? "download it from https://ezquake.com and drop it in the install folder."
              : "the version bundled with nQuake was installed instead."),
        );
      }
    }
    const useBundledEzquake = c.ezquakeSource === "bundled" || !ezquake.ok;

    b.pkg("gpl", "client", {
      skip: (p) =>
        (p === "ezquake.exe" && (!windows || !useBundledEzquake)) ||
        (o.pak1 && (p === "id1/gpl_maps.pk3" || p === "id1/readme.txt")),
    });
    b.pkg("non-gpl", "client", {
      skip: (p) => !windows && p === "ezquake/sb/wget.exe",
    });
    if (platform === "linux") {
      b.pkg("linux", "client", { only: (p) => !/\.tar\.gz$/i.test(p) });
    }
    if (platform === "macos") {
      b.pkg("macosx", "client", {
        // The bundled .app is an old build; only take it as the fallback.
        skip: (p) => p.startsWith("ezQuake.app/") && !useBundledEzquake,
        executable: (p) => /\/MacOS\/[^/]+$/.test(p),
      });
    }
    if (c.textures) b.pkg("textures", "textures");
    if (c.hdTextures) b.pkg("addon-textures", "hd-textures");
    if (c.teamFortress) b.pkg("addon-fortress", "addon-fortress");
    if (c.clanArena) b.pkg("addon-clanarena", "addon-clanarena");
    b.generated(
      "ezquake/configs/preset.cfg",
      renderPresetCfg(c.config, platform),
      "config",
    );
  }

  // ---- Server
  if (wantsServer(o)) {
    const s = o.server;
    const gpl = manifest.packages["sv-gpl"];
    const portTemplate = gpl?.files.find(
      (f) => f.path === "ktx/port_template.cfg",
    );
    const qtvTemplate = gpl?.files.find(
      (f) => f.path === "qtv/qtv_template.cfg",
    );

    // Game servers: N KTX ports, then one port per addon mod.
    let port = s.basePort;
    for (let i = 1; i <= s.ports; i++) {
      servers.push({
        id: `ktx${i}`,
        label: `KTX #${i}`,
        port: port++,
        game: "ktx",
        cfg: `port${i}.cfg`,
      });
    }
    const addonPorts: Record<string, number> = {};
    if (s.ffa) {
      addonPorts["sv-ffa"] = port;
      servers.push({
        id: "ffa",
        label: "FFA",
        port: port++,
        game: "ffa",
        cfg: "port1.cfg",
      });
    }
    if (s.clanArena) {
      addonPorts["sv-ca"] = port;
      servers.push({
        id: "ca",
        label: "Clan Arena",
        port: port++,
        game: "cace",
        cfg: "port1.cfg",
      });
    }
    if (s.teamFortress) {
      addonPorts["sv-fortress"] = port;
      servers.push({
        id: "fortress",
        label: "Team Fortress",
        port: port++,
        game: "fortress",
        cfg: "port1.cfg",
      });
    }

    b.pkg("sv-gpl", "server", {
      // The addon shell scripts are the old Linux installer's; this installer
      // does what they did.
      skip: (p) => p.startsWith("addons/"),
      executable: (p) => p === "ktx/mvdfinish.qws",
    });
    b.pkg("sv-non-gpl", "server");
    b.pkg("sv-configs", "server");
    b.pkg("sv-maps-gpl", "server-maps");
    if (s.fullMaps) b.pkg("sv-maps", "server-maps");

    // Binaries: bundled per platform, optionally replaced by upstream.
    if (platform === "macos") {
      b.notes.push(
        "No MVDSV/KTX/QTV/QWFWD binaries are published for macOS; the server " +
          "files were installed without them. Build MVDSV and KTX from source " +
          "(https://github.com/QW-Group) and drop them in the folder.",
      );
    } else {
      const bundled = windows ? "sv-bin-win32" : "sv-bin-x64";
      b.pkg(bundled, "server-bin", {
        executable: () => !windows,
      });
      if (s.binariesSource === "latest") {
        const mv = b.upstreamFiles("mvdsv", platform, "server-bin", {
          executable: () => !windows,
        });
        const ktx = b.upstreamFiles("ktx", platform, "server-bin");
        if (!mv.ok || !ktx.ok) {
          b.notes.push(
            "The latest MVDSV/KTX builds were not available from the mirror; the versions bundled with nQuake were installed instead.",
          );
        }
      }
    }

    // Addon mods, with their NQUAKESV_* placeholders filled in.
    for (const [pkg, group] of [
      ["sv-ffa", "sv-ffa"],
      ["sv-ca", "sv-ca"],
      ["sv-fortress", "sv-fortress"],
    ] as const) {
      const addonPort = addonPorts[pkg];
      if (addonPort === undefined) continue;
      const vars = serverPlaceholders(s, addonPort);
      b.pkg(pkg, group, {
        transform: (p) => (isCfg(p) ? { kind: "placeholders", vars } : null),
      });
    }

    // Generated configs.
    for (const srv of servers.filter((x) => x.game === "ktx")) {
      if (portTemplate) {
        b.items.push({
          dest: `ktx/${srv.cfg}`,
          size: portTemplate.size + 256,
          group: "config",
          source: {
            kind: "template",
            pkg: "sv-gpl",
            file: portTemplate,
            transform: { kind: "ktx-port", port: srv.port },
          },
        });
      } else {
        b.generated(
          `ktx/${srv.cfg}`,
          renderKtxPortCfg("", s, srv.port, platform),
          "config",
        );
      }
    }
    b.generated("ktx/pwd.cfg", renderPwdCfg(s, platform), "config");
    if (s.qtv) {
      if (qtvTemplate) {
        b.items.push({
          dest: "qtv/qtv.cfg",
          size: qtvTemplate.size + 256,
          group: "config",
          source: {
            kind: "template",
            pkg: "sv-gpl",
            file: qtvTemplate,
            transform: { kind: "qtv" },
          },
        });
      } else {
        b.generated(
          "qtv/qtv.cfg",
          renderQtvCfg("", s, servers, platform),
          "config",
        );
      }
    } else {
      // QTV not wanted: keep the binaries out of the way too.
      b.items = b.items.filter(
        (i) => !i.dest.startsWith("qtv/") || i.dest.endsWith(".cfg"),
      );
    }
    if (s.qwfwd) {
      b.generated("qwfwd/qwfwd.cfg", renderQwfwdCfg(s, platform), "config");
    } else {
      b.items = b.items.filter((i) => !i.dest.startsWith("qwfwd/"));
    }
    for (const script of renderStartScripts(platform, s, servers)) {
      b.generated(script.path, script.text, "config", script.executable);
    }
    b.notes.push(
      `Open UDP ${servers.map((x) => x.port).join(", ")} (game)` +
        (s.qtv ? `, TCP ${s.qtvPort} (QTV)` : "") +
        (s.qwfwd ? `, UDP ${s.qwfwdPort} (QWFWD)` : "") +
        " in your firewall.",
    );
  }

  // ---- Totals
  const groups = new Map<string, PlanGroup>();
  let downloadBytes = 0;
  let totalBytes = 0;
  for (const item of b.items) {
    const g = groups.get(item.group) ?? {
      id: item.group,
      label: GROUP_LABELS[item.group] ?? item.group,
      bytes: 0,
      count: 0,
    };
    g.bytes += item.size;
    g.count += 1;
    groups.set(item.group, g);
    totalBytes += item.size;
    if (
      item.source.kind === "distfiles" ||
      item.source.kind === "upstream" ||
      item.source.kind === "template"
    ) {
      downloadBytes += item.source.file.size;
    }
  }
  return {
    items: b.items,
    groups: [...groups.values()],
    downloadBytes,
    totalBytes,
    notes: b.notes,
    servers,
  };
}

/** Render a template item's fetched text according to its transform. */
export function renderTemplate(
  text: string,
  transform: TemplateTransform,
  o: InstallOptions,
  servers: GameServer[],
): string {
  switch (transform.kind) {
    case "placeholders":
      return applyPlaceholdersText(text, transform.vars);
    case "ktx-port":
      return renderKtxPortCfg(text, o.server, transform.port, o.platform);
    case "qtv":
      return renderQtvCfg(text, o.server, servers, o.platform);
  }
}

function applyPlaceholdersText(text: string, vars: Record<string, string>) {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.split(k).join(v);
  return out;
}
