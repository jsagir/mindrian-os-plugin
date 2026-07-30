---
phase: 240
slug: memory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 240 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None. Plain `node` scripts using `node:assert/strict` plus a hand-rolled `ok`/`fail` pass counter, and plain `bash` suites. No jest, no vitest, no mocha anywhere in this repo. |
| **Config file** | none (by design) |
| **Quick run command** | `node tests/test-240-<name>.cjs` |
| **Full suite command** | `bash tests/run-all-240.sh` |
| **Estimated runtime** | ~30-60 seconds (integration tests drive real hooks + room.db) |

---

## Sampling Rate

- **After every task commit:** Run the single new `tests/test-240-*` file that task touches.
- **After every plan wave:** Run `bash tests/run-all-240.sh` plus the regression set (`bash tests/run-all-236.sh`, `node tests/test-across-session-memory.cjs`).
- **Before `/gsd-verify-work`:** `bash tests/run-all-240.sh` green, `bash tests/run-all-127.3.sh` green, `node scripts/doctor.cjs --acceptance`, `node scripts/build-connector-registry.cjs --check`, zero em-dashes across all phase-touched files.
- **Max feedback latency:** ~60 seconds (the rebuild-survival test is the slowest single leg).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 240-01-01 | 01 | 1 | MEM-01 | -- | N consecutive same-topic turns produce a Layer 2 `in_flight` row via a turn-count trigger decoupled from `setCurrent`'s topic-change gate | integration | `node tests/test-240-jtbd-continuous-promotion.cjs` | No -- Wave 0 | pending |
| 240-01-02 | 01 | 1 | MEM-01 | -- | Mutation: restoring the topic-change-only trigger (jtbd-update.cjs:167-170) turns the above red | mutation | manual revert + re-run, documented in plan | No -- Wave 0 | pending |
| 240-02-01 | 02 | 1 | MEM-01 | -- | Manual-override write-then-read round-trip: fields the gate at across-session-memory.cjs:395 checks are present after `/mos:jtbd set X`, promotes at turn_count=1 | unit+integration | `node tests/test-240-jtbd-manual-override-roundtrip.cjs` | No -- Wave 0 | pending |
| 240-03-01 | 03 | 1 | MEM-01 | -- | Operator JUST_TALK default threshold (0.8) does not block a genuine promotion on a fresh room; the classifier can actually fire | integration | folded into test-240-jtbd-continuous-promotion.cjs's non-vacuity guard | No -- Wave 0 | pending |
| 240-04-01 | 04 | 2 | MEM-02 | -- | promote/park/complete each write a real jtbd_transitioned memory_event surviving a real rebuildGraph, identical id and byte-identical properties | integration | `node tests/test-240-jtbd-event-survives-rebuild.cjs` | No -- Wave 0 (joins existing test-jtbd-transition-graph-wiring.cjs + test-236-rebuild-preserves-journal.cjs, no test joins them today) | pending |
| 240-04-02 | 04 | 2 | MEM-02 | -- | Mutation: adding 'memory_event' to INDEXER_OWNED_NODE_TYPES turns the above red (NOT removing the transaction wrap) | mutation | manual edit + re-run, documented in plan | No -- Wave 0 | pending |
| 240-05-01 | 05 | 1 | MEM-03 | -- | Running the full JTBD suite leaves the ENTIRE .memory/ tree byte-identical (recursive hash, before/after) | fence | `bash tests/test-240-memory-store-hermetic-fence.sh` | No -- Wave 0 | pending |
| 240-05-02 | 05 | 1 | MEM-03 | -- | Deliberately seeded non-hermetic fixture turns the fence red, seeded against a sandboxed HOME | must_catch/must_not_catch | same command | No -- Wave 0 | pending |
| 240-05-03 | 05 | 1 | MEM-03 | -- | tests/test-jtbd-auto-anchor-empirical.sh's cleanup trap fixed (misses 3 of 9 paths: .memory/audit.log, .memory/ROOM.md, .rooms/.room-graph/rooms.db); hermetic standalone AND through run-all-127.3.sh | integration | `bash tests/run-all-127.3.sh` under a sandboxed HOME | No -- Wave 0 | pending |

*Status: pending / green / red / flaky. Task IDs above are provisional -- the planner assigns final plan/wave numbers.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-240.sh` -- glob-discovery aggregator in the `run-all-236.sh` shape (best exemplar to copy): glob discovery over `tests/test-240-*`, expected names enumerated in the header so absence is visible by reading, `found -eq 0` anti-vacuity guard, `set -uo pipefail` (NOT `-e`).
- [ ] `tests/test-240-jtbd-continuous-promotion.cjs` -- MEM-01 SC1 leg 1 + the operator-threshold non-vacuity leg. Must include operator-affinity setup and a classification non-vacuity assertion (research Pitfall 1: a naive test can pass vacuously if the classifier never actually fires).
- [ ] `tests/test-240-jtbd-manual-override-roundtrip.cjs` -- MEM-01 SC1 leg 2.
- [ ] `tests/test-240-jtbd-event-survives-rebuild.cjs` -- MEM-02 SC2, joining the promote path to the rebuild path. Reuse `tests/helpers/fixture-room-236.cjs` (`buildFixtureRoom236`, `countPopulations`, `readNodeRow`) per Canon Part 7 reuse-before-build.
- [ ] `tests/test-240-memory-store-hermetic-fence.sh` -- MEM-03 SC3, recursive `.memory/` hash plus the sandboxed-HOME must_catch pair.
- [ ] Framework install: none needed.

---

## Manual-Only Verifications

None identified. All three requirements have automatable, mutation-provable gates per the research.

---

## Regression Suites (must stay green)

| Suite | Expected result | Why it matters here |
|-------|------------------|----------------------|
| `bash tests/run-all-236.sh` | PASS=12 FAIL=0 | MEM-02's HARD dependency -- the transaction wrap this phase rides on |
| `bash tests/run-all-127.3.sh` | green under sandboxed HOME | Contains the one leaking suite MEM-03 fixes |
| `node tests/test-across-session-memory.cjs` | 36/36 (class 11's multi-process race is pre-existing flaky timing, not this phase's regression) | The module MEM-01's fix lives in |
| `node tests/test-jtbd-transition-graph-wiring.cjs` | 6 tests / 14 assertions | Proves the write side MEM-02 extends |
| `node tests/test-memory-hook-integration.cjs` | 10/10 | Hook integration surface adjacent to MEM-01/02 |
| `node tests/test-129-spine-substrate.cjs` | 15/15 | Underlying substrate MEM-02's sink depends on |
| `node tests/test-memory-command.cjs` | 24/26 expected (2 pre-existing Brain Mode A failures) | `/mos:memory` surface adjacent to this phase |
| `node tests/test-150-brain-egress.cjs` | PASS (MEM-04 zero-prose invariant) | Canon Part 8 regression check, unrelated subsystem but shares the memory-cortex sink |

---

*Source: `.planning/phases/240-memory/240-RESEARCH.md` Validation Architecture section, 2026-07-30.*
