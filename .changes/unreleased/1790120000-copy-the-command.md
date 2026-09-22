---
type: Added
title: The commands on the Done step have a copy button
---

The last thing a browser install asks of you is a line to run in a terminal — `sh start_ezquake.sh`, or on Windows the two lines that `cd /d` into your nQuake folder and run `nquake-finish.bat`. Retyping a path off a screen is exactly where an install goes wrong at the last step, so each of those blocks now has a **Copy** button in the corner of the terminal window, and it copies the whole thing, every line, including the part scrolled out of view on a phone. Where the clipboard API is not available — the page served over plain HTTP, or permission refused — it falls back to the old `execCommand` copy, and says "Press Ctrl+C" rather than pretending to have copied.
