---
quick_id: 260910-dk1
phase: quick-260910-dk1
plan: 01
subsystem: intelligence-layer
tags: [intel-pipeline, research-pipe, contract-fix, tdd, hermetic-test]
dependency-graph:
  requires: []
  provides:
    - "lib/core/intel-pipeline.cjs defaultResearchFn: one-object extractContext call + camelCase lensSet"
    - "lib/core/intel-pipeline.cjs runIntelPipeline: _extractor / _lensDriver test seams"
    - "lib/core/intel-pipeline.cjs _internal.defaultResearchFn test export"
    - "tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs hermetic regression"
    - "tests/run-all-223.sh leg pinning the fixed contract"
  affects:
    - "/mos:intel-pipeline CLI command path (the shipped, non-injected research pipe)"
tech-stack:
  added: []
  patterns:
    - "researchCtx seam threading (_extractor, _lensDriver) mirroring the existing researchFn/computeFn/writeFn injectable seams"
    - "_internal export convention (45 files under lib/ already use it) for a private test-only surface"
key-files:
  created:
    - tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs
  modified:
    - lib/core/intel-pipeline.cjs
    - lib/mcp/tool-router.cjs
    - tests/run-all-223.sh
  moved:
    - ".planning/todos/pending/2026-09-10-intel-pipeline-fan-halt-lens-key-mismatch.md -> .planning/todos/completed/2026-09-10-intel-pipeline-fan-halt-lens-key-mismatch.md"
decisions:
  - "Topic derivation: ctx.handle (roster cell's GENERIC public entity handle) wins when present, else the dimension label -- both are generic methodology/entity handles per Canon Part 8, never room content."
  - "Quick-plan naming for the new test file (tests/test-quick-260910-dk1-...) rather than a test-223-* name, since run-all-223.sh's run_if helper takes an explicit path and does not glob."
  - "No _fetchCorpus pass-through added on the fan seam: the fan has no corpus seam of its own, and adding one would put a fetch(-shaped token on an executable line, forbidden by the run-all-223.sh Part 8 sweep in this file."
metrics:
  duration: "~45 minutes"
  completed: "2026-09-10"
---

# Quick Task 260910-dk1: Fix intel-pipeline research pipe contract Summary

