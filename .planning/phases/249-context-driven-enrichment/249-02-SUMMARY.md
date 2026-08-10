---
phase: 249-context-driven-enrichment
plan: 02
subsystem: api
tags: [brain, memgraph, cypher, eval-harness, tdd, red-proof, mcp, cjs, esm]

# Dependency graph
requires:
  - phase: 247-brain-surface-contract-02
    provides: "lib/core/brain-client.cjs loop-tool wrappers + tier_denied sentinel; contracted client path to all 6 loop tools"
provides:
  - "ProblemsWorthSolving-Brain: additive dimensions vector on orchestration_readiness (T6), hermetically proven"
  - "ProblemsWorthSolving-Brain: known-answer eval harness (checkFrameworkEval) + first fixture + 8 in-suite sabotage red proofs + live probe leg"
  - "MindrianOS-Plugin: scripts/check-flagship-floor.cjs, the SWEEP-02 gate instrument, with a filed honest 24/28-miss baseline"
affects: [249-context-driven-enrichment-03, 252]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure envelope-builder extraction (buildReadinessEnvelope) so an additive server-side field is hermetically provable without a live Memgraph connection -- Cypher CASE arithmetic unchanged, JS wrapping isolated and unit-tested with fabricated rows"
    - "Checker-owned-by-script convention: the pure eval checker (checkFrameworkEval) lives in the script that also drives the live leg (scripts/probe-framework-evals.mjs), and the hermetic test file imports it -- mirrors the repo's own compare-text2cypher.mjs / eval-gate-can-fail.test.mjs precedent, so both legs run the literal same function"
    - "Gate-logic-as-pure-function: scripts/check-flagship-floor.cjs's evaluateFloor(frameworks, probeResults) takes probe results in and verdicts out, zero network, so the hermetic suite injects fixtures and the CLI main() wires live brainCall over the identical function"
    - "Denominator honesty as a printed header, never a silent pick: both floor-set candidates (frontmatter scan vs canon prose) print every run until a ratified override file exists"

key-files:
  created:
    - /home/jsagi/dev/ProblemsWorthSolving-Brain/tests/eval-framework-structure.test.mjs
    - /home/jsagi/dev/ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/beautiful-question.json
    - /home/jsagi/dev/ProblemsWorthSolving-Brain/scripts/probe-framework-evals.mjs
    - scripts/check-flagship-floor.cjs
    - tests/test-249-floor-gate.cjs
  modified:
    - /home/jsagi/dev/ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs
    - /home/jsagi/dev/ProblemsWorthSolving-Brain/tests/arm1-orchestrator.test.mjs

key-decisions:
  - "T6 dimensions hermetic proof required a small refactor beyond 'a few RETURN lines': extracted buildReadinessEnvelope(framework_name, row) as a pure exported function so the additive shape is unit-testable with fabricated rows, since this dev machine has no live Memgraph bolt endpoint reachable (the repo's own arm1-orchestrator.test.mjs is otherwise 100% live-integration, skip-without-backend). Cypher arithmetic is byte-identical (same CASE expressions, now named before summing instead of summed inline) -- zero behavior change, purely a JS-side wrapping refactor."
  - "checkFrameworkEval and discoverFixtures live in scripts/probe-framework-evals.mjs (not a new tests/helpers file) so the live leg and the hermetic suite run the literal identical function -- mirrors the repo's own scripts/compare-text2cypher.mjs <- tests/eval-gate-can-fail.test.mjs pattern rather than inventing a new shared-helper location."
  - "check-flagship-floor.cjs's evaluateFloor treats a framework with NO probe entry as a MISS (never silently dropped from the row set) -- every enumerated framework, probed or not, produces a row, so a probe outage cannot quietly shrink the reported denominator."

requirements-completed: [ENRICH-02, ENRICH-04]

# Metrics
duration: ~55min
completed: 2026-08-10
---

# Phase 249 Plan 02: Context-Driven Enrichment - Dimensions, Eval Harness, Floor Gate Summary

**Additive dimensions vector on the Brain's orchestration_readiness (hermetically proven via a pure envelope-builder extraction), a known-answer eval harness with 8 in-suite sabotage red proofs plus an honest live PENDING-DEPLOY leg, and scripts/check-flagship-floor.cjs filing the exact 24/28-miss ENRICH-04 baseline the research predicted.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-10T14:38:00Z (approx, first Read call)
- **Completed:** 2026-08-10T15:34:16Z
- **Tasks:** 3/3 completed
- **Files modified/created:** 7 (5 created, 2 modified) across two repos

