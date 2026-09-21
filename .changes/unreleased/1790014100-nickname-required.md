---
type: Changed
title: The installer asks for your nickname instead of calling you "player"
---

The nickname field started pre-filled with `player`, ezQuake's own default, so Next-Next-Next produced an install that joined servers as "player" — and, since `preset.cfg` now points `cl_fakename` at the same value, said "PLAYER" in team chat too. The field now starts empty with a placeholder, and the wizard will not move past it (the target step in Simple mode, the client config step in Advanced) until a name is entered. A server-only install is never asked.