Fixed `defaultResearchFn` in `lib/core/intel-pipeline.cjs` to call `extractContext` with one object (not positionally) and hand the driver camelCase `lensSet` (not the extractor's raw snake_case `lens_set`), mirroring `lib/mcp/tool-router.cjs`'s already-correct implementation; threaded two injectable seams (`_extractor`, `_lensDriver`) so the fix is testable with zero network, real extractor, or real lens engine.

## What Was Built

`/mos:intel-pipeline`'s shipped research pipe (the only broken caller of the extractContext/runSourceLens contract) was fanning out with zero lenses on every dimension: `defaultResearchFn` called `extractor.extractContext(context.roomDir, { dimension })` positionally against a function that takes exactly one object, so the extractor never saw `roomDir`; it then spread the extractor's snake_case `lens_set` into the driver via `Object.assign`, but the driver reads camelCase `opts.lensSet`, so `rawLensSet` was always `[]`. The driver's defensive `empty_lens_set` short-circuit (before any network fetch) meant every fan pass returned `quality: 'low'` with zero findings, and the pipeline's SEED-059 disclosure halted the whole fan on pass 1 -- reading as a silent halt with no meaningful research ever attempted.

Three edits fixed the contract in `lib/core/intel-pipeline.cjs`:
1. `defaultResearchFn` now resolves `_extractor`/`_lensDriver` from the researchCtx seams when supplied, derives one `topic` (the roster cell handle when present, otherwise the dimension label -- both generic handles per Canon Part 8), calls `extractContext({ roomDir, topic, db })` with one object, and calls `runSourceLens({ roomDir, topic, lensSet: extracted.lens_set, preflight: extracted.preflight, stage: 'explore', db, dimension })` with an explicit object (no snake_case leak).
2. `runIntelPipeline` copies `o._extractor` and `o._lensDriver` onto `researchCtx` per fan pass when they are plain objects, so the shipped pipe is exercisable end to end with injected spies and no real corpus fetch.
3. `module.exports` gained `_internal: { defaultResearchFn }`, the repo's existing test-export convention (45 files under `lib/` already use it).

A hermetic 228-line regression test (`tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs`, 4 behaviors, 34 checks) proves the fix and was confirmed RED (exit 1, `FAIL -` summary, 9 failing checks spanning all 4 behaviors, no stack trace) against the unmodified tree before the fix landed, then GREEN (exit 0, `PASS -` summary, 34/34) after. It now runs as a named leg of `tests/run-all-223.sh` immediately after the existing `223-04 intel-pipeline` leg. Comment-only cross-references were added in both `lib/core/intel-pipeline.cjs` (naming `lib/mcp/tool-router.cjs` as the sibling caller of the same contract) and `lib/mcp/tool-router.cjs` (pointing back at `defaultResearchFn`), per Canon Part 7 -- the two callers must change together until a shared adapter exists. The closed todo moved from `.planning/todos/pending/` to `.planning/todos/completed/` with a resolution note.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write the failing hermetic regression test | `d976879a` | `tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs` |
| 2 | Fix defaultResearchFn, thread seams, expose _internal | `ec00497e` | `lib/core/intel-pipeline.cjs` |
| 3 | Wire the leg into run-all-223.sh, cross-link the contract | `eef4f021` | `tests/run-all-223.sh`, `lib/mcp/tool-router.cjs`, `.planning/todos/completed/2026-09-10-intel-pipeline-fan-halt-lens-key-mismatch.md` (moved from `pending/`) |

## RED / GREEN Proof (TDD Gate)

**RED** (Task 1, before the fix, against unmodified `lib/core/intel-pipeline.cjs`):
```
FAIL - test-quick-260910-dk1-intel-pipeline-lens-contract: 1 passed, 9 failed
```
9 failing checks spanned all four behaviors: Behavior 1/2 reported `NOT OK - exposes _internal.defaultResearchFn` (guarded, no throw); Behavior 3 reported the driver spy was never called and `lensSet` was never non-empty; Behavior 4 failed its `lensSet:` and `extractContext({` structural assertions. Exit code 1, no stack trace in output.

**GREEN** (Task 2, after the fix):
```
PASS - test-quick-260910-dk1-intel-pipeline-lens-contract: 34 passed, 0 failed
```
Exit code 0. `tests/test-223-intel-pipeline.cjs` stayed green (`PASS - test-223-intel-pipeline: 39 passed, 0 failed`, including Behavior 6's source-structure assertions), and `tests/test-265-intel-roster-fan.cjs` stayed green (`PASS - test-265-intel-roster-fan: 24 passed, 0 failed (7 arms)`).

## Regression Guards (Plan-Pinned)

- `node tests/test-223-intel-pipeline.cjs` -- exit 0, 39/39
- `node tests/test-265-intel-roster-fan.cjs` -- exit 0, 24/24 (7 arms)
- `bash tests/run-all-223.sh` -- `Phase 223: PASS=18 FAIL=1 SKIP=0`. The new `quick-260910-dk1 intel-pipeline lens contract` leg reports `PASSED`. The one `FAIL` (`DESENSITIZE asymmetry: bono command SENS-05 vs mirror []`, `commands/bono.md lost its SENS-05 sensor trigger`) is a **pre-existing failure unrelated to this plan** -- `commands/bono.md` was last touched by commit `31c7fe17` (`274-02`), and this quick task never reads or writes that file. Part 8 sweep, Part 9 sweep, D-03 sweep, Req 6 sweep, dependency-diff, and both `doctor --acceptance` legs (Req 5 and Req 7) all reported `PASSED`, the latter naming only the documented pre-existing baseline gap (`verify-release-clean-tree`).

## Deviations from Plan

**1. [Rule 1 - correctness of acceptance criteria] Avoided embedding a literal em-dash byte in the test file's own em-dash structural check**
- **Found during:** Task 1, while confirming RED and running the acceptance-criteria greps.
- **Issue:** The plan's Behavior 4 structural check ("read `lib/core/intel-pipeline.cjs` as text ... contains no em-dash") naturally mirrors `tests/test-223-intel-pipeline.cjs`'s existing `!/—/.test(src)` idiom, but writing that regex literal puts an em-dash byte (`\xe2\x80\x94`) inside the new test file itself -- which then fails the plan's OWN acceptance criterion `grep -c $'\xe2\x80\x94' tests/test-quick-260910-dk1-....cjs` returning 0 (confirmed test-223-intel-pipeline.cjs's identical idiom would also fail that specific grep, though it predates this plan and is not gated by it).
- **Fix:** Used `/—/.test(src)` (a Unicode escape) instead of a literal em-dash character in the regex, which performs the identical structural check on the target file without embedding the literal byte in this new test file.
- **Files modified:** `tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs`
- **Commit:** `d976879a`

**2. [Rule 1 - acceptance criterion gap] Strengthened the `_internal` export comment so the plain-string `_internal` count reaches 2**
- **Found during:** Task 2, verifying acceptance criteria after the fix.
- **Issue:** The plan's acceptance criteria required `grep -c "_internal" lib/core/intel-pipeline.cjs` to return 2 or more ("the comment plus the export"), but the literal comment wording the plan specified ("exposed for tests (private; do NOT consume in production)", matching `source-lens-driver.cjs:725`'s wording) does not itself contain the substring `_internal` -- confirmed the reference file (`lib/lens-engine/source-lens-driver.cjs`) itself only greps to count 1 for the same pattern.
- **Fix:** Reworded the export comment to `// _internal.defaultResearchFn exposed for tests (private; do NOT consume in production)`, which both names the exact export path and satisfies the count-2 acceptance criterion.
- **Files modified:** `lib/core/intel-pipeline.cjs`
- **Commit:** `ec00497e`

