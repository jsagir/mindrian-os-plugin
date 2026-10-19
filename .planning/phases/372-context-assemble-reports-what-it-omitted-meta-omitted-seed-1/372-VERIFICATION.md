---
phase: 372
status: passed
verified: 2026-10-20
method: isolated export of HEAD (git archive) with node_modules symlinked from the beta.69 plugin cache
---
# Phase 372 verification

Result: PASS. Requirements OMIT372-01 to OMIT372-07 (372-SPEC.md 1 to 7) are covered by 34 test legs plus the golden compare.

## Evidence (run 2026-10-20, `bash tests/run-all-372.sh` in the export)
- 372 omitted test: 34 legs passed (R1a to R7e). Forced throw at each of 7 report sites gives one `leg_failed` entry with the class name only.
- Golden compare: pre-existing fields byte-identical (10 calls, topK sweep 1..18, key order, prepare count).
- Existing: get-room-context, latency, Part 8 invariant, 347 context focus (6), 347 ranked-set exclusion (5), 353 turn budget, legD recency golden: all PASS.
- Connector registry `--check`: PASS. 267 dual-era and zod4 wire snapshots: PASS. 270 tool-schema budget: 5 passed, 59474 bytes. 234: 212 passed. 265: 228 passed.
- 276 failure set unchanged: 149 passed, 2 failed, exactly `room_list` and `room_search` (baseline reds, not from this phase).
- `git diff --check` on phase-owned files: clean (run in the real repository; the export has no .git).
- D1 branch A: `top_k_cap` ships; tie probe stable on Node v22.23.1 and SQLite 3.51.3.

## Not shown
- Not run in the shared working tree: its `node_modules` was removed at about 23:05 on 2026-10-19 by a peer session's package change (package.json and npm-shrinkwrap.json show uncommitted edits not owned by this phase). Verification used an isolated export instead.
- Tie stability on other Node or SQLite builds is covered only by the test-time re-probe (R5a).
- Real-room use on JHTV and the baseline A/B are NOT part of this phase; they gate the deferred Plan 02 of SEED-134.
