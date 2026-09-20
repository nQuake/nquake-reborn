import type { WizardCtx } from "../../app/wizard.ts";
import { randomPassword } from "../../app/wizard.ts";
import { formatBytes } from "../../domain/format.ts";
import { packageBytes } from "../../domain/manifest.ts";
import { MAX_PORTS, clampPorts } from "../../domain/options.ts";
import { UPSTREAM_TARGET } from "../../domain/platform.ts";
import { RefreshIcon } from "../icons.tsx";
import {
  Badge,
  Button,
  Callout,
  ChoiceCard,
  Field,
  SectionTitle,
  Toggle,
} from "../primitives.tsx";

export function ServerStep({ ctx }: { ctx: WizardCtx }) {
  const { options, setOptions, catalog } = ctx;
  const s = options.server;
  const m = catalog.manifest;
  const size = (pkg: string) => (m ? formatBytes(packageBytes(m, pkg)) : "");
  const set = (patch: Partial<typeof s>) =>
    setOptions((o) => ({ ...o, server: { ...o.server, ...patch } }));
  const mv = catalog.upstream?.components.mvdsv;
  const ktx = catalog.upstream?.components.ktx;
  const mvTarget = UPSTREAM_TARGET.mvdsv[options.platform];
  const latestAvailable = !!(
    mvTarget &&
    mv?.targets[mvTarget] &&
    ktx?.targets[mvTarget]
  );
  const lastPort =
    s.basePort +
    s.ports -
    1 +
    (s.ffa ? 1 : 0) +
    (s.clanArena ? 1 : 0) +
    (s.teamFortress ? 1 : 0);

  return (
    <div className="flex flex-col gap-8">
      {options.platform === "macos" && (
        <Callout tone="warn" title="No macOS server binaries">
          MVDSV, KTX, QTV and QWFWD publish no macOS builds. The server files
          and configs will be installed, but you'll need to build the binaries
          from source yourself.
        </Callout>
      )}

      <div>
        <SectionTitle>Identity</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Server name"
            htmlFor="hostname"
            hint="Shown in server browsers, followed by the port."
            error={s.hostname.trim() ? null : "Give the server a name."}
          >
            <input
              id="hostname"
              className="input"
              data-testid="hostname"
              value={s.hostname}
              maxLength={60}
              onInput={(e) =>
                set({ hostname: (e.currentTarget as HTMLInputElement).value })
              }
            />
          </Field>
          <Field
            label="Public address"
            htmlFor="listen"
            hint="IP or hostname players connect to. Leave empty to let the server find its own IP."
          >
            <input
              id="listen"
              className="input"
              data-testid="listen-address"
              value={s.listenAddress}
              placeholder="quake.example.com"
              autoComplete="off"
              onInput={(e) =>
                set({
                  listenAddress: (
                    e.currentTarget as HTMLInputElement
                  ).value.trim(),
                })
              }
            />
          </Field>
          <Field label="Admin name" htmlFor="admin">
            <input
              id="admin"
              className="input"
              data-testid="admin-name"
              value={s.adminName}
              onInput={(e) =>
                set({ adminName: (e.currentTarget as HTMLInputElement).value })
              }
            />
          </Field>
          <Field
            label="Admin e-mail"
            htmlFor="email"
            hint="Shown to players in the server info."
          >
            <input
              id="email"
              className="input"
              type="email"
              data-testid="admin-email"
              value={s.adminEmail}
              onInput={(e) =>
                set({ adminEmail: (e.currentTarget as HTMLInputElement).value })
              }
            />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle hint="Each port is one KTX game server (1on1, 2on2, 4on4, FFA, CTF, race… all selectable in-game). Add-on mods below get their own port after these.">
          Ports
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Game servers" htmlFor="ports" hint={`1–${MAX_PORTS}`}>
            <input
              id="ports"
              className="input"
              type="number"
              min={1}
              max={MAX_PORTS}
              data-testid="ports"
              value={s.ports}
              onInput={(e) =>
                set({
                  ports: clampPorts(
                    Number((e.currentTarget as HTMLInputElement).value),
                  ),
                })
              }
            />
          </Field>
          <Field
            label="First port (UDP)"
            htmlFor="baseport"
            hint={`Uses ${s.basePort}–${lastPort}`}
          >
            <input
              id="baseport"
              className="input"
              type="number"
              min={1025}
              max={65000}
              data-testid="base-port"
              value={s.basePort}
              onInput={(e) =>
                set({
                  basePort:
                    Number((e.currentTarget as HTMLInputElement).value) ||
                    27500,
                })
              }
            />
          </Field>
          <Field
            label="rcon password"
            htmlFor="rcon"
            hint="Remote console. Written to ktx/pwd.cfg."
          >
            <div className="flex gap-2">
              <input
                id="rcon"
                className="input font-mono"
                data-testid="rcon"
                value={s.rconPassword}
                onInput={(e) =>
                  set({
                    rconPassword: (e.currentTarget as HTMLInputElement).value,
                  })
                }
              />
              <Button
                aria-label="Generate a new rcon password"
                onClick={() => set({ rconPassword: randomPassword() })}
              >
                <RefreshIcon />
              </Button>
            </div>
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Services</SectionTitle>
        <div className="flex flex-col gap-2">
          <Toggle
            testId="opt-qtv"
            label="QTV"
            hint="Lets spectators watch games and download demos through a web page."
            meta={`TCP ${s.qtvPort}`}
            checked={s.qtv}
            onChange={(v) => set({ qtv: v })}
          />
          {s.qtv && (
            <div className="grid gap-4 pl-3 sm:grid-cols-2 sm:pl-13">
              <Field label="QTV port" htmlFor="qtvport">
                <input
                  id="qtvport"
                  className="input"
                  type="number"
                  min={1025}
                  max={65000}
                  value={s.qtvPort}
                  onInput={(e) =>
                    set({
                      qtvPort:
                        Number((e.currentTarget as HTMLInputElement).value) ||
                        28000,
                    })
                  }
                />
              </Field>
              <Field label="QTV admin password" htmlFor="qtvpass">
                <div className="flex gap-2">
                  <input
                    id="qtvpass"
                    className="input font-mono"
                    value={s.qtvPassword}
                    onInput={(e) =>
                      set({
                        qtvPassword: (e.currentTarget as HTMLInputElement)
                          .value,
                      })
                    }
                  />
                  <Button
                    aria-label="Generate a new QTV password"
                    onClick={() => set({ qtvPassword: randomPassword() })}
                  >
                    <RefreshIcon />
                  </Button>
                </div>
              </Field>
            </div>
          )}
          <Toggle
            testId="opt-qwfwd"
            label="QWFWD proxy"
            hint="A relay players can route through for a better connection."
            meta={`UDP ${s.qwfwdPort}`}
            checked={s.qwfwd}
            onChange={(v) => set({ qwfwd: v })}
          />
        </div>
      </div>

      <div>
        <SectionTitle>Binaries</SectionTitle>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            testId="bin-latest"
            selected={s.binariesSource === "latest"}
            onSelect={() => set({ binariesSource: "latest" })}
            title={
              <span className="flex items-center gap-2">
                Latest MVDSV + KTX{" "}
                {mv?.version && (
                  <Badge tone="accent">
                    {mv.version} / {ktx?.version}
                  </Badge>
                )}
              </span>
            }
            description={
              latestAvailable
                ? "The newest releases from GitHub, mirrored for the installer. QTV and QWFWD come bundled either way."
                : "The mirror has no build for this platform yet; the bundled binaries will be used."
            }
            disabled={options.platform === "macos"}
          />
          <ChoiceCard
            testId="bin-bundled"
            selected={s.binariesSource === "bundled"}
            onSelect={() => set({ binariesSource: "bundled" })}
            title="Bundled with nQuake"
            description="The MVDSV, KTX, QTV and QWFWD builds shipped in the nQuake distribution files."
            disabled={options.platform === "macos"}
          />
        </div>
      </div>

      <div>
        <SectionTitle>Content</SectionTitle>
        <div className="flex flex-col gap-2">
          <Toggle
            testId="opt-fullmaps"
            label="Full map pack"
            hint="Hundreds of community maps players expect a server to have. The GPL id1 maps are always installed."
            meta={size("sv-maps")}
            checked={s.fullMaps}
            onChange={(v) => set({ fullMaps: v })}
          />
          <Toggle
            testId="opt-sv-ffa"
            label="FFA server"
            hint="A dedicated matchless free-for-all port with map voting."
            meta={size("sv-ffa")}
            checked={s.ffa}
            onChange={(v) => set({ ffa: v })}
          />
          <Toggle
            testId="opt-sv-ca"
            label="Clan Arena server"
            hint="A CA (cace) port."
            meta={size("sv-ca")}
            checked={s.clanArena}
            onChange={(v) => set({ clanArena: v })}
          />
          <Toggle
            testId="opt-sv-fortress"
            label="Team Fortress server"
            hint="A TF port with ThunderVote map voting."
            meta={size("sv-fortress")}
            checked={s.teamFortress}
            onChange={(v) => set({ teamFortress: v })}
          />
        </div>
      </div>
    </div>
  );
}
