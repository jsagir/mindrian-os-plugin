---
phase: 150-memory-cortex-as-graph-members-local-and-brain-queryable-when-reaching
plan: 08
subsystem: tests / doctor / claim-harness
tags: [MEM-09, D-09, claim-harness, phase-gate, canon-part-6, canon-part-8, canon-part-9, canon-part-10]
requires:
  - "150-01: navigation writers (memory_artifact / governing_thought / navigator_persona / decision) + node-id helpers + writeCortexLineageEdge"
  - "150-02: lib/core/navigation/memory-cortex-packet.cjs (buildMemoryCortexPacket) -- the C4/C6 packet arm"
  - "150-03: lib/core/memory/reconcile-memory-runner.cjs (reconcileMemoryArtifacts) -- the fixture build chokepoint"
  - "150-04: getRoomContext legD cortexNodes"
  - "150-06: scripts/intent-classifier.cjs renderEngineDecisionWithDial (the C2 SEEN render arm)"
  - "150-07: readQuintuple (the FEYNMAN read contract under test)"
  - "Phase 148: the frozen 148 drift fences (run-all-148.sh) carried as a phase-gate group"
provides:
  - "tests/claim-harness/: the C1..C7 falsifiable public-site-claim acceptance gate (D-09)"
  - "tests/claim-harness/build-fixture-room-db.cjs: a REAL room.db built via navigation.cjs in a MINDRIAN_ROOMS_HOME tmpdir (no mocked Brain)"
  - "tests/claim-harness/run-all-claims.sh: the two-group claim aggregator (clone of run-all-146.sh)"
  - "doctor --claims: the claim-harness gate, a SIBLING of --acceptance with its own exit code + DOCTOR_CLAIM_FAIL_POINT self-test"
  - "tests/run-all-150.sh FINALIZED: the Phase 150 gate is ONE command (every 150 suite + run-all-claims.sh + carried 148 fences + Part-8 sweep)"
affects:
  - "the marketing/public site: each claim becomes true by instrumentation, not by promise (Canon Part 6 dog-fooding)"
  - "release/CI: doctor --claims is a self-contained acceptance gate runnable alongside doctor --acceptance"
tech-stack:
  added: []
  patterns:
    - "two-group acceptance aggregator (clone of run-all-146.sh): CJS drivers group + gates group; run-to-completion-on-failure; exit 1 on any failure"
    - "real-room fixture discipline (copy committed fixture to a MINDRIAN_ROOMS_HOME tmpdir; build room.db through navigation.cjs; never hand-stitched SQLite)"
    - "honest-negative arm per driver (the claim can FAIL on a broken bridge); semantic claims carved to the Part-10 human gate (named SKIP, never a fake PASS)"
    - "doctor sibling-gate-with-own-exit-code (mirrors --acceptance / --dogfood-acceptance; DOCTOR_CLAIM_FAIL_POINT self-test mirrors DOCTOR_TEST_FAIL_POINT)"
key-files:
  created:
    - "tests/claim-harness/fixtures/claim-room/ (ROOM/STATE/USER at root + problem-definition + market-analysis sections, each with the 6 memory MD kinds; the contradicting pair + poison-nodes)"
    - "tests/claim-harness/build-fixture-room-db.cjs"
    - "tests/claim-harness/run-all-claims.sh"
    - "tests/claim-harness/claim-c1.cjs"
    - "tests/claim-harness/claim-c2.cjs"
    - "tests/claim-harness/claim-c3.cjs"
    - "tests/claim-harness/claim-c4.cjs"
    - "tests/claim-harness/claim-c5.cjs"
    - "tests/claim-harness/claim-c6.cjs"
    - "tests/claim-harness/claim-c7.cjs"
  modified:
    - "scripts/doctor.cjs (the --claims gate + runClaims + DOCTOR_CLAIM_FAIL_POINT self-test + flag parse + help)"
    - "tests/run-all-150.sh (FINALIZED from the 150-01 skeleton)"
