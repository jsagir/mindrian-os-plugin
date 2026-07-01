---
phase: 188-f7-multiselect-toggleable-hitl
plan: 00
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/run-all-188.sh
  - lib/hmi/shape-f8-renderer.test.cjs
  - lib/hmi/f8-capture.test.cjs
  - lib/workflow/f8-consumer.test.cjs
  - lib/hmi/shape-f9-renderer.test.cjs
  - lib/workflow/f9-consumer.test.cjs
  - lib/hmi/shape-f3-parity.test.cjs
  - lib/hmi/shape-f4-parity.test.cjs
  - tests/test-canon-frozen-scalars-floor.cjs
  - tests/test-per-shape-coverage-gate-hardfail.cjs
autonomous: true
requirements: [SFS-01, SFS-02, SFS-03, SFS-04, SFS-05, SFS-08, SFS-09, SFS-10, SFS-11]
must_haves:
  truths:
    - "bash tests/run-all-188.sh runs and reports a PASS/FAIL summary (RED until impl lands)"
    - "Every net-new module has a *.test.cjs sibling that encodes its expected behavior"
    - "A frozen-scalar FLOOR test asserts MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15 unchanged"
    - "A per-shape coverage hard-fail test proves a synthetic missing shape exits 1"
  artifacts:
    - path: "tests/run-all-188.sh"
      provides: "The phase-188 verification aggregator (PASS/FAIL/SKIP)"
      contains: "run_if"
    - path: "tests/test-canon-frozen-scalars-floor.cjs"
      provides: "Frozen-scalar guard for the canon amendment (SFS-11)"
    - path: "tests/test-per-shape-coverage-gate-hardfail.cjs"
      provides: "Hard-fail proof the per-shape gate exits 1 on a missing shape (SFS-10)"
  key_links:
    - from: "tests/run-all-188.sh"
      to: "each *.test.cjs leg"
      via: "run_if leg registration"
      pattern: "run_if"
---

<objective>
Wave 0: create the Nyquist test scaffolding for Phase 188 so every downstream task
has an automated verify that fails RED before implementation and flips GREEN when the
module lands. This is the safety net the whole phase samples against.

Purpose: no task in Waves A-C ships without a < 5s automated check. The phase runner
`tests/run-all-188.sh` is the single gate `/gsd-verify-work` reads.
Output: the phase runner, seven behavior-encoding `*.test.cjs` stubs, and two FLOOR tests
(frozen scalars + per-shape coverage hard-fail).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<RULES>
Restated hard constraints (binding on every task in this plan):
- CJS only, node built-ins only (Phase 87 zero-dep invariant). No TypeScript. No new packages.
- NO em-dashes anywhere. Use hyphens.
- Tests are pure code: no network, no Brain wire, no agent, no live room.db mutation. A FLOOR
  test that needs a registry override uses the `spawnCheckWithRegistry` temp-file pattern
  (`tests/test-render-coverage-gate-hardfail.cjs`), never mutating a tracked file.
- Test stubs encode the EXPECTED behavior (RED now, GREEN when the module lands). A stub that
  cannot import its target module yet must fail loudly (assert the module exists), not skip silently.
- Module paths named in these stubs are the CONTRACT the later waves implement against. Do not
  rename them downstream.
</RULES>

<context>
@.planning/PROJECT.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-VALIDATION.md
@.planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md

# Models to clone
@tests/run-all-187.sh
@tests/test-render-coverage-gate-hardfail.cjs
@lib/hmi/f1-pick-capture-cli.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Phase runner + SFS-12 membrane grep leg</name>
  <read_first>
    - tests/run-all-187.sh (clone the skeleton verbatim: set -uo pipefail, ROOT, run()/run_if() helpers, PASS/FAIL/SKIP summary, `[ "$FAIL" -eq 0 ]` exit)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-VALIDATION.md (the leg list)
    - CLAUDE.md line 46 (the membrane line the SFS-12 grep asserts)
  </read_first>
  <files>tests/run-all-188.sh</files>
  <action>
    Clone `tests/run-all-187.sh` structure. Register `run_if` legs (SKIP-safe until each file exists)
    for: shape-f8-renderer.test.cjs, f8-capture.test.cjs, f8-consumer.test.cjs, shape-f9-renderer.test.cjs,
    f9-consumer.test.cjs, shape-f3-parity.test.cjs, shape-f4-parity.test.cjs, selector-dispatcher.test.cjs
    (F.7 branch, extended in 188-01), test-canon-frozen-scalars-floor.cjs, test-per-shape-coverage-gate-hardfail.cjs,
    plus the gate commands `node scripts/check-render-coverage.cjs` and `node scripts/check-hitl-stages.cjs`.
    Add an inline SFS-12 grep leg (a `run` leg calling a small inline check) asserting `CLAUDE.md` still
    contains the exact frozen-scalar membrane substring "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen" - filter
    comments are irrelevant here (grep the literal string, fail if absent). Use `run_if` for files not yet
    present so Wave 0 exits cleanly with SKIPs. bash only, no emoji, no em-dashes.
  </action>
  <verify>
    <automated>bash tests/run-all-188.sh; test $? -le 1</automated>
  </verify>
  <acceptance_criteria>
    <automated>bash tests/run-all-188.sh</automated>
  </acceptance_criteria>
  <done>Runner executes, prints a PASS/FAIL/SKIP summary, SFS-12 membrane grep leg passes against the current CLAUDE.md:46, missing test files SKIP (not error).</done>
