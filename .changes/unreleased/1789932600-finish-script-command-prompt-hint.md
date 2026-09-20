---
type: Fixed
title: The finish-the-install hint now shows the command-prompt form too
---

`nquake-finish.bat` — the last step of a browser install on Windows — was only ever described as something to double-click. The Done step and `README-nquake.txt` now also show it as two lines you can paste into a command prompt, starting with the `cd /d` into the install folder, so it is clear where the script has to be run from. (The script itself already changes to its own directory, so it works either way.)
