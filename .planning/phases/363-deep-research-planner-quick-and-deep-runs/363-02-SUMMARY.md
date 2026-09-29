---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 02
subsystem: testing
tags: [fixtures, replay, test-helpers, wave-0, research-planner]

requires:
  - phase: 363-01
    provides: run-all-363.sh aggregator with the helpers leg pre-wired
provides:
  - buildRoom363, a disposable two-section cohort fixture room (room.db via navigation, frozen whitespace results, USER.md role variants, planted Part 8 marker)
  - makeReplayFetch and SENTINELS, an offline OpenAlex replay with 429, 500, timeout and network failure modes and a key-safe call recorder
  - writeReplayPreload for spawned CLI and MCP child processes
  - synthetic OpenAlex bodies on the shape verified live 2026-09-29
affects: [363-03, 363-08, 363-12, 363-13, 363-17, 363-20]

tech-stack:
  added: []
  patterns:
    - "fixture room seeded only through navigation writers plus the canonical USER.md writer; no raw SQL"
    - "call recorder stores header names and a has_auth boolean; api_key= in a URL is redacted and flagged"

key-files:
  created:
    - tests/helpers/fixture-room-363.cjs
    - tests/helpers/openalex-replay-363.cjs
    - tests/fixtures/363-openalex/manifest.json
    - tests/fixtures/363-openalex/bodies.json
    - tests/test-363-helpers.cjs
  modified: []

key-decisions:
  - "Frozen gap zones name their sections through nearest_room_artifacts[].artifact_id (the field write-whitespace-sections.cjs derives sections from); additive sections and zone_term fields carry the same facts so later code needs no path parsing"
  - "Task 1 and Task 2 landed as one commit, as the plan's action text instructs (Task 1 says do not commit yet)"

requirements-completed: [DRP363-16, DRP363-17]

duration: single session
completed: 2026-09-29
---

# Phase 363 Plan 02: Fixture room and OpenAlex replay helpers Summary

**Every later 363 test now has offline, deterministic inputs: a two-section cohort room with a planted Part 8 marker, and an OpenAlex replay that models 429, 500, timeout and network failure without ever recording an API key.**

## PLAN_BASE

`acdac6f43bd975c5753a87faf840e56800325ebf`

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 + 2 (one commit, per the plan) | 51abd66ff | fixture-room-363.cjs, openalex-replay-363.cjs, manifest.json, bodies.json, test-363-helpers.cjs |
| fix | 4ac9002f2 | test-363-helpers.cjs (dash characters as unicode escapes) |

Both are ancestors of HEAD.

## What was built

- `GAP_TERM_363` = `acoustic biofilm disruption` (passes `auditQueryString`; appears in no recorded body, so a synonym-only literature is modelled honestly). `MARKER_PREFIX_363` = `SECRET-363-`, marker = prefix plus 12 hex chars, planted in artifact prose and claim text in both sections and absent from every zone field.
- Whitespace-results field names matched (read from `scripts/write-whitespace-sections.cjs`, `scripts/whitespace-command.cjs`, `lib/core/ambient-run.cjs` `_whitespaceAdapter`): top-level `gaps[]`; per gap `zone_id`, `brain_framework`, `density_score`, `knn_density`, `nearest_room_artifacts[{artifact_id: "<section>/<name>/<name>.md", title}]`, `problem_type`, `hypothesis`, `strategic_rank`. There is no section field in the real shape; sections come from the first path segment of `artifact_id`. Additive fields: `sections`, `zone_term`. The test proves it by running the real `write-whitespace-sections.cjs` on the fixture: it files WHITESPACE.md in both sections.
- Zones: `zone-363-two` spans `problem-definition` and `market-analysis` and carries the gap term; `zone-363-one` spans `problem-definition` only.
- room.db lives at `.mindrian/room.db` (real room-db location), holds four claim nodes written by `navigation.writeClaimNode`. USER.md is written by `writeUserMdAtomic` (role `researcher` or `founder`). `withTimingArtifact` adds `market-analysis/timing/adoption-window/adoption-window.md`.
- Response ids in `bodies.json` (success): `gap_primary_zero`, `synonym_hits`, `prior_review_two`, `contested_rows`, `derivation_hit`, `retest_hit`, `scurve_ceiling`, `scurve_headroom`, `diffusion_adoption`, `retracted_one`. Failure sentinels: `SENTINEL_429_BUDGET`, `SENTINEL_500`, `SENTINEL_TIMEOUT`, `SENTINEL_NETWORK`. Manifest provenance: `synthetic_on_verified_shape_2026-09-29`.
- Replay ok responses carry `x-ratelimit-limit-usd 0.1`, `x-ratelimit-cost-usd 0.001` and a decreasing `x-ratelimit-remaining-usd`; bodies carry `meta.count`, `db_response_time_ms`, `cost_usd`; every result has the D-16 fields plus `primary_location.source.display_name` and `is_in_doaj`.
- `writeReplayPreload(dir, { routeModulePath })` writes a `node -r` preload; unknown q defaults to `gap_primary_zero`. Proven in child processes.

