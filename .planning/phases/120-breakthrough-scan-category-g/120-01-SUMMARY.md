---
phase: 120-breakthrough-scan-category-g
plan: "01"
subsystem: lib/hmi + lib/core/breakthrough
tags: [breakthrough, f7-selector, scoring-formula, canon-part-3-decision-gate, canon-part-10-sub-claim-5, d-11-d-12-d-19-verbatim-lock, additive-extension]
dependency_graph:
  requires:
    - phase-88.2 (F-shape selector dispatcher; F_SUBSHAPES array additive-extension pattern)
    - phase-101 (Tier 0/A/B mode-aware dispatch substrate)
    - phase-109 (SQL navigation chokepoint -- findRecentChanges for per-detector engagement priors + dismissal-rate canary)
    - phase-120-00 (Breakthrough graph schema + 6 new EVENT_TYPES strings + DERIVED_FROM edge type)
    - phase-117 (math layer -- whitespace + reverse-salient + cross-domain analogy populate detectors that feed F.7)
  provides:
    - lib/hmi/shape-f7-breakthrough-renderer.cjs (F.7 Breakthrough Surface; 5 verbs verbatim; mandatory-dismiss invariant; D-20 HARD FLOOR provenance refusal)
    - lib/hmi/selector-dispatcher.cjs F.7 branch (F_SUBSHAPES 7 -> 8; additive)
    - lib/core/breakthrough/scoring.cjs (5-component scoring formula + rankBreakthroughs + pickTopWithAffordance + getUserEngagementPrior + isThrottledKind)
    - SCORING_WEIGHTS frozen lock (0.4/0.2/0.2/0.1/0.1; sum 1.0)
    - RECENCY_HALF_LIFE_DAYS verbatim (3)
    - D-19 canary constants verbatim (D19_DISMISSAL_THRESHOLD=0.30; D19_FIRE_WINDOW=100; D19_MIN_SAMPLE=10)
    - tests/test-120-01-scaffold.sh (8-gate shell harness)
  affects:
    - Plan 120-02 (session-start scanner) -- consumes scoring.cjs::pickTopWithAffordance to choose surface candidate; consumes isThrottledKind for D-19 auto-throttle gate
    - Plan 120-03 (ethics fence + cooldowns) -- consumes scoring.cjs::getUserEngagementPrior for confirm/dismiss feedback signal
    - Phase 121.5 terminal-coherence-capstone -- consumes F.7 dispatch in the surface-coherence sweep
tech_stack:
  added: []
  patterns:
    - additive-tail-append (F_SUBSHAPES Set extended 7 -> 8 without reordering existing entries)
    - chokepoint-routing (Canon Part 9 D-06; all memory_event reads via navigation.findRecentChanges)
    - graceful-degradation (missing roomState + chokepoint throw -> neutral prior 0.5; failover-on-canary returns false)
    - canon-part-8-tripwire (source-grep test + scaffold Gate 7 assert zero brain-client require + zero brain.mindrian fetch)
    - object-freeze-invariant (SCORING_WEIGHTS frozen; mutation either no-ops in non-strict or throws in strict)
    - laplace-smoothing-with-neutral-pivot ((c + 0.5) / (c + d + 1) pivots around 0.5 on empty history; avoids division-by-zero)
    - statistical-floor-canary (D19_MIN_SAMPLE = 10 prevents premature throttling on 1-of-2-style noise)
    - tri-surface-adaptation (CLI/Desktop/Cowork all consume F.7 via the same dispatcher envelope; renderer is pure)
