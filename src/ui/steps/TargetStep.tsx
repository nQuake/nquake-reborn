import type { WizardCtx } from "../../app/wizard.ts";
import { PLATFORMS } from "../../domain/platform.ts";
import { BothIcon, MonitorIcon, ServerIcon } from "../icons.tsx";
import { Badge, ChoiceCard, Field, SectionTitle } from "../primitives.tsx";

export function TargetStep({ ctx }: { ctx: WizardCtx }) {
  const { options, setOptions, caps, mode } = ctx;
  const simple = mode === "simple";
  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionTitle hint="You can run both from the same folder — a server for your friends and the client you play with.">
          What do you want to set up?
        </SectionTitle>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
          <ChoiceCard
            testId="target-client"
            selected={options.target === "client"}
            onSelect={() => setOptions((o) => ({ ...o, target: "client" }))}
            icon={<MonitorIcon />}
            title="Play"
            description="The ezQuake client with everything needed to join servers."
          />
          <ChoiceCard
            testId="target-server"
            selected={options.target === "server"}
            onSelect={() => setOptions((o) => ({ ...o, target: "server" }))}
            icon={<ServerIcon />}
            title="Host"
            description="An MVDSV + KTX server, with QTV spectating and a QWFWD proxy."
          />
          <ChoiceCard
            testId="target-both"
            selected={options.target === "both"}
            onSelect={() => setOptions((o) => ({ ...o, target: "both" }))}
            icon={<BothIcon />}
            title="Both"
            description="Client and server side by side in one folder."
          />
        </div>
      </div>

      <div>
        <SectionTitle hint="Which system will run it. Pick a different one to prepare a folder for another machine, e.g. a Linux server from a Windows laptop.">
          Platform
        </SectionTitle>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const selected = options.platform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`platform-${p.id}`}
                onClick={() => setOptions((o) => ({ ...o, platform: p.id }))}
                className={[
                  "focus-ring inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition",
                  selected
                    ? "border-accent bg-accent-wash text-fg-bright"
                    : "border-line bg-surface-2/60 text-fg hover:border-line-strong",
                ].join(" ")}
              >
                {p.label}
                {caps.platform === p.id && (
                  <Badge tone="accent">detected</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {simple && options.target !== "server" && (
        <div>
          <SectionTitle hint="Optional — you can change it in-game with /name.">
            Nickname
          </SectionTitle>
          <div className="max-w-xs">
            <Field label="Nickname" htmlFor="nickname-simple">
              <input
                id="nickname-simple"
                className="input"
                data-testid="nickname"
                value={options.client.config.name}
                maxLength={31}
                autoComplete="nickname"
                onInput={(e) =>
                  setOptions((o) => ({
                    ...o,
                    client: {
                      ...o.client,
                      config: {
                        ...o.client.config,
                        name: (e.currentTarget as HTMLInputElement).value,
                      },
                    },
                  }))
                }
              />
            </Field>
          </div>
        </div>
      )}

      <p className="text-sm text-muted" data-testid="mode-hint">
        {simple ? (
          <>
            <strong className="text-fg">Simple</strong> installs the QuakeWorld
            standard setup: the newest ezQuake, 24-bit textures, WASD, and for a
            server one port at 27500 with QTV, QWFWD and the full map pack.
            Switch to <strong className="text-fg">Advanced</strong> (top right)
            to change any of it.
          </>
        ) : (
          <>
            <strong className="text-fg">Advanced</strong>: the next steps let
            you pick the ezQuake build, add-ons, keys, and every server setting.
          </>
        )}
      </p>
    </div>
  );
}
