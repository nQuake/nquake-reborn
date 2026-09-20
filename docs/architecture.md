# Architecture

The installer is three pure things and two impure ones.

## Pure

- **Options** (`src/domain/options.ts`) — everything the wizard asks, as one
  object. Defaults come from `defaultOptions(platform)`.
- **Plan** (`src/domain/plan.ts`) — `buildPlan(manifest, upstream, options)`
  returns the exact list of files to put in the folder. Each item names a
  destination and a source: a distfiles file, an upstream-mirror file, a text
  the installer generates, a distfiles text with a transform (the addon
  `NQUAKESV_*` placeholders; the KTX port and QTV templates), or the user's
  `pak1.pak`. Later items replace earlier ones with the same destination,
  which is how an upstream `mvdsv` wins over the bundled one.
- **Configs** (`src/domain/configs.ts`) — the strings the plan writes:
  `preset.cfg`, `portN.cfg`, `pwd.cfg`, `qtv.cfg`, `qwfwd.cfg`, the
  `start_ezquake.sh` client launcher and the start/stop scripts per platform.
  Every generated shell script chmods itself and what it launches, because a
  browser cannot set the executable bit.
- **Paths** (`src/domain/paths.ts`) — the names a browser install can never
  create. Chromium's File System Access API rejects `.lnk`, `.scf` and `.url`
  on every OS, and nQuake ships `ezquake/Online Manual.url`.

## Impure

- **Destination** (`src/platform/destination.ts`) — the folder. Three
  implementations: File System Access (browser), Tauri (desktop app), mock
  (simulation). Two capability flags say what a surface can do:
  `canSetExecutable` (only Tauri) and `restrictsNames` (only the browser).
- **Installer** (`src/net/installer.ts`) — a worker pool that walks the plan
  through a `Transport` into a `Destination`, largest files first, reporting
  progress, keeping unchanged files (`install-state.ts`), collecting
  failures, and finishing with `nquake-reborn.json` and `README-nquake.txt`.
  Items the surface cannot name are dropped before the run and reported as
  `result.blocked` notes, not failures — retrying could never fix them.

## Data sources

```
raw.githubusercontent.com/nQuake/distfiles/<commit>/<pkg>/<path>      ← manifest.json
raw.githubusercontent.com/nQuake/nquake-reborn/upstream-mirror/...   ← upstream.json
```

Both are read through `src/net/sources.ts`. The manifest pins files to the
commit it was generated at so a manifest and its files never disagree.

## Surfaces

`src/platform/capabilities.ts` answers "which surface, can it install?".
Web + Chromium desktop → real. Tauri → real (and can chmod). Everything
else → simulation, same wizard, same numbers, no network for the files.