key_files:
  created:
    - lib/hmi/shape-f7-breakthrough-renderer.cjs (200 LOC; closed-vocab 5 verbs + D-10 mandatory-dismiss invariant + D-20 HARD FLOOR provenance refusal)
    - lib/hmi/shape-f7-breakthrough-renderer.test.cjs (17 tests + 1 bonus)
    - lib/core/breakthrough/scoring.cjs (~210 LOC; 5-component formula + 6 helper exports + 6 frozen constants)
    - lib/core/breakthrough/scoring.test.cjs (21 tests)
    - tests/test-120-01-scaffold.sh (8-gate shell harness; em-dash-free via printf encoding)
  modified:
    - lib/hmi/selector-dispatcher.cjs (F_SUBSHAPES 7 -> 8; F.7 dispatch branch; safeRequire of shape-f7-breakthrough-renderer.cjs)
    - lib/memory/run-feynman-tests.cjs (Phase 120-01 Wave 2 block appended at TEST_FILES tail; 2 test path entries)
key-decisions:
  - "F.7 chosen as the new sub-shape ID (NOT F.6) because Phase 88.2-06 already shipped F.6 Plan Review Round; collision-safe path under the existing dispatcher pattern."
  - "5 verbs LOCKED VERBATIM in order: [Explore deeper] / [Confirm] / [File as decision] / [Dismiss] / [Back]; Object.freeze on F7_VERBS prevents mutation; assertContractInvariants returns precise reason codes (verb_count_mismatch / dismiss_required / verb_order_mismatch)."
  - "D-10 mandatory-dismiss is structurally enforced via assertContractInvariants F7_DISMISS_INDEX=3 check on every render."
  - "D-20 HARD FLOOR provenance refusal: F.7 renderer refuses to surface a breakthrough with empty artifact_ids[] -- defense in depth on top of writeBreakthrough's validateProvenance in Plan 120-00 schema.cjs."
  - "SCORING_WEIGHTS frozen verbatim (0.4 / 0.2 / 0.2 / 0.1 / 0.1; sum 1.0); Object.freeze enforces immutability at module load."
  - "Laplace prior formula chosen as (c + 0.5) / (c + d + 1) so 0-confirm / 0-dismissed returns the neutral 0.5 midpoint (avoids the 0/1 = 0 failure mode of a naive ratio). 3-confirm / 0-dismissed returns 0.875; 1-confirm / 4-dismissed returns 0.25."
  - "isThrottledKind statistical floor D19_MIN_SAMPLE=10 prevents premature throttling on small populations (1-of-2 = 50% would otherwise trip the 30% canary on essentially noise)."
  - "D-19 canary measures dismissals against in-window fire_ids only (a dismiss for an out-of-window fire is treated as noise; mirrors a sliding-window-against-fingerprint pattern)."
  - "rankBreakthroughs tie-break by detected_at descending (newer wins) -- the spec doesn't say explicitly but newer is more relevant per Canon Part 5 evidence-grading recency bias."
  - "Test 12 source-grep narrowed from prose match to actual API call match (require / fetch), mirroring the Plan 120-00 Deviation 2 narrowing precedent. Both files include documentation prose about NOT doing Brain coupling -- a true statement that nonetheless tripped the naive regex."
patterns-established:
  - "Closed-vocab F-shape renderer pure-function pattern (mirrors F.3 / F.4 / F.6 plan-review byte-for-byte): freeTextOffered:false carve-out + Object.freeze on the verbs array + render-time invariant assertion."
  - "Chokepoint-routed local-only scoring helper pattern: all per-detector signal reads via navigation.findRecentChanges; never direct sqlite; never Brain. Graceful-degradation on chokepoint throw."
  - "Three-layer harness for verbatim-locked numeric constants: (1) module-level frozen object; (2) unit test that asserts each value; (3) scaffold harness shell gate that greps the literal in source."
requirements-completed:
  - BREAKTHROUGH-120-03
  - BREAKTHROUGH-120-09
metrics:
  duration: "~3h 30m total (Tasks 1-2 by prior agent; Task 3 + scaffold + runner registration this session)"
  duration_task_3: "~25 min (RED test + GREEN impl + scaffold harness + runner registration)"
  completed: "2026-05-17"
  tests_passing: "38/38 across 2 test files (17 renderer + 21 scoring)"
  scaffold_gates: "8/8 green"
  total_lines_changed: "+3772 / -1 across 20 files (includes parallel-collision Plan 120-00 files)"