</task>

<task type="auto">
  <name>Task 2: Renderer + parity behavior stubs (F.8, F.9, F.3, F.4)</name>
  <read_first>
    - lib/hmi/shape-f5-renderer.cjs (the {zones, contract} envelope the F.8/F.9 renderers emit)
    - lib/hmi/shape-f3-renderer.cjs and lib/hmi/shape-f4-renderer.cjs (closed-vocab, recommended:null, freeTextOffered:false)
    - .planning/phases/188-f7-multiselect-toggleable-hitl/188-PATTERNS.md (the F.8/F.9/F.3/F.4 pattern assignments)
  </read_first>
  <files>lib/hmi/shape-f8-renderer.test.cjs, lib/hmi/shape-f9-renderer.test.cjs, lib/hmi/shape-f3-parity.test.cjs, lib/hmi/shape-f4-parity.test.cjs</files>
  <action>
    Write behavior-encoding stubs (RED until the modules land):
    - shape-f8-renderer.test.cjs: require('./shape-f8-renderer.cjs'); assert renderShapeF8 returns
      {zones, contract} with contract.shape==='F.8', contract carries a multiSelect/toggle marker, NO single
      `recommended` marker (D-06), a MAX_TOGGLE_N-bounded-then-PAGED option set (assert paging when options
      exceed the ceiling), and toggle glyphs check / empty-sq (approved-12). Assert MAX_K is NOT referenced
      as the toggle bound.
    - shape-f9-renderer.test.cjs: require('./shape-f9-renderer.cjs'); assert renderShapeF9 emits one
      question per cascade item in ARRAY ORDER, options are the closed ordered-outcome set mapped onto the
      reused OUTCOMES enum (accept==APPROVE), recommended:null, freeTextOffered:false, and paging obligation
      when items exceed the ceiling. Assert NO code path constructs AskUserQuestion outside pickShape.
    - shape-f3-parity.test.cjs: require the F.3 depth capture + consumer + depth-state module; assert a
      picked depth value ('Shallow'..'Extreme') is written to depth-state and readable via getCurrent; assert
      NO marker / NO Free-Text is added to F.3.
    - shape-f4-parity.test.cjs: require the F.4 scope capture + consumer + harvest-scope-state module; assert
      each progressive rung ADDS to the prior scope (accumulation, not replacement); assert closed-vocab
      preserved.
    Reference the exact module paths the later waves must implement:
    lib/hmi/f3-depth-capture-cli.cjs, lib/workflow/f3-depth-consumer.cjs, lib/hmi/depth-state.cjs,
    lib/hmi/f4-scope-capture-cli.cjs, lib/workflow/f4-scope-consumer.cjs, lib/hmi/harvest-scope-state.cjs,
    lib/hmi/f8-action-capture-cli.cjs, lib/hmi/f9-ordered-capture-cli.cjs.
  </action>
  <verify>
    <automated>node lib/hmi/shape-f8-renderer.test.cjs 2>&1 | grep -qiE 'cannot find module|assert' && echo RED-as-expected</automated>
  </verify>
  <acceptance_criteria>
    <automated>node -e "require('node:fs').accessSync('lib/hmi/shape-f8-renderer.test.cjs'); require('node:fs').accessSync('lib/hmi/shape-f9-renderer.test.cjs'); require('node:fs').accessSync('lib/hmi/shape-f3-parity.test.cjs'); require('node:fs').accessSync('lib/hmi/shape-f4-parity.test.cjs')"</automated>
  </acceptance_criteria>
  <done>Four stubs exist, each fails RED (module-not-found or unmet assertion) against the current tree, and each encodes the D-05/D-06/closed-vocab contract in its assertions.</done>
</task>

