import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { WizardCtx } from "../../app/wizard.ts";
import {
  formatBytes,
  formatDuration,
  formatRate,
} from "../../domain/format.ts";
import type { InstallProgress } from "../../net/installer.ts";
import { Button, Callout, ProgressBar } from "../primitives.tsx";

/** How many lines of the log are visible before it scrolls. */
const LOG_ROWS = 10;

/**
 * The install's running log: what has landed, newest at the bottom, with
 * whatever is downloading right now underneath it (a spinner, how far along
 * it is, and a fill behind the row) and then whatever the run does once the
 * downloads are over (packing configs, writing the record). A terminal
 * rather than three truncated paths on one line. It follows the tail like `tail -f`
 * unless the user scrolls up to read something, and then leaves them alone.
 */
/** A small turning mark for a line that is still happening. */
function Spinner() {
  // A ring a little wider than the `+` / `=` column it sits in, centred on
  // it rather than squeezed into it, so file names stay aligned.
  return (
    <span className="relative w-[1ch] shrink-0" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        className="absolute left-1/2 top-1/2 h-[0.75rem] w-[0.75rem] -translate-x-1/2 -translate-y-1/2 animate-spin text-accent motion-reduce:animate-none"
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          opacity="0.25"
        />
        <path
          d="M8 2a6 6 0 0 1 6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </span>
  );
}

