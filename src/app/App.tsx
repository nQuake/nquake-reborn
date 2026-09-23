// The installer shell: header with the wordmark, the stepper (a sidebar on
// desktop, a strip on phones), the current step in a card, and the Back /
// Next footer. All state lives in `useWizard`.
//
// The header is sticky: the wordmark says which page this is and the strip
// says how far in you are, and a phone's screen is short enough that both
// were gone two flicks into the first step. It compacts once the page moves
// (slogan out, wordmark down a size) so a sticky bar costs a phone as little
// of the step as possible.

import { useEffect, useState } from "preact/hooks";

import { BUILD_COMMIT, BUILD_LABEL, REPO_URL } from "../build-env.ts";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  GithubIcon,
  MoonIcon,
  SunIcon,
} from "../ui/icons.tsx";
import { Button, Callout, Card } from "../ui/primitives.tsx";
import { Stepper, StepperCompact } from "../ui/Stepper.tsx";
import { AddonsStep } from "../ui/steps/AddonsStep.tsx";
import { ClientStep } from "../ui/steps/ClientStep.tsx";
import { ConfigStep } from "../ui/steps/ConfigStep.tsx";
import { DoneStep } from "../ui/steps/DoneStep.tsx";
import { FolderStep } from "../ui/steps/FolderStep.tsx";
import { InstallStep } from "../ui/steps/InstallStep.tsx";
import { ReviewStep } from "../ui/steps/ReviewStep.tsx";
import { ServerStep } from "../ui/steps/ServerStep.tsx";
import { TargetStep } from "../ui/steps/TargetStep.tsx";
import { WelcomeStep } from "../ui/steps/WelcomeStep.tsx";
import type { Capabilities } from "../platform/capabilities.ts";
import { useSelfUpdate, type SelfUpdate } from "./self-update.ts";
import {
  applyTextSize,
  initialTextSize,
  nextTextSize,
  type TextSize,
} from "./text-size.ts";
import { applyTheme, initialTheme, type Theme } from "./theme.ts";
import {
  QUERY,
  canProceed,
  missingHere,
  useWizard,
  type StepId,
  type WizardCtx,
} from "./wizard.ts";

const TITLES: Record<StepId, { title: string; lead: string }> = {
  welcome: { title: "Welcome", lead: "QuakeWorld in a few clicks." },
  target: { title: "What to install", lead: "Play, host, or both." },
  client: { title: "Client", lead: "Which ezQuake, and which Quake." },
  addons: { title: "Add-ons", lead: "Textures and mods to bring along." },
  config: {
    title: "Your setup",
    lead: "A minute here saves you an evening in the console.",
  },
  server: { title: "Server", lead: "Name it, pick ports, choose what runs." },
  folder: { title: "Folder", lead: "Where it all goes." },
  review: { title: "Review", lead: "Last look before the downloads start." },
  install: { title: "Installing", lead: "Sit tight." },
  done: { title: "Done", lead: "Happy gibbing!" },
};

const STEP_VIEW: Record<
  StepId,
  (p: { ctx: WizardCtx }) => preact.JSX.Element | null
> = {
  welcome: WelcomeStep,
  target: TargetStep,
  client: ClientStep,
  addons: AddonsStep,
  config: ConfigStep,
  server: ServerStep,
  folder: FolderStep,
  review: ReviewStep,
  install: InstallStep,
  done: DoneStep,
};

const BASE_URL: string = import.meta.env.BASE_URL;

