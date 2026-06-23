---
phase: 172-contextual-invocation-coverage
plan: 12
subsystem: connector-spine
tags: [cirs, canon-part-11, INV-11, INV-17, sens-09, methodology-ingest, born-wired, conformance, navigator-gated]

# Dependency graph
requires:
  - phase: 172-04
    provides: the connector-wiring pattern (the connector: frontmatter block + the regenerated-artifact lockstep) this plan reuses to wire analyze-timing/SENS-09 + ingest-methodology
  - phase: 172-06
    provides: the exhaustive WIRE/EXCLUDE classification that left exactly /mos:act (Plan 08) + /mos:ingest-methodology (this plan) as the only two gaps; the harness-manifest lockstep idiom
  - phase: 172-07
    provides: the trigger-tier seam (classifyTriggerTier / readProblemStateEnum / isContextTier in sensor-types.cjs) -- the context-first / keyword-fallback convention SENS-09 now keys on
  - phase: 170-dual-use-diffusion-ace
    provides: SENS-09 (sensor-diffusion-adoption.cjs) + the adoption-capacity dispatch-framework-map join + analyze-timing's frameworks: [S-Curve Analysis, Adoption-Capacity Theory]
  - phase: 171-methodology-ingest
    provides: lib/core/methodology-ingest.cjs ingestPlan (the 6-step pipeline whose step-5 this plan rewrites) + auditSpecPart8 (the step-2 boundary gate, untouched)
provides:
  - "Phase 170 CIRS conformance: SENS-09 gains a CONTEXT branch keyed on tuple.problem_type (R3/INV-07); keyword DEMOTED to fallback; still fires the FROZEN brain_consult reach (no 7th reach); analyze-timing sensor_triggers gains SENS-09"
  - "Phase 171 CIRS conformance: methodology-ingest step-5 is a THIN CALLER of the born-wired rules (bornWiredConnector + wouldPassCoverageGate) so every FUTURE methodology is born WIRED at ingest (R2)"
  - "/mos:ingest-methodology WIRED (the last gap) -> coverage gap reaches 0 (81 wired / 43 excluded / 0 gap)"
  - "tests/test-170-171-cirs-conformance.cjs (33 assertions) -- the first CIRS conformance proof on real shipped surfaces"