decisions:
  - "the fixture room.db is built THROUGH lib/core/memory/reconcile-memory-runner.cjs (which routes every node + lineage-edge write through navigation.cjs), never hand-stitched SQLite -- so a driver reads a real cortex (T-150-08-01 mitigated)"
  - "each driver carries an honest-negative arm; the 3 initial RED failures surfaced REAL facts (the reconcile DECISION_ID_RE strips the DEC- prefix to PD-100 / MA-200; routing_source flips at the router not inside decide()) which were fixed in the drivers, proving the assertions are real not fixture-shaped"
  - "the semantic claims C2-good (is the move good) and C4-relevance (is the pattern relevant) are CARVED OUT to the Part-10 human empathy gate -- the driver prints a named SKIP line, never a fake machine PASS (T-150-08-03 mitigated)"
  - "the Brain LIVE arms (C4-live, C6-live) gate on lib/core/doctor/class-m-brain-smoke.cjs and self-skip honestly when Brain is unreachable; the hermetic + source arms carry the gate CI-green without a live Brain (T-150-08-05 mitigated)"
  - "C6 plants poison strings by hand into every node field a writer would normally keep clean (adversarial seed), so even a future writer regression cannot leak through the packet; the packet still emits only generic sha256 + enum handles (T-150-08-02 mitigated)"
  - "doctor --claims is a SIBLING of --acceptance (own exit-code contract), NOT folded into the class roster, so the class-flag-always-exit-0 invariant does not apply"
  - "run-all-150.sh dropped the never-created 150-01 skeleton placeholders (test-150-trigger / -navigation-only-invariant / -claim-harness) in favor of the real landed suites + the claim-harness SHELL group; the trigger logic shipped folded into the 150-03 reconcile, and the navigation-only + claim-harness coverage is provided by the harness drivers"
  - "scripts/intent-classifier.cjs was NOT modified by this plan -- the overlap warning (150-04/06 threaded ctx fields + deriveLowFillSections + dial-presenter wiring) was respected; this plan only READS the classifier render helper via require"
metrics:
  duration: "~50m"
  completed: "2026-06-09"
  tasks: 3
  files-created: 16
  files-modified: 2
---

# Phase 150 Plan 08: Claim Harness + Phase Gate Summary

The claim harness (MEM-09 / D-09) and the finalized Phase 150 phase gate: seven
falsifiable public-site-claim drivers (C1..C7) each driving a REAL shipped unit
against a REAL `room.db` built through `lib/core/navigation.cjs` (no mocked
Brain), each with an honest-negative arm; the two semantic claims carved to the
Part-10 human empathy gate; `doctor --claims` as a self-contained sibling of
`--acceptance`; and `tests/run-all-150.sh` finalized so the whole phase gate is
one command. As the final plan, the FULL aggregator is now green.

## What shipped

- **`tests/claim-harness/fixtures/claim-room/`** -- one obviously-fictional
  claim-room (Zorblax Quantum Tea): a `ROOM.md` identity (ICM Layer 0) + `STATE.md`
  + `USER.md` at the root and two section folders (`problem-definition`,
  `market-analysis`) each carrying the six memory MD kinds. It includes the
  CONTRADICTING PAIR (`DEC-PD-100` ship the scheduler vs `DEC-MA-200` never ship
  it) for C3/C7 and POISON-NODES (`BRAIN.md` + `FEYNMAN.md` carrying
  `SECRET CLAIM PROSE` / `leak@example.com` / `/home/jsagi/secret/...` / `${INJECT}`)
  for the C6 egress arm.
- **`tests/claim-harness/build-fixture-room-db.cjs`** -- copies the committed
  fixture to a `MINDRIAN_ROOMS_HOME` tmpdir and builds a REAL `room.db` by
  projecting the memory files THROUGH `reconcileMemoryArtifacts` (which writes only
  via `navigation.cjs`), never hand-stitched SQLite. Exports
  `buildFixtureRoomDb() -> {roomDir, dbPath, db, report, cleanup}`. `node:sqlite`
  unavailable raises a tagged `ESQLITE_UNAVAILABLE` so drivers SKIP (exit 77). The
  fixture build reports 11 upserted nodes / 4 decision nodes / 7 lineage edges.
- **`tests/claim-harness/claim-c1..c7.cjs`** -- the seven drivers:
  C1 focus-node graph identity persists across a `room.db` re-open; C2 `decide()`
  returns a grounded one-move + `dial-presenter.renderDial` reaches the live
  surface (the D-08 SEEN arm) + C2-good carved; C3 minting `CONTRADICTS` between
  the pair lands a queryable edge + writeEdge rejects a non-taxonomy type; C4 the
  cortex packet carries generic advisory handles, Part-8-clean, degrades offline +
  C4-relevance carved + C4-live self-skips; C5 K artifacts -> >= K typed nodes,
  decisions mint at `proposed` (Part-9 completeness); C6 poison-seeded nodes ->
  zero forbidden prose in the packet (hermetic + source + fixture arms) + C6-live
  self-skips; C7 file A then conflicting B -> `INFORMS` lineage + `CONTRADICTS`
  minted mid-session.
- **`tests/claim-harness/run-all-claims.sh`** -- the two-group aggregator (clone
  of `run-all-146.sh`): group (a) the C1..C7 drivers; group (b) the gates
  (`class-m-brain-smoke` as the live-Brain precondition + the Part-8 cortex-packet
  egress sweep). Runs each to completion on failure; per-suite PASS/FAIL/SKIP;
  final tally; exit 1 on any failure.
- **`scripts/doctor.cjs` `--claims`** -- the claim-harness gate, a SIBLING of
  `--acceptance`: `runClaims(opts)` shells `run-all-claims.sh` and returns its OWN
  self-contained exit code (0 = every claim true by instrumentation; 1 = a claim
  failed). The `DOCTOR_CLAIM_FAIL_POINT` env hook (mirroring
  `DOCTOR_TEST_FAIL_POINT`) synthesizes the gate's failure path for its own
  self-test. Flag parse + default + help text mirror the `--acceptance` precedent.
