---
type: Changed
title: The footer is just the build, and it links at the commit
---

The footer carried a credit line and three links that are all a click away from the page anyway, around the one thing only it can tell you: which build you are looking at. Now it is that alone — `v0.2.0.15+8f4022d`, the deployed build label plus the first seven characters of the commit it was built from, linking at that commit on GitHub. A screenshot of a bug report that includes the footer is now a bug report you can check out. The commit comes from `GITHUB_SHA` in CI or `git rev-parse` locally; a build with neither (a source tarball) shows the label alone, unlinked.
