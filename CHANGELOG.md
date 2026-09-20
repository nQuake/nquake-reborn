# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Released sections are **generated at release time from the changeset
fragments** in `.changes/unreleased/` — add a fragment per user-visible change
(see `AGENTS.md` → "Releases and changelog").

## [Unreleased]

## [0.2.0] - 2026-09-20

### Added

- **nQuake web installer** — nQuake is now a web installer: pick Play, Host or Both, keep the QuakeWorld standard setup (Simple) or choose add-ons, keys, server ports and passwords (Advanced), point it at a folder, and it downloads the newest ezQuake, MVDSV and KTX with the nQuake maps, textures and configs straight into that folder — resumable, and re-runnable to update.

### Changed

- **Simple mode is leaner — less to read, nothing to decide** — Simple mode now says only what you need to click Next: the welcome page drops the catalog inventory and the links to the old downloadable installers, the target step replaces the list of defaults with one line, and the review step shows a short summary and a single download size instead of the per-package file breakdown. Installing shows the percentage, one bar and the files going past. Advanced mode is unchanged and still spells out every package, port and option.

### Fixed

- **The ezQuake manual shortcut no longer fails a browser install, and the client launches without a chmod** — Chromium's File System Access API refuses to create `.url` files outright, so nQuake's `ezquake/Online Manual.url` shortcut ended every browser install with "Some files could not be installed". It is now left out of installs on surfaces that cannot name it — listed as a note, not a failure — and still written by the desktop app. Linux and macOS client installs also get a `start_ezquake.sh` launcher that sets the executable bit on the AppImage (and clears macOS's quarantine flag) before starting the client, since a browser cannot set that bit itself.
- **Configs and the KTX mod now install from a browser on Windows** — Chrome and Edge refuse to create `.cfg` and `.dll` files on Windows — Chromium's file system API rejects every extension Safe Browsing marks dangerous on the platform it runs on, and that list covers `cfg`, `dll`, `ini` and `manifest` — so a Windows browser install ended with "Some files could not be installed" and a list that included `qw/autoexec.cfg`, `ezquake/configs/config.cfg`, `ezquake/configs/preset.cfg` and every sample config. Renaming a file into place afterwards is refused the same way, so those files are now downloaded next to their destination with a `.nqinstall` suffix and the installer leaves a small `nquake-finish.bat` that moves them under their real names — the same shape as the `start_*.sh` launchers that set an executable bit a browser cannot. The Done step and `README-nquake.txt` say to run it, `start_servers.bat` runs it for you, and it moves a played-in `config.cfg` aside first instead of overwriting it. The `ezquake/Online Manual.url` shortcut rides along on Windows instead of being dropped. The desktop app writes everything directly and needs none of this.