function FileLog({
  progress,
  running,
  sizes,
}: {
  progress: InstallProgress;
  running: boolean;
  /** Each planned file's size by destination, for the in-flight percentages. */
  sizes: ReadonlyMap<string, number>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const lines = progress.recent;

  useEffect(() => {
    const el = box.current;
    if (el && follow) el.scrollTo(0, el.scrollHeight);
  }, [lines, progress.active, progress.finishing, follow]);

  return (
    <div
      ref={box}
      data-testid="install-log"
      onScroll={(e) => {
        const el = e.currentTarget;
        // Within a line of the bottom still counts as following it.
        setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
      }}
      className="overflow-y-auto rounded-md border border-line bg-page-bg p-3 font-mono text-xs leading-relaxed"
      style={{ height: `${LOG_ROWS * 1.625 + 1.5}rem` }}
      aria-label="Installed files"
      aria-live="off"
    >
      {lines.length === 0 && !running && (
        <div className="text-muted">Nothing yet.</div>
      )}
      {lines.map((f) => (
        <div key={`${f.at}-${f.dest}`} className="flex gap-2">
          <span
            className={
              f.status === "failed"
                ? "text-danger"
                : f.status === "skipped"
                  ? "text-muted"
                  : "text-success"
            }
            aria-hidden="true"
          >
            {f.status === "failed" ? "x" : f.status === "skipped" ? "=" : "+"}
          </span>
          <span className="min-w-0 flex-1 break-all text-fg">{f.dest}</span>
          <span className="shrink-0 tabular-nums text-muted">
            {f.status === "skipped" ? "unchanged" : formatBytes(f.size)}
          </span>
        </div>
      ))}
      {running &&
        progress.active.map((dest) => {
          const size = sizes.get(dest) ?? 0;
          const got = progress.items.get(dest)?.bytes ?? 0;
          const pct = size > 0 ? Math.min(100, (got / size) * 100) : 0;
          return (
            <div
              key={dest}
              data-testid="install-log-active"
              className="-mx-1.5 flex gap-2 rounded-sm px-1.5"
              style={{
                // The row fills as the file arrives, like a progress bar
                // drawn behind the text. It reaches out past the spinner on
                // the left, so the bar starts before the line does.
                background: `linear-gradient(to right, var(--accent-wash) ${pct}%, transparent ${pct}%)`,
              }}
            >
              <Spinner />
              <span className="min-w-0 flex-1 break-all text-fg">{dest}</span>
              <span className="shrink-0 tabular-nums text-accent">
                {size > 0 ? `${Math.floor(pct)}%` : "…"}
              </span>
              <span className="hidden shrink-0 tabular-nums text-muted sm:inline">
                {formatBytes(got)} / {formatBytes(size)}
              </span>
            </div>
          );
        })}
      {running && progress.finishing && (
        <div data-testid="install-log-finishing" className="flex gap-2">
          <Spinner />
          <span className="min-w-0 flex-1 break-all text-fg">
            {progress.finishing}…
          </span>
        </div>
      )}
      {running &&
        progress.active.length === 0 &&
        !progress.finishing &&
        lines.length === 0 && <div className="text-muted">Preparing…</div>}
    </div>
  );
}

export function InstallStep({ ctx }: { ctx: WizardCtx }) {
  const { run, plan, startInstall, cancelInstall, next, back, caps, mode } =
    ctx;
  const [showLog, setShowLog] = useState(false);
  // Simple mode shows one bar, a percentage and the files going past. The
  // per-package breakdown and the log are Advanced's (or a failure's).
  const detailed = mode === "advanced";

  useEffect(() => {
    if (run.status === "idle") startInstall();
  }, [run.status, startInstall]);

  useEffect(() => {
    if (run.status === "done") {
      const t = setTimeout(next, 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [run.status, next]);

  const p = run.progress;
  const fraction = p && p.bytesTotal > 0 ? p.bytesDone / p.bytesTotal : 0;

  const groups = useMemo(() => {
    if (!plan || !detailed) return [];
    return plan.groups.map((g) => {
      let done = 0;
      let failed = 0;
      for (const item of plan.items) {
        if (item.group !== g.id) continue;
        const st = p?.items.get(item.dest);
        if (!st) continue;
        done +=
          st.status === "done" || st.status === "skipped"
            ? item.size
            : st.bytes;
        if (st.status === "failed") failed++;
      }
      return { ...g, done, failed };
    });
  }, [plan, p, detailed]);

  const running = run.status === "running";
  const sizes = useMemo(
    () => new Map((plan?.items ?? []).map((i) => [i.dest, i.size] as const)),
    [plan],
  );
  const failedItems = run.result?.failed ?? [];

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="install-progress"
      data-status={run.status}
    >
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div
              className="display text-5xl text-fg-bright tabular-nums"
              data-testid="install-percent"
            >
              {Math.floor(fraction * 100)}%
            </div>
            <div className="mt-1 text-sm text-muted">
              {run.status === "running" &&
                (p
                  ? `${formatBytes(p.bytesDone)} of ${formatBytes(p.bytesTotal)}`
                  : "Preparing…")}
              {run.status === "done" && "All files are in place."}
              {run.status === "failed" &&
                `${failedItems.length} file(s) failed.`}
              {run.status === "cancelled" && "Cancelled."}
            </div>
          </div>
          {p && running && (
            <div className="text-right text-sm tabular-nums text-muted">
              <div>{formatRate(p.rate)}</div>
              <div>
                {p.eta !== null
                  ? `${formatDuration(p.eta)} left`
                  : "estimating…"}
              </div>
              <div>
                {p.filesDone.toLocaleString()} / {p.filesTotal.toLocaleString()}{" "}
                files
              </div>
            </div>
          )}
        </div>
        <ProgressBar
          className="mt-3 h-3"
          value={fraction}
          active={running}
          tone={
            run.status === "failed"
              ? "danger"
              : run.status === "done"
                ? "success"
                : "accent"
          }
          label="Install progress"
        />
      </div>

      {!caps.realInstall && (
        <Callout tone="warn">
          Simulated — the numbers move, nothing is downloaded.
        </Callout>
      )}

      <ul className="flex flex-col gap-2">
        {groups.map((g) => (
          <li
            key={g.id}
            className="rounded-md border border-line bg-surface-2/60 px-3.5 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-fg-bright">{g.label}</span>
              <span className="tabular-nums text-muted">
                {g.failed > 0 && (
                  <span className="text-danger">{g.failed} failed · </span>
                )}
                {formatBytes(g.done)} / {formatBytes(g.bytes)}
              </span>
            </div>
            <ProgressBar
              className="mt-2 h-1.5"
              value={g.bytes ? g.done / g.bytes : 1}
              tone={
                g.failed ? "danger" : g.done >= g.bytes ? "success" : "accent"
              }
            />
          </li>
        ))}
      </ul>

      {/* The files going past are the proof that something is happening, so
          this stays in Simple mode too. */}
      {p && (run.status !== "idle" || p.recent.length > 0) && (
        <FileLog progress={p} running={running} sizes={sizes} />
      )}

      {run.status === "failed" && (
        <Callout
          tone="error"
          title="Some files could not be installed"
          testId="install-errors"
        >
          <ul className="mt-1 max-h-48 list-disc space-y-1 overflow-auto pl-4 font-mono text-xs">
            {failedItems.map((f) => (
              <li key={f.item.dest}>
                {f.item.dest}: {f.error}
              </li>
            ))}
            {failedItems.length === 0 && (
              <li>{run.log[run.log.length - 1]?.message}</li>
            )}
          </ul>
          <p className="mt-2 text-sm">Retrying only fetches what's missing.</p>
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {running && (
          <Button
            variant="danger"
            onClick={cancelInstall}
            testId="cancel-install"
          >
            Cancel
          </Button>
        )}
        {run.status === "failed" && (
          <>
            <Button
              variant="primary"
              onClick={startInstall}
              testId="retry-install"
            >
              Retry
            </Button>
            <Button onClick={next}>Continue anyway</Button>
          </>
        )}
        {run.status === "cancelled" && (
          <>
            <Button variant="primary" onClick={startInstall}>
              Resume
            </Button>
            <Button onClick={back}>Back</Button>
          </>
        )}
        {run.log.length > 0 && (detailed || run.status === "failed") && (
          <Button variant="ghost" onClick={() => setShowLog((v) => !v)}>
            {showLog ? "Hide log" : `Log (${run.log.length})`}
          </Button>
        )}
      </div>

      {showLog && (
        <pre className="max-h-64 overflow-auto rounded-md border border-line bg-page-bg p-3 font-mono text-xs leading-relaxed">
          {run.log
            .map(
              (e) =>
                `${new Date(e.at).toLocaleTimeString()} [${e.level}] ${e.message}`,
            )
            .join("\n")}
        </pre>
      )}
    </div>
  );
}
