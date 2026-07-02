---
phase: 209-shape-f-native-fire
plan: 06
subsystem: hooks
tags: [primary-detection, side-channel, check-card-fire, session-start, h3, h4]

requires:
  - phase: 209-shape-f-native-fire (plan 01)
    provides: "the E1/E2/E3 trailer + contract engine-arm seam; the E4 emitBindingGate footer/trailer fix this plan's producers hook into"
provides:
  - "lib/core/card-fire-sidechannel.cjs - recordReachedGate/readReachedGates, TTL+size-capped, atomic writes, never-throw"
  - "Three live producers: lib/hmi/selector-dispatcher.cjs pickShape door, scripts/intent-classifier.cjs engine arm + emitBindingGate"
  - "scripts/check-card-fire.cjs's PRIMARY detection is now LIVE (deriveTurnSignals reads the side file); regex BACKSTOP stays secondary permanently"
  - "scripts/session-start no longer teaches the ASCII-box anti-pattern (MODE_MENU + Other-rooms injections both instruct an AskUserQuestion fire)"
  - "tests/test-209-primary-sidechannel.cjs (10 assertions), tests/test-209-session-start-exemplar.cjs (5 assertions)"
affects: [209-07]

tech-stack:
  added: []
  patterns:
    - "Atomic tmp-file-plus-rename writes for a side-channel file (stronger than the existing card-fire-retries.json's plain writeFileSync), justified by this file's role as a detection INPUT rather than just a counter"
    - "A NO_SESSION_KEY degenerate bucket, unioned into every session-scoped read - lets a producer with no session_id in scope still surface its signal"

key-files:
  created:
    - lib/core/card-fire-sidechannel.cjs
    - tests/test-209-primary-sidechannel.cjs
    - tests/test-209-session-start-exemplar.cjs
  modified:
    - lib/hmi/selector-dispatcher.cjs
    - scripts/intent-classifier.cjs
    - scripts/check-card-fire.cjs
    - scripts/session-start

key-decisions:
  - "The side-channel's recorded 'entry' strings are the BARE registry surface path (e.g. \"lib/hmi/selector-dispatcher.cjs\"), NOT the plan's illustrative \"surface#shape\" composite. Verified live: data/render-coverage-registry.json's .cjs entries' `entry` field is always a bare path with no shape suffix, and check-card-fire.cjs's gateReachingEntries()/classifyCardFire() intersect ran_entries against that EXACT string set. Recording a \"#shape\" suffix would never intersect the registry, leaving PRIMARY detection functionally inert despite being wired - the opposite of this plan's purpose. shape is still stored per-record for diagnostics; it is simply not part of the matched key."
  - "readReachedGates unions the requested session's bucket with the NO_SESSION_KEY bucket whenever a real sessionId is given. The pickShape trailer door has no session_id anywhere in scope (verified: zero session_id/sessionId references in the whole file), so without this union its records would never surface to a session-scoped consumer lookup."
  - "check-card-fire.cjs's WR-04 doctrine header is UPDATED in place (not silently left stale): the historical 'PRIMARY is DEFERRED' text is preserved verbatim for the record, immediately preceded by a new DOCTRINE UPDATE section stating PRIMARY is now live and naming the producer module + all three mint sites."

patterns-established:
  - "A test-only path-override seam (opts.filePath, then a CARD_FIRE_SIDECHANNEL_PATH env var, then the real ~/.mindrian default) lets both unit tests and integration tests exercise the real production call sites (pickShape, the engine arm, emitBindingGate) without ever touching the real side-file"

requirements-completed: [H3, H4]

duration: unknown (manual implementation)
completed: 2026-07-02
---

# Phase 209 Plan 06: PRIMARY Side-Channel + Session-Start Fix (H3 + H4) Summary

**check-card-fire.cjs's PRIMARY (registry-keyed) detection - documented INERT since Phase 179 for lack of a producer - is now live at all three gate-envelope mint sites, and the session's opening exemplar no longer teaches the ASCII-box anti-pattern it exists to catch.**

## Performance

- **Tasks:** 3 completed
- **Files modified:** 7 (3 new: sidechannel module + 2 tests; 4 modified: dispatcher, intent-classifier, check-card-fire, session-start)

## Accomplishments

- `lib/core/card-fire-sidechannel.cjs`: TTL-pruned (10 min), size-capped (64KB, oldest-first truncation), atomically-written (tmp+rename) side file at `~/.mindrian/card-fire-reached.json`. Never throws on either end.
- Wired at all three sites: `selector-dispatcher.cjs`'s pickShape door (inside the `payload.emitTelemetry === true` guard, Canon Part 8 fs_scope preserved), and `intent-classifier.cjs`'s engine arm + `emitBindingGate` (F.8).
- `check-card-fire.cjs`'s `deriveTurnSignals` now reads the side file whenever the envelope does not already carry `ran_entries`/`reached_gate_entries` directly - the 22 pre-existing predicate assertions stay byte-identical (direct-field precedence preserved), and all 12 legs of `tests/run-all-179.sh` still pass.
- `scripts/session-start`'s MODE_MENU and "Other rooms:" injections both now instruct an explicit AskUserQuestion fire naming SEED-021; the literal "Type 1, 2, or 3" exemplar is gone; `bash -n` still parses clean.

