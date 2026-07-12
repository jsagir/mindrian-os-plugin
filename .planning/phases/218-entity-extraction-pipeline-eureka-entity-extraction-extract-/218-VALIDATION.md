---
phase: 218
slug: entity-extraction-pipeline-eureka-entity-extraction-extract-
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 218 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain-node assertion scripts (`node tests/test-*.cjs`, hand-rolled `check()`/`ok()` PASS/FAIL counters, `node:assert/strict`) + bash aggregators (`tests/run-all-<phase>.sh`). No jest/vitest — house convention across all 21x phases. |
| **Config file** | none — convention-based (`tests/run-all-218.sh`) |
| **Quick run command** | `node tests/test-218-entity-writer.cjs` |
| **Full suite command** | `bash tests/run-all-218.sh` |
| **Estimated runtime** | ~10-20 seconds (no model/network in the unit legs; REQ-5's noise-reduction leg against aion-eureka-synergy may take longer, matches the ~29s live eureka scan already measured this session) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-218-entity-writer.cjs` (or the most relevant `test-218-*.cjs` for the task just completed)
- **After every plan wave:** Run `bash tests/run-all-218.sh` + `bash tests/run-all-211.sh` (no-regression on the substrate this phase composes with) + `node scripts/build-connector-registry.cjs --check` (this phase adds no command surface — must stay clean)
- **Before `/gsd-verify-work`:** Full suite green, plus `node scripts/doctor.cjs --acceptance` and the REQ-5 before/after numbers logged in the phase's VERIFICATION artifact
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 218-01-01 | 01 | 0 | REQ-1 | — | Entity writer mints company/technology/market nodes at `review_status='proposed'` only, links to source artifact, rejects invalid type | unit | `node tests/test-218-entity-writer.cjs` | ❌ W0 | ⬜ pending |
| 218-01-02 | 01 | 0 | REQ-2 | — | 3 new edge types present, prior 37-member floor survives, non-member rejected, Set stays frozen | unit | `node tests/test-218-edge-vocab.cjs` | ❌ W0 | ⬜ pending |
| 218-01-03 | 01 | 0 | REQ-2 | — | No raw `INSERT INTO nodes/edges` outside the navigation.cjs chokepoint in new code | grep gate | `! grep -rnE "INSERT INTO (nodes|edges)" scripts/entity-extract.cjs lib/core/*extract*.cjs` | ❌ W0 | ⬜ pending |
| 218-02-01 | 02 | 0 | REQ-3 | — | Entity nodes embedded via existing `vector-store.cjs`; public signatures unchanged | unit + diff | `git diff --exit-code lib/core/eureka/vector-store.cjs` | ❌ W0 | ⬜ pending |
| 218-02-02 | 02 | 0 | REQ-4 | — | Zero code change to `insights.cjs`/`graph-ops.cjs`; before/after `whitespace_scan`+`contradiction_check` differ | integration + diff | `git diff --exit-code lib/core/navigation/insights.cjs lib/core/graph-ops.cjs` | ❌ W0 | ⬜ pending |
| 218-02-03 | 02 | 0 | REQ-5 | — | Post-extraction top-25 structural-vs-structural pair share drops below 50% from the 100% baseline | integration (against aion-eureka-synergy) | `node tests/test-218-noise-reduction.cjs` | ❌ W0 | ⬜ pending |
| 218-03-01 | 03 | 0 | D-05 | — | `openRoomDb` sets `{timeout:5000}` + `synchronous=NORMAL`; batch writes in one BEGIN/COMMIT/ROLLBACK | unit | `node tests/test-218-write-safety.cjs` | ❌ W0 | ⬜ pending |
| 218-03-02 | 03 | 0 | Part 8 | — | Zero network calls in the tier-1 extraction path | grep gate | `! grep -rnE "fetch\|http[s]?\.|require\('node:http" scripts/entity-extract.cjs lib/core/*extract*.cjs` | ❌ W0 | ⬜ pending |
| 218-03-03 | 03 | 0 | regression | — | Phases 211/216 engine unregressed by this phase's writes | regression | `bash tests/run-all-211.sh && bash tests/run-all-216.sh` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-218-entity-writer.cjs` — covers REQ-1 (mirror `typed-domain` test style; assert `review_status='proposed'`, invalid-type rejection, artifact-link edge)
- [ ] `tests/test-218-edge-vocab.cjs` — covers REQ-2 (clone `tests/test-200-02-rs-edge-vocab.cjs` floor-test verbatim; assert the 3 new members + prior-floor survival + frozen + non-member-rejected; NEVER assert `.size`)
- [ ] `tests/test-218-write-safety.cjs` — covers D-05 (`PRAGMA busy_timeout`/`synchronous` post-open; BEGIN/COMMIT/ROLLBACK-on-error)
- [ ] `tests/test-218-noise-reduction.cjs` — covers REQ-5 (extract on a fixture/aion-eureka-synergy copy, recompute top-25 structural share; may run as a logged manual-verify leg if a full eureka run is too heavy for CI)
- [ ] `tests/run-all-218.sh` — the aggregator (clone `run-all-216.sh` structure; `run`/`run_if` legs + the `git diff --exit-code` gates for REQ-3/REQ-4)
- [ ] No test framework install needed (convention-based node scripts, already the house standard)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| REQ-5 noise-reduction before/after numbers | REQ-5 | The baseline drifts as the room is used (aion-eureka-synergy is a real, actively-touched room, not a frozen fixture) — the 100% baseline must be re-captured immediately before the test, not hardcoded from this session's measurement | Run `/mos:eureka run` on aion-eureka-synergy, record top-25 structural-vs-structural share; run extraction; re-run `/mos:eureka run`; record new share; log both numbers in the phase's VERIFICATION.md |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
