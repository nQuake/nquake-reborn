---
type: Fixed
title: The release workflow builds the Windows and macOS desktop bundles again
---

v0.2.0 shipped with only a Linux desktop bundle attached, and the release stayed a draft, because three of the four packaging jobs failed. On Windows the embedded web build was selected with `VITE_TARGET=tauri vite build` — POSIX shell syntax that cmd.exe rejects outright ("'VITE_TARGET' is not recognized as an internal or external command"), so `beforeBuildCommand` died before a single file was compiled; the mode is now passed as `vite build --mode tauri`, which works on every shell. On macOS the bundler failed at `security import: failed to import keychain certificate`: it decides whether to code-sign by checking whether `APPLE_CERTIFICATE` *exists*, and the workflow was handing it an empty string from an unset secret. The `APPLE_*` variables are now exported only when the secrets are actually set, so an unsigned bundle builds and uploads as intended.
