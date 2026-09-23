---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 04
subsystem: testing
tags: [floors, ledger, disclosure, sweep, negative-control, hips-02]

requires:
  - phase: 355-01
    provides: "tests/helpers/hygiene-355.cjs, tests/run-all-355.sh skeleton, 355-BASELINE.md"
provides:
  - "data/floor-ledger.json: 35 disclosed rows (D-19) covering every D-21 floor/band/weight/rubric literal in the reverse-salient, HSI, whitespace and eureka engine families, plus the two HIPS-02 research additions and 13 supplementary literals the pattern-pass sweep found"
  - "scripts/check-floor-ledger.cjs: validateLedger (D-20 shape, calibration gate, stale-anchor detection), resolveHits (the pattern-pass sweep, comment-stripped, JS + Python), stripComments, --check offline CLI"
  - "lib/core/floor-disclosure.cjs: PRODUCER_IDS (frozen five-producer set), loadLedger (lazy cached, degrades to {rows:[]}), disclosureFor(producerId), disclosureLine(producerId)"
  - "tests/test-355-floor-sweep.cjs: 106 assertions, EXPECTED_IDS coverage, FAKE_FLOOR negative control, dependent-outputs disclosure proof"
  - "docs/ENV-TUNING.md: \"## Phase 355 disclosed floors\" section (EUREKA_DIFF_FLOOR, Stage A gate env names, analogy-fitness env names)"
affects: [355-23]

tech-stack:
  added: []
  patterns:
    - "Floor disclosure: a producer never renders a bare threshold value; it calls disclosureLine(producerId) from lib/core/floor-disclosure.cjs, which names data/floor-ledger.json instead"
    - "Comment-stripped hit-pattern sweep with file+anchor resolution: const-decimal declarations, envFloat(/envInt(/resolveFloat( calls, and numeric comparisons against a decimal or 1.0-style literal, each hit resolved by (file, anchor) match against a ledger row, unresolved hits fail loudly"

key-files:
  created:
    - data/floor-ledger.json
    - scripts/check-floor-ledger.cjs
    - lib/core/floor-disclosure.cjs
    - tests/test-355-floor-sweep.cjs
  modified:
    - docs/ENV-TUNING.md

key-decisions:
  - "Extended the ledger beyond the 22 EXPECTED_IDS to 35 rows: the pattern-pass sweep over the full engine families (lib/core/rs-*.cjs, lib/core/hsi-*.cjs, lib/core/eureka/*.cjs, lib/core/eureka-critic.cjs, scripts/*whitespace*.cjs, scripts/hsi-*.cjs, scripts/compute-whitespace-gaps.py) surfaced 13 literals D-21's named inventory did not enumerate (ahp-weights.CR_MAX, compression-meter.MIN_LURED_MAGNITUDE, embedding-classifier.DEFAULT_MARGIN, opportunity-harvest.bands, opportunity-statement.tiers, portfolio-dimensions.bands, qualify-opportunity.threshold, reasoning-mode.max-pairs, hsi-spectral.absorbing-baseline, rs-domain-analyzer.BOUNDARY_THRESHOLD_DEFAULT, rs-math.definitional, rs-mind-map.sql-filters, rs-preprocessor.BOUNDARY_THRESHOLD); the plan's own action text requires zero unresolved hits, so each got a disclosed row with dependent_outputs:[] (internal/auxiliary literals no shown producer output depends on, per the D-20 shape's own escape hatch)"
  - "disclosureLine(producerId) returns one fixed string for every producer (not producer-customized), per the plan's action text specifying the exact literal string; disclosureFor(producerId) is where per-producer variation lives (the unverified sentence list, filtered by dependent_outputs)"
  - "dependent_outputs assignment for the 22 primary rows followed the file-family mapping implied by the D-21 grouping: rs-engine/rs-differential-scorer/rs-innovation-classifier -> find-connections (the reverse-salient spine), rs-breakthrough-scorer/eureka-critic/tail-quadrant/analogy-fitness -> eureka, hsi-engine/hsi-to-graph -> hsi, compute-whitespace-gaps/whitespace-command/interpret-whitespace -> whitespace; EUREKA_DIFF_FLOOR (an eureka-specific env resolver defined inside rs-differential-scorer.cjs) was assigned to eureka rather than find-connections since its own name and env var say what it is for"
  - "whitespace-command.novelty-bands uses one re: anchor covering both the >=0.8/>=0.4/<0.4 numeric comparisons AND the 'Novel (>0.8)' / 'Covered (<0.4)' render label text, per the plan's explicit anchor-durability instruction (355-16 is named as later removing that label text; this keeps the row from staling when that happens)"

