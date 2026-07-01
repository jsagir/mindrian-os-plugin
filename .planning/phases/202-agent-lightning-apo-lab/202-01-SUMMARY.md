---
phase: 202-agent-lightning-apo-lab
plan: 01
subsystem: testing
tags: [telemetry, apo, jsonl, reward-signal, lab, cjs, seed-002, phase-121]

# Dependency graph
requires:
  - phase: 121-agent-observability
    provides: "frozen v1 telemetry schema + writer (schema.cjs, writer.cjs, TELEMETRY-SCHEMA.md Section 9 ingestion contract)"
provides:
  - "lab/apo/telemetry-consumer.cjs: readTelemetry(dir, opts) -> { activated, eventCount, events, highSignal, sessions, byRoom, shards, belowThreshold, activationNote }"
  - "lab/apo/reward-table.cjs: buildRewardTable(events) -> { [reach]: { rewardMean, n, signals } } with schema-drift assertion"
  - "the closed SEED-002 open loop: the write-only Phase 121 telemetry stream now has a LOCAL, offline consumer"
affects: [202-02-apo-loop-core, 202-03-plurai-eval-gate, apo, reward-signal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "anchored-shard-filter: readdirSync -> /^events-\\d{4}-W\\d{2}\\.jsonl$/ -> .sort() (Section 9 #1); excludes legacy siblings + quarantine shards"
    - "schema-presence-assert: a lab-side field subset holds its own map and asserts each name is present in schema.cjs ALLOWED_FIELDS, failing loud (REWARD_FIELD_DRIFT) on rename"
    - "hermetic-shard-staging: committed .jsonl fixture is re-staged into a tmp dir as real week-shards; the real ~/.mindrian path is never read or written"

key-files:
  created:
    - lab/apo/telemetry-consumer.cjs
    - lab/apo/reward-table.cjs
    - tests/test-202-telemetry-consumer.cjs
    - tests/fixtures/apo/telemetry-sample.jsonl
  modified: []

key-decisions:
  - "score_value carried RAW in signals and EXCLUDED from rewardMean (unbounded per schema.cjs; normalization deferred to 202-02) -- D3"
  - "byRoom buckets room-less events (command_invocation/empathy/mva.*) under __no_room__ rather than crashing or dropping -- D4"
  - "the reward-field subset is a lab-side selection with a runtime presence-assert against schema.cjs, not a schema export -- D2"

patterns-established:
  - "anchored-shard-filter: only zero-padded ISO-week shards are ingested; the regex IS the legacy/quarantine exclusion"
  - "surface-below-threshold: the activation gate returns activated:false + belowThreshold:true + a visible note, never a silent thin table"

requirements-completed: [SEED-002-ingestion, PHASE-121-consumer, CANON-Part8]

# Metrics
duration: ~30min
completed: 2026-07-01
---

# Phase 202 Plan 01: Telemetry Consumer + Reward Table Summary

**Lab-side LOCAL consumer of the Phase 121 trajectory-telemetry stream: anchored ISO-week shard read, schema_version dispatch, high-signal filtering, session/room grouping, a >=100-event activation gate, and reward-field extraction into a per-reach reward table -- closing the SEED-002 write-only open loop.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-01T~19:55Z
- **Completed:** 2026-07-01T20:24:43Z
- **Tasks:** 3 (each RED then GREEN)
- **Files created:** 4

## Accomplishments

- Built `readTelemetry` implementing the frozen docs/TELEMETRY-SCHEMA.md Section 9 ingestion contract: anchored shard regex + `.sort()`, `event` + `schema_version` dispatch (future v2 rows skipped, partial trailing line tolerated), `command_invocation` filtered from the high-signal set while `eventCount` counts all, grouping by `session_id` and `room_slug_sha256` with a `__no_room__` fallback, and the `ACTIVATION_MIN=100` gate.
- Built `buildRewardTable` extracting the four reward-bearing fields into `{ [reach]: { rewardMean, n, signals } }`, with a runtime anti-drift assertion that each chosen field name still exists in `schema.cjs` ALLOWED_FIELDS.
- Made below-threshold behavior explicit (`activated:false` + `belowThreshold:true` + a visible note) so a pre-activation corpus can never be mistaken for a real reward table.
- Closed the Phase 121 open loop: the telemetry stream, write-only since v1.13, now has a LOCAL offline consumer with zero network / zero Brain / append-only respected.

## Task Commits

Strict TDD, 3 RED/GREEN pairs (6 commits):

1. **Task 1 RED: failing test for consumer + activation gate** - `0b9d3b62` (test)
2. **Task 1 GREEN: telemetry consumer + activation gate** - `8ed9f41e` (feat)
3. **Task 2 RED: failing test for reward-table extraction** - `ca85c48a` (test)
4. **Task 2 GREEN: telemetry reward-table extraction** - `00de7bdb` (feat)
5. **Task 3 RED: failing test for below-threshold surfacing** - `5f8b2427` (test)
6. **Task 3 GREEN: explicit below-activation-threshold surfacing** - `4c62678c` (feat)

**Plan metadata:** docs commit (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `lab/apo/telemetry-consumer.cjs` - LOCAL stream reader + activation gate; reuses `telemetryDir()` + `SCHEMA_VERSION`
- `lab/apo/reward-table.cjs` - reward-field extraction with schema-presence assertion
- `tests/test-202-telemetry-consumer.cjs` - 18 assertions across the 3 tasks
- `tests/fixtures/apo/telemetry-sample.jsonl` - 12 canonical rows in exact `writer.emit` envelope shape

## Decisions Made

- **D2 (reward-field sourcing):** schema.cjs exports only the full ALLOWED_FIELDS whitelist, so `reward-table.cjs` holds its own `REWARD_FIELD` map and asserts each name is present in `ALLOWED_FIELDS[event]` at runtime, throwing `REWARD_FIELD_DRIFT` if a future schema rename drifts it. The anti-drift test targets this presence-check (there is no reward-subset constant to import).
- **D3 (score_value):** schema types `hooked_axis_score.score_value` as an unbounded number. It is carried RAW inside `signals` and excluded from `rewardMean`; the three bounded signals (ranker_confidence, user_response resolve/defer/ignore, domain_match_score) feed the mean. Normalization deferred to 202-02.
- **D4 (byRoom):** `room_slug_sha256` is a payload field absent on `command_invocation`, `empathy_observation`, and the 6 `mva.*` types, so room-less events bucket under `__no_room__` rather than crashing or dropping.
- **D1 (read filter):** the anchored regex `/^events-\d{4}-W\d{2}\.jsonl$/` then `.sort()` is used (not a loose glob), deliberately excluding legacy siblings and quarantine shards.

## Deviations from Plan

The plan's declared fixture path is `tests/fixtures/apo/telemetry-sample.jsonl` (a single file), but D1's anchored regex `/^events-\d{4}-W\d{2}\.jsonl$/` deliberately excludes that name. Reconciled without adding files: the committed fixture holds the 12 canonical rows (human-readable, the plan's named artifact), and the TEST stages them into a hermetic tmp dir as real ISO-week shards (`events-2026-W26.jsonl`, `events-2026-W27.jsonl`) plus decoy siblings. This honors D1 (anchored regex proven by excluding the decoys), REUSE_PART7 (never read the real `~/.mindrian` path), and the 4-file staging constraint simultaneously.

The three plan tasks each specified write-test -> run-fail -> implement -> run-pass -> single commit; per the TDD mandate this was executed as separate RED and GREEN commits (6 total) for a cleaner, gate-visible history. Task 3's surfacing (`activated:false` + visible note) was partially present in the Task 1 cohesive activation-gate consumer; the Task 3 RED was driven by a genuinely-missing machine-readable `belowThreshold` flag, then implemented to green.

No auto-fixes (Rules 1-3) were required; no architectural decisions (Rule 4) arose.

## Issues Encountered

None. The working tree carried unrelated dirty changes (`.planning/seeds/*`, `config.json`, a 195-02 plan, untracked scripts); all six task commits and the docs commit staged only explicit per-file paths, and every `git show --stat` confirmed zero `.planning/seeds/` contamination.

## User Setup Required

None - lab-side, offline, no external service configuration.

## Next Phase Readiness

- The reward table (`buildRewardTable`) is the reward-signal input 202-02's APO loop (propose -> score -> select over `commands/act.md`) will consume; the telemetry term is gated behind `activated` so the loop can start grading-corpus-only (D-202-2) and blend telemetry once >=100 real events exist.
- `score_value` normalization is intentionally deferred to 202-02 blend-weighting.

## Self-Check: PASSED

- All 4 created files + this SUMMARY present on disk.
- All 6 task commits (`0b9d3b62 8ed9f41e ca85c48a 00de7bdb 5f8b2427 4c62678c`) + the docs commit exist.
- `node tests/test-202-telemetry-consumer.cjs` = 18/18 PASS, exit 0.
- Zero `.planning/seeds/` contamination in any 202 commit; 19 unrelated seeds changes left uncommitted.
- Zero network / Brain / egress surface in `lab/apo/`; no em-dashes.

---
*Phase: 202-agent-lightning-apo-lab*
*Completed: 2026-07-01*
