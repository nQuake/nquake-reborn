import { useState } from "preact/hooks";

import { mockDestination, type WizardCtx } from "../../app/wizard.ts";
import { FolderIcon } from "../icons.tsx";
import { Badge, Button, Callout, KeyValue, Toggle } from "../primitives.tsx";

export function FolderStep({ ctx }: { ctx: WizardCtx }) {
  const { caps, folder, chooseFolder, setUseSubfolder, options } = ctx;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const suggested = options.platform === "windows" ? "C:\\nQuake" : "~/nquake";

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-fg">
        Choose where nQuake should live. Anywhere you own is fine —{" "}
        <code>{suggested}</code> is the classic spot.{" "}
        {options.platform === "windows" && (
          <span className="text-muted">
            Avoid Program Files: the game needs to write configs, demos and
            screenshots next to itself.
          </span>
        )}
      </p>

      {!caps.realInstall && (
        <Callout tone="warn" title="Simulation">
          No folder is opened and nothing is written on this device. The rest of
          the installer runs exactly as it would for real.
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
            The browser will ask you to allow saving into the folder.
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
                <span className="font-mono">{folder.picked.name}</span>,
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
                      <Badge tone="info">
                        by this installer — unchanged files will be kept
                      </Badge>,
                    ],
                  ] as [string, preact.ComponentChildren][])
                : []),
              ...(folder.summary.hasClientConfig
                ? ([
                    [
                      "Your config",
                      "config.cfg will be backed up with a timestamp",
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
            <Callout tone="info" title="Update mode">
              Files that already exist with the right size are kept; new and
              changed files are downloaded.
            </Callout>
          )}
        </div>
      )}
    </div>
  );
}