## Accomplishments
- Brain repo: `orchestration_readiness` (T6) now returns an additive `dimensions: { pattern_type, structure, techniques, flow }` vector, each exactly 0|1, summing to `readiness_score` on every fixture -- proven hermetically (zero network) via a pure `buildReadinessEnvelope` export, since no live Memgraph bolt endpoint is reachable from this machine.
- Brain repo: `checkFrameworkEval` known-answer checker + `beautiful-question.json` fixture (authored from a live read-tier probe, `_fixture_class: graph_regression`) + `scripts/probe-framework-evals.mjs` live leg. 13 hermetic tests including 8 in-suite sabotage red proofs, all demonstrated failing before being fixed to pass.
- Live probe leg executed once, read-only: beautiful-question.json content checks PASS, dimensions correctly marked PENDING-DEPLOY (Task 1's server field is unpushed by design).
- Plugin repo: `scripts/check-flagship-floor.cjs`, the SWEEP-02 gate instrument, with 13 hermetic tests including 2 in-suite sabotage red proofs (one score, one multi-match name) that turn an all-green fixture fully red.
- Filed the mandatory live baseline RED run: **4/28 passing, 24/28 missing the floor**, exit code 1 -- an exact match to the research's predicted bucket, both denominators printed, ratification held OPEN.
- All three brain-repo commits stayed local, unpushed, per the plan's coordination rule (deploy rides 249-03's operator checkpoint).

## Task Commits

Each task was committed atomically, both with full TDD RED -> GREEN cycles:

1. **Task 1 RED+GREEN (brain repo, local, unpushed): dimensions vector** - `efedd9a` (feat) -- includes the RED test extension in the same commit per the plan's single-task-commit protocol (RED demonstrated live, not committed separately, since the whole task is one behavior)
2. **Task 2 RED+GREEN (brain repo, local, unpushed): eval harness + fixture + live probe** - `7952494` (feat)
3. **Task 3 RED+GREEN (plugin): check-flagship-floor.cjs + hermetic test + filed baseline** - `bb414fa4` (feat)

_No plan-metadata-only commit yet -- this SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md land in the final commit below._

## TDD Gate Compliance

All three tasks carry `tdd="true"`. RED was demonstrated live before GREEN in every case (run, observed failing, then implemented):

