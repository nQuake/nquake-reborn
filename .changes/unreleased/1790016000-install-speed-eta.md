---
type: Fixed
title: The download tail is faster, and the time left stops claiming 16 minutes
---

A client install is ~520 files, of which ~450 are small: the queue runs largest first, so the second half of every install is hundreds of round trips to the CDN carrying almost no bytes. Two things made that half feel endless.

The worker pool ran six files at a time — the old per-host limit of an HTTP/1.1 browser, which does not apply to `raw.githubusercontent.com`, where every download is a stream on one HTTP/2 connection. It now runs twelve, so that tail costs about half the round trips' worth of waiting.

The "time left" was computed from bytes and measured bandwidth alone, which is meaningless once the work is round trips rather than bytes: throughput in bytes collapses, and the estimate reported minutes for what was seconds of work (one report read "64 KB/s · 16m 16s left" with twenty seconds to go). The installer now fits both costs a file has — a fixed per-file overhead and a per-byte rate — over the files that most recently finished, which is right in both halves of the install. Files reused from a previous install are fitted too, so an update that skips most of its files no longer estimates as though it were downloading them.