---

# Phase 120 Plan 01: F.7 Breakthrough Surface Selector + 5-Component Scoring Formula Summary

**Closed-vocabulary F.7 Breakthrough Surface (5 verbs verbatim) wired into the Phase 88.2 selector dispatcher, with the verbatim-locked 5-component scoring formula + per-detector Laplace-smoothed engagement prior + D-19 dismissal-rate canary, all routing through the Phase 109 navigation chokepoint with zero Brain coupling.**

## Substantive One-Liner

Phase 120-01 ships the user-facing surface for Phase 120 (Breakthrough Scan / Category G): a new closed-vocab F.7 sub-shape registered additively with the Phase 88.2 dispatcher, paired with the D-12 5-component scoring formula and the D-19 per-detector dismissal-rate canary. The whole plan is local-only (Canon Part 8), chokepoint-routed (Canon Part 9), and constitutionally provenance-required (D-20 HARD FLOOR defense in depth at the surface layer).

## Performance

- **Duration:** ~3h 30m total wall time (Tasks 1-2 by prior agent; Task 3 + scaffold + runner registration this session; ~25 min wall-time for Task 3 resumption)
- **Started:** 2026-05-17T06:59:20+03:00 (Task 1 by prior agent)
- **Resumed:** 2026-05-17T10:07:00+03:00 (this session, Task 3)
- **Completed:** 2026-05-17T10:31:05+03:00 (this session)
- **Tasks:** 3 (Task 1 + Task 2 landed by prior agent; Task 3 landed here)
- **Files created:** 5 (2 production .cjs + 2 test .cjs + 1 shell harness)
- **Files modified:** 2 (selector-dispatcher.cjs + run-feynman-tests.cjs)

## Accomplishments

1. **F.7 Breakthrough Surface renderer** (`lib/hmi/shape-f7-breakthrough-renderer.cjs`) -- pure CJS, zero deps; closed-vocab 5 verbs verbatim; D-10 mandatory-dismiss structural guard; D-20 HARD FLOOR provenance refusal; D-17 rule 3 time anchor with bucket boundaries that match the user-visible spec examples.
2. **F.7 dispatcher branch** (`lib/hmi/selector-dispatcher.cjs`) -- F_SUBSHAPES additive extension 7 -> 8; new dispatchShapeFSubShape branch routes `requestedShape:'F.7'` to the renderer via safeRequire; existing 88.2 + 101 + 88.6 wiring preserved byte-stable.
3. **5-component scoring formula** (`lib/core/breakthrough/scoring.cjs`) -- the locked-verbatim D-12 weighted sum; rankBreakthroughs stable sort; pickTopWithAffordance shape for the "More breakthroughs (N)" surface; per-detector Laplace-smoothed engagement prior; D-19 dismissal-rate canary with D19_MIN_SAMPLE statistical floor.
4. **Scaffold harness** (`tests/test-120-01-scaffold.sh`) -- 8 gates covering F.7 dispatch + 5 verbs verbatim + locked scoring constants + Canon Part 8 zero-Brain invariant + em-dash HARD RULE.
5. **Feynman runner registration** -- Phase 120-01 Wave 2 block at TEST_FILES tail; 2 test path entries (renderer + scoring); aggregator harness annotated in comment block.

## Task Commits

Each task was committed atomically:

1. **Task 1 (renderer):** `2faf85c1` -- `feat(120-01): add F.7 Breakthrough Surface renderer with 5 verbs verbatim + D-20 HARD FLOOR`
   - Files: `lib/hmi/shape-f7-breakthrough-renderer.cjs` (200 LOC) + `lib/hmi/shape-f7-breakthrough-renderer.test.cjs` (17/17 passing)