No other deviations. Plan executed as written otherwise.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. The threat register in the plan (T-dk1-01 topic derivation, T-dk1-02 seam tampering, T-dk1-03 degrade-envelope DoS, T-dk1-SC supply chain) fully covers the surface touched; no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced. `topic` derivation strictly follows the plan's mitigation (roster cell handle or the LOCAL JTBD-dimension label; never room content), and the try/catch degrade envelope at `intel-pipeline.cjs:132-134` (asserted via the `research pipe unavailable` grep gate) is byte-identical to before.

## Self-Check: PASSED

- FOUND: `tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs`
- FOUND: commit `d976879a` (`git log --oneline --all | grep d976879a`)
- FOUND: commit `ec00497e` (`git log --oneline --all | grep ec00497e`)
- FOUND: commit `eef4f021` (`git log --oneline --all | grep eef4f021`)
- FOUND: `.planning/todos/completed/2026-09-10-intel-pipeline-fan-halt-lens-key-mismatch.md`
- MISSING (expected): `.planning/todos/pending/2026-09-10-intel-pipeline-fan-halt-lens-key-mismatch.md` (moved, confirmed absent)

## Post-review (2026-09-10)

- Code review (260910-dk1-REVIEW.md): no blockers. WR-01 (test left 4 temp dirs per run, 35 found after one
  run) fixed in b6830e1d: mkTmp now records every dir and cleanupTmp removes them before exit, mirroring
  test-223's rmSync idiom; re-run 34/34 with zero leftover dirs. IN-01 (the `dimension` field passed to
  runSourceLens is not read by the driver today) accepted as harmless intent-documenting; IN-02 (the
  _extractor/_lensDriver seam gate is shape-checked, not flag-gated) accepted: the seams are unreachable
  from MCP input and from every current caller; revisit if a programmatic caller is wired.
- Verification (260910-dk1-VERIFICATION.md): passed, 6/6 must-haves.
- The one FAIL in bash tests/run-all-223.sh (DESENSITIZE asymmetry, commands/bono.md) is pre-existing since
  274-02 and filed separately: .planning/todos/pending/2026-09-10-bono-desensitize-asymmetry-sens-05-mirror-empty.md