- **Task 1:** `node --test tests/arm1-orchestrator.test.mjs` against the test extension alone (before `buildReadinessEnvelope` existed) failed with `SyntaxError: The requested module '../src/arm1-orchestrator.mjs' does not provide an export named 'buildReadinessEnvelope'` -- a genuine RED via import failure, the same technique `eval-gate-can-fail.test.mjs` documents in this repo ("RED on the unfixed code: ... not exported (import fails)"). After implementing `buildReadinessEnvelope` + the Cypher RETURN additions: 5 pass (new hermetic dimensions tests), 9 skip (the file's pre-existing 9 live-integration guard tests, which skip identically with or without this change -- no live Memgraph bolt endpoint is reachable from this machine, confirmed by a direct `/dev/tcp` connect-refused probe before starting).
- **Task 2:** `node --test tests/eval-framework-structure.test.mjs` against the test file alone (before `scripts/probe-framework-evals.mjs` existed) failed identically via import failure. After implementing: 13/13 pass, including all 8 sabotage red-proof assertions (structure extra-member+shuffle, broken flow chain, below-floor readiness, mismatched dimensions, dropped chain member, both negative controls, missing `_fixture_class`) -- each demonstrated to actually flip `pass` to `false` and populate `failures[]`, not merely asserted in prose.
- **Task 3:** `node --test tests/test-249-floor-gate.cjs` against the test file alone (before `scripts/check-flagship-floor.cjs` existed) failed via import failure. After implementing: 13/13 pass, including both sabotage red proofs (a single score sabotaged 3->1, a single name sabotaged to a 2-match ambiguity) each independently demonstrated to flip an otherwise-all-green fixture's `exitCode` from 0 to 1.

## Files Created/Modified

**Brain repo** (`/home/jsagi/dev/ProblemsWorthSolving-Brain`, local commits, NOT pushed):
- `src/arm1-orchestrator.mjs` - T6 Cypher RETURN additively names its four existing CASE booleans (`dim_pattern_type`, `dim_structure`, `dim_techniques`, `dim_flow`) before summing them into `readiness_score` (byte-identical arithmetic); new pure `buildReadinessEnvelope(framework_name, row)` wraps them into `readiness.dimensions`
- `tests/arm1-orchestrator.test.mjs` - 5 new hermetic tests (fully-ready, partial, exhaustive-combo, null-row, BACKEND-field) + the existing T6 live guard extended to assert dimensions when a real backend is reachable
- `scripts/probe-framework-evals.mjs` - exports `checkFrameworkEval` (pure checker) and `discoverFixtures` (glob), plus a live-leg `main()`; status-honest wire shape ported from the plugin's `build-brain-census.cjs`/`probe-brain-contract.cjs`
- `tests/eval-framework-structure.test.mjs` - 13 hermetic tests including 8 in-suite sabotage red proofs
- `tests/fixtures/framework-evals/beautiful-question.json` - first fixture, `_fixture_class: graph_regression`, authored from a live read-tier probe this session

**Plugin repo** (`/home/jsagi/dev/MindrianOS-Plugin`):
- `scripts/check-flagship-floor.cjs` - the SWEEP-02 gate; pure `evaluateFloor` + `parseOverrideFile` + live CLI wiring over `build-brain-census.cjs`'s exported `scanMethodologyCommands`/`brainCall`/`BRAIN_URL`
- `tests/test-249-floor-gate.cjs` - 13 hermetic tests including 2 in-suite sabotage red proofs

## Dimensions Vector Shape (brain repo, local, unpushed)

```
readiness.dimensions: {
  pattern_type: 0 | 1,   // f.pattern_type IS NOT NULL AND f.pattern_type <> 'unknown'
  structure:    0 | 1,   // count(DISTINCT s) > 0 over HAS_PHASE|HAS_STAGE|HAS_PROCESS_STEP|HAS_STEP
  techniques:   0 | 1,   // count(DISTINCT tech) > 0 over USES_TECHNIQUE|EQUIPS_WITH
  flow:         0 | 1,   // count(DISTINCT flow) > 0 over structure -[:LEADS_TO]-> flow
}
```
`dimensions.pattern_type + dimensions.structure + dimensions.techniques + dimensions.flow === readiness.readiness_score` on every fixture (5 hermetic tests prove this, including an exhaustive walk of 9 representative 0/4..4/4 combinations). Pre-existing keys (`tool`, `backend`, `grounded`, `note`, `readiness.name`, `readiness.readiness_score`, `readiness.orchestration_status`) are byte-identical to the pre-249-02 envelope. Local sha: **`efedd9a`** (brain repo, `main`, unpushed).

## Floor-Gate Baseline Output (live, read-tier, filed in full)

```
Brain URL: https://pws-brain-mcp.onrender.com
Floor denominator: OPEN (navigator ratification pending, 249-03 Task 2). Candidate A (frontmatter scan, operating superset): 50 kind:methodology command(s) / 28 distinct framework(s). Candidate B (canon prose): 25 command(s).
Enumerated frameworks this run: 28

[MISS] Jobs to Be Done (JTBD) -- uses=5 matches=1 score=2/4
[MISS] Reverse Salient Analysis -- uses=5 matches=1 score=0/4
[MISS] Six Thinking Hats -- uses=4 matches=1 score=1/4
[MISS] HSI Semantic Surprise Analysis Assistant -- uses=3 matches=1 score=0/4
[MISS] PWS Triple Validation Compass -- uses=3 matches=1 score=2/4
[MISS] S-Curve Analysis -- uses=3 matches=1 score=0/4
[MISS] Adoption-Capacity Theory -- uses=2 matches=1 score=2/4
[MISS] PWS Value Proposition -- uses=2 matches=1 score=0/4
[MISS] Root Cause Analysis -- uses=2 matches=1 score=2/4
[MISS] Scenario Planning -- uses=2 matches=6 score=0/4
[MISS] Systems Thinking -- uses=2 matches=2 score=0/4
[MISS] The Pyramid Principle -- uses=2 matches=1 score=0/4
[PASS] Ackoff Pyramid -- uses=1 matches=1 score=3/4
[MISS] Adaptive Leadership -- uses=1 matches=1 score=0/4
[PASS] Beautiful Question Framework -- uses=1 matches=1 score=4/4
[MISS] Domain Selection -- uses=1 matches=1 score=2/4
[MISS] Dominant Design -- uses=1 matches=1 score=0/4
[MISS] Four Lenses of Innovation -- uses=1 matches=2 score=0/4
[MISS] Futures Wheel -- uses=1 matches=1 score=0/4
[MISS] Hypothesis-Driven Problem Solving -- uses=1 matches=1 score=2/4
[MISS] Knowns and Unknowns Matrix Framework -- uses=1 matches=1 score=2/4
[MISS] Lean Canvas -- uses=1 matches=1 score=0/4
[MISS] MECE (Mutually Exclusive, Collectively Exhaustive) -- uses=1 matches=1 score=0/4
[MISS] Mullins Model -- uses=1 matches=2 score=0/4
[MISS] PEST Analysis -- uses=1 matches=0 score=n/a/4
[PASS] Problem Definition Transformation Framework -- uses=1 matches=1 score=4/4
[MISS] Red Teaming -- uses=1 matches=2 score=0/4
[PASS] Usher's Model of Cumulative Synthesis -- uses=1 matches=1 score=3/4

Frameworks passing (exactly-1 match AND readiness>=3): 4/28
Frameworks MISSING the floor: 24/28
=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===
```

**Exit code: 1** (confirmed non-zero). This is an exact match to 249-RESEARCH.md's predicted bucket: the same 4 passing frameworks (Beautiful Question 4/4, Problem Definition Transformation 4/4, Ackoff Pyramid 3/4, Usher's Model 3/4), the same absent node (PEST Analysis, 0 matches), and the same 5 multi-match ambiguities (Scenario Planning 6, Systems Thinking/Four Lenses/Mullins/Red Teaming 2 each). This is the honest ENRICH-04 starting line, filed as required -- a green run today would have meant the gate cannot fail.