2. **Task 2 (dispatcher wiring):** `18b1bde1` -- `feat(120-01): register F.7 with selector dispatcher (F_SUBSHAPES 7->8 + dispatch branch)`
   - Files: `lib/hmi/selector-dispatcher.cjs` (F_SUBSHAPES extended; F.7 branch added)
3. **Task 3 RED:** `c7caf53c` -- `test(120-01): add failing tests for breakthrough scoring (RED)`
   - Files: `lib/core/breakthrough/scoring.test.cjs` (21 tests; fails because scoring.cjs does not yet exist)
4. **Task 3 GREEN:** `16596ff3` -- `feat(120-01): implement 5-component breakthrough scoring formula (GREEN)`
   - Files: `lib/core/breakthrough/scoring.cjs` + Test 12 regex fix
5. **Task 3 scaffold + runner:** `5efd231b` -- `feat(120-01): scaffold harness + Feynman runner registration`
   - Files: `tests/test-120-01-scaffold.sh` + `lib/memory/run-feynman-tests.cjs`

(TDD discipline produced 2 commits for Task 3: test → feat → scaffold; mirrors the Phase 120-00 schema.cjs commit pattern.)

## Files Created / Modified

### Created

| File | LOC | Purpose |
|------|-----|---------|
| `lib/hmi/shape-f7-breakthrough-renderer.cjs` | 200 | F.7 closed-vocab renderer; 5 verbs verbatim; D-10 + D-20 guards |
| `lib/hmi/shape-f7-breakthrough-renderer.test.cjs` | 251 | 17 tests + 1 bonus (KIND_DISPLAY_NAMES coverage) |
| `lib/core/breakthrough/scoring.cjs` | 213 | 5-component scoring + 4 helpers + 6 frozen constants |
| `lib/core/breakthrough/scoring.test.cjs` | 422 | 21 tests across 15 named cases (some have sub-cases) |
| `tests/test-120-01-scaffold.sh` | 99 | 8-gate shell harness |

### Modified

| File | Change | Provenance |
|------|--------|------------|
| `lib/hmi/selector-dispatcher.cjs` | F_SUBSHAPES 7 -> 8 (additive tail-append) + F.7 dispatch branch in dispatchShapeFSubShape + comment provenance block | Phase 88.2-04 additive-extension pattern |
| `lib/memory/run-feynman-tests.cjs` | Phase 120-01 Wave 2 block appended at TEST_FILES tail; 2 path entries | Phase 120-00 + Phase 119-00 additive-tail-append precedent |

## Decisions Made

### 1. F.7 chosen over F.6 (collision-safe sub-shape ID)

Phase 88.2-06 already shipped F.6 Plan Review Round (`shape-f6-plan-review-renderer.cjs`). Reusing the F.6 ID would either break the existing 88.2-06 contract or force a complex routing dispatch by JTBD state. F.7 is the next free integer in the F-sub-shape namespace, and the additive-extension pattern preserves byte-stable backwards compatibility for every existing surface.

### 2. 5 verbs LOCKED VERBATIM order (D-08)

`[Explore deeper]` / `[Confirm]` / `[File as decision]` / `[Dismiss]` / `[Back]`. Object.freeze on F7_VERBS prevents mutation; F7_DISMISS_INDEX=3 documents the structural location of the mandatory Dismiss for assertContractInvariants. `assertContractInvariants` returns precise reason codes (`verb_count_mismatch` / `dismiss_required` / `verb_order_mismatch`) for downstream error surfacing.

### 3. D-10 mandatory-dismiss structurally enforced

`assertContractInvariants` runs on every render against the mutable verbs copy; if it doesn't deep-equal F7_VERBS the renderer returns `{ error: 'dismiss_required' }` (or `'verb_order_mismatch'` for non-Dismiss mismatches). The user can never see an F.7 selector without a Dismiss exit.

### 4. D-20 HARD FLOOR provenance refusal at surface layer

