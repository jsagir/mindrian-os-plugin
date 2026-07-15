---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
plan: 02
subsystem: eureka
tags: [reasoning-mode, eureka-portfolio-report, degrade, byte-parity, provenance, cjs, fallback]

# Dependency graph
requires:
  - phase: 226-01
    provides: "lib/core/eureka/reasoning-mode.cjs (readRoomMarkdown, proposeCandidatePairs, validateMappings, emitReasoningPrompts, scoreReasoningPairs, buildReasoningStatement, assertReasoningInvariants, REASONING_FORMULA_VERSION) + the tri-modal _forceUnavailable seam + the >= 12 pair fixture set"
  - phase: 215-04
    provides: "scripts/eureka-portfolio-report.cjs embedded async main + the { provenance, ranked, tail, statements } md+json writer this branch mirrors byte-for-byte"
  - phase: 219
    provides: "bankStatements governed write (hard-skipped on the reasoning path) + the provenance object shape reasoning mode reproduces"
provides:
  - "scripts/eureka-portfolio-report.cjs mode:reasoning branch: six additive parseArgv flags, top-of-main stage dispatch, reasoningStageSeed/Emit/Score, buildUpgradeDelta, renderReasoningReport, the encoder-unavailable degrade seam"
  - "D4/G-5 byte-parity: a reasoning run writes the SAME four-key shape with the exact embedded statements[] + provenance field names plus mode:'reasoning' and honest-null encoder legs"
  - "D7 honest-cause degrade render (encoder_unavailable vs below_floor, never the bare not-enough-entries symptom)"
  - "G-3 banking hard-skip (no bankStatements call site reachable from the reasoning score stage) + G-1 assertReasoningInvariants before BOTH writes"
  - "SEED req 5 reasoning -> embedded upgrade delta on the embedded success path"
  - "tests/test-226-field-contract.cjs + tests/test-226-degrade-cause.cjs (real-emitter hermetic legs)"
affects: [226-03, 226-04, eureka-command, report-html, mos-eureka]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Negated hard-gate degrade: the reasoning branch keys on the SAME idx.embedded / scored.length booleans the embedded path already computed (no second gate variable)"
    - "Byte-parity-by-mirror writer: the fallback assembles the identical four-key jsonOut with honest-null encoder legs rather than a second output shape"
    - "Refuse-to-emit at the writer: assertReasoningInvariants (node:assert) runs immediately before BOTH fs.writeFileSync calls, a deterministic online guardrail"
    - "Emit/score CLI split for a self-judging process (mirrors eureka-critic-run.cjs) with a max-1-retry manifest latch"

key-files:
  created:
    - tests/test-226-field-contract.cjs
    - tests/test-226-degrade-cause.cjs
    - .planning/phases/226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la/deferred-items.md
  modified:
    - scripts/eureka-portfolio-report.cjs

key-decisions:
  - "weak_dimensions byte-parity resolved to the LIVE embedded emitter shape { a:[], b:[] } (the object buildOpportunityStatement returns and the embedded jsonOut passes through), NOT the AI-SPEC zod array - byte-parity with shipped code is the D4 contract, the zod schema was aspirational"
  - "renderReasoningReport lives in the Task 1 commit (not Task 2 as the plan split it) because reasoningStageScore is a hard caller of it - a working score stage cannot write md without it"
  - "The --force-encoder-unavailable degrade tests run WITHOUT --offline: embedTexts' encodeFn injection seam wins over _forceUnavailable, so forcing encoder_unavailable requires the non-offline path (the seam still short-circuits before any model load, zero network)"
  - "buildUpgradeDelta is called only when idx.embedded === true so a degrade run never claims a spurious upgrade over its own prior reasoning file"

patterns-established:
  - "Reasoning provenance carries EVERY embedded provenance key with honest values (encoder_model 'none (reasoning mode)', ahp_weights null, tail_* honest defaults) plus the reasoning extensions, so no existing JSON consumer breaks"
  - "Mode label is render-visible on BOTH paths: a '- Mode: embedded' bullet on the embedded statements render and the caveat-first reasoning render"

requirements-completed: [REQ-1, REQ-3, REQ-4, REQ-6, REQ-8]

# Metrics
duration: ~45min
completed: 2026-07-15
---