- **`tests/run-all-150.sh` FINALIZED** -- every real 150 CJS suite +
  `claim-harness/run-all-claims.sh` as a SHELL group + the carried 148
  frozen-contracts/reach-ids drift fences (`run-all-148.sh`) + a standalone Part-8
  grep sweep over the five new 150 artifacts. The phase gate is one command.

## Phase gate result (the required tally)

`bash tests/run-all-150.sh` -> **Total: 14, Passed: 14, Failed: 0, Missing: 0**
(exit 0). The constituent claim harness reports **9/9** (7 drivers + 2 gates) and
the carried `run-all-148.sh` reports **18/18** with `test-148-frozen-contracts`
+ `test-reach-ids-drift` + `test-posture-ids-drift` all PASS -- confirming
`MAX_K=3` and `DIAL_REACH_K=6` are byte-unchanged (the frozen 148 constitution
held through Phase 150).

## Frozen-contract + Canon gates

- **Frozen contracts NOT changed:** `MAX_K=3`, the 0.70/0.15 recommend gate, and
  `DIAL_REACH_K=6` (no 7th reach) are byte-unchanged; the carried `run-all-148.sh`
  drift fences assert this and are green.
- **Canon Part 8 (zero egress):** the C6 driver + the run-all-claims Part-8 gate +
  the run-all-150 Part-8 sweep all confirm zero forbidden user-content-to-Brain
  tokens across the cortex packet path and the new 150 artifacts; the packet emits
  only generic sha256 + enum handles.
- **Canon Part 9 (proposed-minting):** C5 asserts decision truth-claim nodes mint
  at `review_status='proposed'` (never auto-confirmed) and every node carries a
  closed-set review_status.
- **Canon Part 6 (dog-fooding):** each public-site claim is now a falsifiable test
  that is true by instrumentation; the harness IS the acceptance gate.
- **No em-dashes / en-dashes** anywhere in the harness, the fixture, the doctor
  edit, or run-all-150.sh (verified by `grep -P` sweeps).
- **intent-classifier.cjs overlap respected:** this plan did NOT modify
  `scripts/intent-classifier.cjs`; it only reads its exported render helper via
  `require`. The 150-04/06 threaded ctx fields, `deriveLowFillSections`, and the
  dial-presenter wiring are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract mismatch] Decision node-id prefix + routing_source location**
- **Found during:** Task 2 (the RED run of the C2/C3/C7 drivers via their honest-negative arms)
- **Issue:** C3/C7 asserted `decision:DEC-PD-100` but the reconcile `DECISION_ID_RE`
  strips the `DEC-` prefix, so the projected ids are `decision:PD-100` /
  `decision:MA-200`; C2-grounded asserted `decide().routing_source` but
  `routing_source` is flipped at the router (intent-classifier), not on the
  `decide()` return object (it carries `decision_trace.brain_md_tier_mode`).
- **Fix:** repointed C3/C7 to the canonical `PD-100` / `MA-200` ids; re-expressed
  C2-grounded to assert the grounded one-move shape (`decision_trace` + tier mode +
  `fire_skill` slot + `suppress_skills` array) and let the C2-seen render arm prove
  the legacy->engine flip reaches the surface.
- **Files modified:** tests/claim-harness/claim-c2.cjs, claim-c3.cjs, claim-c7.cjs
- **Commit:** 0e677232 (the fixes landed in the same Task 2 commit as the drivers)

**2. [Rule 3 - Stale skeleton placeholders] run-all-150.sh suite names**
- **Found during:** Task 3 (finalizing run-all-150.sh)
- **Issue:** the 150-01 skeleton listed three suites that were never created under
  those names (`test-150-trigger.cjs` -- the trigger shipped folded into the 150-03
  reconcile; `test-150-navigation-only-invariant.cjs` + `test-150-claim-harness.cjs`
  -- this plan provides that coverage via the claim-harness drivers, not standalone
  CJS suites).
- **Fix:** registered the real landed suites + the `claim-harness/run-all-claims.sh`
  SHELL group instead, so the gate is green (0 missing) rather than carrying 3
  permanent MISSING lines.
- **Files modified:** tests/run-all-150.sh
- **Commit:** 2dd48b42

## Self-Check: PASSED

- Files: build-fixture-room-db.cjs, run-all-claims.sh, claim-c1..c7.cjs, the
  fixture tree, the run-all-150.sh + doctor.cjs edits all FOUND on disk.
- Commits: 1413c78f, 0e677232, 2dd48b42 all FOUND in git history.
- `bash tests/run-all-150.sh` exits 0 with 14/14 passed, 0 failed, 0 missing.