patterns-established:
  - "Pattern: a ledger row's line_anchor is either a bare const/function name (matched as \\bNAME\\b) or an re: prefixed regex; resolveHits and validateLedger share one matchesAnchor helper so a hit-resolution check and a stale-anchor check never diverge in behavior"
  - "Pattern: stripComments returns an array the SAME LENGTH as the input lines (blank where a comment was), so every reported hit carries the real 1-indexed file line number, never an offset into a stripped buffer"

requirements-completed: [HIPS-02]

duration: 95min
completed: 2026-09-23
---

# Phase 355 Plan 04: Floor Ledger, Sweep and Disclosure Summary

**Ships data/floor-ledger.json (35 disclosed rows), scripts/check-floor-ledger.cjs's validateLedger + resolveHits sweep (73 files scanned, 60 hits, 0 unresolved), and lib/core/floor-disclosure.cjs so a threshold literal like `0.3` or `0.15` never rides an eureka/find-connections/find-bottlenecks/hsi/whitespace output as if it had been measured.**

## Performance

- **Duration:** 95 min
- **Started:** 2026-09-23T19:05:00Z (approx)
- **Completed:** 2026-09-23T20:40:00Z (approx)
- **Tasks:** 2 completed (both `tdd="true"`: RED then GREEN)
- **Files modified:** 4 created, 1 modified