<task type="auto">
  <name>Task 3: Consumer stubs + two FLOOR tests</name>
  <read_first>
    - lib/workflow/f1-pick-consumer.cjs (Part 9 header: consumer NEVER opens room.db; caller passes roomState.db; closeOffer is the write)
    - tests/test-render-coverage-gate-hardfail.cjs (the spawnCheckWithRegistry temp-override pattern the per-shape hard-fail clones)
    - docs/MINDRIAN-CANON.md (grep the frozen scalars MAX_K=3 / DIAL_REACH_K=6 / 0.70 / 0.15 for the FLOOR test anchors)
  </read_first>
  <files>lib/workflow/f8-consumer.test.cjs, lib/workflow/f9-consumer.test.cjs, tests/test-canon-frozen-scalars-floor.cjs, tests/test-per-shape-coverage-gate-hardfail.cjs</files>
  <action>
    - f8-consumer.test.cjs: require('./f8-fanout-consumer.cjs'); assert N captured toggles produce N closeOffer
      calls on ONE confirm (mock roomState.db + spy closeOffer via the caller seam); assert the consumer does
      NOT require better-sqlite3 / node:sqlite and does NOT open room.db (grep its own source for forbidden
      requires); assert degrade-never-block per item (one bad toggle does not abort the set); assert the
      two-channel split (outcome keyword vs reach verb) is preserved.
    - f9-consumer.test.cjs: require('./f9-ordered-consumer.cjs'); assert APPROVE writes the edge, REJECT records
      NOT-applied + reason, DEFER leaves a CONTRADICTS-linked competing-claim pair (Decision 13 "rejection is
      data"); same Part-9 no-open-db source assertion.
    - test-canon-frozen-scalars-floor.cjs: read docs/MINDRIAN-CANON.md, assert the exact tokens MAX_K=3,
      DIAL_REACH_K=6, 0.70, 0.15 are present and byte-identical to their current form (capture the current
      surrounding phrase as the expected anchor). This test is the guard the canon amendment (188-05) must
      keep GREEN.
    - test-per-shape-coverage-gate-hardfail.cjs: clone the spawnCheckWithRegistry temp-file pattern; synthesize
      a scenario where one canonical shape (F.0-F.9) lacks a renderer/branch and assert the per-shape gate
      predicate exits 1 with a self-naming error. Until the per-shape predicate lands (188-03), this test may
      target the extension's exported predicate; write it so it flips GREEN when 188-03/188-07 wire the assertion.
  </action>
  <verify>
    <automated>node tests/test-canon-frozen-scalars-floor.cjs</automated>
  </verify>
  <acceptance_criteria>
    <automated>node tests/test-canon-frozen-scalars-floor.cjs</automated>
  </acceptance_criteria>
  <done>Two consumer stubs exist and encode the Part-9 no-open-db + fan-out + ordered-outcome contracts; the frozen-scalar FLOOR test PASSES against the current canon (it is the guard, so it must be green now); the per-shape hard-fail test exists and uses the temp-override pattern.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| test harness -> tracked files | A FLOOR test must never mutate a tracked file to force a pass |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-188-00-01 | Tampering | FLOOR tests writing to real registries/canon | mitigate | temp-file spawnCheckWithRegistry override; assertions read-only over tracked files |
| T-188-00-02 | Repudiation | a stub that green-washes (skips instead of asserting) | mitigate | stubs assert module presence + behavior; run_if SKIP is reported distinctly in the summary |
| T-188-00-SC | Tampering | npm/pip/cargo installs | accept | zero package installs this phase (Phase 87 zero-dep invariant); no supply-chain surface |
</threat_model>

<verification>
- `bash tests/run-all-188.sh` runs, exits 0 or 1 (SKIPs allowed in Wave 0), prints the summary.
- `node tests/test-canon-frozen-scalars-floor.cjs` exits 0 (guard green against current canon).
- Every stub fails RED against the current tree for the RIGHT reason (module-not-found / unmet assertion).
</verification>

<success_criteria>
- Phase runner + 7 module stubs + 2 FLOOR tests exist.
- SFS-12 membrane grep leg passes against current CLAUDE.md:46.
- Frozen-scalar FLOOR test is GREEN now (it is the guard for 188-05).
- No production module edited; no em-dashes; zero new dependencies.
</success_criteria>

## Artifacts this phase produces
- `tests/run-all-188.sh` (phase runner)
- `lib/hmi/shape-f8-renderer.test.cjs`, `lib/hmi/shape-f9-renderer.test.cjs`, `lib/hmi/shape-f3-parity.test.cjs`, `lib/hmi/shape-f4-parity.test.cjs`
- `lib/workflow/f8-consumer.test.cjs`, `lib/workflow/f9-consumer.test.cjs`
- `tests/test-canon-frozen-scalars-floor.cjs`, `tests/test-per-shape-coverage-gate-hardfail.cjs`
- Module-path CONTRACT for downstream waves: `f8-action-capture-cli.cjs`, `f8-fanout-consumer.cjs`, `f9-ordered-capture-cli.cjs`, `f9-ordered-consumer.cjs`, `f3-depth-capture-cli.cjs`, `f3-depth-consumer.cjs`, `depth-state.cjs`, `f4-scope-capture-cli.cjs`, `f4-scope-consumer.cjs`, `harvest-scope-state.cjs`

<output>
Create `.planning/phases/188-f7-multiselect-toggleable-hitl/188-00-SUMMARY.md` when done
</output>
