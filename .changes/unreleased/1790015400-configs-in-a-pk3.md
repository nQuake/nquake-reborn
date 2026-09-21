---
type: Changed
title: Windows browser installs no longer need a finish step — the configs go in a pk3
---

A browser on Windows cannot create a `.cfg` file, so the previous release wrote them all with a `.nqinstall` suffix and left a `nquake-finish.bat` to rename them. It can create a `.pk3`, though, and ezQuake reads configs out of a pack exactly as it reads them off disk — so the configs are now packed into `id1/configs.pk3` (and a `configs.pk3` in each mod folder that has its own configs) and a client install is finished the moment it finishes. `id1` is the lowest-priority game folder, so the `config.cfg` ezQuake writes when you quit still wins over the packed copy, and anything you edit as a loose file keeps working. Server installs are unchanged: MVDSV reads no zips and the KTX mod library has to be a real file, so those keep `nquake-finish.bat` — which `start_servers.bat` already runs for you. The `ezquake/Online Manual.url` shortcut is left out of browser installs rather than being the one thing that still needs a batch file; the readme links the manual.
