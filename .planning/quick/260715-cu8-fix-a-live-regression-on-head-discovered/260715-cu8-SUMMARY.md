---
quick: 260715-cu8
subsystem: eureka-entity-extraction
tags: [tier-2, what-why, framework-terms, low-confidence, disclosure, canon-part-8, canon-part-9, seed-059]

requires:
  - phase: quick-260714-k44
    provides: two-tier WHAT-vs-WHY classifier + honest no-LLM degrade + tier2_low_confidence aggregate counter
provides:
  - per-term low-confidence disclosure on artifact nodes via framework_terms_low_confidence (additive sibling scalar)
  - dedicated hermetic disclosure mechanism test (marked / unmarked / upgrade-removal / subset invariant)
  - corrected 219-metadata Test 2 pinning the live disclosure signal
  - SEED-059 Site 4 worked example (one case closed, scope not rewritten)
affects: [eureka, entity-extraction, framework_terms, SEED-059, fallback-disclosure]

tech-stack:
  added: []
  patterns:
    - "Additive sibling scalar prop for per-result disclosure (subset of the primary scalar, deleted when empty, byte-compatible for existing substring readers)"
    - "Confident-upgrade semantics: a later confident run removes a prior low-confidence marker"

key-files:
  created:
    - tests/test-219-low-confidence-disclosure.cjs
  modified:
    - scripts/entity-extract.cjs
    - tests/test-219-metadata.cjs
    - tests/run-all-219.sh
    - .planning/seeds/SEED-059-fallback-disclosure-convention.md
    - CHANGELOG.md

key-decisions:
  - "Sibling scalar prop framework_terms_low_confidence, not per-term objects inside framework_terms (preserves the T-219-05 scalar-only discipline and the 218 substring readers)"
  - "Test 2 pins CORRECT behavior (Hexcel present AND disclosed), not a revert and not blind acceptance"
  - "WHAT-side sibling gap documented for a future seed, not fixed (no scope expansion)"

patterns-established:
  - "Fallback-disclosure applied structurally to one path: the fallback emits a checkable per-result signal on the artifact itself, not only in an aggregate counter"

requirements-completed: [CU8-REQ-1, CU8-REQ-2, CU8-REQ-3, CU8-REQ-4, CU8-REQ-5]

duration: ~30min
completed: 2026-07-15
---

# Quick 260715-cu8: Per-term low-confidence disclosure for framework_terms Summary

**A low-confidence WHY term that lands via the no-LLM embedding best-guess is now disclosed per-term on its artifact node via an additive `framework_terms_low_confidence` sibling scalar, so it is no longer structurally indistinguishable from a confidently-resolved framework term; the live 219 regression is fixed by pinning correct behavior.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-15
- **Tasks:** 3 (all `auto`, two TDD)
- **Files modified:** 6 (1 created)

## Accomplishments

- **Root cause fixed at origin.** The two-tier classifier (quick 260714-k44) legitimately classifies "Hexcel" as WHY on the plain fixture; under the live zero-credit account state the honest-degrade path lands it in `framework_terms` as a low-confidence embedding best-guess. The signal for "this was a low-confidence guess" existed ONLY in the aggregate `status.json` counter (`tier2_low_confidence`). Once written onto the node, the guess was indistinguishable from a confident term. Now every no-LLM-degrade term is disclosed per-term.
- **Threaded per-term through the pipeline:** `routeLabel` carries an optional `lowConfidence` flag (only the runTier2 no-LLM escalation branch sets it), `whyByArtifact` aggregates `{ name, lowConfidence }`, and `applyFrameworkTerms` maintains the additive `framework_terms_low_confidence` sibling (subset of `framework_terms`, confident-upgrade removes the marker, prop deleted when empty).
- **Byte-compatibility preserved:** `framework_terms` stays a plain comma-joined scalar; the reader audit (only the two 218 tests read it, via substring) is documented in the doc comment; `run-all-218.sh` stays green (FAIL=0).
- **Test pins the signal:** a dedicated 4-leg mechanism test plus a corrected Test 2 that RED-fails again if disclosure ever silently disappears.

## Task Commits

1. **Task 1: Thread per-term low-confidence into framework_terms_low_confidence** - `0cff100f` (fix)
2. **Task 2: Dedicated disclosure test + fix 219-metadata Test 2** - `cf299e6b` (test)
3. **Task 3: SEED-059 worked example + CHANGELOG** - `bce00305` (docs)

## Files Created/Modified

