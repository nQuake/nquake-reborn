import { formatBytes } from "../../domain/format.ts";
import type { WizardCtx } from "../../app/wizard.ts";
import { MonitorIcon, PhoneIcon, RocketIcon, ServerIcon } from "../icons.tsx";
import { Button, Callout, ExternalLink } from "../primitives.tsx";

const LEGACY = [
  {
    label: "Windows installer (.exe)",
    href: "https://github.com/nQuake/client-win32/raw/master/releases/nquake_installer-latest.exe",
  },
  {
    label: "Linux installer (.tar.gz)",
    href: "https://github.com/nQuake/client-linux/raw/master/releases/nquake_installer-linux-latest.tar.gz",
  },
  {
    label: "macOS installer (.tar.gz)",
    href: "https://github.com/nQuake/client-macosx/raw/master/releases/nquake_installer-macosx-latest.tar.gz",
  },
];

export function WelcomeStep({ ctx }: { ctx: WizardCtx }) {
  const { caps, catalog } = ctx;
  const totalFiles = catalog.manifest
    ? Object.values(catalog.manifest.packages).reduce(
        (n, p) => n + p.files.length,
        0,
      )
    : 0;
  const totalBytes = catalog.manifest
    ? Object.values(catalog.manifest.packages).reduce((n, p) => n + p.bytes, 0)
    : 0;
  const ez = catalog.upstream?.components.ezquake?.version;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-base leading-relaxed text-fg">
          <strong className="text-fg-bright">nQuake</strong> is the QuakeWorld
          package for newcomers and for anyone who just wants to get fragging:
          the game data, the <strong className="text-fg-bright">ezQuake</strong>{" "}
          client, maps, textures, models and a sane config, ready in one folder.
          This installer does the same job the old{" "}
          <code className="text-sm">.exe</code> did — from your browser,
          straight into a folder you pick.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: <MonitorIcon />,
            title: "Client",
            text: ez
              ? `ezQuake ${ez}, the newest release`
              : "ezQuake, the QuakeWorld client",
          },
          {
            icon: <ServerIcon />,
            title: "Server",
            text: "MVDSV + KTX with QTV and QWFWD, configured and ready to start",
          },
          {
            icon: <RocketIcon />,
            title: "Modern",
            text: "Resumable per-file downloads; re-run it later to update",
          },
        ].map((f) => (
          <li
            key={f.title}
            className="flex gap-3 rounded-md border border-line bg-surface-2/60 px-3.5 py-3"
          >
            <span className="mt-0.5 text-xl text-accent">{f.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-fg-bright">
                {f.title}
              </span>
              <span className="block text-sm text-muted">{f.text}</span>
            </span>
          </li>
        ))}
      </ul>

      {caps.realInstall ? (
        <Callout tone="success" title="Ready to install" testId="cap-real">
          {caps.surface === "tauri"
            ? "The desktop app can write straight into the folder you choose."
            : "Your browser can write into a folder you choose (File System Access API)."}
        </Callout>
      ) : (
        <Callout tone="warn" title="Simulation mode" testId="cap-mock">
          <span className="flex items-start gap-2">
            <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {caps.mockReason === "mobile"
                ? "QuakeWorld doesn't run on phones and tablets, so nothing will be downloaded here. You can still walk through the whole installer to see how it works."
                : caps.mockReason === "no-fs-access"
                  ? "This browser can't write files into a folder. The walkthrough works, but nothing is installed — use Chrome, Edge, Brave or Opera on a computer, or the desktop app."
                  : caps.mockReason === "insecure-context"
                    ? "This page isn't served over HTTPS, so the browser won't allow folder access. The walkthrough runs in simulation."
                    : "Simulation forced by the URL. Nothing will be written."}
            </span>
          </span>
        </Callout>
      )}

      <div className="rounded-md border border-line bg-surface-2/40 px-3.5 py-3 text-sm">
        {catalog.loading ? (
          <span className="text-muted" data-testid="catalog-loading">
            Loading the file catalog…
          </span>
        ) : catalog.error ? (
          <span
            className="flex flex-wrap items-center justify-between gap-2"
            data-testid="catalog-error"
          >
            <span className="text-danger">
              Couldn't load the file catalog: {catalog.error}
            </span>
            <Button onClick={ctx.reloadCatalog}>Try again</Button>
          </span>
        ) : (
          <span
            className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-muted"
            data-testid="catalog-ready"
          >
            <span>
              Catalog:{" "}
              <span className="text-fg">
                {totalFiles.toLocaleString()} files
              </span>
              , <span className="text-fg">{formatBytes(totalBytes)}</span>{" "}
              across every package
            </span>
            {catalog.manifest?.generated && (
              <span>
                Updated{" "}
                {new Date(catalog.manifest.generated).toLocaleDateString()}
              </span>
            )}
          </span>
        )}
      </div>

      <details className="text-sm text-muted">
        <summary className="cursor-pointer select-none hover:text-fg">
          Prefer the classic downloadable installers?
        </summary>
        <ul className="mt-2 flex flex-col gap-1 pl-4">
          {LEGACY.map((l) => (
            <li key={l.href}>
              <ExternalLink href={l.href}>{l.label}</ExternalLink>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
