# nQuake Reborn

[![ci](https://github.com/nQuake/web-installer/actions/workflows/ci.yml/badge.svg)](https://github.com/nQuake/web-installer/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-GPL--2.0-blue.svg)](LICENSE)

**nQuake as a web installer.** The QuakeWorld package that used to ship as an
NSIS `.exe` and a bash script now runs in the browser: choose *Play*, *Host*
or *Both*, point it at a folder, and it downloads ezQuake / MVDSV / KTX with
the nQuake maps, textures and configs straight into that folder. **Simple**
mode is Next, Next, Next on QuakeWorld's standard setup; **Advanced** opens
every choice — ezQuake build, add-ons, keys, server ports, passwords, mods. A thin [Tauri shell](tauri/README.md) wraps the same page
as a desktop app.

Live: the `main` branch deploys to GitHub Pages under
`/web-installer/preview/`; the latest release is served at `/web-installer/`.

## How it works

- **No zips.** GitHub release assets can't be fetched from a web page (they
  send no CORS headers), so the installer reads
  [`manifest.json`](https://github.com/nQuake/distfiles/blob/master/manifest.json)
  from the [distfiles](https://github.com/nQuake/distfiles) repository and
  downloads each file from `raw.githubusercontent.com`, which does send them.
  Per-file downloads are also resumable and let a re-run skip what hasn't
  changed.
- **Latest upstream binaries.** A scheduled workflow
  ([`mirror-upstream.yml`](.github/workflows/mirror-upstream.yml)) extracts
  the newest ezQuake, MVDSV and KTX releases onto the `upstream-mirror`
  branch of this repository, so the installer can offer them with CORS too.
  Without the mirror it falls back to the binaries bundled in distfiles.
- **Writes through a seam.** In a Chromium browser the folder comes from the
  File System Access API; in the desktop app from Tauri's dialog/fs plugins;
  on phones and in browsers without folder access the whole flow runs as a
  simulation so people can see what installing involves.

## Develop

```sh
npm ci
npm run dev          # http://localhost:5173 — add ?mock=1 to simulate
make test            # vitest
make lint            # eslint + tsc
make fmt             # prettier
make build           # → dist/
node scripts/screenshots.mjs   # photograph every step at desktop + phone
```

Mobile and desktop are both first-class: check every visible change at both
viewports (the screenshot script does it in one go).

## Layout

| Path            | What lives there                                                        |
| --------------- | ----------------------------------------------------------------------- |
| `src/domain`    | Pure: the install plan, generated configs and scripts, sizes, state.    |
| `src/net`       | Fetching: URLs, retrying transport, the install runner.                 |
| `src/platform`  | Where files go: capabilities, File System Access, Tauri, the simulation.|
| `src/ui`        | The wizard steps and primitives.                                        |
| `src/app`       | Wizard state, the shell, the entry point.                               |
| `tests/`        | Vitest suites mirroring `src/`.                                         |
| `scripts/`      | Screenshot harness, upstream mirror, release tooling.                   |
| `tauri/`        | The desktop shell (thin — see its README).                              |

Dependency direction is `app → ui → domain`, `app → net/platform → domain`;
`src/domain/` never touches the DOM or the network (eslint enforces it).

## Deploy and release

`pages.yml` builds three slots into one GitHub Pages artifact (release at the
root, `main` at `/preview/`, an opt-in branch at `/branch/`). `release.yml`
is dispatched by hand, derives the version bump from the changeset fragments,
tags, packages the desktop app for Windows / macOS / Linux, and publishes.
See [`AGENTS.md`](AGENTS.md) for the details and the conventions.

## Credits

nQuake is by Empezar and the QuakeWorld community —
[nquake.com](https://www.nquake.com/). ezQuake, MVDSV, KTX, QTV and QWFWD are
maintained by [QW-Group](https://github.com/QW-Group). This installer is
GPL-2.0, like the original.
