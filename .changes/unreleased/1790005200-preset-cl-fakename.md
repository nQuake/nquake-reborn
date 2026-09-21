---
type: Fixed
title: Your nickname now shows up in team messages instead of "PLA"
---

ezQuake rewrites every `say_team` message as `<cl_fakename><cl_fakename_suffix><message>`, and nQuake's `nquake_default.cfg` sets `cl_fakename "pla"` — a leftover placeholder from "player". So team chat read `PLA: 0/1000 RL: 100 LG: 100` for everyone, whatever they called themselves, and `name`, `nick`, `tname` and `tpname` all failed to change it because none of them feed `cl_fakename`. The generated `ezquake/configs/preset.cfg` now sets `cl_fakename` to the nickname you gave the installer, alongside `name`, and carries a comment saying what the cvar does and how to clear it — preset.cfg is exec'd after `nquake_default.cfg`, so it wins. The nickname hint in Advanced mode no longer says `/name` is all there is to it.