`run-all-249.sh` (landed by the concurrent 249-01 executor mid-session) auto-discovered `test-249-floor-gate.cjs` by glob and ran it green, confirmed after Task 3's commit: `Phase 249: PASS=5 FAIL=0 SKIP=0`.

## Decisions Made

See `key-decisions` in the frontmatter above. Summarized:
1. Extracted `buildReadinessEnvelope` as a pure function (rather than leaving the envelope construction inline) so Task 1's "hermetically proven" requirement could be satisfied without a live Memgraph connection, which this machine does not have (confirmed by a direct `/dev/tcp/127.0.0.1/7690` connect-refused probe -- the bolt endpoint lives on a separate workstation per the brain repo's own CLAUDE.md).
2. `checkFrameworkEval`/`discoverFixtures` live in the script (not a new `tests/helpers/` file) so both legs run the identical function, matching the repo's own `compare-text2cypher.mjs` precedent.
3. `evaluateFloor` treats an un-probed framework as a MISS rather than silently excluding it from the row count.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical, found during Task 1] Hermetic proof required extracting a pure envelope-builder, not just adding RETURN fields**
- **Found during:** Task 1, attempting to satisfy the must_haves' "hermetically proven" requirement
- **Issue:** The plan's action text describes "a few additive lines" in the Cypher RETURN plus the JS envelope, but `tests/arm1-orchestrator.test.mjs` is a 100%-live-integration file (all 9 pre-existing tests skip without `GRAPH_BACKEND=memgraph` and a reachable bolt endpoint) -- confirmed no such endpoint is reachable from this machine. A same-file test that only exercises the live-guarded `orchestrationReadiness()` function cannot demonstrate a genuine RED->GREEN cycle in this environment (SKIP is not FAIL), and cannot hermetically prove the additive-shape claim at all.
- **Fix:** Extracted `buildReadinessEnvelope(framework_name, row)` as a small, separately-exported pure function performing only the envelope wrapping (unchanged Cypher arithmetic, byte-identical thresholds). 5 new hermetic tests exercise it directly against fabricated rows (full/partial/exhaustive-combo/null), independent of live-backend reachability. The existing live T6 guard test was also extended to assert dimensions live, for when a real backend eventually runs this file.
- **Files modified:** `src/arm1-orchestrator.mjs`, `tests/arm1-orchestrator.test.mjs`
- **Verification:** RED demonstrated (import failure before the export existed), GREEN after (5 pass, 9 skip as before -- identical skip count/reason to pre-change baseline, confirming zero behavior regression to the live path)
- **Committed in:** `efedd9a` (Task 1 commit, brain repo)

