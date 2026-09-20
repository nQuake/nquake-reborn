---
name: debug
description: Debug the nQuake web installer (nquake-reborn) — reproduce and fix a bug report, work out why a file failed to install or came out wrong, or inspect what an install would actually do. Use this whenever someone reports something going wrong with an nQuake install ("Cannot create X", a file missing or not executable, a wrong config, a failed download, the wizard offering the wrong things), whenever you need to see the plan or a generated config without running a real install, and whenever the screenshot harness or the toolchain misbehaves in a sandbox. Reach for it even when the report is a vague screenshot from Discord — the triage table turns an error string into a file to open.
---

# Debugging the nQuake installer

Bug reports here arrive as screenshots from Discord, so the first job is
usually to turn a sentence and an error string into a file. The second is to
reproduce it in Node in under a second, because the alternative — a real
600 MB install in a browser you have to click through — is not a debugging
loop you can iterate in.

## Start here

```sh
npm ci                                  # fresh checkouts have no node_modules
make test                               # ~1s, 46 tests; establishes a baseline
node .agents/skills/debug/scripts/plan.mjs --platform linux --target both
```

If `make lint` explodes with `Cannot find package '@eslint/js'`, that is the
missing `node_modules`, not your change.

## Triage: error string → where it lives

The installer reports failures as `` `${item.dest}: ${message}` ``, so a
screenshot usually hands you both the destination and the message.

| What the user sees | What it means | Open |
| --- | --- | --- |
| `Cannot create <path>` | The browser's file system API refused the *name*. Not a network problem, and retrying can never help. | `src/domain/paths.ts`, `src/platform/fs-access.ts` |
| `Expected N bytes, received M` | The manifest and the bytes disagree — usually a stale manifest, or a truncated response. | `src/net/transport.ts`, the manifest's `commit` pin |
| `HTTP 404` | A package or path was renamed in `nQuake/distfiles` without the plan being changed. | `src/domain/plan.ts`, distfiles `AGENTS.md` |
| A CORS / network error on a download | Something built a non-`raw.githubusercontent.com` URL. Release assets send no CORS header — that is the whole reason there are no zips. | `src/net/sources.ts` |
| Wrong/missing files installed | The plan decided wrong. | `src/domain/plan.ts` |
| A config or script with wrong contents | A pure string builder. | `src/domain/configs.ts`, `src/domain/readme.ts` |
| "It won't start" on Linux/macOS | The executable bit. A browser cannot chmod; the generated `start_*.sh` scripts chmod themselves and what they launch. | `src/domain/configs.ts`, `src/platform/tauri.ts` |
| Something only wrong in the desktop app | The Tauri destination or its one Rust command. | `src/platform/tauri.ts`, `tauri/src-tauri/src/lib.rs` |

Which surface the user was on is usually deducible from the error text:
`Cannot create …` is `fs-access.ts` (so: Chromium, web). The desktop app's
errors come from the Tauri fs plugin and read differently.

## Reproduce it in Node

`src/domain` is pure and `runInstall` only ever talks to a `Destination` and a
`Transport`. Swap in the mock destination and a transport that invents bytes
and you are exercising the real worker pool, reuse check, record, readme and
every generated config — without a browser, a folder picker or the network.

The bundled scripts do this. They load the project's TypeScript through Vite's
SSR API (Vite is already a dependency, `vite-node` is not), so they need no
install step and work offline apart from fetching the catalog.

```sh
# What would this install write? (buildPlan is pure — this is instant)
node .agents/skills/debug/scripts/plan.mjs --platform linux --target both
node .agents/skills/debug/scripts/plan.mjs --grep AppImage --source
node .agents/skills/debug/scripts/plan.mjs --upstream none      # mirror down

# Run the whole install against the mock destination
node .agents/skills/debug/scripts/dry-run.mjs --platform linux --restricted
node .agents/skills/debug/scripts/dry-run.mjs --cat "start_ezquake|README"
node .agents/skills/debug/scripts/dry-run.mjs --fail "\.pk3$"

# Audit the live catalog against everything the installer assumes
node .agents/skills/debug/scripts/audit-catalog.mjs

# Screenshots, with the sandbox's traps handled
sh .agents/skills/debug/scripts/shots.sh --scenario client --platform linux
```

Each script explains its own flags in a header comment; `plan.mjs` and
`dry-run.mjs` share the wizard flags (`--platform`, `--target`, `--pak1`,
`--tf`, `--ca`, `--ffa`, `--hd-textures`, `--no-textures`, `--no-maps`,
`--bundled-client`, `--bundled-binaries`, `--ports N`), because a bug that only
appears for one combination is common and the plan is a pure function of them.
Match the reporter's answers first.

**`--restricted` matters.** The mock destination writes anything, so a bug that
only happens in a real browser will not reproduce with `?mock=1` or a plain
dry run. `--restricted` makes the mock refuse the names Chromium refuses,
which is what makes a browser-only failure visible in Node.