affects: [172-13 (RETRO-07 hard-FAIL flip reads this ledger and asserts gap===0), 170-release (navigator-gated on this green conformance), 171-release (navigator-gated on this green conformance)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "context-first / keyword-fallback firing precedence in a sensor: signal -> context (problem_type allow-list) -> keyword (demoted) -> marker, with the tier recorded as an evidence enum (trigger_tier)"
    - "ingest step-5 as a THIN CALLER: ingestPlan emits the born-wired connector block + a gate-pass assertion instead of a free-text hand-wiring checklist; the engine reuses the frozen REACH_IDS bank so it can never recommend a 7th reach"
    - "regenerated-artifact lockstep: connector-registry + coverage-ledger + harness-manifest move together with the source frontmatter change in the same commit"

key-files:
  created:
    - tests/test-170-171-cirs-conformance.cjs
  modified:
    - lib/core/sensors/sensor-diffusion-adoption.cjs
    - lib/core/methodology-ingest.cjs
    - commands/analyze-timing.md
    - commands/ingest-methodology.md
    - tests/test-diffusion-adoption-sensor.cjs
    - tests/run-all-172.sh
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "SENS-09 CONTEXT branch fires on a DIFFUSION-SPECIFIC problem_type allow-list (DIFFUSION_PROBLEM_TYPES), NOT on any populated problem-state -- so the keyword fallback stays genuinely reachable on a bare diffusion-lexicon turn that carries no diffusion problem-state. The broader Plan-07 classifyTriggerTier seam is used only to LABEL the trigger_tier evidence enum, making context-first/keyword-fallback a recorded, testable property."
  - "analyze-timing already carried a connector (SENS-06 -> context_block -> S-Curve Analysis, from Phase 144.1) and was already WIRED -- it was NOT dark as the plan author assumed. The plan's literal 'add a brain_consult connector block' would have collided with the existing block. RECONCILIATION (Rule 1/3): added SENS-09 to the existing block's sensor_triggers array (the ACE/brain_consult path lands on the same command via the dispatch-framework-map), documented the dual-reach home in a frontmatter comment. The verify (grep connector: + SENS-09 brain_consult in the sensor) is satisfied; no 7th reach minted."
  - "/mos:ingest-methodology WIRED (not EXCLUDED) per the plan's explicit 'wire the last gap' instruction: it is the maintainer surface for the born-wired pipeline itself, frozen brain_consult reach, sensor_triggers:[] (admin, not navigator-sensor-fired), framework:null (methodology-agnostic, additive-degrade). Either WIRE or EXCLUDE drives gap to 0; the plan chose WIRE."
  - "ingest engine default born-wired reach is brain_consult (the SENS-09 precedent); a spec naming a non-frozen reach is rejected back to brain_consult so step-5 can never recommend a 7th reach."

requirements-completed: [INV-11, INV-17]

# Metrics
duration: ~30min
completed: 2026-06-23
---

# Phase 172 Plan 12: Reconcile 170 + 171 Under CIRS (INV-11/17) Summary

**The FIRST CIRS conformance proof on real shipped surfaces: Phase 170's SENS-09 gains a CONTEXT branch keyed on the navigator problem-state (keyword demoted to fallback, frozen brain_consult reach preserved), Phase 171's methodology-ingest step-5 becomes a THIN CALLER of the born-wired rules (so every future methodology is born WIRED), and /mos:ingest-methodology -- the last gap -- is wired, driving the coverage gap to 0 (81 wired / 43 excluded / 0 gap).**

## Performance

- **Duration:** ~30 min
- **Started / Completed:** 2026-06-23
- **Tasks:** 3 of 3
- **Files:** 1 created + 8 modified (2 lib, 2 commands, 2 tests, 1 aggregator, 3 generated data artifacts)

## Accomplishments

- **Task 1 (commit b9525a0a) -- SENS-09 context branch + analyze-timing/SENS-09 wiring:**
  - Promoted SENS-09's `problem_type` read to the PRIMARY CONTEXT branch (R3/INV-07): a new `hasDiffusionContext(tuple)` fires the `context` mode when `tuple.problem_type` is in a generic `DIFFUSION_PROBLEM_TYPES` allow-list (read via the navigation.cjs chokepoint convention, enum/scalar only, Part 8/9). The diffusion KEYWORD lexicon match is DEMOTED to the fallback tier (fires only when no diffusion problem-state is present). Firing precedence: `signal -> context -> keyword -> marker`.
  - Evidence now records `mode` + `trigger_tier` (from the Plan-07 `classifyTriggerTier` seam) + `problem_type` -- enums only, never matched user text.
  - SENS-09 still fires the FROZEN `brain_consult` reach (no 7th reach minted).
  - `commands/analyze-timing.md` `sensor_triggers` gains `SENS-09` (the ACE/brain_consult dispatch path lands on the same command via the dispatch-framework-map; documented in a frontmatter comment). analyze-timing stays WIRED and in the gate.
  - Extended `tests/test-diffusion-adoption-sensor.cjs` with the 4 Task-1 behaviors (32 assertions total).
- **Task 2 (commit dc76f26a) -- methodology-ingest step-5 thin CIRS caller + wire /mos:ingest-methodology:**
  - Rewrote `ingestPlan` step-5 from a free-text trigger checklist into a THIN CALLER of the CIRS born-wired rules: `bornWiredConnector(spec)` emits the exact `connector:` block the methodology must carry (frozen reach, framework name, sensor trigger, frozen posture); `wouldPassCoverageGate(connector)` asserts it would PASS the gate at ingest (R2). The engine reuses the frozen `REACH_IDS` bank -- a non-frozen reach is rejected to `brain_consult`, so it can NEVER recommend a 7th reach.
  - The step-2 Part-8 boundary audit (`auditSpecPart8`) is behaviorally UNCHANGED (still fail-closed on emails / room ids / currency figures / possessive user references).
  - WIRED `/mos:ingest-methodology` (the last gap): connector block, frozen `brain_consult` reach, `sensor_triggers:[]` (admin maintainer surface), `framework:null` (methodology-agnostic, additive-degrade). Updated the command's step-5 prose to the born-wired thin-caller flow.
  - Wrote `tests/test-170-171-cirs-conformance.cjs` (33 assertions, Task 1 + Task 2) and registered it + the sensor test in `tests/run-all-172.sh`.
- **Task 3 (artifacts committed in the Task 1/2 lockstep) -- registry/ledger regen + navigator gate:**
  - Regenerated `data/connector-registry.json` (81 connectors) + `data/connector-coverage-ledger.json` (81 wired / 43 excluded / **0 gap**) via the generator (never hand-edited). `--check` exits 0. `/mos:analyze-timing` and `/mos:ingest-methodology` both show `state: wired`. The downstream `data/harness-manifest.json` was regenerated in lockstep (it digests the connector-registry).

## Final Coverage Split

| Metric | Before this plan | After this plan |
|--------|------------------|-----------------|
| wired | 80 | **81** |
| excluded | 43 | 43 |
| gap | 1 (`/mos:ingest-methodology`) | **0** |

The coverage gap is fully closed. The only prior residual gaps across the baseline were `/mos:act` (closed by Plan 08) and `/mos:ingest-methodology` (closed here).

## Verification

| Check | Result |
|-------|--------|
| `tests/test-diffusion-adoption-sensor.cjs` | PASS (32 assertions) |
| `tests/test-170-171-cirs-conformance.cjs` | PASS (33 assertions) |
| `node scripts/build-connector-registry.cjs --check` exit | 0 (`connector-registry: OK`, no gap warning) |
| `/mos:analyze-timing` ledger state | wired |
| `/mos:ingest-methodology` ledger state | wired |
| coverage counts | 81 wired / 43 excluded / 0 gap |
| `bash tests/run-all-172.sh` | 14/14 PASS |
| frozen reach-ids drift fence | PASS (exactly 6, no 7th) |
| frozen posture-ids drift fence | PASS (exactly 3) |
| connector tripwire fence | PASS (4 bad cases flagged + clean tree exits 0) |

## Navigator Gate (170/171 release-hold)

This plan is the navigator gate for the held 170/171 release. The 170/171 release-hold is cleared **CONDITIONAL on the navigator confirming the conformance test passes** -- it is green here (`tests/test-170-171-cirs-conformance.cjs` 33/33, `tests/run-all-172.sh` 14/14, gap 0). This plan makes 170/171 CONFORM; it does NOT itself release them. Release remains a separate navigator step (the SPEC/CONTEXT design INV-11/17 stays LOCKED; this plan applies it, does not re-open it).

## Frozen-Invariant Compliance (Canon Part 11 R1/R2/R3 + Part 8)

- No 7th reach minted: SENS-09 + the ingest engine + the two wired commands all reuse the FROZEN `brain_consult`. No 4th posture (`push_forward` only). The ingest engine rejects a non-frozen reach back to `brain_consult`.
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract: untouched (not in scope).
- No new edge type, no new node type, no new Brain wire opened. The connector blocks + the born-wired recommendation carry only generic machinery enums + published framework names + render labels (Part 8: structurally incapable of carrying user content).
- `auditSpecPart8` (the step-2 boundary gate) is behaviorally unchanged (test asserts it still fails closed on email / room-id / currency).
- SENS-09 evidence carries `mode` + `trigger_tier` + `problem_type` enums only -- never matched user text (T-172-26 mitigated).
- Generated JSON regenerated by the generator, never hand-edited (CONN-02 discipline).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Reconcile to actual state] analyze-timing was already WIRED, not dark**
- **Found during:** Task 1
- **Issue:** The plan action said "Add a connector block to commands/analyze-timing.md (...reach_id brain_consult...)", assuming analyze-timing was a dark surface. In fact it already carried a connector block (SENS-06 -> context_block -> S-Curve Analysis, from Phase 144.1) and was already WIRED. A command file carries exactly one connector block; adding a second `brain_consult` block would have been illegal.
- **Fix:** Added `SENS-09` to the existing block's `sensor_triggers` array (the ACE/brain_consult path lands on the SAME command via the already-shipped dispatch-framework-map: `adoption-capacity` -> "Adoption-Capacity Theory" -> commandsForFramework -> `/mos:analyze-timing`). Documented the dual-reach home in a frontmatter comment. The plan's automated verify (`grep -q "connector:"` + SENS-09 still firing brain_consult in the sensor) is satisfied; no 7th reach minted; analyze-timing stays wired and in the gate.
- **Files modified:** commands/analyze-timing.md
- **Commit:** b9525a0a

