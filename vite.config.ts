import { readFileSync } from "node:fs";
import process from "node:process";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vitest/config";

// The GitHub Pages base path is injected by `pages.yml` via VITE_BASE so the
// same bundle works at `/nquake-reborn/`, `/nquake-reborn/preview/`, or
// `/nquake-reborn/branch/` (or at `/` behind a custom domain). Locally it
// serves at `/`. The Tauri shell (`tauri/`) embeds the bundle and loads it
// off a private origin, so it builds with a relative base.
const isEmbedded = process.env.VITE_TARGET === "tauri";
const base = isEmbedded ? "./" : (process.env.VITE_BASE ?? "/");

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

const PROJECT_NAME = "nQuake";

// Short build identifier surfaced in the footer so you can tell at a glance
// which build is running: `<pkg.version>[.<run>][-<slot>]`. The run number
// is the GitHub Actions run number (omitted locally); the slot is `pre` for
// a `/preview/` deploy and `br` for `/branch/`.
const GITHUB_RUN_NUMBER = process.env.GITHUB_RUN_NUMBER;
const BUILD_SLOT = base.endsWith("/preview/")
  ? "pre"
  : base.endsWith("/branch/")
    ? "br"
    : "";
const BUILD_LABEL =
  pkg.version +
  (GITHUB_RUN_NUMBER ? `.${GITHUB_RUN_NUMBER}` : "") +
  (BUILD_SLOT ? `-${BUILD_SLOT}` : "");

// Emit `dist/version.json` so a deploy can be identified from outside the
// app (and by the smoke test in `pages.yml`).
function emitVersionJson(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: BUILD_LABEL }) + "\n",
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [preact(), tailwindcss(), emitVersionJson()],
  build: {
    // One chunk for the embedded build: the whole app is on disk already,
    // and dynamic `import()` off a custom scheme is one more thing to go
    // wrong for no gain.
    rollupOptions: isEmbedded ? { output: { inlineDynamicImports: true } } : {},
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_LABEL__: JSON.stringify(BUILD_LABEL),
    __APP_NAME__: JSON.stringify(PROJECT_NAME),
  },
  test: {
    // Domain / net tests run in node. UI tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