`renderShapeF7Breakthrough` refuses to render a breakthrough with empty or missing `artifact_ids[]`, returning `{ error: 'provenance_required' }`. This is defense in depth on top of `writeBreakthrough`'s `validateProvenance` in Plan 120-00 `schema.cjs`. Even if a caller bypasses the schema layer, the surface layer still enforces the Cypher-provable invariant.

### 5. SCORING_WEIGHTS frozen verbatim (D-12)

```javascript
const SCORING_WEIGHTS = Object.freeze({
  confidence: 0.4,
  recency: 0.2,
  differential: 0.2,
  artifact_count_log: 0.1,
  user_engagement_prior: 0.1,
});
```

Sum = exactly 1.0 (verified within 1e-9 tolerance). Object.freeze prevents accidental mutation. The triple-layer enforcement is: (1) module-level frozen object, (2) Test 1 unit assertion, (3) scaffold Gate 5 + Gate 6 shell grep for the literal weight + the RECENCY_HALF_LIFE_DAYS symbol.

### 6. Laplace prior formula choice

The CONTEXT.md D-12 spec implies a prior but does not prescribe a specific formula. Three candidates considered:

| Formula | Empty | 3-conf | 1-conf + 4-dismiss |
|---------|-------|--------|--------------------|
| Naive c / (c + d) | 0/0 = NaN | 3/3 = 1.0 | 1/5 = 0.2 |
| Plain Laplace (c + 1) / (c + d + 2) | 1/2 = 0.5 | 4/5 = 0.8 | 2/7 = 0.286 |
| Neutral pivot (c + 0.5) / (c + d + 1) | 0.5/1 = 0.5 | 3.5/4 = 0.875 | 1.5/6 = 0.25 |

The neutral-pivot form was chosen because:
- it pivots around 0.5 on empty history (matches Test 6 expected behavior verbatim);
- it gives more amplitude in both directions than plain Laplace (which is desirable for a per-detector learning signal that should adapt quickly to confirmed signals);
- the formula has a clean closed form that's easy to audit by hand.

### 7. D-19 statistical floor (D19_MIN_SAMPLE = 10)

CONTEXT.md D-19 specifies the rolling 100-fire window and the 30% threshold but does not specify a minimum sample size. Without a floor, the canary trips on essentially noise (1-of-2 = 50% throttles a brand-new detector after 2 fires). The floor of 10 was chosen to match standard statistical adequacy heuristics for binary-outcome populations.

### 8. rankBreakthroughs tie-break by detected_at descending

The spec doesn't prescribe a tie-break rule explicitly. Newer-wins was chosen because:
- it aligns with Canon Part 5 recency bias for evidence grading;
- it matches the user-visible "what just happened" framing of Category G (variable reward of the most recent insight);
- it provides deterministic ordering for the test surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 12 source-grep regex required `.cjs` extension**

