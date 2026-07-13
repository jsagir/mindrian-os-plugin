---
phase: quick-260713-fx2
plan: 01
subsystem: eureka
tags: [eureka, entity-extract, freshness-gate, nested-artifact, decisions-16, live-discovered]

# Dependency graph
requires:
  - phase: 218
    provides: writeEntityNode + edge vocabulary + entity-extract.cjs dispatcher
  - phase: quick-260706 (T-218-VD-5, same-session earlier work)
    provides: the freshness-gated entity-extraction pre-step this fix repairs
provides:
  - A correct, recursive newestArtifactMtimeMs() that sees the standard nested artifact layout
  - A regression-pinning test leg (3b) proven RED against the unfixed code, GREEN against the fix
affects: [eureka-command, entity-extract, phase-219-harvest-sensor, phase-220-url-ingest]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded recursive directory walk (MAX_WALK_DEPTH) instead of a one-level readdir, for any future room-content probe"
    - "Prove-the-test-catches-the-bug: revert fix -> RED -> restore fix -> GREEN, not just written-and-trusted"

key-files:
  created: []
  modified:
    - scripts/eureka-command.cjs
    - tests/test-218-eureka-auto-extract.cjs

key-decisions:
  - "Recurse to MAX_WALK_DEPTH=8 rather than a fixed 2-level special case, since a room's real nesting depth (sub-rooms, per-artifact folders) is not itself bounded to exactly 2"
  - "Skip dot-directories at EVERY depth (not just the top level), so .mindrian/.room-graph/.git never get walked at any nesting level"
  - "Isolation fix in the test: leg 3's deliberately-future mtime (Date.now()+5000) outlives its own run and must be wound back to a safe past point before leg 3b, or leg 3b would false-green even against the unfixed code"

patterns-established:
  - "A freshness/staleness probe over room content must recurse to the ICM Obsidian-vault nested layout (decisions.md #16); a flat one-level directory walk is a real, repeatable bug class, not a one-off"

requirements-completed: [QUICK-FX2-EUREKA-FRESHNESS-NESTED-ARTIFACT]

# Metrics
duration: ~35min
completed: 2026-07-13
---

# Phase quick-260713-fx2 Plan 01: Fix eureka freshness gate blind to nested artifact layout Summary

**`eureka run`'s T-218-VD-5 freshness gate silently never re-extracted a room's real content because its mtime probe only checked one directory level deep, missing every artifact filed in this codebase's own standard `section/name/name.md` nested layout - found live, not in a fixture, minutes after shipping the Phase 220 URL-ingestion pipeline.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 4 completed (fix, test, red/green proof, live re-verify)
- **Files modified:** 2

## Accomplishments

- Root-caused live against a real room (`aion-eureka-synergy`): ingested a real URL via `ingestUrl()`, ran `/mos:eureka run` expecting auto-extraction, found the entity-extract status still dated the PRIOR day. Confirmed the extractor itself was fine (`entity-extract.cjs` run directly picked up the new artifact: 38->65 artifacts, 354->605 entities) - isolating the bug to the freshness *probe*, not the extraction pipeline.
- Fixed `newestArtifactMtimeMs()` to recurse (`MAX_WALK_DEPTH = 8`), skipping dot-directories at every depth, not just the top one.
- Added test leg 3b to `tests/test-218-eureka-auto-extract.cjs`, filing a new artifact in the real nested shape and asserting it trips the gate.
- **Proved the test actually catches the bug**, not just written-and-trusted: reverted the fix, re-ran, confirmed leg 3b fails with the exact production symptom's assertion message; restored the fix, confirmed 5/5 green.
- Caught and fixed a second, more subtle bug while writing the regression test itself: leg 3's deliberately-future mtime hack (`Date.now()+5000`, there to dodge filesystem mtime-resolution flakiness) silently outlives leg 3's own run and would make leg 3b pass even against the UNFIXED code (a false green). Fixed by winding that file's mtime back to a safe past point before leg 3b runs, so the only remaining reason the gate can trip is the new nested artifact leg 3b actually adds.

## Task Commits

Each task was committed atomically:

1. **Task 1: fix newestArtifactMtimeMs to recurse** - `69068f53` (fix, bundled with Task 2's test in one commit since they were built and verified together as one red/green cycle)
2. **Task 2: regression-pinning test leg 3b + isolation fix** - `69068f53` (same commit)

## Files Created/Modified

- `scripts/eureka-command.cjs` - `newestArtifactMtimeMs` rewritten as a bounded recursive walk (`MAX_WALK_DEPTH=8`); dot-directories skipped at every depth. Full root-cause comment left in place at the call site for the next reader.
- `tests/test-218-eureka-auto-extract.cjs` - new leg 3b (files a nested `section/name/name.md` artifact, asserts re-extraction); isolation reset of leg 3's future-mtime hack before leg 3b runs; leg count updated 4->5 in the final log line.

## How It Works (Feynman)

This whole codebase has one rule for where a real artifact lives: its own folder, named after itself, inside its section - `research/my-finding/my-finding.md`, never a bare `research/my-finding.md`. That rule exists so every artifact can carry its own attachments and get its own graph node cleanly (decisions.md #16).

The freshness gate's job was simple: "has anything in this room changed more recently than the last time we extracted entities?" To answer that, it needs to find the single newest file-modification-time across every real artifact. The original code asked one directory level down from each section - it would find `research/my-finding.md` if that existed, but it would never even look inside `research/my-finding/` to find `my-finding.md` there. Since EVERY real artifact lives one folder deeper than that, the probe was structurally blind to almost everything it was supposed to watch. It always answered "nothing's changed," even when something very clearly had, so `eureka run` never re-extracted on its own - the exact two-step manual-sequencing gap this same freshness gate was built earlier this session to close.

The fix just asks the right, complete question: walk into every subfolder, however deep, and find the newest `.md` file anywhere under the room (skipping only the tool's own dot-prefixed bookkeeping directories). Now a fresh artifact anywhere in the room - flat or nested - gets seen.

## Deviations from Plan

None - matches the plan exactly, including the unplanned-but-necessary isolation fix to the test itself (folded into Task 2, not a separate task, since it was discovered while proving Task 2's own red/green cycle).

## Verification

- `node tests/test-218-eureka-auto-extract.cjs` - 5/5 legs PASSED.
- `bash tests/run-all-218.sh` - Phase 218: PASS=13 FAIL=0 SKIP=0, no regression.
- Red/green proof: reverted `newestArtifactMtimeMs` to the one-level-deep original, re-ran the suite - leg 3b failed with `a NEW artifact filed in the standard nested section/name/name.md layout must trip the freshness gate...`, legs 1-3 still passed (confirming the isolation fix correctly narrows the failure to leg 3b only). Restored the fix - 5/5 green again.
- Live re-verify: `node scripts/entity-extract.cjs /home/jsagi/MindrianRooms/aion-eureka-synergy start` picked up the room's real new content (38->65 artifacts, 354->605 entities, 355->628 edges) - proof of what the gate should now trigger automatically on the next `eureka run`.
- No em-dashes introduced (both files hand-checked; house rule).
- `node -c` clean on both modified files.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: scripts/eureka-command.cjs
- FOUND: tests/test-218-eureka-auto-extract.cjs
- FOUND commit: 69068f53
