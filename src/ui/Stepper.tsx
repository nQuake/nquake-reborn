// The wizard's progress indicator: a vertical list of numbered steps on
// desktop, a compact "Step 3 of 8" strip with a thin bar on phones.

import { CheckIcon } from "./icons.tsx";
import { ProgressBar } from "./primitives.tsx";

export interface StepInfo {
  id: string;
  label: string;
}

export function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: StepInfo[];
  current: number;
  /** Allowed only backwards, and never once the install has started. */
  onJump?: (index: number) => void;
}) {
  const step = steps[current];
  return (
    <>
      <div className="md:hidden" data-testid="stepper-compact">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-medium text-fg-bright">{step?.label}</span>
          <span className="tabular-nums text-muted">
            Step {current + 1} of {steps.length}
          </span>
        </div>
        <ProgressBar
          value={(current + 1) / steps.length}
          label="Wizard progress"
        />
      </div>
      <ol className="hidden md:flex md:flex-col md:gap-1" data-testid="stepper">
        {steps.map((s, i) => {
          const state =
            i < current ? "done" : i === current ? "current" : "todo";
          const clickable = onJump && i < current;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onJump?.(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={[
                  "focus-ring flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition",
                  state === "current"
                    ? "bg-accent-wash text-fg-bright"
                    : "text-muted",
                  clickable
                    ? "cursor-pointer hover:bg-surface-2 hover:text-fg"
                    : "cursor-default",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    state === "done"
                      ? "border-success bg-success text-accent-fg"
                      : state === "current"
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-line-strong",
                  ].join(" ")}
                >
                  {state === "done" ? (
                    <CheckIcon className="h-3.5 w-3.5" stroke-width="3" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={state === "current" ? "font-medium" : ""}>
                  {s.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