- **Found during:** Task 3 GREEN phase verification
- **Issue:** The plan's Test 12 regex `require\s*\(\s*['"][^'"]*navigation['"][^)]*\)` matched only when `navigation` was the literal trailing identifier in the quote. Production code requires `require('../navigation.cjs')` which has `.cjs` after `navigation` -- the regex didn't match.
- **Fix:** Narrowed the regex to `require\s*\(\s*['"][^'"]*navigation(?:\.cjs)?['"]\s*\)` -- now matches both `'navigation'` and `'navigation.cjs'` suffixes.
- **Files modified:** `lib/core/breakthrough/scoring.test.cjs` (1 regex line)
- **Verification:** all 21 scoring tests pass after the fix
- **Commit:** `16596ff3` (part of GREEN commit; the regex narrowing landed alongside the impl)

**2. [Rule 2 - Missing Critical] D19_MIN_SAMPLE statistical floor added**

- **Found during:** Task 3 RED phase test design
- **Issue:** CONTEXT.md D-19 specifies the 100-fire rolling window and the 30% threshold but does NOT specify a minimum sample size. Without a floor, isThrottledKind would trip on noise (1-of-2 = 50% throttles a detector after its first 2 fires).
- **Fix:** Added `D19_MIN_SAMPLE = 10` constant; isThrottledKind returns false when `fired.length < D19_MIN_SAMPLE`. Test 11a asserts this prevents premature throttling.
- **Files modified:** `lib/core/breakthrough/scoring.cjs` (1 constant export + 1 guard line); `lib/core/breakthrough/scoring.test.cjs` (Test 11a + Test 14)
- **Verification:** Test 11a passes with 3 surfaced + 2 dismissed (66% rate but below sample floor)
- **Commit:** `16596ff3`

**3. [Rule 3 - Blocking] Test file em-dash regex requires literal pattern**

- **Found during:** post-GREEN em-dash audit
- **Issue:** The em-dash HARD RULE applies to production code. Test 13 itself greps for the literal U+2014 character in `scoring.cjs` -- this means `scoring.test.cjs` MUST contain one literal U+2014 char (the search pattern). Running `grep -c '<U+2014>' lib/core/breakthrough/scoring.test.cjs` returns 1.
- **Fix:** This is the same pattern Plan 120-00 hit (Deviation 2 in 120-00-SUMMARY.md): the test source contains documentation/regex prose for a forbidden pattern, which by definition contains the pattern. The success criteria specifies `grep -c '<U+2014>' lib/core/breakthrough/scoring.cjs` (production file only, NOT the test) -- which returns 0. The scaffold harness Gate 8 scans the renderer + scoring.cjs + the harness self, NOT the test files, also returns 0. Acceptance criterion #6 specifies the 3-file scan: scoring.cjs + renderer + harness -- all 0.
- **No code changes needed** -- this is intentional, mirrors Plan 120-00's narrowed Test 12 pattern, and aligns with how Canon Part 8 tripwires consistently treat source-grep tests.

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 documentation clarification).
**Impact on plan:** All auto-fixes essential. No scope creep. Plan 120-02 (Plan 120-03) consume scoring.cjs's API surface as designed.

## Authentication Gates

None. Plan 120-01 is a pure-substrate plan (no external APIs, no auth).

## Verification Evidence

### Test count totals

| File | Tests | Status |
|------|-------|--------|
| `lib/hmi/shape-f7-breakthrough-renderer.test.cjs` | 17 + 1 bonus | green (17/17) |
| `lib/core/breakthrough/scoring.test.cjs` | 21 | green (21/21) |
| **TOTAL** | **38** | **all green** |

### Scaffold harness pass evidence

```text
$ bash tests/test-120-01-scaffold.sh
OK: 120-01 scaffold complete (F.7 dispatch + 5 verbs verbatim + 5-component scoring + zero Brain coupling + zero em-dashes)
```

All 8 gates green.

### Verbatim-lock invariants

```text
$ node -e "const s=require('./lib/core/breakthrough/scoring.cjs'); const w=s.SCORING_WEIGHTS; console.log(w.confidence + '/' + w.recency + '/' + w.differential + '/' + w.artifact_count_log + '/' + w.user_engagement_prior)"
0.4/0.2/0.2/0.1/0.1

$ node -e "const s=require('./lib/core/breakthrough/scoring.cjs'); console.log(s.RECENCY_HALF_LIFE_DAYS, s.D19_DISMISSAL_THRESHOLD, s.D19_FIRE_WINDOW, s.D19_MIN_SAMPLE)"
3 0.3 100 10
```

### Canon Part 8 source-grep evidence

```text
$ grep -E "require.+brain-client|fetch.+brain\.mindrian|cross.+room.+aggregat" lib/core/breakthrough/scoring.cjs lib/hmi/shape-f7-breakthrough-renderer.cjs
(zero matches)
```

### Em-dash HARD RULE evidence

