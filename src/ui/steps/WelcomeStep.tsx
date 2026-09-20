import type { WizardCtx } from "../../app/wizard.ts";
import { MonitorIcon, PhoneIcon, RocketIcon, ServerIcon } from "../icons.tsx";
import { Button, Callout } from "../primitives.tsx";

export function WelcomeStep({ ctx }: { ctx: WizardCtx }) {
  const { caps, catalog } = ctx;
  const ez = catalog.upstream?.components.ezquake?.version;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-base leading-relaxed text-fg">
        <strong className="text-fg-bright">nQuake</strong> is QuakeWorld, ready
        to play: the game, the{" "}
        <strong className="text-fg-bright">ezQuake</strong> client, maps,
        models, textures and a config that just works. Pick a folder, and a few
        minutes later you're fragging.
      </p>

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: <MonitorIcon />,
            title: "Play",
            text: ez
              ? `ezQuake ${ez}, set up and ready`
              : "ezQuake, set up and ready",
          },
          {
            icon: <ServerIcon />,
            title: "Host",
            text: "Your own server, ready to start",
          },
          {
            icon: <RocketIcon />,
            title: "Stay current",
            text: "Run it again any time to update",
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
            ? "The app can write straight into the folder you choose."
            : "Your browser can install straight into a folder you choose."}
        </Callout>
      ) : (
        <Callout tone="warn" title="Simulation mode" testId="cap-mock">
          <span className="flex items-start gap-2">
            <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {caps.mockReason === "mobile"
                ? "QuakeWorld doesn't run on phones and tablets, so nothing will be installed here. You can still walk through the installer to see how it works."
                : caps.mockReason === "no-fs-access"
                  ? "This browser can't write files into a folder. The walkthrough works, but nothing is installed — use Chrome, Edge, Brave or Opera on a computer, or the desktop app."
                  : caps.mockReason === "insecure-context"
                    ? "This page isn't served over HTTPS, so the browser won't allow folder access. The walkthrough runs in simulation."
                    : "Simulation forced by the URL. Nothing will be written."}
            </span>
          </span>
        </Callout>
      )}

      {/* The catalog has to be loaded before Next opens; only the waiting and
          the failure are worth saying out loud. */}
      {catalog.loading ? (
        <p className="text-sm text-muted" data-testid="catalog-loading">
          Getting things ready…
        </p>
      ) : catalog.error ? (
        <Callout tone="error" title="Couldn't reach the downloads">
          <span
            className="flex flex-wrap items-center justify-between gap-2"
            data-testid="catalog-error"
          >
            <span>{catalog.error}</span>
            <Button onClick={ctx.reloadCatalog}>Try again</Button>
          </span>
        </Callout>
      ) : (
        <span hidden data-testid="catalog-ready" />
      )}
    </div>
  );
}
