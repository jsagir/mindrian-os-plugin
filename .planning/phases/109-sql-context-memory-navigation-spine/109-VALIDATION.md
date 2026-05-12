---
phase: 109
slug: sql-context-memory-navigation-spine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 109 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The acceptance test (10.1 in RESEARCH.md) is the LOAD-BEARING RELEASE GATE: zero non-SQLite filesystem reads during the navigation flow, or the phase does not ship.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node `assert/strict` + `node --test` (matches existing `tests/run-all.sh` pattern) |
| **Config file** | none — canonical pattern is `tests/test-*.cjs` files invoked individually |
| **Quick run command** | `node tests/test-navigation-acceptance.cjs` (Wave 0 creates) |
| **Full suite command** | `bash tests/run-all.sh` |
| **Estimated runtime** | ~2 min total at phase gate (16 test files; <30s per wave) |

---

## Sampling Rate

- **After every task commit:** Run the test for the deliverable being built (<5s per test)
- **After every plan wave:** Run all tests for the wave's deliverables (<30s)
- **Before `/gsd:verify-work`:** `bash tests/run-all.sh` plus the instrumented acceptance test must be green (<2 min)
- **Max feedback latency:** 30 seconds per wave

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| NAV-109-01 | Focus persists across sessions; auto-focus rules fire in correct order | unit | `node tests/test-navigation-focus.cjs` | ❌ W0 |
| NAV-109-02 | Neighborhood CTE returns ranked typed neighbors in <50ms on 10K-node room | perf + unit | `node tests/test-navigation-neighborhood.cjs && node tests/test-navigation-perf-10k.cjs` | ❌ W0 |
| NAV-109-03 | Memory event log: 15 event types accepted; outside-set rejected; queryable by time-range | unit | `node tests/test-navigation-memory-events.cjs` | ❌ W0 |
| NAV-109-04 | 7 insight queries return correct shapes; explanation strings templated (no LLM in loop) | unit | `node tests/test-navigation-insights.cjs` | ❌ W0 |
| NAV-109-05 | Pre-commit hook fails commits with direct room-db.cjs imports outside allow-list; pre-existing imports survive | integration | `node tests/test-navigation-chokepoint-hook.cjs` | ❌ W0 |
| NAV-109-06 | buildBrainPacket returns shape per CONTEXT D-06; banked_opportunities carries hash+tags+band only | unit + Part 8 | `node tests/test-navigation-packet-builder.cjs && node tests/test-navigation-packet-part8-leak.cjs` | ❌ W0 |
| NAV-109-07 | storeBrainSuggestions writes review_status='proposed' always; Part 9 invariant SQL returns 0 rows | unit + Part 9 | `node tests/test-brain-ingestion-part-9-invariant.cjs` | ❌ W0 |
| NAV-109-08 | getRoomHomeView output covers every field deriveSection emits (regression fence) | regression | `node tests/test-room-home-vs-brain-derivation-regression.cjs` | ❌ W0 |
| NAV-109-09 | Canon Part 9 merge produces well-formed MINDRIAN-CANON.md with Part 9 between Part 8 and Appendix A; CANON-PHASE-MAP.md rows are `shipped` | structural | `node tests/test-canon-part-9-ratification.cjs` | ❌ W0 |
| **ALL** | **Acceptance test: full navigation flow produces 6 typed payloads with ZERO non-SQLite filesystem reads** | **instrumented release gate** | `node tests/test-navigation-acceptance.cjs` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Wave 4 plan mapping (added 2026-05-12 by /gsd:plan-phase 109 add-more-plans)

