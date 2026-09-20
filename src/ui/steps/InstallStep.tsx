import { useEffect, useMemo, useState } from "preact/hooks";

import type { WizardCtx } from "../../app/wizard.ts";
import {
  formatBytes,
  formatDuration,
  formatRate,
} from "../../domain/format.ts";
import { Button, Callout, ProgressBar } from "../primitives.tsx";

export function InstallStep({ ctx }: { ctx: WizardCtx }) {
  const { run, plan, startInstall, cancelInstall, next, back, caps } = ctx;
  const [showLog, setShowLog] = useState(false);

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
    if (!plan) return [];
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
  }, [plan, p]);

  const running = run.status === "running";
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
          Simulated: the numbers move, the network stays quiet.
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

      {p && running && p.active.length > 0 && (
        <div
          className="truncate font-mono text-xs text-muted"
          data-testid="active-files"
        >
          {p.active.slice(0, 3).join("  ·  ")}
          {p.active.length > 3 && `  ·  +${p.active.length - 3}`}
        </div>
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
          <p className="mt-2 text-sm">
            Retrying re-downloads only what's missing; everything that landed is
            kept.
          </p>
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
        {run.log.length > 0 && (
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