# Phase 226 Plan 02: Reasoning-Mode Branch in eureka-portfolio-report Summary

**The mode:reasoning fallback wired into the shipped portfolio runner: a genuine embedded degrade (encoder_unavailable or below_floor) now seeds candidate pairs, the session answers a byte-identical two-pass rubric, and the runner writes the SAME { provenance, ranked, tail, statements } md+json pair labeled mode:reasoning with structurally-null encoder legs, a banking hard-skip, a refuse-to-emit assertion before every write, and an honest cause-named degrade message instead of the old pairs_scored:0 dead end.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 of 3
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- **Task 1 (stages + writer):** Added six additive parseArgv flags, a top-of-main stage dispatch, and the three-stage flow (`reasoningStageSeed` degrade seeding keyed on the SAME idx.embedded/scored.length booleans, `reasoningStageEmit` with the pairs.json SEED-req-2 guard, `reasoningStageScore` with verdict-by-code replay, a max-1-retry manifest latch, the byte-parity four-key jsonOut, the banking hard-skip, and `assertReasoningInvariants` before BOTH writes). Also `buildUpgradeDelta` (SEED req 5) and `renderReasoningReport` (caveat-first, no fabricated numeric column).
- **Task 2 (honest renders + labels):** Rewrote the `renderReport` degrade block to name the CAUSE (`encoder_unavailable` vs `below_floor`) and never emit the bare "not enough entries" symptom (the David proving case); added `mode:'embedded'` to every embedded `statements[]` JSON row plus a render-visible `- Mode: embedded` bullet; added a `## Reasoning to embedded upgrade` section in its own zone, never merged into the ranked table.
- **Task 3 (real-emitter tests):** `test-226-field-contract` drives the real emitter end to end in a hermetic temp room and asserts the four top-level keys, exact embedded statement + provenance field names (literal lists), honest-null legs, tail six-key empties, `run_mode 'reasoning'`, and caveat-before-provenance; `test-226-degrade-cause` proves all three cause legs including the REQ-8 no-speculative-trigger case.

## Task Commits

1. **Task 1: stage dispatch + degrade seed + score/write path** - `b246e20d` (feat)
2. **Task 2: honest-cause degrade, mode label both paths, upgrade render** - `05657d81` (feat)
3. **Task 3: hermetic D4 field-contract + D7 degrade-cause legs** - `a4b56db1` (test)

## Files Created/Modified