## Accomplishments
- `data/floor-ledger.json` carries 35 rows, every one `status: "disclosed"` (D-19) with the house `data/*-ledger.json` shape (`built_at`, `phase`, `floor_basis`, `rows[]`): the 22 EXPECTED_IDS from the D-21 inventory plus the two HIPS-02 research additions (`hsi-to-graph.cjs:100`'s `0.3` literal, the whitespace `Novel (>0.8)` / `Covered (<0.4)` label text), plus 13 supplementary rows so every other literal the sweep's pattern pass found across the engine families resolves too
- `scripts/check-floor-ledger.cjs` ships `validateLedger` (required-field shape check, kind/status/env_read enum checks, the calibration gate -- `calibrated` without `provenance.gold` and `provenance.n` fails -- and stale-anchor detection reading each row's own file fresh), `resolveHits` (the pattern-pass sweep: const-decimal declarations, `envFloat(`/`envInt(`/`resolveFloat(` calls, numeric comparisons against a decimal or `1.0`-style literal, each hit resolved by file + anchor against a ledger row), `stripComments` (JS `//`/`/* */`/`*`-continuation and Python `#`, URL-safe, same-length-as-input so line numbers stay real), and a `--check` CLI mode (zero network, never requires `brain-client.cjs`)
- `lib/core/floor-disclosure.cjs` ships `PRODUCER_IDS` (frozen `['eureka','find-connections','find-bottlenecks','hsi','whitespace']`), `loadLedger` (lazy, cached, degrades to `{rows: []}` on any read failure so a render can never crash), `disclosureFor(producerId)` (the devpkg-shaped `observation`/`suggests`/`unverified`/`evidence_used` block, one plain sentence per disclosed row the producer depends on, never the numeric value), and `disclosureLine(producerId)` (the fixed rendered line naming `data/floor-ledger.json`, asserted clean against the D-30 decimal regex and a bare-percent regex)
- `tests/test-355-floor-sweep.cjs` (253 lines) proves all of it: 106/106 assertions pass -- ledger shape + EXPECTED_IDS coverage, `validateLedger`'s calibration-gate rejection on two hand-built bad rows, `resolveHits` scanning 73 files with zero unresolved hits, a `FAKE_FLOOR = 0.42` negative control planted under `lib/core/rs-__scratch-floor-355.cjs` and caught, then removed, and the dependent-outputs leg proving every disclosed row's dependent producers get an honest `unverified` line through `floor-disclosure.cjs`
- `docs/ENV-TUNING.md` gained `## Phase 355 disclosed floors`: the disclosed-not-calibrated framing plus prose entries for `EUREKA_DIFF_FLOOR`, the four `eureka-critic.cjs` Stage A gate env names (`EUREKA_SWAP_INVARIANCE_FLOOR`, `EUREKA_SWAP_K`, `EUREKA_NN_DELTA_FLOOR`, `EUREKA_ENTITY_MIN`), and the three `analogy-fitness.cjs` env names (`MINDRIAN_ANALOGY_LAYER_THRESHOLD`, `MINDRIAN_ANALOGY_TEXT_WEIGHT`, `MINDRIAN_ANALOGY_RESTATEMENT_FLOOR`)
- `bash tests/run-all-355.sh`: `PASS=20 FAIL=3 SKIP=11`, up from 355-01's baseline `PASS=16 FAIL=3 SKIP=14` (4 new PASSes: this plan's own `check-floor-ledger --check` and `test-355-floor-sweep.cjs` legs, no new regression -- the 3 FAILs are the same three pre-existing external failures `deferred-items.md` already logs)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED sweep test, then the ledger and its --check validator (D-20, D-21, D-22)** -- RED `a7c8f51fc` (test), GREEN `cd726d011` (feat)
2. **Task 2: lib/core/floor-disclosure.cjs and the ENV-TUNING prose** -- GREEN `9172ebb50` (feat)

**Plan metadata:** committed separately below (docs: complete plan)

_Note: both tasks are TDD tasks. Task 2's RED leg (the "dependent outputs" assertions in `tests/test-355-floor-sweep.cjs`) was written together with Task 1's initial test file in the `a7c8f51fc` commit rather than as a second standalone test-only commit, since both legs share one require block and one hygiene preamble -- see Deviations below. It failed correctly (`FAIL: lib/core/floor-disclosure.cjs exists`) until `9172ebb50` landed the module, confirmed by an interim run before that commit._

## Files Created/Modified
- `data/floor-ledger.json` -- 35-row disclosed floor ledger (D-19, D-20, D-21)
- `scripts/check-floor-ledger.cjs` -- `validateLedger`, `resolveHits`, `stripComments`, `SCAN_FAMILIES`, `FLOOR_SCAN_FILES`, `--check` CLI
- `lib/core/floor-disclosure.cjs` -- `PRODUCER_IDS`, `loadLedger`, `disclosureFor`, `disclosureLine`
- `tests/test-355-floor-sweep.cjs` -- the D-22 sweep test, 106 assertions, FAKE_FLOOR negative control
- `docs/ENV-TUNING.md` -- new `## Phase 355 disclosed floors` section

## Decisions Made
- Extended the ledger to 35 rows (13 beyond the 22 EXPECTED_IDS) so every literal the pattern-pass sweep finds across the full engine families resolves; the 13 extra rows carry `dependent_outputs: []` since they are internal/auxiliary constants no producer's shown output depends on (the D-20 shape's documented escape hatch for a "definitional constant")
- `disclosureLine(producerId)` returns one fixed string for every producer per the plan's literal action text, rather than a per-producer customized line; per-producer variation lives entirely in `disclosureFor`'s `unverified` array and `evidence_used` list
- `EUREKA_DIFF_FLOOR` (defined inside `rs-differential-scorer.cjs` but eureka-specific by name and env var) was mapped to `dependent_outputs: ['eureka']`, distinct from `DIFF_FLOOR`/`LSA_FLOOR`/`BERT_FLOOR` in the same file which map to `['find-connections']` (the main `score()` path)
- `whitespace-command.novelty-bands` uses one `re:` anchor covering both the `>=0.8`/`>=0.4`/`<0.4` comparisons and the `Novel (>0.8)` / `Covered (<0.4)` render label text, per the plan's explicit anchor-durability instruction naming 355-16 as a later plan that removes that label text

## Deviations from Plan

### Auto-fixed Issues

None -- both tasks' action steps were followed as written; the RED/GREEN gate sequence holds for both tasks (`test(355-04)` before both `feat(355-04)` commits).

### Scope-boundary items (documented, not auto-fixed)

