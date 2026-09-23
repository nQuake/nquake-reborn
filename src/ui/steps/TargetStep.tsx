import { useState } from "preact/hooks";

import type { WizardCtx } from "../../app/wizard.ts";
import {
  platformsDetectedFirst,
  type Platform,
} from "../../domain/platform.ts";
import {
  AppleIcon,
  BothIcon,
  LinuxIcon,
  MonitorIcon,
  ServerIcon,
  WindowsIcon,
} from "../icons.tsx";
import {
  Badge,
  ChoiceCard,
  RequiredMark,
  SectionTitle,
} from "../primitives.tsx";
import { useFlaggedField } from "../use-flagged-field.ts";

/** The mark each OS is known by, for the buttons below. */
const PLATFORM_ICON = {
  windows: WindowsIcon,
  linux: LinuxIcon,
  macos: AppleIcon,
} satisfies Record<Platform, unknown>;

export function TargetStep({ ctx }: { ctx: WizardCtx }) {
  const { options, setOptions, caps, mode } = ctx;
  const simple = mode === "simple";
  // The player name has no default, so the field starts empty. It only turns
  // red once the user has been in it and left it empty — or once they have
  // pressed Next, which is `ctx.flagged` and what brings them back here.
  const [nickTouched, setNickTouched] = useState(false);
  const nickMissing = options.client.config.name.trim().length === 0;
  const nickError = (nickTouched || ctx.flagged) && nickMissing;
  const nickRef = useFlaggedField<HTMLInputElement>(ctx.flagged && nickMissing);
  const platforms = platformsDetectedFirst(caps.platform);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionTitle>What do you want to set up?</SectionTitle>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
          <ChoiceCard
            testId="target-client"
            selected={options.target === "client"}
            onSelect={() => setOptions((o) => ({ ...o, target: "client" }))}
            icon={<MonitorIcon />}
            title="Play"
            description="Everything you need to join a game."
          />
          <ChoiceCard
            testId="target-server"
            selected={options.target === "server"}
            onSelect={() => setOptions((o) => ({ ...o, target: "server" }))}
            icon={<ServerIcon />}
            title="Host"
            description="Your own QuakeWorld server, ready to start."
          />
          <ChoiceCard
            testId="target-both"
            selected={options.target === "both"}
            onSelect={() => setOptions((o) => ({ ...o, target: "both" }))}
            icon={<BothIcon />}
            title="Both"
            description="Play and host from the same folder."
          />
        </div>
      </div>

      <div>
        <SectionTitle>Platform</SectionTitle>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {platforms.map((p) => {
            const selected = options.platform === p.id;
            const Glyph = PLATFORM_ICON[p.id];
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
                <span
                  className={`text-base ${selected ? "text-accent" : "text-muted"}`}
                >
                  <Glyph />
                </span>
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
          <SectionTitle>
            <label htmlFor="nickname-simple">
              Player name
              <RequiredMark />
            </label>
          </SectionTitle>
          <div className="max-w-xs">
            <input
              ref={nickRef}
              id="nickname-simple"
              className="input"
              data-testid="nickname"
              value={options.client.config.name}
              placeholder="Your nickname"
              required
              aria-required="true"
              aria-invalid={nickError}
              maxLength={31}
              autoComplete="nickname"
              onBlur={() => setNickTouched(true)}
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
            {nickError && (
              <p
                className="mt-1.5 text-xs text-danger"
                data-testid="nick-error"
              >
                Enter a player name to continue.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
