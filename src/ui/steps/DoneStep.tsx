import type { WizardCtx } from "../../app/wizard.ts";
import { formatBytes, formatDuration } from "../../domain/format.ts";
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
  // The firewall ports are already listed in the server table above.
  const visibleNotes = (plan?.notes ?? []).filter(
    (n) => !n.startsWith("Open UDP"),
  );

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
            into the same folder to fetch just those.
          </Callout>
        ) : (
          <Callout tone="success" title="nQuake is installed">
            {r &&
              `${r.written.toLocaleString()} files written${r.skipped ? `, ${r.skipped.toLocaleString()} already up to date` : ""}, ${formatBytes(r.bytes)} in ${formatDuration(r.durationMs / 1000)}.`}
          </Callout>
        )
      ) : (
        <Callout tone="warn" title="That was the simulation">
          Nothing was downloaded to this device. On a computer, the same steps
          put a playable nQuake in the folder you choose — try it in Chrome or
          Edge, or with the desktop app.
        </Callout>
      )}

      {client && (
        <div>
          <SectionTitle>Play</SectionTitle>
          {o.platform === "windows" && (
            <p className="text-sm">
              Open your nQuake folder and run <code>ezquake.exe</code>. Your
              nickname and keys are already set; press <kbd>~</kbd> for the
              console and type <code>/serverbrowser</code> to find a game.
            </p>
          )}
          {o.platform === "linux" && (
            <p className="text-sm">
              In a terminal, from the nQuake folder:
              <code className="mt-2 block rounded-md border border-line bg-page-bg p-2 font-mono text-xs">
                chmod +x ezQuake-x86_64.AppImage && ./ezQuake-x86_64.AppImage
              </code>
            </p>
          )}
          {o.platform === "macos" && (
            <p className="text-sm">
              Open <code>ezQuake.app</code> from the nQuake folder. If macOS
              refuses the first launch, run once in Terminal:
              <code className="mt-2 block rounded-md border border-line bg-page-bg p-2 font-mono text-xs">
                xattr -dr com.apple.quarantine ezQuake.app && chmod +x
                ezQuake.app/Contents/MacOS/*
              </code>
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
              </>
            ) : (
              <>
                Run <code>./start_servers.sh</code> in the folder — it sets the
                executable bits and starts each process in a restart loop.{" "}
                <code>./stop_servers.sh</code> stops them.
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
            Open those ports in your firewall. Passwords are in{" "}
            <code>ktx/pwd.cfg</code> and <code>qtv/qtv.cfg</code>; everything
            above is also in <code>README-nquake.txt</code>.
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
