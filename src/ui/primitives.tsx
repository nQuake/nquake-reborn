// The small vocabulary every step is built from: Button, Card, Field,
// Toggle, ChoiceCard, Callout, ProgressBar, Badge. Tailwind utilities over
// the tokens in `styles/theme.css`.

import type { ComponentChildren, JSX } from "preact";

import { CheckIcon, InfoIcon, WarnIcon } from "./icons.tsx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "size"
> {
  variant?: ButtonVariant;
  size?: "md" | "lg";
  testId?: string;
}

const BUTTON: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg hover:brightness-110 active:brightness-95 shadow-[0_1px_0_rgba(0,0,0,.25)]",
  secondary:
    "bg-surface-2 text-fg-bright border border-line-strong hover:bg-surface-3",
  ghost: "text-fg hover:bg-surface-2",
  danger:
    "bg-danger-wash text-danger border border-danger/40 hover:brightness-110",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  testId,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={[
        "focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "lg" ? "px-5 py-3 text-base" : "px-3.5 py-2 text-sm",
        BUTTON[variant],
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ComponentChildren;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface shadow-[0_8px_30px_rgba(0,0,0,.12)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ComponentChildren;
  hint?: ComponentChildren;
}) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {children}
      </h3>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  error,
}: {
  label: ComponentChildren;
  hint?: ComponentChildren;
  htmlFor?: string;
  children: ComponentChildren;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg-bright">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({
  label,
  hint,
  meta,
  checked,
  onChange,
  disabled,
  testId,
}: {
  label: ComponentChildren;
  hint?: ComponentChildren;
  /** Right-aligned detail, typically a size. */
  meta?: ComponentChildren;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label
      data-testid={testId}
      data-checked={checked ? "true" : "false"}
      className={`flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface-2/60 px-3 py-3 transition hover:border-line-strong ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) =>
            onChange((e.currentTarget as HTMLInputElement).checked)
          }
        />
        <span className="h-6 w-10 rounded-full bg-surface-3 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-fg-bright shadow transition peer-checked:translate-x-4 peer-checked:bg-accent-fg" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-fg-bright">{label}</span>
          {meta && (
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {meta}
            </span>
          )}
        </span>
        {hint && <span className="mt-0.5 text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  meta,
  testId,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ComponentChildren;
  description?: ComponentChildren;
  icon?: ComponentChildren;
  meta?: ComponentChildren;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      data-testid={testId}
      onClick={onSelect}
      className={[
        "focus-ring relative flex w-full cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 text-left transition",
        selected
          ? "border-accent bg-accent-wash shadow-[inset_0_0_0_1px_var(--accent)]"
          : "border-line bg-surface-2/60 hover:border-line-strong",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {icon && (
        <span className={`text-2xl ${selected ? "text-accent" : "text-muted"}`}>
          {icon}
        </span>
      )}
      <span className="text-base font-semibold text-fg-bright">{title}</span>
      {description && <span className="text-sm text-muted">{description}</span>}
      {meta && (
        <span className="mt-1 text-xs tabular-nums text-muted">{meta}</span>
      )}
      <span
        className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border ${
          selected
            ? "border-accent bg-accent text-accent-fg"
            : "border-line-strong"
        }`}
      >
        {selected && <CheckIcon className="h-3.5 w-3.5" stroke-width="3" />}
      </span>
    </button>
  );
}

export type Tone = "info" | "warn" | "error" | "success";

const CALLOUT: Record<Tone, string> = {
  info: "border-line bg-surface-2 text-fg",
  warn: "border-warn/40 bg-warn-wash text-fg",
  error: "border-danger/40 bg-danger-wash text-fg",
  success: "border-success/40 bg-success-wash text-fg",
};
const CALLOUT_ICON: Record<Tone, string> = {
  info: "text-muted",
  warn: "text-warn",
  error: "text-danger",
  success: "text-success",
};

export function Callout({
  tone = "info",
  title,
  children,
  testId,
}: {
  tone?: Tone;
  title?: ComponentChildren;
  children?: ComponentChildren;
  testId?: string;
}) {
  const Icon =
    tone === "info" ? InfoIcon : tone === "success" ? CheckIcon : WarnIcon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-testid={testId}
      className={`flex gap-3 rounded-md border px-3.5 py-3 text-sm ${CALLOUT[tone]}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${CALLOUT_ICON[tone]}`} />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold text-fg-bright">{title}</div>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  active,
  tone = "accent",
  className = "",
  label,
}: {
  /** 0..1 */
  value: number;
  active?: boolean;
  tone?: "accent" | "success" | "danger";
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const color =
    tone === "success"
      ? "bg-success"
      : tone === "danger"
        ? "bg-danger"
        : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-3 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${color} ${active ? "bar-active" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "info",
}: {
  children: ComponentChildren;
  tone?: Tone | "accent";
}) {
  const cls =
    tone === "accent"
      ? "bg-accent-wash text-accent"
      : tone === "success"
        ? "bg-success-wash text-success"
        : tone === "warn"
          ? "bg-warn-wash text-warn"
          : tone === "error"
            ? "bg-danger-wash text-danger"
            : "bg-surface-3 text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export function KeyValue({
  rows,
  testId,
}: {
  rows: [ComponentChildren, ComponentChildren][];
  testId?: string;
}) {
  return (
    <dl
      className="divide-y divide-line rounded-md border border-line bg-surface-2/60 text-sm"
      data-testid={testId}
    >
      {rows.map(([k, v], i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-4 px-3 py-2"
        >
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium text-fg-bright">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ComponentChildren;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-link underline decoration-link/40 underline-offset-2 hover:decoration-link ${className}`}
    >
      {children}
    </a>
  );
}
