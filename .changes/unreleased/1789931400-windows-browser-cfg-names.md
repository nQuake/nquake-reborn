---
type: Fixed
title: Configs and the KTX mod now install from a browser on Windows
---

Chrome and Edge refuse to create `.cfg` and `.dll` files on Windows — Chromium's file system API rejects every extension Safe Browsing marks dangerous on the platform it runs on, and that list covers `cfg`, `dll`, `ini` and `manifest` — so a Windows browser install ended with "Some files could not be installed" and a list that included `qw/autoexec.cfg`, `ezquake/configs/config.cfg`, `ezquake/configs/preset.cfg` and every sample config. Renaming a file into place afterwards is refused the same way, so those files are now downloaded next to their destination with a `.nqinstall` suffix and the installer leaves a small `nquake-finish.bat` that moves them under their real names — the same shape as the `start_*.sh` launchers that set an executable bit a browser cannot. The Done step and `README-nquake.txt` say to run it, `start_servers.bat` runs it for you, and it moves a played-in `config.cfg` aside first instead of overwriting it. The `ezquake/Online Manual.url` shortcut rides along on Windows instead of being dropped. The desktop app writes everything directly and needs none of this.
