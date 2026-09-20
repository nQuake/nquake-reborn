import type { WizardCtx } from "../../app/wizard.ts";
import { formatBytes, formatDuration } from "../../domain/format.ts";
import { SIDECAR_SUFFIX } from "../../domain/paths.ts";
import { ExternalIcon } from "../icons.tsx";
import {
  Button,
  Callout,
  ExternalLink,
  KeyValue,
  SectionTitle,
} from "../primitives.tsx";

const LINKS: [string, string][] = [
  ["QuakeWorld portal", "https://www.quakeworld.nu/"],
  ["Discord", "https://discord.quake.world/"],
  ["Server list", "https://www.quakeservers.net/quakeworld/servers/"],
  ["ezQuake manual", "https://ezquake.com/"],
  ["Learn to bunnyhop", "https://www.quakeworld.nu/wiki/Bunnyhopping"],
];

export function DoneStep({ ctx }: { ctx: WizardCtx }) {
  const { options: o, run, plan, folder, caps, reset } = ctx;
  const r = run.result;
  const client = o.target !== "server";
  const server = o.target !== "client";
  const partial = r && !r.ok;
  // A browser cannot chmod, so `./script.sh` would be "Permission denied" on
  // the first run; every generated script sets its own bit when run with `sh`.
  const sh = (script: string) =>
    folder?.picked.canSetExecutable ? `./${script}` : `sh ${script}`;
  // The firewall ports are already listed in the server table above.
  const visibleNotes = [
    ...(plan?.notes ?? []).filter((n) => !n.startsWith("Open UDP")),
    // Files this surface is not allowed to name at all — nothing the user did
    // wrong, and nothing they can retry, so they are notes and not failures.
    ...(r?.blocked ?? []).map(
      (b) => `${b.dest} was not installed: ${b.reason}.`,
    ),
  ];

  const openFolder = async () => {
    if (folder?.picked.kind !== "tauri") return;
    const { revealInFileManager, TauriDestination } =
      await import("../../platform/tauri.ts");
    if (folder.picked instanceof TauriDestination)
      await revealInFileManager(folder.picked);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="done">
      {caps.realInstall ? (
        partial ? (
          <Callout tone="warn" title="Installed with errors">
            {r?.failed.length} file(s) didn't make it. Run the installer again
            into the same folder to pick up the rest.
          </Callout>
        ) : (
          <Callout tone="success" title="nQuake is installed">
            {r &&
              `${formatBytes(r.bytes)} downloaded in ${formatDuration(r.durationMs / 1000)}.`}
          </Callout>
        )
      ) : (
        <Callout tone="warn" title="That was the simulation">
          Nothing was installed on this device. On a computer, the same steps
          leave you with a playable nQuake — try it in Chrome or Edge, or with
          the desktop app.
        </Callout>
      )}

      {r?.fixupScript && (
        <Callout tone="warn" title="One last step — finish the install">
          <p>
            Chrome and Edge are not allowed to create <code>.cfg</code> or{" "}
            <code>.dll</code> files on Windows, so {r.sidecars.length} of them
            were written with a <code>{SIDECAR_SUFFIX}</code> suffix instead.
            Open your nQuake folder and double-click{" "}
            <code>{r.fixupScript}</code> once to put them under their real names
            — it is a plain text file, so you can read it first.
          </p>
          <p className="mt-2 text-xs text-muted">
            The desktop app writes these files directly and needs no such step.
          </p>
        </Callout>
      )}

      {client && (
        <div>
          <SectionTitle>Play</SectionTitle>
          {o.platform === "windows" && (
            <p className="text-sm">
              Open your nQuake folder and run{" "}
              {r?.fixupScript ? (
                <>
                  <code>{r.fixupScript}</code> first, then{" "}
                  <code>ezquake.exe</code>
                </>
              ) : (
                <code>ezquake.exe</code>
              )}
              . Your nickname and keys are already set; press <kbd>~</kbd> for
              the console and type <code>/serverbrowser</code> to find a game.
            </p>
          )}
          {o.platform === "linux" && (
            <p className="text-sm">
              In a terminal, from the nQuake folder:
              <code className="mt-2 block rounded-md border border-line bg-page-bg p-2 font-mono text-xs">
                {sh("start_ezquake.sh")}
              </code>
              <span className="mt-2 block text-xs text-muted">
                After the first run <code>./start_ezquake.sh</code> works too.
              </span>
            </p>
          )}
          {o.platform === "macos" && (
            <p className="text-sm">
              In a terminal, from the nQuake folder:
              <code className="mt-2 block rounded-md border border-line bg-page-bg p-2 font-mono text-xs">
                {sh("start_ezquake.sh")}
              </code>
              <span className="mt-2 block text-xs text-muted">
                It opens <code>ezQuake.app</code> — after that you can launch it
                from Finder.
              </span>
            </p>
          )}
        </div>
      )}

      {server && plan && (
        <div>
          <SectionTitle>Start the server</SectionTitle>
          <p className="text-sm">
            {o.platform === "windows" ? (
              <>
                Double-click <code>start_servers.bat</code>.{" "}
                <code>stop_servers.bat</code> stops everything.
                {r?.fixupScript && " It runs the finish script above for you."}
              </>
            ) : (
              <>
                Run <code>{sh("start_servers.sh")}</code> in the folder;{" "}
                <code>{sh("stop_servers.sh")}</code> stops it again.
              </>
            )}
          </p>
          <div className="mt-3">
            <KeyValue
              rows={[
                ...plan.servers.map(
                  (s) => [s.label, `UDP ${s.port}`] as [string, string],
                ),
                ...(o.server.qtv
                  ? [["QTV", `TCP ${o.server.qtvPort}`] as [string, string]]
                  : []),
                ...(o.server.qwfwd
                  ? [["QWFWD", `UDP ${o.server.qwfwdPort}`] as [string, string]]
                  : []),
                [
                  "rcon password",
                  <span className="font-mono">{o.server.rconPassword}</span>,
                ],
              ]}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Open those ports in your firewall. Everything above is also in{" "}
            <code>README-nquake.txt</code>.
          </p>
        </div>
      )}

      {visibleNotes.length > 0 && (
        <Callout tone="info" title="Notes">
          <ul className="list-disc space-y-1 pl-4">
            {visibleNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div>
        <SectionTitle>Next</SectionTitle>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <ExternalLink
                href={href}
                className="inline-flex items-center gap-1"
              >
                {label} <ExternalIcon className="h-3 w-3" />
              </ExternalLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        {folder?.picked.kind === "tauri" && (
          <Button variant="primary" onClick={openFolder}>
            Open folder
          </Button>
        )}
        <Button onClick={reset} testId="start-over">
          Install something else
        </Button>
      </div>
    </div>
  );
}
