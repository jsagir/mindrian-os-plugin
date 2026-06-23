---
phase: 172-contextual-invocation-coverage
plan: 13
subsystem: connector-spine
tags: [cirs, canon-part-11, coverage-gate, hard-fail, four-class, governance-isa, INV-10, INV-13, INV-14, navigator-gated]

# Dependency graph
requires:
  - phase: 172-16
    provides: the corrected baseline (88 wired / 36 excluded / 0 gap in the connector ledger) that this plan flips the gate against; the 7 newly-wired presentation surfaces + the visualize/query deprecated-excludes whose connector EXCLUDE this plan propagates into the projection
  - phase: 172-12
    provides: the gap===0 connector baseline this plan must not regress before flipping
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: contract + scripts/build-connector-registry.cjs --check tripwire that this plan flips to hard-FAIL
  - phase: 157-04
    provides: the orchestration projection generator + its --check tripwire whose command_gaps WARN this plan flips to hard-FAIL
provides:
  - "both coverage gates flipped WARN -> hard-FAIL (a surface neither WIRED nor EXCLUDED, or a command counterpart neither ranked nor excluded, exits non-zero)"
  - "projection-exclude reconciliation: a command counterpart EXCLUDED at the connector layer PROPAGATES to EXCLUDED in the projection command-ledger (10 bare-command gaps -> excluded; projection now 76 ranked / 25 excluded / 0 gap)"
  - "both gates wired into all four enforcement surfaces: pre-commit + install-pre-commit + release.sh (new Step 2.4) + doctor --acceptance (new coverage-gate point)"
  - "Canon Part 11 R1 four-class governance-ISA amendment (mechanical / framework / intelligence / pipeline); coverageReport() carries a per-surface class enum (counts unchanged 88/36/0); canon v1.14 -> v1.15"
  - "two adversarial proofs: tests/test-coverage-gate-hardfail.cjs (14) + tests/test-cirs-four-class-floor.cjs (23), both registered in run-all-172.sh"
