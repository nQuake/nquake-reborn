#!/usr/bin/env node
// Photograph the whole installer, one PNG per wizard step, at a desktop and a
// phone viewport, in both themes. The point is fast iteration on the small
// details: change a style, re-run, flip through the pictures.
//
//   node scripts/screenshots.mjs                 # builds, serves dist/, shoots
//   node scripts/screenshots.mjs --url http://localhost:5173   # against a dev server
//   node scripts/screenshots.mjs --scenario server --viewport phone --theme dark
//   node scripts/screenshots.mjs --platform linux
//   node scripts/screenshots.mjs --manifest ../distfiles/manifest.json
//
// The build it photographs reads the distfiles manifest from a local copy
// when one is given (or found at ../distfiles/manifest.json) and the
// upstream index from tests/fixtures/upstream.json, so the run needs no
// network and shows the "latest ezQuake" states.
//
// Output: screenshots/<scenario>/<viewport>-<theme>/<nn>-<step>.png
//
// The wizard is driven through its data-testid hooks with `?mock=1`, so the
// run is deterministic and needs no folder picker; the install step is
// simulated and captured mid-flight and once finished.
//
// Playwright is not a project dependency (it drags a browser download into
// every `npm ci`). This script resolves it from the global install or from
// PLAYWRIGHT_MODULE; `npx playwright install chromium` gets you a browser.

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const wantScenario = arg("scenario", "all");
const wantViewport = arg("viewport", "all");
const wantTheme = arg("theme", "all");
const platform = arg("platform", "windows");
const urlArg = arg("url", "");
// `--names browser-windows` makes the simulated folder refuse what a browser
// on Windows refuses, which is the only way to shoot the finish-the-install
// screen without a Windows machine.
const names = arg("names", "");
const manifestPath = arg(
  "manifest",
  resolve(root, "../distfiles/manifest.json"),
);
const upstreamPath = arg(
  "upstream",
  resolve(root, "tests/fixtures/upstream.json"),
);
const outDir = resolve(root, arg("out", "screenshots"));

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    "/usr/lib/node_modules/playwright/index.mjs",
  ].filter(Boolean);
  const require = createRequire(import.meta.url);
  for (const c of candidates) {
    try {
      return await import(c);
    } catch {
      try {
        return require(c);
      } catch {
        /* next */
      }
    }
  }
  try {
    const globalRoot = (await run("npm", ["root", "-g"])).trim();
    return await import(resolve(globalRoot, "playwright/index.mjs"));
  } catch {
    throw new Error(
      "Playwright not found. `npm i -g playwright && npx playwright install chromium`, or set PLAYWRIGHT_MODULE.",
    );
  }
}

function run(cmd, args, env = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, ...env },
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("exit", (code) =>
      code === 0 ? res(out) : rej(new Error(`${cmd} exited ${code}`)),
    );
  });
}

async function startPreview() {
  console.log("building…");
  const env = {};
  if (existsSync(manifestPath)) env.VITE_MANIFEST_URL = "manifest.json";
  if (existsSync(upstreamPath)) env.VITE_UPSTREAM_URL = "upstream.json";
  await run("npx", ["vite", "build"], env);
  if (env.VITE_MANIFEST_URL)
    copyFileSync(manifestPath, resolve(root, "dist/manifest.json"));
  if (env.VITE_UPSTREAM_URL)
    copyFileSync(upstreamPath, resolve(root, "dist/upstream.json"));
  console.log(
    `catalog: ${env.VITE_MANIFEST_URL ? manifestPath : "remote"}; upstream: ${env.VITE_UPSTREAM_URL ? upstreamPath : "remote"}`,
  );
  const port = 4173 + Math.floor(Math.random() * 500);
  const proc = spawn(
    "npx",
    ["vite", "preview", "--port", String(port), "--strictPort"],
    {
      cwd: root,
      stdio: "ignore",
    },
  );
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return { url, stop: () => proc.kill() };
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  proc.kill();
  throw new Error("preview server did not start");
}

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
};
const THEMES = ["dark", "light"];
// `simple` is the default Next-Next-Next flow; the other three switch to
// Advanced on the target step to photograph every option.
const SCENARIOS = ["simple", "client", "server", "both"];

