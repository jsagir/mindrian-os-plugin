# Phase 129 Deferred Items

Out-of-scope discoveries logged during Phase 129 execution. Per the executor
SCOPE BOUNDARY rule these are NOT fixed in this phase.

## DI-129-05-01 -- Pre-existing Phase 122 e2e Canon Part 8 proximity-scan failure

- **Discovered during:** Plan 129-05 Task 2 zero-regression sweep.
- **Symptom:** `node lib/memory/workflow-layer-e2e.test.cjs` exits 1 with
  `AssertionError: a /mos: command literal appears within ~80 chars of a
  brain/query/fetch/http token in lib/workflow/selector-decisions.cjs -- a Canon
  Part 8 breach signal`. `bash tests/run-all-122.sh` reports 3/5 (also
  `test-command-registry.cjs` RED, flagged RED-by-design in the 122 runner header).
- **Pre-existing:** PROVEN. With all Phase 129 changes stashed away, the test
  still exits 1 on clean `main` HEAD. Neither file I could be blamed for was
  touched by Phase 129: `lib/workflow/selector-decisions.cjs` was last modified by
  commit `40aafda3` (feat(125-07): recordSelectorMiss), and
  `lib/memory/workflow-layer-e2e.test.cjs` by `6d634ad4` (feat(122-05)). Phase 129
  touched only `tests/test-129-*.cjs`, `tests/fixtures/phase-129/`,
  `tests/run-all-129.sh`, and the additive Phase 129 block in
  `lib/memory/run-feynman-tests.cjs`.
- **Why out of scope:** The proximity-scan is a Phase 122 (workflow-layer) Canon
  Part 8 tripwire reacting to text in a Phase 125 selector module. It is unrelated
  to the Phase 129 spine memory_event arc. Fixing it requires reasoning about the
  Phase 122/125 selector wording, not the Phase 129 substrate.
- **Disposition:** DEFER. Recommend a dedicated `/gsd:debug` session scoped to
  `lib/workflow/selector-decisions.cjs` to either re-space the offending literal
  or refine the proximity heuristic. The Phase 109 navigation acceptance test
  (the substrate Phase 129 extends) passes clean -- zero regression on the surface
  Phase 129 owns.