export function App({ caps }: { caps: Capabilities }) {
  const ctx = useWizard(caps);
  const [theme, setTheme] = useState<Theme>(() => initialTheme(QUERY.theme));
  useEffect(() => applyTheme(theme), [theme]);
  // Phones cannot pinch-zoom this page, so this is how the type gets bigger.
  const [textSize, setTextSize] = useState<TextSize>(() =>
    initialTextSize(QUERY.text),
  );
  useEffect(() => applyTextSize(textSize), [textSize]);
  const scrolled = useScrolled();

  // Keep the page on the newest deploy. The desktop app carries its own
  // bundle, so there is nothing for it to fetch.
  const update = useSelfUpdate({
    enabled: caps.surface === "web" && QUERY.update,
    installStatus: ctx.run.status,
    // A browser's folder handle and a `pak1.pak` from a file dialog both die
    // with the page; everything else comes back.
    losesInput: ctx.folder?.picked.kind === "fs-access" || ctx.pak1 !== null,
    save: (target) => ctx.saveNow("update", target),
  });

  const { step } = ctx;
  const View = STEP_VIEW[step];
  const meta = TITLES[step];
  const installing = step === "install";
  const nextLabel =
    step === "welcome" ? "Get started" : step === "review" ? "Install" : "Next";
  const proceed = canProceed(ctx);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Opaque, not a blur: the card's own header slid under a translucent
          bar and read as a ghost behind the wordmark. The line under it
          appears only once there is something up there to separate. */}
      <div
        className={`app-top sticky top-0 z-20 bg-page-bg ${
          scrolled ? "border-b border-line" : ""
        }`}
      >
        <header
          className={`mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 sm:pb-2 sm:pt-5 ${
            scrolled ? "pb-1 pt-2" : "pb-2 pt-5"
          }`}
        >
          <a
            href={BASE_URL}
            onClick={(e) => {
              // A plain click starts over in place — the same clean installer
              // a reload gives, without refetching the catalog or dropping
              // `?mock=1`. Modified clicks still open a new tab.
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
                return;
              e.preventDefault();
              ctx.reset();
            }}
            className="flex items-baseline gap-3 no-underline"
            aria-label="nQuake"
          >
            <span
              className={`wordmark sm:text-5xl ${scrolled ? "text-3xl" : "text-4xl"}`}
            >
              <span className="n">n</span>
              <span className="quake">Quake</span>
            </span>
            <span className="slogan hidden text-lg text-fg-bright sm:inline">
              QuakeWorld — where it all started
            </span>
          </a>
          <div className="flex items-center gap-1">
            <TextSizeButton size={textSize} onChange={setTextSize} />
            <button
              type="button"
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              data-testid="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="focus-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
            >
              {theme === "dark" ? (
                <SunIcon className="h-4.5 w-4.5" />
              ) : (
                <MoonIcon className="h-4.5 w-4.5" />
              )}
            </button>
            <a
              href="https://github.com/nQuake/web-installer"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="nQuake on GitHub"
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
            >
              <GithubIcon className="h-4.5 w-4.5" />
            </a>
          </div>
        </header>
        {/* The slogan is the page's signature, not a fixture: on phones it
            is there when you arrive and gives its line back to the step as
            soon as you scroll. Desktop shows it beside the wordmark. */}
        {!scrolled && (
          <p className="slogan px-4 text-base text-fg-bright sm:hidden">
            QuakeWorld — where it all started
          </p>
        )}
        {/* Phones have no room for the step list, so the bar rides up here
            instead of sitting above the card. Desktop keeps the sidebar. */}
        <div className="mx-auto w-full max-w-5xl px-4 pb-2 pt-1.5 md:hidden">
          <StepperCompact steps={ctx.steps} current={ctx.stepIndex} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pt-2 empty:hidden sm:px-6">
        <UpdateNotice ctx={ctx} update={update} />
      </div>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-4 px-4 pb-6 pt-4 sm:px-6 md:grid-cols-[220px_1fr] md:content-start md:gap-8 md:pb-10">
        {/* Below the sticky header: that bar is ~4.5rem tall and everything
            in it is sized in rem, so 6rem clears it at every text size. */}
        <aside className="hidden md:sticky md:top-24 md:block md:self-start">
          <Stepper
            steps={ctx.steps}
            current={ctx.stepIndex}
            onJump={installing || step === "done" ? undefined : ctx.goTo}
          />
        </aside>

        <Card className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7 sm:py-5">
            <div>
              <h1 className="display text-2xl text-fg-bright sm:text-3xl">
                {meta.title}
              </h1>
              <p className="mt-0.5 text-sm text-muted">{meta.lead}</p>
            </div>
            {!installing && step !== "done" && <ModeSwitch ctx={ctx} />}
          </div>
          <div className="flex-1 px-5 py-5 sm:px-7 sm:py-6">
            <View ctx={ctx} />
          </div>
          {!installing && step !== "done" && (
            <div className="hidden items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-7 md:flex">
              <NavButtons ctx={ctx} nextLabel={nextLabel} proceed={proceed} />
            </div>
          )}
        </Card>

        {/* Phone nav: sticks to the bottom of the viewport while the step is
            on screen and settles under the card at the end of the page, so it
            never covers the footer. Desktop uses the card's own footer row. */}
        {!installing && step !== "done" && (
          <div className="phone-nav sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <NavButtons ctx={ctx} nextLabel={nextLabel} proceed={proceed} />
            </div>
          </div>
        )}
      </main>

      {/* The whole footer is one line: which build you are looking at, linked
          at the commit it was built from. A bug report that carries this is a
          bug report you can check out. */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-right text-xs text-muted sm:px-6">
        <BuildStamp />
      </footer>
    </div>
  );
}