// Each step: wait for something that proves it's on screen, optionally poke
// at it so the picture shows a non-default state, then shoot.
function stepsFor(scenario) {
  const simple = scenario === "simple";
  const target = simple ? "client" : scenario;
  const steps = [
    {
      name: "welcome",
      ready: "[data-testid=cap-mock], [data-testid=cap-real]",
      before: async (p) =>
        p.waitForSelector("[data-testid=catalog-ready]", {
          state: "attached",
          timeout: 60_000,
        }),
    },
    {
      name: "target",
      ready: "[data-testid=target-client]",
      before: async (p) => {
        await p.click(`[data-testid=mode-${simple ? "simple" : "advanced"}]`);
        await p.click(`[data-testid=target-${target}]`);
        await p.click(`[data-testid=platform-${platform}]`);
        if (simple) await p.fill("[data-testid=nickname]", "newbie");
      },
    },
  ];
  if (!simple && scenario !== "server") {
    steps.push(
      {
        name: "client",
        ready: "[data-testid=opt-textures]",
        before: async (p) => p.click("[data-testid=opt-fortress]"),
      },
      {
        name: "config",
        ready: "[data-testid=nickname]",
        before: async (p) => p.fill("[data-testid=nickname]", "Empezar"),
      },
    );
  }
  if (!simple && scenario !== "client") {
    steps.push({
      name: "server",
      ready: "[data-testid=hostname]",
      before: async (p) => {
        await p.fill("[data-testid=hostname]", "nQuake Reborn Test Server");
        await p.click("[data-testid=opt-sv-ffa]");
      },
    });
  }
  steps.push(
    {
      name: "folder",
      ready: "[data-testid=pick-folder]",
      before: async (p) => {
        await p.click("[data-testid=pick-folder]");
        await p.waitForSelector("[data-testid=folder-summary]");
      },
    },
    { name: "review", ready: "[data-testid=review-summary]" },
    {
      name: "install",
      ready: "[data-testid=install-progress]",
      before: async (p) => {
        // Catch it mid-flight.
        await p.waitForFunction(
          () => {
            // eslint-disable-next-line no-undef -- runs inside the page
            const el = document.querySelector("[data-testid=install-percent]");
            return el && parseInt(el.textContent, 10) >= 20;
          },
          null,
          { timeout: 60_000 },
        );
      },
      next: false,
    },
    {
      name: "done",
      ready: "[data-testid=done]",
      before: async (p) =>
        p.waitForSelector("[data-testid=done]", { timeout: 90_000 }),
      next: false,
    },
  );
  return steps;
}

async function shoot(browser, baseUrl, scenario, viewportName, theme) {
  const dir = resolve(outDir, scenario, `${viewportName}-${theme}`);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    ...VIEWPORTS[viewportName],
    colorScheme: theme,
  });
  const page = await context.newPage();
  const url =
    `${baseUrl}?mock=1&theme=${theme}&platform=${platform}` +
    (names ? `&names=${names}` : "");
  await page.goto(url, { waitUntil: "networkidle" });
  // See `html[data-shot]` in src/styles/theme.css.
  await page.evaluate(
    // eslint-disable-next-line no-undef -- runs inside the page
    () => document.documentElement.setAttribute("data-shot", "1"),
  );
  const steps = stepsFor(scenario);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await page.waitForSelector(s.ready, { timeout: 30_000 });
    if (s.before) await s.before(page);
    // Sticky bits (sidebar, phone nav) are captured where a fresh visitor
    // sees them, not wherever the last click scrolled to.
    // eslint-disable-next-line no-undef -- runs inside the page
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const file = resolve(
      dir,
      `${String(i + 1).padStart(2, "0")}-${s.name}.png`,
    );
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ${file.replace(root + "/", "")}`);
    // Two nav bars exist (desktop footer, phone sticky bar); click the visible one.
    if (s.next !== false)
      await page.locator("[data-testid=nav-next]:visible").first().click();
  }
  await context.close();
}

const pw = await loadPlaywright();
const server = urlArg ? { url: urlArg, stop: () => {} } : await startPreview();
const browser = await pw.chromium.launch();
try {
  const scenarios = wantScenario === "all" ? SCENARIOS : [wantScenario];
  const viewports =
    wantViewport === "all" ? Object.keys(VIEWPORTS) : [wantViewport];
  const themes = wantTheme === "all" ? THEMES : [wantTheme];
  for (const scenario of scenarios) {
    for (const viewport of viewports) {
      for (const theme of themes) {
        console.log(`${scenario} / ${viewport} / ${theme}`);
        await shoot(browser, server.url, scenario, viewport, theme);
      }
    }
  }
} finally {
  await browser.close();
  server.stop();
}