---

**Total deviations:** 1 auto-fixed (Rule 2, missing critical -- a genuine hermetic proof mechanism, not present in the plan's literal "few lines" framing but required by its own must_haves text)
**Impact on plan:** In-scope of the plan's own explicit "hermetically proven" requirement. No architectural change to the graph or the tool contract; purely a JS-side refactor with identical Cypher arithmetic. No scope creep.

## Issues Encountered

- **No live Memgraph bolt endpoint reachable from this machine.** Confirmed via a direct `/dev/tcp/127.0.0.1/7690` probe (connection refused) before starting Task 1. This is expected per the brain repo's own CLAUDE.md ("Source of truth Docker container ... on a workstation") -- not a blocker, since the read-tier HTTP path to `pws-brain-mcp.onrender.com` (used for Task 2's fixture authoring and live probe leg, and Task 3's baseline run) was fully available via `~/.mindrian.env`. Only the brain repo's own live-integration test suite (`arm1-orchestrator.test.mjs`'s pre-existing 9 tests) is affected, and it already SKIPs (never fails) without that backend -- unchanged behavior, documented above as a deviation driving the hermetic-proof design.
- **12 pre-existing environmental test failures in the brain repo's full suite** (`npm test`, 512+13 tests): `D-01`/`D-02` holder-auth tests, `list_frameworks`/`framework_edges`/`framework_chain_slice` live tests, `Layer A` live stdio test, `l1-readonly-live.test.mjs`, `framework-edges-op-shape.test.mjs`, `D-11 /health` test, `brain_schema` version test, plus 2 documented `# TODO` markers the repo's own CLAUDE.md names explicitly ("Two todo entries print in every run"). All 12 are unrelated to `arm1-orchestrator.mjs` or `eval-framework-structure.test.mjs`; confirmed by name-matching against the brain repo's CLAUDE.md's own documented environmental-failure list before proceeding. Not introduced by this plan; not fixed (out of scope, Rule 1 does not apply -- these predate every file this plan touched).
- **249-01 landed concurrently mid-session** (parallel executor, `lib/core/enrichment-queue.cjs`, capture seams, `tests/run-all-249.sh`, `skills/brain-connector/SKILL.md`). Zero file overlap confirmed by `git status --short` before and after each of this plan's commits -- Task 3's files (`scripts/check-flagship-floor.cjs`, `tests/test-249-floor-gate.cjs`) were staged and committed individually, never via a broad `git add`, so no in-flight 249-01 work was swept into this plan's commits.

## User Setup Required

None - no external service configuration required. The live probe leg (Task 2) and the floor-gate baseline run (Task 3) both used the pre-existing read-tier key at `~/.mindrian.env`; no admin key was used or required anywhere in this plan, per its explicit constraint.

## Next Phase Readiness

- **249-03** can now: (1) push the two reconciled brain-repo commits from this plan (`efedd9a` dimensions, `7952494` eval harness) alongside 247-03's own push, sequenced per the plan's coordination rule; (2) redeploy Render and re-run `node scripts/probe-framework-evals.mjs` until dimensions flips from PENDING-DEPLOY to `checked`; (3) hold its Task 2 denominator-ratification checkpoint (`data/flagship-floor-set.json` is the only legal producer, still absent); (4) begin ENRICH-04's per-framework enrichment batches against the filed 24-miss baseline, using `scripts/check-flagship-floor.cjs` as the live re-run gate after each batch.
- **252 (SWEEP-02)** now has its gate artifact (`scripts/check-flagship-floor.cjs`) and its honest starting line (4/28) on record; the gate cites this script's green run as its own completion evidence per the roadmap.
- No blockers for 249-03 or 252 against this plan's commits. The brain-repo commits remain local and unpushed by design, awaiting 249-03's operator checkpoint.

---
*Phase: 249-context-driven-enrichment*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 8 files created/modified confirmed present on disk (5 in the brain repo,
2 in the plugin repo, this SUMMARY.md). All 3 commit hashes (`efedd9a`,
`7952494` in the brain repo; `bb414fa4` in the plugin repo) confirmed present
in `git log --oneline --all` of their respective repositories.
