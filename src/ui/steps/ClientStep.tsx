import { useState } from "preact/hooks";

import type { WizardCtx } from "../../app/wizard.ts";
import { formatBytes } from "../../domain/format.ts";
import { PAK1_SIZE } from "../../domain/plan.ts";
import { UPSTREAM_TARGET } from "../../domain/platform.ts";
import {
  Badge,
  Button,
  Callout,
  ChoiceCard,
  ExternalLink,
  SectionTitle,
} from "../primitives.tsx";

export function ClientStep({ ctx }: { ctx: WizardCtx }) {
  const { options, setOptions, catalog, pak1, setPak1 } = ctx;
  const c = options.client;
  const ez = catalog.upstream?.components.ezquake;
  const ezTarget = UPSTREAM_TARGET.ezquake[options.platform];
  const latestAvailable = !!(ez && ezTarget && ez.targets[ezTarget]);
  const bundledAvailable = options.platform !== "linux";
  const [pakError, setPakError] = useState<string | null>(null);

  const setClient = (patch: Partial<typeof c>) =>
    setOptions((o) => ({ ...o, client: { ...o.client, ...patch } }));

  const onPak = (file: File | null) => {
    setPakError(null);
    if (!file) {
      setPak1(null);
      return;
    }
    if (file.size !== PAK1_SIZE) {
      setPakError(
        `That file is ${formatBytes(file.size)}; the registered pak1.pak is exactly ${formatBytes(PAK1_SIZE)} (${PAK1_SIZE.toLocaleString()} bytes). Check you picked Quake/id1/pak1.pak.`,
      );
      setPak1(null);
      return;
    }
    setPak1(file);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionTitle hint="The client binary itself. Everything else nQuake ships is the same either way.">
          ezQuake
        </SectionTitle>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            testId="ezquake-latest"
            selected={c.ezquakeSource === "latest"}
            onSelect={() => setClient({ ezquakeSource: "latest" })}
            title={
              <span className="flex items-center gap-2">
                Latest release
                {ez?.version && <Badge tone="accent">{ez.version}</Badge>}
              </span>
            }
            description={
              latestAvailable
                ? `The newest ezQuake from GitHub, mirrored for the installer${ez?.publishedAt ? ` (released ${new Date(ez.publishedAt).toLocaleDateString()})` : ""}.`
                : "The mirror hasn't published a build for this platform yet; the bundled version will be used instead."
            }
          />
          <ChoiceCard
            testId="ezquake-bundled"
            selected={c.ezquakeSource === "bundled"}
            onSelect={() => setClient({ ezquakeSource: "bundled" })}
            disabled={!bundledAvailable}
            title="Bundled with nQuake"
            description={
              bundledAvailable
                ? "The ezQuake build shipped in the nQuake distribution files. Older, but known to work with these configs."
                : "nQuake ships no usable Linux binary; the latest release is the only option."
            }
          />
        </div>
      </div>

      <div>
        <SectionTitle hint="nQuake installs the shareware episode. If you own Quake, add pak1.pak to get the full game — the installer copies it in and drops the GPL stand-in maps.">
          Own the full game?
        </SectionTitle>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-3.5 py-2 text-sm font-medium text-fg-bright hover:bg-surface-3">
              <input
                type="file"
                accept=".pak,application/octet-stream"
                className="sr-only"
                data-testid="pak1-input"
                onChange={(e) => {
                  const input = e.currentTarget as HTMLInputElement;
                  onPak(input.files?.[0] ?? null);
                  input.value = "";
                }}
              />
              {pak1 ? "Choose a different pak1.pak…" : "Add pak1.pak…"}
            </label>
            {pak1 && (
              <span className="flex items-center gap-2 text-sm">
                <Badge tone="success">pak1.pak verified</Badge>
                <Button variant="ghost" onClick={() => onPak(null)}>
                  Remove
                </Button>
              </span>
            )}
          </div>
          {pakError && <Callout tone="error">{pakError}</Callout>}
          <p className="text-xs text-muted">
            It's in your Quake folder under <code>id1/</code> — for Steam:{" "}
            <code>steamapps/common/Quake/id1/pak1.pak</code>. Don't have it?{" "}
            <ExternalLink href="https://store.steampowered.com/app/2310/">
              Quake on Steam
            </ExternalLink>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
