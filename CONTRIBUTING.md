# Contributing to nquake-reborn

## Prerequisites

- [Node.js](https://nodejs.org/) 22+ (see `.nvmrc`), npm 10+
- For the desktop shell only: [Rust](https://rustup.rs) and the
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```sh
git clone https://github.com/nQuake/nquake-reborn.git
cd nquake-reborn
npm ci
npm run dev      # http://localhost:5173
```

Add `?mock=1` to the URL to run the installer in simulation mode on a
machine where you don't want to write anything.

## Quality gates

```sh
make fmt-check   # prettier
make lint        # eslint + tsc --noEmit
make test        # vitest
make build       # vite build
node scripts/screenshots.mjs   # every step, desktop + phone, both themes
```

All four `make` targets run in CI and must pass. Run `make fmt` before
committing — formatting is its own gate.

## Workflow

1. Branch off `main` (`feat/…`, `fix/…`, `docs/…`).
2. Make the change with tests where it makes sense — `src/domain/` is pure
   and cheap to test, keep it covered.
3. For anything user-visible, add a fragment under `.changes/unreleased/`
   (see `AGENTS.md`) and re-run the screenshot script to check both
   viewports.
4. Open a pull request. Commits and the PR title follow
   [Conventional Commits](https://www.conventionalcommits.org/); PRs are
   squash-merged, so the title becomes the commit on `main`.

## Code of conduct

Be excellent to each other. QuakeWorld has survived since 1996 on the
goodwill of a small community; this project runs on the same.
