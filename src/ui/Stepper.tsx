// The wizard's progress indicator, in two shapes: `Stepper`, a vertical list
// of numbered steps down the side on desktop, and `StepperCompact`, the
// "Step 3 of 8" strip with a thin bar that phones get instead. They are
// separate components because they hang in different places — the list beside
// the card, the strip in the sticky header (`app/App.tsx`).

import { CheckIcon } from "./icons.tsx";
import { ProgressBar } from "./primitives.tsx";

export interface StepInfo {
  id: string;
  label: string;
}

/** Where you are and how far there is to go, in two lines and a bar. */
export function StepperCompact({
  steps,
  current,
}: {
  steps: StepInfo[];
  current: number;
}) {
  const step = steps[current];
  return (
    <div data-testid="stepper-compact">
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
  );
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
  return (
    <ol className="flex flex-col gap-1" data-testid="stepper">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
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
  );
}
