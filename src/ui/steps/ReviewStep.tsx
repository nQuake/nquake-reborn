import type { WizardCtx } from "../../app/wizard.ts";
import { formatBytes } from "../../domain/format.ts";
import { platformLabel } from "../../domain/platform.ts";
import { Button, Callout, KeyValue, SectionTitle } from "../primitives.tsx";

export function ReviewStep({ ctx }: { ctx: WizardCtx }) {
  const { options: o, plan, folder, catalog, mode, setMode, goTo } = ctx;
  if (!plan || !folder) return null;
  const switchToAdvanced = () => {
    setMode("advanced");
    goTo(2);
  };
  const c = o.client;
  const s = o.server;
  const client = o.target !== "server";
  const server = o.target !== "client";
  const ez = catalog.upstream?.components.ezquake?.version;
  const folderName = folder.useSubfolder
    ? `${folder.picked.name}/nQuake`
    : folder.picked.name;

  const rows: [string, preact.ComponentChildren][] = [
    [
      "Install",
      o.target === "both"
        ? "Client + server"
        : o.target === "client"
          ? "Client"
          : "Server",
    ],
    ["Platform", platformLabel(o.platform)],
    ["Folder", <span className="font-mono">{folderName}</span>],
  ];
  if (client) {
    rows.push(
      [
        "ezQuake",
        c.ezquakeSource === "latest" && ez ? `Latest (${ez})` : "Bundled",
      ],
      ["Game data", o.pak1 ? "Full game (your pak1.pak)" : "Shareware episode"],
      ["Nickname", c.config.name],
      [
        "Keys",
        c.config.layout.toUpperCase() +
          (c.config.invertMouse ? ", inverted mouse" : ""),
      ],
      [
        "Client add-ons",
        [
          c.textures && "24-bit textures",
          c.hdTextures && "HD textures",
          c.teamFortress && "Team Fortress",
          c.clanArena && "Clan Arena",
        ]
          .filter(Boolean)
          .join(", ") || "none",
      ],
    );
  }
  if (server) {
    rows.push(
      ["Server name", s.hostname],
      [
        "Game ports",
        plan.servers.map((x) => `${x.label} ${x.port}`).join(", "),
      ],
      [
        "Services",
        [s.qtv && `QTV ${s.qtvPort}`, s.qwfwd && `QWFWD ${s.qwfwdPort}`]
          .filter(Boolean)
          .join(", ") || "none",
      ],
      [
        "Binaries",
        s.binariesSource === "latest" ? "Latest MVDSV + KTX" : "Bundled",
      ],
      ["Maps", s.fullMaps ? "Full map pack" : "GPL id1 maps only"],
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {mode === "simple" && (
        <Callout tone="info" title="Standard setup" testId="simple-defaults">
          <p>
            These are the QuakeWorld defaults. Want a different ezQuake build,
            add-ons, keys, or server ports and passwords?
          </p>
          <Button
            className="mt-2"
            onClick={switchToAdvanced}
            testId="switch-advanced"
          >
            Switch to Advanced
          </Button>
        </Callout>
      )}
      <KeyValue rows={rows} />

      <div>
        <SectionTitle>Download</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["To download", formatBytes(plan.downloadBytes)],
              ["On disk", formatBytes(plan.totalBytes)],
              ["Files", plan.items.length.toLocaleString()],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div
              key={k}
              className="rounded-md border border-line bg-surface-2/60 px-3.5 py-3"
            >
              <div className="text-xs uppercase tracking-wider text-muted">
                {k}
              </div>
              <div
                className="display text-2xl text-fg-bright"
                data-testid={`review-${k.toLowerCase().replace(/\s/g, "-")}`}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
          {plan.groups.map((g) => (
            <li key={g.id} className="flex justify-between gap-4">
              <span>{g.label}</span>
              <span className="tabular-nums">
                {g.count} files · {formatBytes(g.bytes)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {plan.notes.length > 0 && (
        <Callout tone="info" title="Good to know">
          <ul className="list-disc space-y-1 pl-4">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}
    </div>
  );
}
