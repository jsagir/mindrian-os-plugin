---
phase: 231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont
plan: 01
subsystem: eureka
tags: [eureka, entity-extraction, provenance, evidenceTier, low-confidence, pairing-exclusion, key-resolution, rca, verify-not-build]

# Dependency graph
requires:
  - phase: 218-eureka-entity-extraction
    provides: routeLabel WHY-side lowConfidence stamping, tier-2b classifier, step-4b scaffold/container pair exclusion, test-218-what-why-classifier contract
provides:
  - WHAT-side evidenceTier provenance stamping (low_confidence + fallback) in scripts/entity-extract.cjs
  - step-4b low-trust pair exclusion (low_confidence-only) with hasVerifiedEntity Decision-8 guard + low_trust_pairs_excluded provenance counter in scripts/eureka-portfolio-report.cjs
  - cwd-independent module-relative .env key-resolution leg in lib/core/mva-classifier.cjs resolveAnthropicKey
  - _coerceLabels drop-on-garbage narrowing (parseable-but-garbled per-term answer -> noise) in lib/core/eureka/entity-classifier.cjs
  - tests/test-218-low-trust-exclusion.cjs (3-leg regression)
affects: [231-02 (CR-01 reconciliation + human-verify gate + phase roll-up), eureka pairing/ranking, entity-extraction provenance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Honest-provenance stamp defaulting to a neutral value: only non-confident WHAT entities carry an evidenceTier; confident ones stay undefined so the node write is byte-identical to pre-fix"
    - "Additive-branch-at-a-shared-insertion-point: the low-trust pair exclusion is a third branch in the existing step-4b loop alongside container/scaffold, counted + surfaced, never a parallel filter pass"
    - "Two-tier provenance distinction: low_confidence (excluded from pairing) vs fallback (stamped for honesty, NOT excluded) so a keyless/encoder-down room still ranks"
    - "Fail-open key resolution: 4th module-relative .env leg returns null (not throw) in a keyless install cache, preserving graceful degrade"

key-files:
  created:
    - tests/test-218-low-trust-exclusion.cjs
  modified:
    - scripts/entity-extract.cjs
    - scripts/eureka-portfolio-report.cjs
    - lib/core/mva-classifier.cjs
    - lib/core/eureka/entity-classifier.cjs

key-decisions:
  - "D-01: exclude ONLY evidenceTier 'low_confidence' from pairing (NOT 'fallback'), guarded by hasVerifiedEntity; wiring point is eureka-portfolio-report.cjs step-4b, NOT room-native-substrate.cjs (PATTERNS.md location correction)"
  - "D-02: resolveAnthropicKey gains a cwd-independent module-relative .env leg (walk up from __dirname), shipping in THIS phase, keyless-safe null degrade"
  - "D-03: _coerceLabels narrowed to coerce garbled per-term answers to 'noise'; _fallback T-T2-01 whole-response fail-open contract left byte-intact"
  - "D-05: test-218-what-why-classifier contract unweakened (22/22): no-key -> source:'fallback', embedding-degrade -> classifier_source:'embedding' never silently 'fallback'"

patterns-established:
  - "Provenance stamp mirrors the existing WHY-side self-analog in the same file, additive-only"
  - "Exclusion set is a frozen Set with a deliberately narrow membership (low_confidence only) to protect Decision 8"

requirements-completed: [EEN-01, EEN-02, EEN-03, EEN-04, EEN-06]

# Metrics
duration: 12min
completed: 2026-07-19
---

# Phase 231 Plan 01: Eureka Entity-Noise Fix (WHAT-side low-confidence + pairing exclusion) Summary

**Verified and accepted the already-applied FIX A/B/C: WHAT entities now carry an evidenceTier provenance stamp (low_confidence for no-LLM embedding best-guesses, fallback for encoder-down degrades), low_confidence pairs are excluded from eureka ranking under a Decision-8 hasVerifiedEntity guard with an honest low_trust_pairs_excluded counter, resolveAnthropicKey gained a cwd-independent module-relative .env leg so tier-2b can resolve a key, and _coerceLabels drops garbled per-term model answers as noise while _fallback's fail-open contract stays byte-intact.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-19T16:55:00Z (approx)
- **Completed:** 2026-07-19T17:07:00Z (approx)
- **Tasks:** 3 (verify-and-accept)
- **Files modified:** 5 (4 modified + 1 new test)

## Accomplishments

- **FIX A (stamping):** Confirmed `routeLabel()` stamps `e.evidenceTier = 'low_confidence'` on the WHAT branch only when `lowConfidence === true`; the single such call site is the `runTier2()` no-LLM else-branch (`routeLabel(it.e, it.bestGuess, whatEntities, whyTerms, true)`). `runDegradeHzx()` stamps `'fallback'` (provenance only, deliberately distinct from and NOT excluded like `'low_confidence'`). The write loop passes `evidenceTier: e.evidenceTier` into `writeEntityNode`, which defaults a non-string to `'None'` (byte-identical write for confident entities).
- **FIX A (exclusion):** Confirmed `LOW_TRUST_EVIDENCE_TIERS = Object.freeze(new Set(['low_confidence']))` (fallback deliberately absent), `isLowTrustEntity(row)` gates on `ENTITY_NODE_TYPES` and parses `row.properties` defensively, and the step-4b loop computes `hasVerifiedEntity` before the pair loop with the additive branch `if (hasVerifiedEntity && (aLowTrust || bLowTrust)) { lowTrustPairsExcluded += 1; continue; }`. The count surfaces in the provenance object (`low_trust_pairs_excluded`) and a markdown provenance-table row.
- **FIX B (key leg):** Confirmed `resolveAnthropicKey()` has a 4th `path.resolve(__dirname, '..', '..', '.env')` leg, try/catch-swallowed, feeding `_parseAnthropicKey`, falling through to `return null`. Cross-platform, no `process.cwd()` in the actual leg code, keyless-safe null degrade. Canon Part 8 holds (LOCAL -> Anthropic, never Brain).
- **FIX C (narrowing):** Confirmed `_coerceLabels` line is `labels[n] = (v && VALID_LABELS.has(v)) ? v : 'noise';` and the old `? v : 'what'` coercion exists nowhere in the file. `_fallback()` (lines 113-117) is byte-intact: every name -> `'what'`, `source: 'fallback'`, never throws (T-T2-01 DoS protection preserved).
- **All six tests green:** low-trust-exclusion 3/3, noise-reduction 4/4, scaffold-pair-filter 2/2, what-why-classifier 22/22, mva-from-brief 21/21, mva-dror-harness 5/5.

## Task Commits

This is a verify-and-accept plan: all three tasks' code was already written (uncommitted) by a prior `/gsd-debug` session. After verifying every must_have against the real file contents and re-running every gate, the plan's `files_modified` were committed atomically:

1. **Tasks 1-3 (FIX A stamping + exclusion, FIX B key leg, FIX C narrowing + new test)** - `3000d06e` (feat)

**Plan metadata:** (docs commit with SUMMARY + STATE + ROADMAP - see final commit)

## Files Created/Modified

- `scripts/entity-extract.cjs` - `routeLabel()` WHAT-branch low_confidence stamp, `runDegradeHzx()` fallback provenance stamp, write-loop `evidenceTier` persist. (Also carries the 231-02 CR-01 `reconcileEvidenceTierAcrossDuplicateNames()` IIFE, committed here as-is; CR-01 credit is plan 231-02's, not this plan's.)
- `scripts/eureka-portfolio-report.cjs` - `LOW_TRUST_EVIDENCE_TIERS` frozen set, `isLowTrustEntity()` predicate, `hasVerifiedEntity` Decision-8 guard, step-4b either-endpoint exclusion branch, `low_trust_pairs_excluded` counter + provenance table row.
- `lib/core/mva-classifier.cjs` - 4th module-relative `.env` leg in `resolveAnthropicKey()`.
- `lib/core/eureka/entity-classifier.cjs` - `_coerceLabels` drop-on-garbage narrowing (`? v : 'noise'`); `_fallback()` untouched.
- `tests/test-218-low-trust-exclusion.cjs` (NEW) - 3-leg regression: stamping, mixed-room exclusion, Tier-0 guard.

## Decisions Made

None new - this plan verified and accepted decisions already locked in CONTEXT.md/PATTERNS.md. The following are documented as **locked decisions, not deviations**:

- **(a) fallback tier NOT excluded (Decision 8):** `LOW_TRUST_EVIDENCE_TIERS` is `low_confidence`-only. Excluding `fallback` would empty a pure Tier-0 room (where every entity is a keyless/encoder-down fallback guess), breaking graceful degradation. This is a deliberate, tested refinement over CONTEXT.md's original broader description.
- **(b) wiring point is `eureka-portfolio-report.cjs` step-4b, NOT `room-native-substrate.cjs`:** CONTEXT.md's original wiring guess was corrected by PATTERNS.md and the RCA reconciliation, because pairing enumerates `indexed` SELECT nodes here, not `techMap`. `room-native-substrate.cjs` was NOT touched.
- **(c) 231-REVIEW.md WR-01/WR-02/WR-04 logged as non-blocking fast-follow candidates** (see Known Limitations).

## Deviations from Plan

None - plan executed exactly as written (verify-and-accept). Every must_have holds against the current working tree; every gate test exits 0.

Two grep-count acceptance criteria matched a count one higher than the literal expected value, both traced to explanatory **comments** (not code drift):

- Task 1a `grep -c "e.evidenceTier = 'low_confidence'" scripts/entity-extract.cjs` returned 2: line 420 is the actual WHAT-branch code; line 406 is a documentation comment describing that stamp. The code assertion holds exactly once.
- Task 3b `grep -c "process.cwd" <(sed -n '152,175p' ...)` returned 1: the match is line 152, a comment stating the 4th leg resolves from `__dirname` "NOT process.cwd()". The actual leg code (line 165, `path.resolve(__dirname, '..', '..', '.env')`) never calls `process.cwd()`.

Both were verified by reading the surrounding source, confirming the underlying must_haves hold at the code level. No code was changed.

## Issues Encountered

None. All source assertions held on the current working tree (no drift from the 5-concurrent-session window flagged in the plan objective).

## Known Limitations (non-blocking, fast-follow candidates - out of this verify-and-accept scope)

- **WR-01:** a truncation-tail per-term answer is coerced to noise (could drop a legitimately-truncated valid label).
- **WR-02:** the no-key classifier test is not hermetic against a real repo `.env` present on the machine.
- **WR-04:** the 4th key leg assumes a fixed two-levels-up depth from `lib/core/` to plugin root.

These are logged in `231-REVIEW.md` as non-blocking warnings, candidates for a fast-follow, not fixed here.

## Scope Boundaries Honored

- `scripts/entity-extract.cjs`'s CR-01 section (`reconcileEvidenceTierAcrossDuplicateNames()`), `tests/test-218-duplicate-entity-reconciliation.cjs`, and `tests/run-all-218.sh` are plan **231-02's** territory and were NOT modified or committed by this plan (though `entity-extract.cjs` physically carries the CR-01 IIFE, committed here as-is since both fixes share one file and both test green together).
- `lib/core/eureka/entity-classifier.cjs`'s `_fallback()` (T-T2-01 contract) untouched.

## TDD Gate Compliance

Not a TDD plan (verify-and-accept). The plan's regression test (`tests/test-218-low-trust-exclusion.cjs`) was pre-written and re-run green during verification.

## User Setup Required

None - no external service configuration required. (The optional `.env` Anthropic key remains optional; a keyless install degrades gracefully as before.)

## Next Phase Readiness

- **231-02 ready:** verify CR-01 duplicate-name reconciliation, full-suite roll-up, human-verify gate (live keyed acceptance or offline approval), and the final RCA disposition. The CR-01 code already lives in `entity-extract.cjs` (committed here); 231-02 owns its verification, its dedicated test wiring (`run-all-218.sh` lines 170-171), and the phase-completion checkpoint.
- **No blockers introduced.** Pre-existing, unrelated Phase 218 suite failures (`test-218-edge-vocab.cjs`, `test-218-entity-writer.cjs`, `test-218-eureka-auto-extract.cjs` leg 5 - a schema `review_status` gap + a `reasoning_await_mappings` issue) were confirmed PRE-EXISTING during planning and remain out of scope.

## Self-Check: PASSED

- FOUND: `tests/test-218-low-trust-exclusion.cjs`
- FOUND: `.planning/phases/231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont/231-01-SUMMARY.md`
- FOUND: commit `3000d06e`

---
*Phase: 231-eureka-entity-noise-fix-thread-the-low-confidence-signal-ont*
*Completed: 2026-07-19*