```text
$ grep -c '<U+2014>' lib/core/breakthrough/scoring.cjs lib/hmi/shape-f7-breakthrough-renderer.cjs tests/test-120-01-scaffold.sh
lib/core/breakthrough/scoring.cjs:0
lib/hmi/shape-f7-breakthrough-renderer.cjs:0
tests/test-120-01-scaffold.sh:0
```

## D-19 Throttle Thresholds Verbatim

```javascript
const D19_DISMISSAL_THRESHOLD = 0.30;   // dismiss rate > 30% triggers throttle
const D19_FIRE_WINDOW = 100;            // rolling 100-fire window
const D19_MIN_SAMPLE = 10;              // statistical adequacy floor
```

Plan 120-02 session-start scanner calls `isThrottledKind(detector_kind, roomState)` BEFORE running each detector. If it returns true, that detector auto-downgrades to soft-fire-only until manually reviewed (per CONTEXT.md D-19 auto-throttle policy). The throttle event is logged as `breakthrough_throttled` (one of the 6 EVENT_TYPES strings landed in Plan 120-00 Task 1).

## F.7 Registration Discretion Call

The plan permitted the planner to pick the sub-shape ID. Three options:

| Option | Pros | Cons |
|--------|------|------|
| Reuse F.6 | Already in use for Plan Review Round | Breaks 88.2-06 contract; routing collision |
| Inline as F.6 alternative path | No new ID | Complex JTBD-state dispatch fork; brittle |
| **F.7 (chosen)** | Collision-safe; additive; mirrors 88.2-06 R1 invariant | None |

The F.7 choice mirrors the Phase 88.2-06 R1 invariant: collision-safe paths under the existing dispatcher pattern. F_SUBSHAPES grew 7 -> 8 entries (additive tail-append; mirrors the EVENT_TYPES additive idiom from Plan 120-00 + Plan 119-00 + Plan 117-00).

## Constitutional Invariants (LOAD-BEARING)

### D-10 mandatory-dismiss

Every F.7 render asserts F7_VERBS deep-equals the canonical array (including the literal `'Dismiss'` at F7_DISMISS_INDEX=3). The user can NEVER see an F.7 selector without a Dismiss exit. Without it the detector only learns from confirmations -- a classic engagement-optimizer failure where the loop drifts toward whatever the user accepts even if accuracy is degrading.

### D-20 HARD FLOOR provenance

```javascript
if (!bk || typeof bk !== 'object' || !Array.isArray(bk.artifact_ids) || bk.artifact_ids.length === 0) {
  return { error: 'provenance_required' };
}
```

Two structural enforcement points (defense in depth):
1. **Plan 120-00 schema.cjs** -- `writeBreakthrough` calls `validateProvenance` BEFORE the transaction opens. Failed validation = no write attempt.
2. **Plan 120-01 renderer (this plan)** -- `renderShapeF7Breakthrough` refuses to render. Even if a caller bypasses the schema layer, the surface layer still enforces the Cypher-provable invariant.

### Canon Part 8 zero-Brain-coupling

```text
$ grep -E "require.+brain-client|fetch.+brain\.mindrian" lib/hmi/shape-f7-breakthrough-renderer.cjs lib/core/breakthrough/scoring.cjs
(zero matches across both files)
```

Plan 120-01 makes ZERO Brain MCP calls. All reads route through `lib/core/navigation.cjs` (Canon Part 9 chokepoint).

### SCORING_WEIGHTS sum to exactly 1.0

```text
$ node -e "const s=require('./lib/core/breakthrough/scoring.cjs'); console.log(Math.abs(Object.values(s.SCORING_WEIGHTS).reduce((a,b)=>a+b,0) - 1.0) < 1e-9)"
true
```

## Issues Encountered

None. RED -> GREEN -> scaffold landed cleanly. The Test 12 regex narrowing was discovered during the first GREEN run (test failed because regex required `'navigation'` literal at end-of-quote); fixed inline and re-verified green within the same iteration.

