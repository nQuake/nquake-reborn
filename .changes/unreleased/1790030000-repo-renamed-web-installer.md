---
type: Changed
title: The installer now lives at nquake.com/web-installer
---

The repository has been renamed from `nQuake/nquake-reborn` to `nQuake/web-installer`, so the installer is served at https://nquake.com/web-installer/ instead of https://nquake.com/nquake-reborn/ (and the preview slot at `/web-installer/preview/`). The project is still called nQuake Reborn: the install record in your game folder is still `nquake-reborn.json`, so an existing install is recognised and updated exactly as before, and nothing about what gets downloaded or where it lands has changed. What moved is the address — the GitHub and licence links in the page footer, the "Installer source" line in `README-nquake.txt`, and the `upstream-mirror` branch the latest ezQuake / MVDSV / KTX binaries are fetched from, which now reads from the repository's new name.