## Test counts

- `node tests/test-363-helpers.cjs`: PASS 72, FAIL 0 (exit 0). 30 fixture-room legs and 42 replay legs, including: real reader accepts the frozen file, marker planted and never in a zone, no `INSERT INTO`, sentinel behaviours, fake key never recorded, key in URL flagged and redacted, adapter-built URL replays, bodies normalize through `parseOpenAlex`, every title, abstract and venue passes the Part 8 audit, net guard attempts 0.
- `bash tests/run-all-363.sh`: `PASSED=21 FAILED=0 SKIPPED=23 KNOWN=10`, exit 0 (was 20 / 0 / 24 / 10 after 363-01; the helpers leg moved from SKIPPED to PASSED). KNOWN legs are unchanged pre-existing reds from 363-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal dash characters in the test file**
- **Found during:** aggregator run (em-dash guard flagged tests/test-363-helpers.cjs)
- **Issue:** the `EM_DASH` and `EN_DASH` constants ended up as literal characters on disk instead of unicode escapes.
- **Fix:** rewrote both as JavaScript unicode escapes (U+2014 and U+2013); the test still passes 72/72.
- **Commit:** 4ac9002f2

**2. [Rule 1 - Bug] room.db path assumption**
- **Issue:** first draft of the test looked for `room.db` at the room root; `openRoomDb` places it at `.mindrian/room.db`.
- **Fix:** the leg asserts the real path. Caught before the first commit.

### Notes

- The first aggregator run (before fix 4ac9002f2) reported FAILED=2 KNOWN=9: the em-dash guard plus one leg that read differently from its 363-01 signature. The clean re-run after the fix is FAILED=0 KNOWN=10. I did not investigate the transient leg further; peers commit in this tree.
- The plan expected a possible `percent`-style audit refusal on abstracts; the recorded bodies pass the audit as written, so no wording had to be changed.

## Authentication gates

None.

## Known Stubs

None. Bodies are intentionally synthetic and marked so in the manifest; the only live OpenAlex call in the phase remains the opt-in smoke in 363-20.

## Threat Flags

None. No new network endpoint, auth path or schema; T-363-09 (key recorded), T-363-17 (raw SQL door) and T-363-18 (network in tests) are all covered by named legs.

## Issues Encountered

- Shared tree: many unrelated peer diffs exist in `git status`; only the five owned paths were staged, each commit used `git commit --only`, and both shas are ancestors of HEAD. STATE.md, ROADMAP.md and REQUIREMENTS.md were not written (orchestrator records them).
- Requirement ids this plan completes: DRP363-16 and DRP363-17 (fixture and replay inputs; DRP363-16 was already marked for the D-16 fix in 363-01, and DRP363-17 gets its planted-marker fixture here).

## Self-Check: PASSED

- FOUND: tests/helpers/fixture-room-363.cjs, tests/helpers/openalex-replay-363.cjs, tests/fixtures/363-openalex/manifest.json, tests/fixtures/363-openalex/bodies.json, tests/test-363-helpers.cjs
- FOUND commits: 51abd66ff, 4ac9002f2 (both ancestors of HEAD)
- `node tests/test-363-helpers.cjs` exit 0; `bash tests/run-all-363.sh` exit 0, FAILED=0
