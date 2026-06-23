# Phase 172 Structured VERDICT - Contextual Invocation Coverage (CIRS R1-R14 + INV-01..23)

Status: PASS (navigator-gated phase-close verdict)
Date: 2026-06-23
Plan: 172-14 (INV-15, the adversarial-verify-with-structured-verdict property)
Canon: docs/MINDRIAN-CANON.md Part 11 (The Invocation Constitution), v1.15

This is the structured pass/fail VERDICT over the whole coverage contract: every
CIRS ruling (R1-R14) and every phase requirement (INV-01..23), each with a
PASS / FAIL / DEFERRED-ENFORCEMENT status. It is the navigator decision point for
closing Phase 172. The adversarial red-team (tests/test-cirs-adversarial-verify.cjs)
proves BY CONSTRUCTION that the born-wired hard gate catches the two failure modes
that caused the recurring 143.x / 144.1 regressions: a dark surface, and a second
ungoverned selection brain.

---

## Headline coverage counts (the final state)

| Ledger | wired / ranked | excluded | gap |
|--------|----------------|----------|-----|
| connector-coverage-ledger.json | 88 wired | 36 excluded | 0 gap |
| orchestration-command-ledger.json | 76 ranked | 25 excluded | 0 gap |

Both ledgers are gap=0. The born-wired coverage gate is HARD-FAIL across all four
enforcement surfaces (pre-commit + install-pre-commit + release.sh + doctor
--acceptance); a surface neither WIRED nor EXCLUDED exits non-zero at every merge.

---

## The adversarial-verify result (INV-15)

tests/test-cirs-adversarial-verify.cjs: PASS - 19 / 19 assertions, exit 0.

| Group | Assertions | Result |
|-------|-----------|--------|
| Attack 1: dark surface (ADV-01a..e) | dark fixture classifies gap; trips BOTH hard gates non-zero; connector FAIL names the surface; zero tracked-file mutation | PASS |
| Attack 2: second selection brain (ADV-02a..c) | act-command feeds the REAL decide() (loadRealDecide); NO ungoverned ()=>null decideFn; act.md connector-wired | PASS |
| Positive: rs-* fires context_block (ADV-03) | every rs-* connector declares reach_id context_block + sensor_triggers | PASS |
| Positive: hats engine-mapped (ADV-04) | navigation-engine reachIdToSkillFamily has the hats case | PASS |
| Positive: gap=0 BOTH ledgers (ADV-05a..c) | connector gap=0, zero excluded-without-reason errors, projection command gap=0 | PASS |
| Frozen invariants (ADV-06a..d) | REACH_IDS=6, POSTURE_IDS=3, DIAL_REACH_K=6, MAX_K=3 | PASS |
| No false-positive (ADV-07a..b) | clean live repo passes BOTH hard gates exit 0 | PASS |

The red-team emits a structured `{ pass, assertions[] }` verdict and exits
non-zero if any assertion fails.

---

## The phase aggregator

tests/run-all-172.sh: PASS - 20 / 20 green.

It composes BOTH CI tripwires as direct invocations (connector --check +
orchestration-projection --check, both hard gap gates) plus 18 CJS suites,
including the 172-15 chain-transform composition test, the 172-13 four-class
floor test, the 172-13 hard-fail adversarial test, this plan's adversarial
verify, and the carried frozen-bank drift fences (exactly-6 reaches, exactly-3
postures).

---

## CIRS ruling verdict (R1-R14)

