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
- **Session** (`src/domain/session.ts`) — what survives a self-update, and
  how to read it back. The page updates itself by reloading, so the wizard's
  answers are written to session storage just before that reload and merged
  over today's `defaultOptions` on the way up: the build that wrote them is
  not the build that reads them. Only that reload resumes
  (`sessionToResume`); a refresh or the wordmark starts a clean install.
- **Update** (`src/domain/update.ts`) — when the app may replace itself. Any
  change in the deployed build label counts; a running install is never
  interrupted, a reload that would cost the user a folder handle or a picked
  `pak1.pak` is offered rather than taken, and the same build is only reached
  for twice before the page stops trying (a CDN can announce a bundle it is
  not serving yet).
- **Paths** (`src/domain/paths.ts`) — the names a browser install cannot
  create, and what to do about them. Chromium's File System Access API
  rejects `.lnk`, `.scf` and `.url` on every OS (nQuake ships
  `ezquake/Online Manual.url`), and on Windows it also rejects every
  extension Safe Browsing marks dangerous there — `cfg`, `dll`, `ini`,
  `manifest`, i.e. every config nQuake ships. `resolveName` decides per
  surface: write it, park it under a `.nqinstall` name for the generated
  `nquake-finish.bat` to rename, or drop it.

## Impure

- **Destination** (`src/platform/destination.ts`) — the folder. Three
  implementations: File System Access (browser), Tauri (desktop app), mock
  (simulation). Two capability fields say what a surface can do:
  `canSetExecutable` (only Tauri) and `nameRules` (`"none"` outside the
  browser, `"browser"` or `"browser-windows"` in it, by the host OS).
  `path` is a third thing a surface may or may not know: the desktop app has
  the folder's full path, a browser is given a handle with only a `name`, so
  the wizard shows `displayPath(dest)` and falls back to the name.
- **Installer** (`src/net/installer.ts`) — a worker pool (`DEFAULT_CONCURRENCY`
  files at a time; they are HTTP/2 streams to one host, not connections) that
  walks the plan
  through a `Transport` into a `Destination`, largest files first, reporting
  progress (including `recent`, the tail of files that finished, in the order
  they finished, which is what the install step logs),
  keeping unchanged files (`install-state.ts`), collecting
  failures, and finishing with `nquake-reborn.json` and `README-nquake.txt`.
  Items the surface cannot name are either parked under a `.nqinstall` name
  (`result.sidecars`, with `nquake-finish.bat` written at the end to rename
  them) or dropped before the run and reported as `result.blocked` notes —
  never failures, since retrying could not fix them.

## Data sources

```
raw.githubusercontent.com/nQuake/distfiles/<commit>/<pkg>/<path>      ← manifest.json
raw.githubusercontent.com/nQuake/web-installer/upstream-mirror/...   ← upstream.json
```

Both are read through `src/net/sources.ts`. The manifest pins files to the
commit it was generated at so a manifest and its files never disagree.

## Surfaces

`src/platform/capabilities.ts` answers "which surface, can it install?".
Web + Chromium desktop → real. Tauri → real (and can chmod). Everything
else → simulation, same wizard, same numbers, no network for the files.
