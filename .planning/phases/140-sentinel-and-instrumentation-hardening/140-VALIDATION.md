---
phase: 140
slug: sentinel-and-instrumentation-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-04
---

# Phase 140 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from the 140-RESEARCH.md "Validation Architecture" section (lines 234-276).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (`.test.cjs` files in `lib/memory/`, `lib/core/`) + self-contained bash smoke scripts in `tests/` |
| **Config file** | none (node:test needs none; bash harnesses are self-contained with mktemp fixtures + trap cleanup) |
| **Quick run command** | `node --test lib/core/hsi-to-graph.test.cjs` (single file) |
| **Full suite command** | `node --test` over touched `lib/` files plus the relevant `tests/*.sh` smoke harnesses |
| **Estimated runtime** | ~15 seconds (node:test files) + a few seconds per bash smoke harness |

---

## Sampling Rate

- **After every task commit:** Run the single relevant test for the bug being fixed (e.g. `node --test lib/core/hsi-to-graph.test.cjs`, or `bash tests/test-sentinel-health-check.sh`)
- **After every plan wave:** Run `node --test` over touched `lib/` files + the new bash smoke harnesses
- **Before `/gsd:verify-work`:** All 5 regression tests must be green, plus a manual `/mos:scout` run in a real (migrated) room showing the health-check report written, HSI edges in room.db, the telemetry JSONL gaining lines, and a phase deadline surfaced
- **Max feedback latency:** ~30 seconds (single-file quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 140-01-01 | 01 | 1 | HARD-02 | T-140-02 | system-bookkeeping node insert satisfies Phase-109 created_by CHECK | unit | `node --test lib/core/hsi-to-graph.test.cjs` | NO W0 | pending |
| 140-01-02 | 01 | 1 | HARD-02 | T-140-02 / T-140-03 | both-schema NOT-NULL-safe insert; scalar/local payload only | unit | `node --test lib/core/hsi-to-graph.test.cjs` | NO W0 | pending |
| 140-01-03 | 01 | 1 | HARD-02 (D-03) | T-140-01 | scout write failure surfaces, not swallowed (no 2>/dev/null, no bare \|\| true) | smoke/grep | `grep -n "hsi-to-graph" commands/scout.md` | n/a | pending |
| 140-02-01 | 02 | 1 | HARD-01, HARD-03 | T-140-04 / T-140-05 | zero-edge snapshot survives; backup-dir IDs never enter graph | bash smoke | `bash tests/test-sentinel-health-check.sh; bash tests/test-hsi-skip-heal-backup.sh` | NO W0 | pending |
| 140-02-02 | 02 | 1 | HARD-01 | T-140-04 | numeric capture single-line; no arithmetic abort under set -e | bash smoke | `bash tests/test-sentinel-health-check.sh` | NO W0 | pending |
| 140-02-03 | 02 | 1 | HARD-03 | T-140-05 | both SKIP_DIRS sets exclude .heal-backup (D-04 scope held) | bash smoke | `bash tests/test-hsi-skip-heal-backup.sh` | NO W0 | pending |
| 140-03-01 | 03 | 1 | HARD-04 (D-01) | T-140-06 | all-turns gate; JSONL stays scalar-only + LOCAL-slug-only, no new field | unit | `node --test lib/memory/query-efficiency-telemetry.test.cjs` | PARTIAL extend | pending |
| 140-03-02 | 03 | 1 | HARD-04 (D-01a) | T-140-07 | 57x claim stays measurable on /mos: population; no silent redefinition | manual/run | `node scripts/scout-telemetry-aggregator.cjs --mos-only` | n/a | pending |
| 140-03-03 | 03 | 1 | HARD-05 | T-140-08 | malformed/placeholder dates skipped (epoch==0 guard); absent STATE.md non-fatal | bash smoke | `bash tests/test-deadline-monitor-planning-state.sh` | NO W0 | pending |

*Status: pending / green / red / flaky*

---

## Phase Requirements - Test Map (from RESEARCH lines 246-253)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | health-check survives a zero-edge snapshot and writes a valid report | bash smoke | `bash tests/test-sentinel-health-check.sh` (fixture: room with empty previous snapshot) | NO - Wave 0 |
| HARD-02 | `hsi-to-graph.cjs` writes Section + edge nodes into a Phase-109-migrated room.db without NOT NULL failure (and into an un-migrated 3-col db) | unit (node:test) | `node --test lib/core/hsi-to-graph.test.cjs` | NO - Wave 0 |
| HARD-03 | `compute-hsi.py` and `rs-engine.py` exclude `.heal-backup/` from artifacts | python/bash smoke | `bash tests/test-hsi-skip-heal-backup.sh` (fixture: room with `.heal-backup/<TS>/dup.md`) | NO - Wave 0 |
| HARD-04 | telemetry hook writes a JSONL line for a no-/mos:-context Read/Grep/Glob turn; the existing test still passes | unit (node:test) | `node --test lib/memory/query-efficiency-telemetry.test.cjs` | PARTIAL - extend existing |
| HARD-05 | deadline monitor reports a `.planning/STATE.md` phase deadline as DUE, not CLEAR | bash smoke | `bash tests/test-deadline-monitor-planning-state.sh` | NO - Wave 0 |

---

## Wave 0 Requirements

- [ ] `lib/core/hsi-to-graph.test.cjs` - HARD-02, migrated + un-migrated room.db fixtures (use `openRoomDb` to migrate, then run the writer)
- [ ] `tests/test-sentinel-health-check.sh` - HARD-01, zero-edge-snapshot fixture
- [ ] `tests/test-hsi-skip-heal-backup.sh` - HARD-03, both scanners, `.heal-backup/<TS>/dup.md` fixture
- [ ] extend `lib/memory/query-efficiency-telemetry.test.cjs` - HARD-04, assert a JSONL line is written when no /mos: context is set (all-turns case) + Part-8 field-set assertion
- [ ] `tests/test-deadline-monitor-planning-state.sh` - HARD-05, `.planning/STATE.md` phase-deadline fixture

*HARD-04 reuses the existing `lib/memory/query-efficiency-telemetry.test.cjs` (Canon Part 7 reuse) - extend, do NOT fork a parallel `tests/` copy.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase gate end-to-end scout run | HARD-01..05 | A real `/mos:scout` run against a live migrated room exercises all 5 fixes together; not reducible to a single automated assertion | In a real (migrated) room: run `/mos:scout`; confirm the health-check report is written (HARD-01), HSI edges land in room.db (HARD-02), backup-dir duplicates are absent from results (HARD-03), the telemetry JSONL gains lines (HARD-04), and a phase deadline surfaces (HARD-05) |
| 57x-claim reconciliation | HARD-04 / D-01a | Comparing all-turns vs /mos:-only median requires reading the produced reconciliation note + a human judgement on whether the published number is materially redefined | Run `node scripts/scout-telemetry-aggregator.cjs` and `--mos-only`; read `140-57X-CLAIM-RECONCILIATION.md`; decide whether claim language needs a release-process follow-up (claim-language change itself is DEFERRED) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 regression tests)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