| Plan | Owns | Fills test | Requirement | Note |
|---|---|---|---|---|
| 109-10 | tests/test-navigation-acceptance.cjs (+ conditional surgical fix to a lib/core/navigation/*.cjs module) | tests/test-navigation-acceptance.cjs (the load-bearing instrumented gate; was a 109-00 stub) | NAV-109-09 (test-flow half) | Routes the full navigation flow through lib/core/navigation.cjs with fs-instrument active; asserts zero non-SQLite filesystem reads; the `_mocks` seam is mandatory on every call. |
| 109-11 | docs/MINDRIAN-CANON.md + docs/CANON-PHASE-MAP.md + tests/test-canon-part-9-ratification.cjs | tests/test-canon-part-9-ratification.cjs (structural; was a 109-00 stub) | NAV-109-09 (canon half) | Merges Part 9 into MINDRIAN-CANON.md before Appendix A; flips CANON-PHASE-MAP Part 9 rows to shipped for 108+109; v1.3 -> v1.4; Appendix D entry 12. Per CONTEXT D-09, owns the canon files exclusively. |
| 109-12 | the 4 missing SUMMARY files (109-00/01/07/09) + .planning/REQUIREMENTS.md | (none - bookkeeping recovery) | (none - bookkeeping; flips NAV-109-06/07/08 to Complete) | Restores 109-00/07/09 SUMMARYs verbatim from commits 5426e97/65468bc/b3d8c01 where recoverable; hand-writes 109-01-SUMMARY noting follow-up fix 7d87ed5. Last plan of the phase. |

Known gap (carried, not fixed by Wave 4 plans): the 16 Phase-109 test stubs from Plan 109-00 Task 4 are NOT all registered in `lib/memory/run-feynman-tests.cjs` on main (only `test-navigation-migration-views.cjs` is). The stubs still run via direct `node tests/test-*.cjs`. Plan 109-12 flags this in 109-00-SUMMARY.md; a follow-up may register them. The two stubs Wave 4 fills (test-navigation-acceptance.cjs, test-canon-part-9-ratification.cjs) are likewise not in the Feynman runner - Plans 109-10/11 do NOT add them (per the planning brief: register nothing new).

---

## The Acceptance Test (release gate, non-negotiable)

`tests/test-navigation-acceptance.cjs` — LOAD-BEARING. If this fails, Phase 109 does not ship.

**Fixture:** 500-node test room at `tests/fixtures/phase-109/sample-room/` (Wave 0 creates):
- 1 room + 8 sections + 50 artifacts + 100 claims + 80 assumptions + 60 evidence + 30 decisions + 25 open_questions + 20 opportunities + 30 stakeholders + 50 memory_events + 40 entities + 20 jtbd anchors + ~600 edges across the 23 EDGE_TYPES

**Flow:**
1. Open fixture room
2. Set focus to known decision node
3. **Install fs proxy** (`tests/helpers/fs-instrument.cjs`) — wraps fs.readFile/open/readdir/stat with allow-list of room.db + WAL/SHM/journal companions only
4. Call all 6 navigation primitives in sequence (getNeighborhood, findContradictions, findRecentChanges, buildBrainPacket, getRoomHomeView, findRelevantOpportunities)
5. Per-call assertions: returns in <50ms (timed via `process.hrtime.bigint()`), every node carries provenance fields
6. **Cross-flow assertion (the load-bearing one):** fs proxy reports ZERO non-SQLite filesystem reads. If even one fs.readFile outside room.db / WAL / shm files fires, test FAILS
7. Brain packet skeleton serializes to <1200 tokens
8. Room Home payload does NOT duplicate data (id-set comparison)
9. Uninstall fs proxy
10. Exit code: 0 only if every assertion passes

**Belt + suspenders:** in CI on Linux, also run under `strace -f -e trace=openat -o /tmp/strace.log` and assert strace contains only allow-list paths.

---

## Migration Tests (3 additional)

| Test | Fixture | Assertion |
|---|---|---|
| `test-navigation-migration-idempotent` | room with Phase 108 schema; run migration twice | second run is no-op (no errors, no data changes) |
| `test-navigation-migration-backfill` | room with legacy data: nodes with `properties.confidence='high'`, assumptions with various validity values | post-migration: confidence=0.8, assumption rows exist as graph nodes with correct review_status per status_aliases (untested→proposed, supported→validated, contradicted→invalidated, stale→stale) |
| `test-navigation-migration-coexistence` | room mid-migration (Step 1 done, Step 2 not yet) | reads via navigation API still work; old `assumptions.validity` reads still work; no data corruption |

---

## Performance Test (10K nodes)

`tests/test-navigation-perf-10k.cjs`. Generates a 10K-node room programmatically (`tests/fixtures/phase-109/generate-perf-room.cjs`):
- Cold neighborhood query: <200ms p95 over 10 calls
- Warm neighborhood query: <50ms p95 over 100 calls
- Memory: peak RSS during the test stays under 200MB
- Realistic edge density: ~3-5 edges per node, weighted toward CONTRADICTS / SUPPORTS / DEPENDS_ON / ASSUMES (the high-weight types that drive ranking)

---

## Wave 0 Requirements (16 files + 2 fixtures)

Test files (created as RED stubs in 109-00; filled by later plans):
- [ ] `tests/test-navigation-acceptance.cjs` (the load-bearing instrumented gate)
- [ ] `tests/test-navigation-focus.cjs` (NAV-109-01)
- [ ] `tests/test-navigation-neighborhood.cjs` (NAV-109-02 correctness)
- [ ] `tests/test-navigation-perf-10k.cjs` (NAV-109-02 perf)
- [ ] `tests/test-navigation-memory-events.cjs` (NAV-109-03)
- [ ] `tests/test-navigation-insights.cjs` (NAV-109-04)
- [ ] `tests/test-navigation-chokepoint-hook.cjs` (NAV-109-05)
- [ ] `tests/test-navigation-packet-builder.cjs` (NAV-109-06 shape)
- [ ] `tests/test-navigation-packet-part8-leak.cjs` (NAV-109-06 Part 8 invariant)
- [ ] `tests/test-brain-ingestion-part-9-invariant.cjs` (NAV-109-07)
- [ ] `tests/test-room-home-vs-brain-derivation-regression.cjs` (NAV-109-08)
- [ ] `tests/test-canon-part-9-ratification.cjs` (NAV-109-09)
- [ ] `tests/test-navigation-migration-idempotent.cjs`
- [ ] `tests/test-navigation-migration-backfill.cjs`
- [ ] `tests/test-navigation-migration-coexistence.cjs`

Helper + fixtures:
- [ ] `tests/helpers/fs-instrument.cjs` (fs proxy for the load-bearing assertion)
- [ ] `tests/fixtures/phase-109/sample-room/` (500-node fixture; seed data + room.db; checked into git)
- [ ] `tests/fixtures/phase-109/generate-perf-room.cjs` (10K-node generator)

Registry update:
- [ ] Update `tests/run-all.sh` to register the 16 new test files

*Existing test infrastructure: 74 shipped tests using direct-CJS pattern. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Canon Part 9 amendment text reads cleanly as canon prose at the merge point | NAV-109-09 | Subjective prose quality | Read merged docs/MINDRIAN-CANON.md Part 9; verify it parses as Part-N canon (uses Part 9 numbering, cross-references Parts 4 and 8, lives within the Mindrian Canon voice) |
| The "no whole-room scan" instrumented assertion behaves correctly across surfaces | acceptance test | Cross-platform validation | Run acceptance test on Linux (with strace belt-suspenders), macOS (Cowork), Windows (CLI cohort). All three must exit 0 |
| Room Home Driver migration doesn't visually break Phase 90 BRAIN.md output | NAV-109-08 | UX comparison | Compare BRAIN.md before/after — fields covered, but ordering or framing may shift |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (16 test files + helper + 2 fixtures + registry update)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per wave
- [ ] **The fs-instrument acceptance test passes with ZERO non-SQLite filesystem reads (the release gate)**
- [ ] `nyquist_compliant: true` set in frontmatter (after planner ships Wave 0)

**Approval:** pending
