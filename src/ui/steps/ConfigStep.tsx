import { useState } from "preact/hooks";

import type { WizardCtx } from "../../app/wizard.ts";
import { renderPresetCfg } from "../../domain/configs.ts";
import {
  BINDABLE_KEYS,
  KEY_LAYOUTS,
  type KeyLayout,
  type MovementKeys,
} from "../../domain/options.ts";
import { ChoiceCard, Field, SectionTitle, Toggle } from "../primitives.tsx";

const LAYOUTS: { id: KeyLayout; title: string; description: string }[] = [
  { id: "wasd", title: "WASD", description: "The modern default." },
  {
    id: "esdf",
    title: "ESDF",
    description: "One column right — more keys under the left hand.",
  },
  { id: "arrows", title: "Arrow keys", description: "The 1996 way." },
  { id: "custom", title: "Custom", description: "Pick each key yourself." },
];

const KEY_LABELS: [keyof MovementKeys, string][] = [
  ["forward", "Forward"],
  ["back", "Back"],
  ["left", "Move left"],
  ["right", "Move right"],
  ["jump", "Jump"],
];

export function ConfigStep({ ctx }: { ctx: WizardCtx }) {
  const { options, setOptions } = ctx;
  const cfg = options.client.config;
  const [nickTouched, setNickTouched] = useState(false);
  const setCfg = (patch: Partial<typeof cfg>) =>
    setOptions((o) => ({
      ...o,
      client: { ...o.client, config: { ...o.client.config, ...patch } },
    }));

  const pickLayout = (layout: KeyLayout) =>
    setCfg(
      layout === "custom"
        ? { layout }
        : { layout, keys: { ...KEY_LAYOUTS[layout] } },
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nickname"
          htmlFor="nickname"
          hint="Required. Your in-game name — later, /name changes it, and /cl_fakename, which is what prefixes your team messages."
          error={
            nickTouched && !cfg.name.trim()
              ? "Enter a nickname to continue."
              : null
          }
        >
          <input
            id="nickname"
            className="input"
            data-testid="nickname"
            value={cfg.name}
            maxLength={31}
            placeholder="Your nickname"
            required
            aria-required="true"
            autoComplete="nickname"
            onBlur={() => setNickTouched(true)}
            onInput={(e) =>
              setCfg({ name: (e.currentTarget as HTMLInputElement).value })
            }
          />
        </Field>
        <div className="flex flex-col justify-end">
          <Toggle
            testId="invert-mouse"
            label="Invert mouse"
            hint="Push forward to look down."
            checked={cfg.invertMouse}
            onChange={(v) => setCfg({ invertMouse: v })}
          />
        </div>
      </div>

      <div>
        <SectionTitle hint="Movement keys. Everything else — weapons, teamsay, the works — comes from nQuake's default config.">
          Keys
        </SectionTitle>
        <div
          role="radiogroup"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {LAYOUTS.map((l) => (
            <ChoiceCard
              key={l.id}
              testId={`layout-${l.id}`}
              selected={cfg.layout === l.id}
              onSelect={() => pickLayout(l.id)}
              title={l.title}
              description={l.description}
            />
          ))}
        </div>
        {cfg.layout === "custom" && (
          <div
            className="mt-4 grid gap-3 sm:grid-cols-5"
            data-testid="custom-keys"
          >
            {KEY_LABELS.map(([key, label]) => (
              <Field key={key} label={label} htmlFor={`key-${key}`}>
                <select
                  id={`key-${key}`}
                  className="input"
                  value={cfg.keys[key]}
                  onChange={(e) =>
                    setCfg({
                      keys: {
                        ...cfg.keys,
                        [key]: (e.currentTarget as HTMLSelectElement).value,
                      },
                    })
                  }
                >
                  {BINDABLE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-muted hover:text-fg">
          Preview <code>ezquake/configs/preset.cfg</code>
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-page-bg p-3 font-mono text-xs leading-relaxed text-fg">
          {renderPresetCfg(cfg, "linux")}
        </pre>
      </details>
    </div>
  );
}
