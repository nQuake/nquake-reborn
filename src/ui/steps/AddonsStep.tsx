import type { WizardCtx } from "../../app/wizard.ts";
import { formatBytes } from "../../domain/format.ts";
import { packageBytes } from "../../domain/manifest.ts";
import { installsTextures } from "../../domain/options.ts";
import { Toggle } from "../primitives.tsx";

/**
 * Textures and mods: content that goes into the game folders, not a choice
 * about the client, so it is a step of its own after it.
 */
export function AddonsStep({ ctx }: { ctx: WizardCtx }) {
  const { options, setOptions, catalog } = ctx;
  const c = options.client;
  const m = catalog.manifest;
  const size = (pkg: string) => (m ? formatBytes(packageBytes(m, pkg)) : "");

  const setClient = (patch: Partial<typeof c>) =>
    setOptions((o) => ({ ...o, client: { ...o.client, ...patch } }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-sm text-muted">
          Optional extras, on top of what every install gets. Sizes are what
          gets downloaded.
        </p>
        <div className="flex flex-col gap-2">
          <Toggle
            testId="opt-textures"
            label="24-bit textures"
            hint={
              c.hdTextures
                ? "Not needed: the QRP textures below replace these."
                : "Replacement world textures for the standard maps. Recommended."
            }
            meta={size("textures")}
            checked={installsTextures(c)}
            disabled={c.hdTextures}
            onChange={(v) => setClient({ textures: v })}
          />
          <Toggle
            testId="opt-hd-textures"
            label="High-resolution textures (QRP)"
            hint="The Quake Retexturing Project packs — much sharper, much bigger."
            meta={size("addon-textures")}
            checked={c.hdTextures}
            onChange={(v) => setClient({ hdTextures: v })}
          />
          <Toggle
            testId="opt-fortress"
            label="Team Fortress"
            hint="The classic class-based mod, with its maps."
            meta={size("addon-fortress")}
            checked={c.teamFortress}
            onChange={(v) => setClient({ teamFortress: v })}
          />
          <Toggle
            testId="opt-clanarena"
            label="Clan Arena"
            hint="Round-based team mode (Arena + Prox)."
            meta={size("addon-clanarena")}
            checked={c.clanArena}
            onChange={(v) => setClient({ clanArena: v })}
          />
        </div>
      </div>
    </div>
  );
}
