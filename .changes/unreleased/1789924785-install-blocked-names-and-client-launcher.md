---
type: Fixed
title: The ezQuake manual shortcut no longer fails a browser install, and the client launches without a chmod
---

Chromium's File System Access API refuses to create `.url` files outright, so nQuake's `ezquake/Online Manual.url` shortcut ended every browser install with "Some files could not be installed". It is now left out of installs on surfaces that cannot name it — listed as a note, not a failure — and still written by the desktop app. Linux and macOS client installs also get a `start_ezquake.sh` launcher that sets the executable bit on the AppImage (and clears macOS's quarantine flag) before starting the client, since a browser cannot set that bit itself.