| Rule | Ruling | Status | Evidence / reason |
|------|--------|--------|-------------------|
| R1 | Two states (WIRED or EXCLUDED); four governed classes | PASS | coverage ledger wired-XOR-excluded; classifySurfaceClass emits mechanical/framework/intelligence/pipeline (172-13, canon v1.15 R1 four-class amendment) |
| R2 | Born-wired (new/modified surface fails CLOSED) | PASS | hard-FAIL flip 172-13; tests/test-cirs-adversarial-verify ADV-01b/d proves a dark surface trips BOTH gates |
| R3 | Context-triggered (sensors on problem-state) | PASS | rs-* + SENS-09 fire on sensor_triggers keyed to LOCAL state (172-07, 170); ADV-03 |
| R4 | One governed path (no second selection brain) | PASS | /mos:act feeds the REAL decide() as decideFn; the ()=>null second brain is gone (172-08); ADV-02a/b |
| R5 | Remote counterpart (projection node per surface) | PASS | mindrian-operation counterparts in the orchestration projection (172-03); command ledger gap=0 |
| R6 | Earned chains (curated FEEDS_INTO confidence) | DEFERRED-ENFORCEMENT | Curated confidence ships on the LOCAL projection FEEDS_INTO (172-08/10/15) and ranking defers to Part 3 MAX_K; hard-FAIL on absent/uniform confidence is gated on a learned-weight substrate (SEED-009) not yet present, so the direction is law and the enforcement stays warn/aspirational. |
| R7 | Local-only at decide/rank (derived read-model) | PASS | projection is a Brain-derived LOCAL cache; zero live Brain read/write on the hot path (Part 8 / 157) |
| R8 | Promotion path (dark -> mindrian-operation -> pws) | PASS | navigator-gated metadata reclassification within the sanctioned projection (172-03/06/16) |
| R9 | Enforced, not aspirational (gate in pre-commit + release + doctor + ingest) | PASS | hard-FAIL wired into all four surfaces (172-13); doctor --drift records the scheduled reconciliation timeframe |
| R10 | Lockstep on change (re-run gate, keep projection in sync) | PASS | the regenerated-artifact lockstep (registry + ledger + projection + harness-manifest move together) across every 172 plan |
| R11 | Fractal coverage rollup (NESTED_WITHIN, scale-invariant) | DEFERRED-ENFORCEMENT | the depth-bounded aggregate-SCALAR-only rollup operator ships (172-11, over NESTED_WITHIN from 169) and is tested, but hard-FAIL enforcement of cross-room coverage health is gated on the scale-invariant operator being exercised at production depth across real nested rooms; until then it holds as warn/aspirational, so no unproven cross-room number is frozen as hard law. |
| R12 | Forward-declaration & explainability (cirs_relationship block) | PASS | the slug-keyed CIRS column + the cirs_relationship contract (172-02); every spine-touching plan declares it |
| R13 | Retirement (RETIRED ledger state + dangling-FEEDS_INTO gate-FAIL) | DEFERRED-ENFORCEMENT | the direction is law (a removed surface must transition to RETIRED with mandatory inbound-chain re-point-or-drop, and a live FEEDS_INTO to a retired target must gate-FAIL), but 172 SHIPS NO surface retirement - there is no owning implementation plan in this phase - so the RETIRED state machine and the dangling-target gate-FAIL are declared-now / enforce-later, mirroring the R6/R11 precedent the SPEC establishes. |
| R14 | Trigger-overlap detection (WARN minimum; arbitration defers to MAX_K) | DEFERRED-ENFORCEMENT | the direction is law (two wired surfaces firing on the same problem-state are a coverage-quality defect the gate should WARN on, with arbitration deferring to the Part 3 MAX_K ranker), but the overlap detector is substrate-gated (it needs the per-sensor problem-state fingerprint compare that no 172 plan owns), so it is declared-now / enforce-later alongside R6/R11/R13. autonomous_safe (the R14 connector-block field) IS gate-governed and PASS (172-08 act). |

DEFERRED-ENFORCEMENT count: 4 (R6, R11, R13, R14). Each is DECLARED-but-DEFERRED:
the ruling is binding canon law now; hard-FAIL enforcement is gated on substrate
that does not yet exist (learned chain weights; production-depth fractal rollup;
a surface-retirement plan; the trigger-overlap fingerprint comparator). This is
the disciplined-minimal posture ratified at canon v1.14: no unproven number or
unbuilt state machine is frozen as hard law before its substrate ships.

---

## Requirement verdict (INV-01..23)

