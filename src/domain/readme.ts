// The `README-nquake.txt` dropped into the install folder: what was installed
// and how to start it, tailored to the platform and the choices made.

import type { InstallOptions } from "./options.ts";
import { platformLabel } from "./platform.ts";
import type { InstallPlan } from "./plan.ts";

export function renderInstallReadme(
  o: InstallOptions,
  plan: InstallPlan,
  version: string,
  now: Date,
  opts: {
    /** The desktop app chmods what it writes; a browser cannot. */
    executableBitsSet?: boolean;
    /** Set when files are waiting under a `.nqinstall` name (see paths.ts). */
    fixupScript?: string | null;
  } = {},
): string {
  const out: string[] = [];
  // Without the bit, `./script.sh` is "Permission denied" — but `sh script.sh`
  // works, and every script this installer generates chmods itself first.
  const run = (script: string) =>
    opts.executableBitsSet ? `./${script}` : `sh ${script}`;
  const eol = o.platform === "windows" ? "\r\n" : "\n";
  out.push("nQuake — installed by the nQuake web installer");
  out.push("=".repeat(48));
  out.push(`Installer version: ${version}`);
  out.push(`Installed: ${now.toISOString()}`);
  out.push(`Platform: ${platformLabel(o.platform)}`);
  out.push("");

  if (opts.fixupScript) {
    out.push("FIRST: FINISH THE INSTALL");
    out.push("-------------------------");
    out.push(
      "Chrome and Edge are not allowed to create .cfg or .dll files on Windows,",
    );
    out.push(
      `so those were written with a .nqinstall suffix. Double-click ${opts.fixupScript}`,
    );
    out.push(
      "in this folder once to put them under their real names, then delete it.",
    );
    out.push("Nothing below works until you have.");
    out.push("");
  }

  if (o.target !== "server") {
    out.push("PLAYING");
    out.push("-------");
    if (o.platform === "windows") {
      out.push(
        "Run ezquake.exe. Your nickname and keys from the installer are in",
      );
      out.push(
        "ezquake/configs/preset.cfg and load automatically on first start.",
      );
    } else if (o.platform === "linux") {
      out.push("Start the client from a terminal in this folder:");
      out.push(`  ${run("start_ezquake.sh")}`);
      out.push(
        "The launcher sets the executable bit on the AppImage and runs it;",
      );
      out.push("after the first run ./start_ezquake.sh works too.");
    } else {
      out.push("Start the client from a terminal in this folder:");
      out.push(`  ${run("start_ezquake.sh")}`);
      out.push(
        "The launcher sets the executable bits, clears the macOS quarantine",
      );
      out.push(
        "flag and opens ezQuake.app; after the first run you can open the app",
      );
      out.push("from Finder as usual.");
    }
    if (!o.pak1) {
      out.push("");
      out.push(
        "You installed the shareware episode. If you own Quake, copy pak1.pak",
      );
      out.push(
        "from your Quake/id1 folder into id1/ here and delete id1/gpl_maps.pk3.",
      );
    }
    out.push("");
  }

  if (o.target !== "client") {
    out.push("SERVER");
    out.push("------");
    if (o.platform === "windows") {
      out.push(
        "Double-click start_servers.bat to start every server; stop_servers.bat stops them.",
      );
    } else {
      out.push(
        `Run ${run("start_servers.sh")} (it sets the executable bits first); ` +
          `${run("stop_servers.sh")} stops them.`,
      );
      out.push(
        "After the first run ./start_servers.sh works too; add that to cron",
      );
      out.push("with @reboot to survive restarts.");
    }
    out.push("");
    out.push("Servers:");
    for (const s of plan.servers) {
      out.push(
        `  ${s.label.padEnd(16)} UDP ${s.port}  (mvdsv -port ${s.port} -game ${s.game} +exec ${s.cfg})`,
      );
    }
    if (o.server.qtv) out.push(`  ${"QTV".padEnd(16)} TCP ${o.server.qtvPort}`);
    if (o.server.qwfwd)
      out.push(`  ${"QWFWD".padEnd(16)} UDP ${o.server.qwfwdPort}`);
    out.push("");
    out.push(`rcon password: ${o.server.rconPassword}`);
    if (o.server.qtv) out.push(`QTV admin password: ${o.server.qtvPassword}`);
    out.push("Passwords live in ktx/pwd.cfg and qtv/qtv.cfg.");
    out.push("");
  }

  if (plan.notes.length) {
    out.push("NOTES");
    out.push("-----");
    for (const n of plan.notes) out.push(`* ${n}`);
    out.push("");
  }

  out.push("LINKS");
  out.push("-----");
  out.push("QuakeWorld community:  https://www.quakeworld.nu/");
  out.push("Discord:               https://discord.quake.world/");
  out.push(
    "Server browser:        https://www.quakeservers.net/quakeworld/servers/",
  );
  out.push("ezQuake:               https://ezquake.com/");
  out.push("Installer source:      https://github.com/nQuake/nquake-reborn");
  return out.join(eol) + eol;
}
