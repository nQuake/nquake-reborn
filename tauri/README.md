# nQuake desktop (Tauri shell)

A **thin window around the compiled web installer**, for people who would
rather download an app than trust a browser with a folder — and for
browsers that can't be trusted with one (Firefox and Safari have no File
System Access API).

It embeds `dist/` (built by `make build-tauri`) and adds **only what a
webview can't do**:

| Capability | Provided by | Reached from |
| --- | --- | --- |
| Pick a folder | `tauri-plugin-dialog` | `src/platform/tauri.ts` |
| Read / write inside it | `tauri-plugin-fs` | `src/platform/tauri.ts` |
| Reveal the folder when done | `tauri-plugin-opener` | `src/platform/tauri.ts` |
| Set the executable bit on downloaded binaries | `set_executable` in `src-tauri/src/lib.rs` (the one custom command — a webview cannot chmod) | `src/platform/tauri.ts` |

Nothing here imports from `src/`. Every decision — what to download, where
each file goes, what the configs say — is made by the web app; the shell
answers questions.

## Build

Prerequisites: [Rust](https://rustup.rs) and the
[Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for
your OS.

```sh
npm ci                      # root — the web app
npm --prefix tauri ci       # this shell's own dependency (the Tauri CLI)
make build-tauri            # dist/ with a relative base
npm --prefix tauri run build
```

Bundles land in `tauri/src-tauri/target/release/bundle/`. The Release
workflow builds them for Windows, macOS (Intel and Apple Silicon) and Linux
and attaches them to the GitHub Release.

`npm --prefix tauri run dev` opens the window on the Vite dev server for
live reload.

## Icons

`tauri/src-tauri/icons/` is generated from `public/favicon.svg` with
`npm --prefix tauri run icons` (the Tauri CLI's `icon` command) and is
committed so a checkout builds without the generator.

## Signing

Builds are unsigned unless signing secrets are configured. macOS will refuse
the first launch of an unsigned app ("damaged" or "unidentified developer");
right-click → Open, or **System Settings → Privacy & Security → Open
Anyway**. See the Release workflow for the secret names.