**1. [Documented departure from literal task boundary] Task 2's RED leg landed in Task 1's test commit, not a separate one**
- **Found during:** Writing `tests/test-355-floor-sweep.cjs`
- **Issue:** The plan's Task 1 action text says "write tests/test-355-floor-sweep.cjs ... implementing the behavior list" (Task 1's behavior list only) and Task 2's action text separately says "add a `dependent outputs` leg to tests/test-355-floor-sweep.cjs ... run; it fails" as its own RED step. Writing the file once with both legs included was simpler and the file was going to be edited by Task 2 regardless; the leg-5 assertions were present from the first commit and genuinely failed (`FAIL: lib/core/floor-disclosure.cjs exists`) until Task 2's GREEN commit landed the module, so the RED-before-GREEN discipline was preserved in substance (confirmed by an interim `node tests/test-355-floor-sweep.cjs` run between the two GREEN commits, output captured above), just not as a separate git commit boundary
- **Why not restructured:** Splitting the test file into a Task-1-only version and then a Task-2 diff would have meant writing, committing, then immediately re-writing the same file moments later with no behavior difference in between (Task 1's own commit already left leg 5 red) -- no functional risk, and the full RED-then-GREEN-then-GREEN commit sequence (`test`, `feat`, `feat`) still gates correctly per task
- **Files modified:** `tests/test-355-floor-sweep.cjs` (one commit, not two)
- **Verification:** `git log --oneline` shows `test(355-04)` -> `feat(355-04)` (ledger) -> `feat(355-04)` (disclosure helper); `node tests/test-355-floor-sweep.cjs` at each intermediate commit was manually re-run and confirmed red/green at the expected points
- **Committed in:** `a7c8f51fc` (test), `9172ebb50` (feat, makes leg 5 green)

---

**Total deviations:** 0 auto-fixed Rule 1/2/3 fixes; 1 documented departure from the literal per-task RED commit boundary (no functional impact, gate sequence preserved).
**Impact on plan:** None on correctness or coverage -- all acceptance criteria for both tasks pass, `node scripts/check-floor-ledger.cjs --check` exits 0, `node tests/test-355-floor-sweep.cjs` exits 0 with 106/106 assertions passing.

## Issues Encountered

None outside the pre-existing three `tests/run-all-355.sh` no-regression-leg failures already logged in `deferred-items.md` by 355-01 (Phase 356's own em-dash guard on its own file, an `@huggingface/transformers` version gap, `PB8-03` in `part8-egress-guard.cjs`) -- none of those three touches a file this plan created or modified, and this plan's own two new legs (`check-floor-ledger --check`, `test-355-floor-sweep.cjs`) both pass.

## User Setup Required

None -- no external service configuration required. No env var is REQUIRED; `EUREKA_DIFF_FLOOR`, the four Stage A gate env names, and the three analogy-fitness env names are all optional operator overrides with disclosed (not calibrated) defaults.

## Next Phase Readiness

- `lib/core/floor-disclosure.cjs` is ready for 355-23 (the plan named in this plan's own objective as the one that "adds the sweep's render leg once all five producers print their disclosure line") to wire `disclosureLine`/`disclosureFor` into each of the five producers' actual rendered output
- `data/floor-ledger.json` and `scripts/check-floor-ledger.cjs` are ready for any later plan that adds a new threshold literal to the reverse-salient, HSI, whitespace or eureka engine families: `node scripts/check-floor-ledger.cjs --check` (or `node tests/test-355-floor-sweep.cjs`) will fail loudly on an unrecorded literal via the same pattern-pass sweep, catching the exact class of regression the `FAKE_FLOOR` negative control proves this sweep catches
- No blocker carried forward from this plan; the three pre-existing `tests/run-all-355.sh` failures logged in `deferred-items.md` remain exactly as 355-01 left them, untouched by this plan's files

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 4 created/modified files verified present on disk (`data/floor-ledger.json`,
`scripts/check-floor-ledger.cjs`, `lib/core/floor-disclosure.cjs`,
`tests/test-355-floor-sweep.cjs`, `docs/ENV-TUNING.md`); all 3 commits
(`a7c8f51fc`, `cd726d011`, `9172ebb50`) verified present in `git log`.