- `scripts/eureka-portfolio-report.cjs` - the mode:reasoning branch (stages, writer, renders, upgrade delta, provenance extensions) additive to the embedded async main
- `tests/test-226-field-contract.cjs` - D4/G-5 byte-parity against the real emitter (hermetic temp room)
- `tests/test-226-degrade-cause.cjs` - D7 honest-cause + REQ-8 no-speculative-trigger (3 legs)
- `.planning/phases/226-.../deferred-items.md` - logged pre-existing out-of-scope 216/219 failures

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-226-field-contract.cjs` (D4/G-5, REQ-3) | exit 0 (7 statements, 7 ranked; byte-parity + null legs) |
| `node tests/test-226-degrade-cause.cjs` (D7, REQ-6/REQ-8) | exit 0 (3 legs) |
| `node tests/test-226-null-legs.cjs` (D1 held through the wiring) | exit 0 |
| `node tests/test-226-rubric-parity.cjs` (D3 unchanged) | exit 0 |
| `bash tests/run-all-215.sh` (embedded regression oracle) | PASS=8 FAIL=0 (unchanged from baseline) |
| `bash tests/run-all-216.sh` | PASS=8 FAIL=2 (pre-existing, unchanged - see deferred-items) |
| `bash tests/run-all-219.sh` | PASS=11 FAIL=2 (pre-existing, unchanged - see deferred-items) |
| `grep -c assertReasoningInvariants` (>= 2, called before both writes) | 2 call sites (+1 comment) |
| bankStatements reachable from the reasoning score stage | none (hard-skip, one embedded-only call site) |
| em-dashes across the 3 touched files | 0 |

## Decisions Made

- **weak_dimensions shape (the plan-01 forward flag, resolved):** the LIVE embedded emitter passes `buildOpportunityStatement`'s `{ a:[], b:[] }` object straight through into `jsonOut.statements[].weak_dimensions`. Byte-parity with the shipped code is the D4/G-5 contract, so reasoning-mode carries the SAME object shape (which `buildReasoningStatement` already does). The AI-SPEC `ReasoningStatement` zod naming `weak_dimensions` an array was aspirational and does NOT match live code; reconciled to live code, not to the schema. The field-contract test asserts the object shape.
- **renderReasoningReport placement:** the plan split it into Task 2, but `reasoningStageScore` (Task 1) is a hard caller - a score stage cannot write its md report without it. Implemented in the Task 1 commit; Task 2 then only touched the embedded `renderReport` (degrade message, mode bullet, upgrade section). Documented as a minor task-ordering deviation, no scope change.
- **Force-unavailable requires the non-offline path:** see Deviations (Rule 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] --force-encoder-unavailable is inert under --offline**
- **Found during:** Task 3 (field-contract test)
- **Issue:** The first field-contract run passed `--offline --force-encoder-unavailable` and did NOT degrade (it scored 2 pairs). Root cause: in `lib/core/eureka/embedding-spine.cjs::embedTexts`, the `encodeFn` injection seam (offline stub) returns success BEFORE control reaches `getEncoder`, where the `_forceUnavailable` short-circuit lives. So the force seam only takes effect when `encodeFn` is absent (the non-offline path). This is the plan-01 seam's intended usage ("force idx.embedded !== true even on a model-cached box"), not a bug in the seam.
- **Fix:** Drive the `encoder_unavailable` degrade legs WITHOUT `--offline`. The seam still short-circuits before any model load (returns `encoder_unavailable` at the getEncoder entry), so zero network is reached; the offline preload additionally pins `allowRemoteModels=false`. Documented the reason inline in both tests.
- **Files modified:** tests/test-226-field-contract.cjs, tests/test-226-degrade-cause.cjs
- **Verification:** both tests exit 0; the degrade path now genuinely reports `encoder_unavailable`.
- **Committed in:** a4b56db1 (Task 3 commit)

**2. [Task-ordering] renderReasoningReport implemented in Task 1 rather than Task 2**
- **Found during:** Task 1 (score stage needs a render to write md)
- **Issue:** The plan assigned `renderReasoningReport` to Task 2, but `reasoningStageScore` (Task 1) calls it directly and cannot write a valid md report without it.
- **Fix:** Implemented the full caveat-first render in the Task 1 commit (satisfying all five caveat elements and the no-numeric-column rule); Task 2 then focused on the embedded `renderReport` changes only.
- **Files modified:** scripts/eureka-portfolio-report.cjs
- **Verification:** Task 2's plan verify command (`renderReasoningReport` caveat-before-provenance, encoder_unavailable named) passes.
- **Committed in:** b246e20d (Task 1 commit)

---

**Total deviations:** 2 (1 blocking auto-fix, 1 task-ordering). No scope change; the shipped behavior matches the plan's success criteria exactly.

## Issues Encountered

- Pre-existing, out-of-scope failures in `run-all-216.sh` (shape-declaration/skill-mirror advisory lints) and `run-all-219.sh` (218/219 entity-writer + banking legs) were RED at baseline before any 226-02 change. Logged to `deferred-items.md`, not fixed (SCOPE BOUNDARY). Their counts are unchanged after this plan, confirming no new regressions.

## Known Stubs

None. The reasoning ranked rows' `score:null`, `dims:null`, `weak_a:[]`, `weak_b:[]`, and every statement's `differential_score:null` / `semantic_similarity:null` are the intended, contract-required honest-null values (the encoder is structurally absent on this path), asserted by `assertReasoningInvariants` and the field-contract test - not unwired stubs.

## Next Phase Readiness

- Plan 226-03 (mode disclosure surfaces: report-html De Stijl export, eureka-command html/reasoning subcommands, commands/eureka.md faithful-judge protocol, D6 three-surface test) can build on the JSON contract this plan froze: `provenance.run_mode === 'reasoning'`, the caveat text, and the `mode` field on every statement.
- The banking hard-skip and G-1 assertion are the standing write-side guardrails 226-03/04 inherit.

## Self-Check: PASSED

- Files: scripts/eureka-portfolio-report.cjs, tests/test-226-field-contract.cjs, tests/test-226-degrade-cause.cjs all present on disk.
- Commits: b246e20d, 05657d81, a4b56db1 all present in git log.