affects: [172 release gate (the born-wired hard gate is now enforced at every merge), 170/171 conformance, all upcoming surface-adding phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "connector-EXCLUDE propagation: build-orchestration-projection.cjs classifyCommandNode now reads data/connector-coverage-ledger.json's excluded command set (memoized, test-overridable) so the projection-excluded set is the UNION of EXCLUDED_COMMANDS (projection-native) + the connector-excluded set"
    - "gap-WARN-to-hard-FAIL flip in both generators: command_gaps / gap surfaces join the STALE + CONN-03 hard-fail set in runCheck (exit 1), guarded by the gap===0 baseline so a clean repo stays exit 0"
    - "four-class governance ISA: classifySurfaceClass(src, fm, state) derives exactly one class per surface (excluded -> utility-excluded slot; frameworks/connector.framework -> framework; pipeline markers -> pipeline; intelligence markers -> intelligence; else mechanical); purely additive metadata, counts byte-stable"
    - "adversarial fixture-in-commands probe: the hard-fail test copies a dark fixture into commands/ under a temp name, spawns --check, asserts non-zero + names the surface, removes it in finally (zero tracked-file mutation)"
    - "atomic canon lockstep wave: R1 four-class sentence + two-wires/R9 prose + Appendix D entry 26 + version 1.14->1.15 + CANON-PHASE-MAP row + class enum + FLOOR test moved together so CI never went RED"

key-files:
  created:
    - .planning/phases/172-contextual-invocation-coverage/172-13-SUMMARY.md
    - tests/test-coverage-gate-hardfail.cjs
    - tests/test-cirs-four-class-floor.cjs
    - tests/fixtures/coverage-gate-dark/DARK-FIXTURE.md
    - tests/fixtures/coverage-gate-dark/EXCLUDED-FIXTURE.md
  modified:
    - scripts/build-connector-registry.cjs
    - scripts/build-orchestration-projection.cjs
    - scripts/hooks/pre-commit
    - scripts/install-pre-commit.sh
    - scripts/release.sh
    - scripts/doctor.cjs
    - docs/MINDRIAN-CANON.md
    - docs/CANON-PHASE-MAP.md
    - data/brain-orchestration-projection.json
    - data/orchestration-command-ledger.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json
    - tests/run-all-172.sh

key-decisions:
  - "Enumerated the LIVE projection gaps after regen (10 bare-command gaps) rather than hardcoding a stale list; all 10 were EXCLUDED in the connector layer, so the navigator-approved propagation reconciled every one to projection-excluded (gap 10 -> 0)"
  - "The projection-excluded set is the UNION of the projection-native EXCLUDED_COMMANDS table (doctor/setup/help) AND the connector-excluded command set (deprecated redirects, render/utility) -- the connector EXCLUDE decision is ADDITIVE, propagated, never duplicated into the projection table by hand"
  - "Flipped BOTH generators' gap from WARN to hard-FAIL ONLY after confirming both ledgers gap=0, so the executor's own post-flip commits pass the now-hard hook (CI never RED mid-sweep)"
  - "Wired the connector + projection --check into all four surfaces: pre-commit + install-pre-commit (both splice path + fresh-hook body) + release.sh (new direct Step 2.4) + doctor --acceptance (new coverage-gate point, pre-tag + full); release.sh already calls doctor --acceptance at Steps 2.5/6.6/9.8"
  - "Applied the navigator-confirmed VERBATIM four-class R1 sentence (hyphens, no em-dashes); the class enum is purely additive metadata -- the wired/excluded/gap counts stayed 88/36/0"
  - "Adversarial hard-fail proof copies a dark fixture into commands/ under a temp probe name and removes it in finally, proving the end-to-end exit-code contract without mutating any tracked file"

requirements-completed: [INV-10, INV-13, INV-14]

# Metrics
duration: ~35min
completed: 2026-06-23
---

# Phase 172 Plan 13: The Full Flip - Born-Wired Hard Gate + Four-Class Governance ISA Summary

**Flips BOTH CIRS coverage gates from WARN to hard-FAIL across all four enforcement surfaces (pre-commit + install-pre-commit + release.sh + doctor --acceptance), reconciles the orchestration projection so a command counterpart EXCLUDED at the connector layer PROPAGATES to EXCLUDED in the projection (10 bare-command gaps -> 0, both ledgers gap=0), and lands the navigator-confirmed Part 11 R1 four-class governance-ISA canon amendment (mechanical / framework / intelligence / pipeline) with a class-aware gate -- the structural cure for the recurring 143.x/144.1 dark-surface regression (R2/R9/INV-10/INV-14).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 4 of 4
- **Files modified:** 13 (8 scripts/docs/data modified, 5 created)

## Accomplishments

- **Task 1 (commit 7858e79f):** Flipped the gap WARN to hard-FAIL in BOTH generators + the projection-exclude reconciliation.
  - `build-connector-registry.cjs --check`: a `gap` surface (neither WIRED nor EXCLUDED) now exits non-zero, joining the CONN-03 + STALE hard fails.
  - `build-orchestration-projection.cjs --check`: `command_gaps` now a hard FAIL.
  - **Projection-exclude reconciliation:** `classifyCommandNode` reads the connector-coverage-ledger excluded command set (memoized `connectorExcludedCommands()`), so a command excluded at the connector layer is excluded in the projection command-ledger too. The 10 LIVE bare-command gaps after regen (`brain-derive`, `correct-reference-now`, `feynman-timeline-refresh`, `heal`, `onboard`, `organize`, `query`, `radar`, `vault`, `visualize`) were ALL connector-excluded, so they propagated to excluded. Projection went 15 -> 25 excluded, 10 -> 0 gap.
  - Regenerated projection (76 ranked / 25 excluded / 0 gap) + harness-manifest in lockstep.
- **Task 2 (commit 34160b84):** Wired both --check gates into all four enforcement surfaces.
  - `scripts/hooks/pre-commit`: broadened the connector guard's staged-path trigger to fire on `agents/*.md` + `connector-coverage-ledger.json`; broadened the projection guard to the ledger JSONs. Both now hard-FAIL on a dark surface.
  - `scripts/install-pre-commit.sh`: added connector --check + projection --check guards to both the splice path and the fresh-hook body; idempotency check updated to require both.
  - `scripts/release.sh`: new Step 2.4 runs both --check gates as a hard abort before any version mutation.
  - `scripts/doctor.cjs`: new `coverage-gate` acceptance point (pre-tag + full) runs both --check gates; release.sh already calls doctor --acceptance at Steps 2.5/6.6/9.8.
- **Task 3 (commit 75451e52):** Adversarial hard-fail proof.
  - `tests/test-coverage-gate-hardfail.cjs` (14 assertions): a synthesized dark surface classifies `gap` and makes --check exit non-zero (copied into commands/ under a temp name, spawned, removed in finally -- never mutates a tracked file); an excluded-with-reason surface classifies `excluded` with no error; the clean live repo stays exit 0; the FAIL message names the surface + recovery line.
  - Fixtures under `tests/fixtures/coverage-gate-dark/` (dark + excluded), never walked by the live generator.
- **Task 4 (commit 74b0b8c1):** Four-class governance-ISA - canon amendment + class-aware gate, ONE atomic lockstep wave.
  - **CANON:** Part 11 R1 gains the VERBATIM four-class sentence; the two-wires doctrine gains the capability-vs-permission clarification; R9 records doctor --drift as the scheduled reconciliation surface; Appendix D entry 26 + header/footer Version 1.14 -> 1.15. Externally grounded in the ArbiterOS governance-ISA paradigm.
  - **CODE:** `coverageReport()` surfaces carry a `class` enum (mechanical|framework|intelligence|pipeline|utility-excluded). Counts UNCHANGED (88/36/0). Distribution: 56 framework + 30 mechanical + 2 pipeline + 36 utility-excluded = 124.
  - **FLOOR TEST:** `tests/test-cirs-four-class-floor.cjs` (23 assertions) asserts the four classes + one-class-per-surface + the byte-stable counting contract; registered in `tests/run-all-172.sh`.
  - **CANON-PHASE-MAP:** v1.15 version-history row.

## Task Commits

1. **Task 1: Flip gap WARN -> hard-FAIL + propagate connector EXCLUDE into projection** - `7858e79f` (feat)
2. **Task 2: Wire both gates into pre-commit + install-pre-commit + release.sh + doctor --acceptance** - `34160b84` (feat)
3. **Task 3: Adversarial hard-fail proof** - `75451e52` (test)
4. **Task 4: Four-class governance-ISA + Part 11 R1 amendment (v1.14 -> v1.15)** - `74b0b8c1` (feat)

## The projection reconciliation (the navigator-approved "full flip")

| Metric | Before (172-16 regen, stale projection) | After (this plan) | Delta |
|--------|------------------------------------------|-------------------|-------|
| projection ranked | 76 | 76 | 0 |
| projection excluded | 15 | 25 | +10 |
| projection gap | 10 | 0 | -10 |
| connector wired | 88 | 88 | 0 |
| connector excluded | 36 | 36 | 0 |
| connector gap | 0 | 0 | 0 |

The 10 bare-command gaps in the projection were ALL EXCLUDED in the connector layer; propagating the connector EXCLUDE decision reconciled every one to projection-excluded. BOTH ledgers are now gap=0.

## Verification

| Check | Result |
|-------|--------|
| `build-connector-registry.cjs --check` on baseline | exit 0 (OK) |
| `build-orchestration-projection.cjs --check` on baseline | exit 0 (OK) |
| connector ledger counts | wired 88 / excluded 36 / gap 0 |
| projection command-ledger counts | ranked 76 / excluded 25 / gap 0 |
| dark surface trips connector gate (RED) | exit non-zero + names surface + recovery (test 1/4) |
| excluded fixture does NOT trip gate | classifies excluded, no error (test 2) |
| both gates wired in pre-commit + install-pre-commit | grep OK (connector + projection --check) |
| release.sh Step 2.4 + doctor coverage-gate point | present |
| Canon Part 11 R1 four-class sentence | present (verbatim) |
| coverageReport() class enum | present; counts unchanged 88/36/0 |
| canon version | 1.15 |
| em-dashes in changed canon bytes | none |
| `tests/test-coverage-gate-hardfail.cjs` | 14/14 PASS |
| `tests/test-cirs-four-class-floor.cjs` | 23/23 PASS |
| `bash tests/run-all-172.sh` | 18/18 PASS |

## Deviations from Plan

None of substance - plan executed as written. Two plan-anticipated lockstep regenerations fired and were staged in the same commits (the sanctioned pattern): the harness-manifest STALE tripwire after the projection regen (Task 1) and the connector-ledger regen carrying the new class field (Task 4). The TDD ordering for Task 3 was effectively inverted by plan structure: the hard-fail implementation is a structural prerequisite that shipped in Task 1 (the gate had to be hard before the executor's own post-flip commits could pass the hook), so Task 3 is the adversarial PROOF of an already-shipped behavior (committed as a single `test(...)` commit) rather than a separate RED-then-GREEN cycle.

## Issues Encountered

The orchestration projection was STALE relative to the 172-16 connector ledger at plan start (exit 1, 10 command gaps). Regenerating it (no fix, just `node scripts/build-orchestration-projection.cjs`) plus the propagation reconciliation cleared all 10 gaps. No genuine UNDECIDED gap remained, so the flip proceeded (per the plan's STOP-if-undecided-gap guard).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The born-wired hard gate is enforced at every merge across all four surfaces. A new dark surface now FAILs at pre-commit / release / doctor.
- Both ledgers gap=0; the gate is class-aware; canon at v1.15.
- No blockers. 170/171 conformance + the 172 release gate can now lean on the hard gate.

## Known Stubs

None. Every surface carries an explicit WIRE or EXCLUDE-with-reason decision (connector ledger) and exactly one class (the four-class amendment).

## Threat Flags

None. The change introduces no new network endpoint, auth path, or trust-boundary schema change. T-172-29 (a new dark surface lands) is now MITIGATED by the hard-fail gate at pre-commit + release + doctor (Task 3 proves it adversarially). T-172-30 (CI goes RED mid-sweep) MITIGATED: the flip landed only after both ledgers were reconciled to gap=0. T-172-SC (package installs) N/A: generator + hook + release + doctor edits only, zero package installs.

## Self-Check: PASSED

- FOUND: 172-13-SUMMARY.md
- FOUND commit 7858e79f (Task 1)
- FOUND commit 34160b84 (Task 2)
- FOUND commit 75451e52 (Task 3)
- FOUND commit 74b0b8c1 (Task 4)
- FOUND: tests/test-coverage-gate-hardfail.cjs, tests/test-cirs-four-class-floor.cjs
- Both ledgers gap=0 confirmed on disk; canon Version 1.15 confirmed

---
*Phase: 172-contextual-invocation-coverage*
*Completed: 2026-06-23*