/**
 * True once the page has moved at all, which is what the sticky header
 * compacts on. The threshold is a couple of pixels rather than zero so a
 * phone's rubber-band scroll does not flicker the slogan in and out.
 */
function useScrolled(threshold = 4): boolean {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/**
 * `v0.2.0.15+8f4022d` — the deployed build label and the commit it was built
 * from, linked at that commit on GitHub. A build with no git and no
 * `GITHUB_SHA` behind it (a source tarball) has no hash to show and no commit
 * to link at, so it stays plain text.
 */
function BuildStamp() {
  const short = BUILD_COMMIT.slice(0, 7);
  const label = `v${BUILD_LABEL}${short ? `+${short}` : ""}`;
  if (!short) return <span className="font-mono">{label}</span>;
  return (
    <a
      className="font-mono hover:text-fg"
      href={`${REPO_URL}/commit/${BUILD_COMMIT}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Built from ${BUILD_COMMIT}`}
      data-testid="build-stamp"
    >
      {label}
    </a>
  );
}

/**
 * Small / medium / large, cycled by one button — the replacement for the
 * pinch-zoom the page turns off on phones. The two A's show where you are:
 * the right-hand one is drawn at the size you picked.
 */
function TextSizeButton({
  size,
  onChange,
}: {
  size: TextSize;
  onChange: (s: TextSize) => void;
}) {
  const next = nextTextSize(size);
  return (
    <button
      type="button"
      aria-label={`Text size: ${size}. Switch to ${next}.`}
      title={`Text size: ${size}`}
      data-testid="text-size"
      onClick={() => onChange(next)}
      className="focus-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-2 text-muted hover:bg-surface-2 hover:text-fg"
    >
      <span className="flex items-baseline gap-0.5">
        <span className="display text-[0.8rem] leading-none">A</span>
        <span
          className={`display leading-none ${
            size === "small"
              ? "text-[1rem]"
              : size === "medium"
                ? "text-[1.25rem]"
                : "text-[1.5rem]"
          }`}
        >
          A
        </span>
      </span>
    </button>
  );
}

/**
 * The two things the self-update has to say out loud: that a newer installer
 * is there and this page is not taking it on its own (because a reload would
 * cost the user something), and — after a reload that did happen by itself —
 * that the page they are looking at is a new one and their answers came with
 * it. Everything else it does silently, which is the point.
 */
function UpdateNotice({ ctx, update }: { ctx: WizardCtx; update: SelfUpdate }) {
  const [hidden, setHidden] = useState(false);
  const restored = ctx.restored;

  if (update.action === "ask" && update.latest) {
    const costs = [
      ctx.folder?.picked.kind === "fs-access" ? "pick your folder again" : null,
      ctx.pak1 ? "add your pak1.pak again" : null,
    ].filter((c): c is string => c !== null);
    return (
      <Callout tone="info" title="A newer installer is available">
        <div className="flex flex-col gap-2.5">
          <p>
            You are running <span className="font-mono">v{BUILD_LABEL}</span>;{" "}
            <span className="font-mono">v{update.latest}</span> is live.
            Everything you have filled in is kept
            {costs.length > 0 ? (
              <>
                {" "}
                — you will only have to {costs.join(" and ")}, which the browser
                will not let a page remember.
              </>
            ) : (
              "."
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={update.apply}
              testId="update-apply"
            >
              Load it
            </Button>
            <Button variant="ghost" onClick={update.dismiss}>
              Not now
            </Button>
          </div>
        </div>
      </Callout>
    );
  }

  // Only until the install starts: by then it has been read, and the install
  // step is about the files, not about us.
  if (restored?.reason === "update" && !hidden && ctx.run.status === "idle") {
    const lost = [
      restored.folder?.kind === "fs-access" ? "Pick your folder again" : null,
      restored.pak1Name ? `Add ${restored.pak1Name} again` : null,
    ].filter((c): c is string => c !== null);
    return (
      <Callout tone="success" title="Updated to the latest installer">
        <div className="flex items-start justify-between gap-4">
          <p>
            This page reloaded itself as{" "}
            <span className="font-mono">v{BUILD_LABEL}</span> and brought your
            answers along.
            {lost.length > 0 ? ` ${lost.join(". ")}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="focus-ring shrink-0 cursor-pointer rounded px-1 text-xs text-muted hover:text-fg"
          >
            Dismiss
          </button>
        </div>
      </Callout>
    );
  }

  return null;
}

/**
 * Simple / Advanced. Simple is Next, Next, Next on the defaults; Advanced
 * unfolds the client, setup and server steps. Switching to Advanced from a
 * later step jumps back to the first step it unlocks so nothing is skipped.
 */
function ModeSwitch({ ctx }: { ctx: WizardCtx }) {
  const pick = (mode: "simple" | "advanced") => {
    if (mode === ctx.mode) return;
    const wasAt = ctx.step;
    ctx.setMode(mode);
    if (mode === "advanced" && (wasAt === "folder" || wasAt === "review")) {
      // The advanced steps sit between target and folder.
      ctx.goTo(2);
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label="Setup mode"
      className="inline-flex shrink-0 rounded-md border border-line bg-surface-2 p-0.5 text-xs font-medium"
    >
      {(["simple", "advanced"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={ctx.mode === m}
          data-testid={`mode-${m}`}
          onClick={() => pick(m)}
          className={[
            "focus-ring cursor-pointer rounded-[calc(var(--radius)-2px)] px-2.5 py-1 capitalize transition",
            ctx.mode === m
              ? "bg-accent text-accent-fg"
              : "text-muted hover:text-fg",
          ].join(" ")}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function NavButtons({
  ctx,
  nextLabel,
  proceed,
}: {
  ctx: WizardCtx;
  nextLabel: string;
  proceed: boolean;
}) {
  const first = ctx.stepIndex === 0;
  // A step that is only missing an answer from one of its own fields keeps a
  // live Next: pressing it puts the cursor in that field and marks it, which
  // is the one thing a disabled button cannot do.
  const missing = missingHere(ctx);
  return (
    <>
      <Button
        variant="ghost"
        onClick={ctx.back}
        disabled={first}
        testId="nav-back"
        className={first ? "invisible" : ""}
      >
        <ArrowLeftIcon /> Back
      </Button>
      <Button
        variant="primary"
        size="lg"
        onClick={proceed ? ctx.next : ctx.flagMissing}
        disabled={!proceed && !missing}
        testId="nav-next"
      >
        {ctx.step === "review" ? <DownloadIcon className="h-5 w-5" /> : null}
        {nextLabel}
        {ctx.step !== "review" && <ArrowRightIcon />}
      </Button>
    </>
  );
}
