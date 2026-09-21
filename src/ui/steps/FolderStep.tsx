import { useEffect, useState } from "preact/hooks";

import { mockDestination, type WizardCtx } from "../../app/wizard.ts";
import { displayPath } from "../../platform/destination.ts";
import { FolderIcon } from "../icons.tsx";
import { Badge, Button, Callout, KeyValue, Toggle } from "../primitives.tsx";

export function FolderStep({ ctx }: { ctx: WizardCtx }) {
  const { caps, folder, chooseFolder, setUseSubfolder, options } = ctx;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The desktop app can name a folder without a dialog, so it gets the
  // standard `~/nquake` picked for it — Next works straight away, and
  // "Choose a different folder…" is there for anyone who wants elsewhere.
  // A browser cannot: the File System Access API only ever hands the page a
  // folder the user picked themselves, so there the button is the only way in.
  const canDefault = caps.surface === "tauri" && caps.realInstall;
  const [defaultPath, setDefaultPath] = useState<string | null>(null);
  useEffect(() => {
    if (!canDefault) return;
    let live = true;
    void (async () => {
      try {
        const { defaultTauriDestination, defaultTauriPath } =
          await import("../../platform/tauri.ts");
        const path = await defaultTauriPath();
        if (!live) return;
        setDefaultPath(path);
        // Only while nothing is chosen: the step remounts on every visit, so
        // coming back never throws away the folder the user picked instead.
        if (!folder) await chooseFolder(await defaultTauriDestination());
      } catch {
        /* No home directory to offer; the picker still works. */
      }
    })();
    return () => {
      live = false;
    };
    // Mount-time decision only — `folder` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDefault]);

  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!caps.realInstall) {
        await chooseFolder(mockDestination());
      } else if (caps.surface === "tauri") {
        const { pickTauriDestination } =
          await import("../../platform/tauri.ts");
        const dest = await pickTauriDestination();
        if (dest) await chooseFolder(dest);
      } else {
        const { pickFsAccessDestination } =
          await import("../../platform/fs-access.ts");
        const dest = await pickFsAccessDestination();
        if (dest) await chooseFolder(dest);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const suggested =
    defaultPath ?? (options.platform === "windows" ? "C:\\nQuake" : "~/nquake");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-fg">
        {canDefault ? (
          <>
            nQuake goes in <code>{suggested}</code> unless you say otherwise.
          </>
        ) : (
          <>
            Where should nQuake live? <code>{suggested}</code> is a good spot.
          </>
        )}{" "}
        {options.platform === "windows" && (
          <span className="text-muted">
            Not Program Files — the game needs to write next to itself.
          </span>
        )}
      </p>

      {!caps.realInstall && (
        <Callout tone="warn" title="Simulation">
          Nothing is written on this device — the rest of the installer runs
          exactly as it would for real.
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={pick}
          disabled={busy}
          testId="pick-folder"
        >
          <FolderIcon className="h-5 w-5" />
          {folder
            ? "Choose a different folder…"
            : caps.realInstall
              ? "Choose folder…"
              : "Use a simulated folder"}
        </Button>
        {caps.surface === "web" && caps.realInstall && (
          <span className="text-xs text-muted">
            Your browser will ask you to allow saving into it.
          </span>
        )}
        {canDefault && !folder && (
          <span className="text-xs text-muted">
            Or just press Next to use the default.
          </span>
        )}
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {folder && (
        <div className="flex flex-col gap-4" data-testid="folder-summary">
          <KeyValue
            rows={[
              [
                "Folder",
                <span className="font-mono break-all">
                  {displayPath(
                    folder.picked,
                    folder.useSubfolder ? "nQuake" : undefined,
                  )}
                </span>,
              ],
              [
                "Contents",
                folder.summary.empty ? (
                  <Badge tone="success">empty</Badge>
                ) : folder.summary.existingInstall ? (
                  <Badge tone="accent">existing nQuake / Quake install</Badge>
                ) : (
                  <span>
                    {folder.summary.entries} item(s) — not an nQuake folder
                  </span>
                ),
              ],
              ...(folder.summary.previousState
                ? ([
                    [
                      "Installed before",
                      <Badge tone="info">yes — this will update it</Badge>,
                    ],
                  ] as [string, preact.ComponentChildren][])
                : []),
              ...(folder.summary.hasClientConfig
                ? ([
                    [
                      "Your config",
                      "will be backed up before anything changes",
                    ],
                  ] as [string, preact.ComponentChildren][])
                : []),
            ]}
          />
          {!folder.summary.empty && !folder.summary.existingInstall && (
            <Toggle
              testId="use-subfolder"
              label='Create an "nQuake" subfolder inside it'
              hint="Keeps the game files apart from whatever is already there."
              checked={folder.useSubfolder}
              onChange={setUseSubfolder}
            />
          )}
          {folder.summary.existingInstall && (
            <Callout tone="info" title="Update">
              Only what's missing or out of date will be downloaded.
            </Callout>
          )}
        </div>
      )}
    </div>
  );
}