| Req | Description | Status | Owning plan |
|-----|-------------|--------|-------------|
| INV-01 | Classify EVERY surface WIRE / EXCLUDE | PASS | 172-01, 172-06, 172-16 |
| INV-02 | Wire every thinking-surface gap | PASS | 172-04, 172-05, 172-16 |
| INV-03 | Explicit utility-exclude decision | PASS | 172-01, 172-06, 172-16 |
| INV-04 | Projection represents ALL surfaces | PASS | 172-03 |
| INV-05 | mindrian-operation counterpart for non-framework commands | PASS | 172-03 |
| INV-06 | Promotion path dark -> counterpart -> frontier framework | PASS | 172-03 |
| INV-07 | Context-driven trigger (not keyword-only) | PASS | 172-07 |
| INV-08 | Chains produce useful next-steps (curated, cross-class) | PASS | 172-08, 172-10, 172-15 |
| INV-09 | Coverage + chain health monitored at projection | PASS | 172-11 |
| INV-10 | RETRO-07 coverage gate hard-FAIL | PASS | 172-01, 172-13 |
| INV-11 | Reconcile 170 under CIRS | PASS | 172-12 |
| INV-12 | Local-Only against the projection (no live Brain) | PASS | ambient (Part 8 / 157); ADV-07 + Part-8 grep |
| INV-13 | CIRS is a closed ruling set (canon amendment to change) | PASS | 172-02, 172-13 |
| INV-14 | Born-wired lifecycle gate | PASS | 172-13 |
| INV-15 | Harness-as-code adversarial verify + structured verdict | PASS | 172-14 (this plan) |
| INV-16 | Fractal coverage rollup over NESTED_WITHIN | PASS (operator shipped; R11 enforcement deferred) | 172-11 |
| INV-17 | 170 + 171 conform to CIRS before release | PASS | 172-12 |
| INV-18 | /mos:act collapses to ONE governed selection brain | PASS | 172-08 |
| INV-19 | /mos:act always-on standing suggestion | PASS | 172-09 |
| INV-20 | /mos:act renders through Shape F.1 host | PASS | 172-08 |
| INV-21 | /mos:act internal intent-calibration phase | PASS | 172-08 |
| INV-22 | Forward-compatibility / explainability (R12 cirs_relationship) | PASS | 172-02 |
| INV-23 | Systems-thinking (Meadows) design lens wired | PASS | 172-07 |

All 23 requirements PASS. INV-16's rollup OPERATOR is shipped and tested; the
corresponding CIRS rule R11 stays DEFERRED-ENFORCEMENT (hard-FAIL of cross-room
coverage health gated on production-depth exercise).

---

## Frozen-invariant compliance

| Invariant | Frozen value | Status |
|-----------|--------------|--------|
| REACH_IDS | 6 (context_block, contradiction, cross_room, brain_consult, deep_research, hats) | PASS |
| POSTURE_IDS | 3 (push_forward, hold, pull_back) | PASS |
| DIAL_REACH_K | 6 | PASS |
| MAX_K | 3 | PASS |

No 7th reach, no 4th posture, no new edge type, no new node type, no new Brain
wire was minted by Phase 172. The 0.70/0.15 RECOMMENDED gate and the F.1 keyboard
contract are untouched.

---

## Residual risk for the navigator

- R6 / R11 / R13 / R14 are DECLARED-but-DEFERRED-ENFORCEMENT. The rulings are
  binding law; their hard-FAIL gates ship in later phases when their substrate
  exists (learned chain weights; production-depth fractal rollup; a surface-
  retirement plan; the trigger-overlap fingerprint comparator). A surface
  retirement or a trigger-overlap that lands before its gate will pass silently;
  the doctor --drift scheduled reconciliation is the interim catch.
- The projection is a LOCAL Brain-derived cache; continuous remote Brain sync
  stays deferred to Phase 137. No live Brain read/write rides the hot path.

## VERDICT

PASS. The adversarial red-team catches both regression failure modes, every 172
test is green via run-all-172.sh (20/20), both ledgers are gap=0, the four frozen
invariants are intact, and a structured pass/fail verdict over the whole coverage
contract is recorded. R6 + R11 + R13 + R14 are recorded as DEFERRED-ENFORCEMENT,
each with its one-line reason. INV-15's adversarial-verify-with-structured-verdict
property is met. Phase 172 (Contextual Invocation Coverage) is ready to close.