## User Setup Required

None. Plan 120-01 ships pure CJS modules with zero new runtime dependencies. No external services, no env vars, no API keys.

## Next Phase Readiness

- **Plan 120-02 (session-start scanner)** is unblocked. It consumes:
  - `pickTopWithAffordance(candidates, roomState, nowMs)` -- to pick the top-1 surface candidate
  - `isThrottledKind(kind, roomState)` -- BEFORE running each detector
  - `lib/hmi/selector-dispatcher.cjs::pickShape({requestedShape:'F.7', ...})` -- to render the surfaced breakthrough
- **Plan 120-03 (ethics fence + cooldowns)** is unblocked. It consumes `getUserEngagementPrior(kind, roomState)` for confirm/dismiss feedback shaping.
- **Phase 121.5 terminal-coherence-capstone** can include F.7 in the surface-coherence sweep (no new work needed; the dispatcher envelope is byte-stable).
- **No blockers** for v1.13.0 final release gate.

## Self-Check: PASSED

All deliverable files present on disk:
- `lib/hmi/shape-f7-breakthrough-renderer.cjs` -- FOUND
- `lib/hmi/shape-f7-breakthrough-renderer.test.cjs` -- FOUND
- `lib/hmi/selector-dispatcher.cjs` (modified) -- FOUND with F_SUBSHAPES 8 entries + F.7 branch
- `lib/core/breakthrough/scoring.cjs` -- FOUND
- `lib/core/breakthrough/scoring.test.cjs` -- FOUND
- `tests/test-120-01-scaffold.sh` -- FOUND, executable
- `lib/memory/run-feynman-tests.cjs` (modified) -- FOUND with Phase 120-01 block at TEST_FILES tail

All 5 commits present:
- `2faf85c1` (Task 1 renderer)
- `18b1bde1` (Task 2 dispatcher)
- `c7caf53c` (Task 3 RED)
- `16596ff3` (Task 3 GREEN)
- `5efd231b` (Task 3 scaffold + Feynman runner)

All acceptance criteria verified:
- `node --test lib/core/breakthrough/scoring.test.cjs` -> 21/21 pass
- `node --test lib/hmi/shape-f7-breakthrough-renderer.test.cjs` -> 17/17 pass
- `bash tests/test-120-01-scaffold.sh` -> exit 0, all 8 gates green
- `SCORING_WEIGHTS` prints `0.4/0.2/0.2/0.1/0.1`
- `weights sum to 1.0` -> `true`
- `RECENCY_HALF_LIFE_DAYS` -> `3`
- `grep -c "require.*brain-client" lib/core/breakthrough/scoring.cjs` -> `0`
- `grep -c '<U+2014>' lib/core/breakthrough/scoring.cjs lib/hmi/shape-f7-breakthrough-renderer.cjs tests/test-120-01-scaffold.sh | grep -v ":0$"` -> no output (all three at 0)
- `grep -c "D-11\|D-12\|D-19" lib/core/breakthrough/scoring.cjs` -> 8+ matches (decision-ID provenance comments)

## Self-Check: PASSED

Files exist on disk (6/6):
- FOUND: lib/hmi/shape-f7-breakthrough-renderer.cjs
- FOUND: lib/hmi/shape-f7-breakthrough-renderer.test.cjs
- FOUND: lib/hmi/selector-dispatcher.cjs (modified)
- FOUND: lib/core/breakthrough/scoring.cjs
- FOUND: lib/core/breakthrough/scoring.test.cjs
- FOUND: tests/test-120-01-scaffold.sh (executable)

Commits exist in git history (5/5):
- FOUND: 2faf85c1 (Task 1 renderer)
- FOUND: 18b1bde1 (Task 2 dispatcher)
- FOUND: c7caf53c (Task 3 RED)
- FOUND: 16596ff3 (Task 3 GREEN)
- FOUND: 5efd231b (Task 3 scaffold + Feynman runner)
