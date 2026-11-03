---
quick_id: 261103-vdn
description: 369.6 isolation guard skips the statusline cache in filesNewerThan
date: 2026-11-03
files_modified:
  - scripts/isolate-larry-voice.cjs
  - tests/test-3696-isolation-cache-skip.cjs
  - tests/run-all-3696.sh
---

# Plan 261103-vdn

Root cause (proven 2026-11-03): a live Claude statusline in any session whose room is this checkout rewrites
`room/.mindrian/statusline-cache.json` about every 7 s (mtime 22:28:25 then 22:28:32). `filesNewerThan` in
`scripts/isolate-larry-voice.cjs` is a bare `find -newer` with no ignore filter, so legs B4d and B5f of
`tests/test-3696-isolation.cjs` see a "repo file newer than the marker" inside a long suite run. The test passes
alone (70/0) because the window is short.

Task 1: `filesNewerThan` skips exactly `<root>/room/.mindrian/statusline-cache.json`, nothing broader.
Task 2: new `tests/test-3696-isolation-cache-skip.cjs` pins skip-only-that-path (S1 to S6) and is a plain run leg in `tests/run-all-3696.sh`.

Out of scope: running the full suite (load1 above 6), push.