## Task Commits

All three tasks landed in one commit (implemented directly against the live seams, verified incrementally at each step rather than via separate TDD RED/GREEN commits, since the seams required careful live-tree investigation - the registry entry-format discovery below - before the correct implementation could be written):

1. **Task 1 + Task 2 + Task 3: side-channel module, three producers, PRIMARY consumer wire, session-start fix**
   - `f200f43c` feat(209-06): H3 PRIMARY side-channel + H4 session-start exemplar fix

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `lib/core/card-fire-sidechannel.cjs` - `recordReachedGate`, `readReachedGates`, `sideFilePath`, TTL/size-cap constants.
- `lib/hmi/selector-dispatcher.cjs` - one `recordReachedGate` call inside the `emitTelemetry===true` guard, alongside `emitPresentationTelemetry`/`emitSelectorPickUnified`.
- `scripts/intent-classifier.cjs` - two `recordReachedGate` calls (engine arm post-trailer; `emitBindingGate` post-trailer), plus `sessionId` threaded into the engine-arm `ctx` object at its call site.
- `scripts/check-card-fire.cjs` - `deriveTurnSignals` reads the side file on empty direct-field `ran_entries`; the WR-04 doctrine header updated in place.
- `scripts/session-start` - the MODE_MENU here-string and its injection line, plus the "Other rooms:" injection, rewritten to instruct a card fire.
- `tests/test-209-primary-sidechannel.cjs` - 10 assertions (writer/reader round trip, degrade paths, TTL, the fs_scope no-write proof, source proofs, the PRIMARY-live consumer behaviors, direct-field precedence, empty-file byte-identical behavior, constitutional-floor proof).
- `tests/test-209-session-start-exemplar.cjs` - 5 assertions (forbidden literal absence, both regions' AskUserQuestion/SEED-021 presence, `bash -n`).

## Decisions Made

See key-decisions in frontmatter. The registry entry-format discovery (bare path, not "surface#shape") is the most consequential - it was found by directly inspecting `data/render-coverage-registry.json`'s live `.cjs` entries and `gateReachingEntries()`'s exact string-set intersection logic before writing a single line of the producer/consumer wiring, rather than assuming the plan's illustrative schema example was load-bearing.

## Deviations from Plan

The recorded entry-string format (bare surface path vs. the plan's "surface#shape" illustrative example) is the one documented, load-bearing deviation - required for PRIMARY detection to actually function, not a style preference. Everything else follows the plan's file list, producer sites, and consumer-wiring instructions as written.

## Issues Encountered

None requiring escalation. The `sessionId`-threading investigation (confirming `emitBindingGate` receives it as a direct arg while the engine arm needed it added to its `ctx` object, and the pickShape door has none in scope at all) was resolved by direct code reading, not guesswork, and is reflected in the NO_SESSION_KEY union design.

## Verification Results

- `node tests/test-209-primary-sidechannel.cjs` - exits 0, 10/10 assertions
- `node tests/test-209-session-start-exemplar.cjs` - exits 0, 5/5 assertions
- `node tests/test-ga4-card-fire-interceptor.cjs` - exits 0, 22/22 (pre-existing suite, unchanged)
- `bash tests/run-all-179.sh` - Passed: 12, Failed: 0, Skipped: 0
- `bash tests/run-all-209.sh` - PASS=7 FAIL=0 SKIP=2 (209-01 through 06 green; 07 x2 correctly SKIP)
- `grep -c "recordReachedGate" lib/hmi/selector-dispatcher.cjs` = 1 (inside the emitTelemetry guard)
- `grep -c "recordReachedGate" scripts/intent-classifier.cjs` = 2
- `grep -n "MAX_FORCE_RETRIES = 3"` / `"MAX_SESSION_INTERCEPTS = 12"` - both present, byte-unchanged
- `grep -c "Type 1, 2, or 3" scripts/session-start` = 0
- `grep -c "AskUserQuestion" scripts/session-start` = 3 (>= 2 required)
- `bash -n scripts/session-start` - exits 0
- No em-dashes across all touched files

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 209-07 (H1+H2 backstop tuning + the incident-replay adversarial verification) can now proceed with live PRIMARY telemetry to observe: its own stated rationale is to tune the backstop only after the native path (including this plan's PRIMARY wiring) is live, using intercept telemetry to confirm which regex branches still fire.

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