**2. [Rule 3 - Blocking] Regenerated the downstream harness manifest + registry/ledger in the per-task commits (lockstep)**
- **Found during:** Tasks 1 + 2 (the pre-commit `--check` + harness-manifest STALE tripwires would otherwise block each commit)
- **Issue:** Changing the analyze-timing + ingest-methodology connector frontmatter makes `data/connector-registry.json` (and the manifest that digests it) STALE; the pre-commit hooks fail closed on a stale generated artifact.
- **Fix:** Ran `node scripts/build-connector-registry.cjs` and `node scripts/build-harness-manifest.cjs` (the sanctioned regeneration commands) and staged the regenerated registry + ledger + manifest into the same per-task commits, keeping the generated-artifact set atomic. This is the established Plans 172-04/05/06 lockstep. Task 3's registry/ledger regen therefore landed inside the Task 1/2 commits rather than as a separate commit; Task 3's role here is the navigator-gate confirmation (`--check` 0, analyze-timing wired, gap 0).
- **Files modified:** data/connector-registry.json, data/connector-coverage-ledger.json, data/harness-manifest.json
- **Commits:** b9525a0a, dc76f26a

## Known Stubs

None. SENS-09's context branch and the ingest born-wired path are fully implemented and tested. Every baseline surface now carries an explicit WIRE or EXCLUDE decision; the coverage gap is 0.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. SENS-09 reads only LOCAL bytes (turn text, the diagnose tuple/ctx enums, a LOCAL side-channel) and egresses generic handles + enum evidence; the ingest engine is pure/zero-I/O and emits generic machinery metadata only. T-172-26 (SENS-09 evidence), T-172-27 (born-dark methodology), T-172-28 (ingest spec boundary audit) all mitigated as planned.

## Self-Check: PASSED