- `scripts/entity-extract.cjs` - `routeLabel` lowConfidence flag; `whyByArtifact` carries `{ name, lowConfidence }`; `applyFrameworkTerms` writes the additive `framework_terms_low_confidence` sibling with subset + upgrade + delete-when-empty semantics; reader-audit finding documented in the doc comment
- `tests/test-219-low-confidence-disclosure.cjs` (new) - 4 hermetic legs: low-margin marked, confident unmarked, confident re-run clears the marker, subset invariant; driven via the existing `embedClassifyImpl` + `_forceNoLlm` seams
- `tests/test-219-metadata.cjs` - Test 2 replaced with the additive-only + live-state disclosure-pin contract
- `tests/run-all-219.sh` - file-gated `run_if` leg for the new disclosure test
- `.planning/seeds/SEED-059-fallback-disclosure-convention.md` - dated worked-example section, scope not rewritten, WHAT-side gap named for a future seed
- `CHANGELOG.md` - Unreleased Fixed entry in house style

## Decisions Made

- **Sibling scalar prop, not per-term objects.** Per-term objects inside `framework_terms` would violate the T-219-05 scalar-only discipline and break the 218 substring readers. `framework_terms_low_confidence` is a comma-joined subset scalar, purely additive.
- **Test 2 pins correct behavior.** Not a revert of the Hexcel classification (it is legitimate) and not blind acceptance; it asserts Hexcel is present AND disclosed low-confidence under the live state, so the leg REDs if the disclosure signal disappears.
- **No scope expansion.** The adjacent WHAT-side gap (a low-confidence WHAT best-guess becomes a proposed entity node with no per-node marker) is documented as a future-seed candidate, deliberately not fixed.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the implementation followed the planned sibling-scalar mechanism directly.

## Issues Encountered

**Pre-existing, out-of-scope failure surfaced by the full `run-all-221.sh` acceptance (NOT caused by cu8).** The aggregator finished with `Phase 221: PASS=12 FAIL=2`. Both failures trace to a single root cause in a different subsystem: the `216-03 gate: shape declaration (strict)` leg (`node scripts/check-shape-declaration.cjs --check --strict`) reports SHAPE DECLARATION VIOLATION on command surfaces that declare a `hitl_shape` AND `connector.excluded:true` simultaneously (`commands/admin.md`, `commands/brain-derive.md`, `commands/correct-reference-now.md`, `commands/doctor.md`, `commands/dogfood-flush.md`, and others). Phase 220's `220 no-regression` leg RED-cascades from the same 216 chain.

- **Proof it is pre-existing:** reproduced identically on a clean worktree at the parent commit `bba2decd` (before either cu8 commit) with `--check --strict` exit 1 and the same violations. quick 260715-cu8 touched only `scripts/entity-extract.cjs` and the 219 tests, never `commands/*` or `scripts/check-shape-declaration.cjs`. The flagged command files last changed in commit `2b92c252`.
- **cu8 scope is fully green:** `run-all-218.sh` (FAIL=0), `run-all-219.sh` (PASS=13, FAIL=0, including the fixed metadata leg and the new disclosure leg), `test-219-low-confidence-disclosure.cjs` (4/4). The specific regression this quick task targets (`test-219-metadata` Test 2) is resolved.
- **Disposition:** logged to `deferred-items.md` in this quick-task directory (SCOPE BOUNDARY rule). A separate debug/quick task should reconcile the Canon Part 11 R16 HITL shape declarations on those command surfaces. Not fixed here to avoid scope expansion.

## Verification

- `bash tests/run-all-218.sh`: PASS, FAIL=0 (confident-path byte-compatibility holds).
- `bash tests/run-all-219.sh`: PASS=13, FAIL=0 (fixed metadata leg + new disclosure leg).
- `node tests/test-219-low-confidence-disclosure.cjs`: 4/4 legs.
- `node tests/test-219-metadata.cjs`: 7/7 legs, live branch "Hexcel present" disclosure pin green.
- `bash tests/run-all-221.sh`: PASS=12 FAIL=2 -- the only two FAILs are the pre-existing 216/220 shape-declaration cascade documented above and in `deferred-items.md`, confirmed identical on the pre-cu8 baseline; the 218 and 219 legs it chains are both FAIL=0.
- grep gates green: zero-network on `entity-extract.cjs` (Test 6 passes), no em-dashes in any touched file (all CHANGELOG em-dashes are pre-existing entries, none in the cu8 entry).

## Next Steps

- The framework_terms Site 4 case is closed; SEED-059 stays open for Sites 1-3 and the general convention.
- The adjacent WHAT-side disclosure gap is a named future-seed candidate.
- The pre-existing 216/220 HITL shape-declaration cascade needs its own reconciliation task (see `deferred-items.md`).

## Self-Check: PASSED

- `scripts/entity-extract.cjs`: FOUND
- `tests/test-219-low-confidence-disclosure.cjs`: FOUND
- `tests/test-219-metadata.cjs`: FOUND
- `tests/run-all-219.sh`: FOUND
- `.planning/seeds/SEED-059-fallback-disclosure-convention.md`: FOUND
- `CHANGELOG.md`: FOUND
- `260715-cu8-SUMMARY.md`: FOUND
- Commit `0cff100f`: FOUND
- Commit `cf299e6b`: FOUND
- Commit `bce00305`: FOUND
