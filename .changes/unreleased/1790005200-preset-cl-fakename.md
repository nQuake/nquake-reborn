---
type: Fixed
title: Team messages are prefixed with your name instead of "PLA"
---

ezQuake rewrites every `say_team` message as `<cl_fakename><cl_fakename_suffix><message>`, and nQuake's `nquake_default.cfg` sets `cl_fakename "pla"`. The short prefix is deliberate — a team message is only so wide, and three characters leave the rest of the line for "0/1000 RL: 100 LG: 100" — but `"pla"` is an abbreviation of ezQuake's own default `name "player"`, and nothing makes it follow a player who renames themselves: `name`, `nick`, `tname` and `tpname` all fail to change it. So team chat read `PLA: 0/1000 RL: 100 LG: 100` for everyone, whatever they called themselves. The generated `ezquake/configs/preset.cfg` now writes the same three characters of *your* nickname (`cl_fakename "ter"` for "terryb") alongside `name`, under a one-line reminder to change it too if you change your name — the one thing the cvar will not do by itself. preset.cfg is exec'd after `nquake_default.cfg`, so it wins. The nickname hint in Advanced mode no longer says `/name` is all there is to it.