## Confirming a browser platform rule

When the suspicion is "the browser refuses this", do not guess from the error
message — read Chromium. The source is fetchable and settles it in one step:

```sh
curl -sS "https://chromium.googlesource.com/chromium/src/+/main/content/browser/\
file_system_access/file_system_access_manager_impl.cc?format=TEXT" \
  | base64 -d | grep -n "IsSafePathComponent" -A 120
```

That function is the complete list of names the File System Access API will
refuse, and it is where `src/domain/paths.ts` comes from. Keep the two in step:
if that list grows, so should ours.

## Traps in a sandboxed container

- **`cargo check` cannot run** — the container has no GTK (`gdk-3.0.pc`). That
  is the environment, not the change. CI's `tauri-check` covers `tauri/`; say
  so plainly rather than reporting a failure you cannot act on.
- **The headless browser has no network.** Node can reach
  `raw.githubusercontent.com` through the agent proxy but the browser cannot,
  so a screenshot run hangs on `[data-testid=catalog-ready]` until you pass a
  local `--manifest`. `shots.sh` fetches one and passes it for you.
- **Playwright is deliberately not a project dependency**, and any version you
  install pins a Chromium revision that probably is not the one in
  `/opt/pw-browsers`. Do not hunt for the matching version; `shots.sh` points
  whatever Playwright is available at whatever browser exists, via a shim
  module handed to `PLAYWRIGHT_MODULE`.
- **`screenshots/` is gitignored** — it is a local design loop, not an
  artifact. Look at the PNGs (the Read tool renders them); do not trust the
  exit code. Both viewports are primary.

## Things that look like bugs but aren't

- **Spaces in filenames are fine.** `ktx/configs/usermodes/dmm4cfgs for Rocket
  Arena maps.txt` installs happily. When a name fails, suspect the extension.
- **`skipped` on a second run is the feature**, not a failure: `canReuse` keeps
  unchanged files, so re-running into the same folder is the update path and
  the retry path.
- **No macOS server binaries exist anywhere** — not in distfiles, not upstream.
  A macOS server install is configs only, with a note saying so.
- **The desktop app and the browser legitimately differ.** `canSetExecutable`
  is true only under Tauri; `restrictsNames` is true only in the browser. A
  report that reproduces on one surface and not the other is usually one of
  these two flags, and the fix belongs behind the `Destination` seam — never as
  a branch inside the installer.
- **Simulation mode is not a bug.** Phones, Firefox, Safari, non-HTTPS pages
  and `?mock=1` all get the full wizard with simulated downloads, and say so in
  a banner. "It didn't write anything" from a Firefox user is working as
  designed.

## Poking at a running app

`make dev`, then URL params: `?mock=1` (force simulation),
`?mode=simple|advanced`, `?platform=windows|linux|macos`, `?theme=dark|light`.
The build-time overrides `VITE_MANIFEST_URL` / `VITE_UPSTREAM_URL` point the
two index files elsewhere — that is how the screenshot harness runs against a
local `../distfiles/manifest.json` and `tests/fixtures/upstream.json`.

## Before calling it fixed

```sh
make fmt && make fmt-check && make lint && make test && make build
sh .agents/skills/debug/scripts/shots.sh --scenario <the affected one>
```

Then: a `.changes/unreleased/` fragment (CI gates on it), and the doc sync
points at the bottom of `AGENTS.md`. Add a test at the layer the bug lived in —
a plan bug belongs in `tests/domain/plan.test.ts`, a surface-behaviour bug in
`tests/net/installer.test.ts` with the mock configured to behave like that
surface.

## Worked example: the `.url` bug

A Discord screenshot showed `ezquake/Online Manual.url: Cannot create
ezquake/Online Manual.url`, and the reporter guessed it was the spaces.

1. `Cannot create` → `fs-access.ts#openWrite` → `getFileHandle` threw → the API
   rejected the *name*. Not network, not retryable.
2. `audit-catalog.mjs`-style scan of the manifest: exactly one offending path,
   and other files with spaces install fine. So: the extension, not the spaces.
3. Chromium source (command above): `.lnk`, `.scf` and `.url` are refused
   outright, on every OS, because a `.url` file can be made to read arbitrary
   files (crbug.com/1307930).
4. Fix in the pure layer (`domain/paths.ts`), one capability flag on the seam
   (`Destination.restrictsNames`), and `runInstall` drops such items before the
   run and reports them as notes rather than failures — because a failure the
   user cannot act on is worse than no failure at all.
5. `dry-run.mjs --restricted` reproduced it before the fix and proved it after.

The shape generalises: read the error to find the layer, use the pure layer to
reproduce in a second, confirm platform behaviour against the platform's own
source, and put the decision in `src/domain` where a test can reach it.
