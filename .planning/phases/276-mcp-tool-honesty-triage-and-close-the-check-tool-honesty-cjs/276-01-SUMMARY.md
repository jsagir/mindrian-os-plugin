---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 01
subsystem: testing
tags: [mcp-tool-honesty, check-tool-honesty, tdd-red, node-assert, bash-aggregator]

# Dependency graph
requires: []
provides:
  - "tests/run-all-276.sh, the glob-discovery aggregator every later 276 plan registers into by adding a tests/test-276-* file, no runner edit needed"
  - "tests/fixtures/tool-honesty/switch-dispatch.cjs, the synthetic switch (command) fixture with one writing case and one echo case"
  - "tests/test-276-tool-honesty-switch-branches.cjs, the RED proof for TOOLHON-01 (D-1, the dead branch splitter) and the TOOLHON-05 boundary enumeration assertion, observed FAILING against the pre-fix scripts/check-tool-honesty.cjs"
affects: ["276-02", "276-03", "276-04", "276-06 (must flip this exact RED command to exit 0)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Glob-discovery test aggregator (tests/run-all-273.sh / tests/run-all-274.sh shape): found-eq-0 guard provable via a TEST_276_PREFIX override, Part 8 source sweep, no-em-dash fence"
    - "RED-then-GREEN in separate commits: the RED test + fixture land in one commit containing no production file, observed failing, matching the 209b604f / 75278850 precedent"
    - "Reproducing an unexported internal helper (extractHandlerBody) from a script's own exported primitives (maskNonCode, scanBalanced, splitTopLevelArgs, extractStringLiteralConcat) inside a test, rather than duplicating its logic against source text"

key-files:
  created:
    - tests/run-all-276.sh
    - tests/fixtures/tool-honesty/switch-dispatch.cjs
    - tests/test-276-tool-honesty-switch-branches.cjs
  modified: []

key-decisions:
  - "Assertion 1 (branch-split proof) calls scripts/check-tool-honesty.cjs's exported splitBranches directly on a handler body located via the exported text-scanning primitives, rather than asserting on scanAll() rows -- scanAll() always produces one row per vocabulary command regardless of whether branchMap actually split anything (rows iterate the schema's z.enum vocabulary, not the branchMap keys), so a rows-presence assertion would have passed today and hidden the bug it exists to catch."
  - "The false-verification comment assertion (scripts/check-tool-honesty.cjs:559-565) checks the raw source for the literal substring \"verified against real fall-through\" without stripping comments first, because the assertion is ABOUT a comment's own claim, not a count literal that a stray comment could self-invalidate."

requirements-completed: [TOOLHON-01, TOOLHON-05]

# Metrics
duration: 6min
completed: 2026-09-03
---

# Phase 276 Plan 01: Wave 0 Test Infrastructure Summary

**Built the glob-discovery aggregator, the synthetic switch(command) fixture, and the RED proof that scripts/check-tool-honesty.cjs's splitBranches never actually splits a switch-dispatched branch -- pinning D-1, the phase's headline detector defect, before any production code moves.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-03T16:48:36Z
- **Completed:** 2026-09-03T16:54:32Z
- **Tasks:** 3 completed
- **Files modified:** 3 (all new)

## Accomplishments

- `tests/run-all-276.sh` exists, is executable, passes `bash -n`, and its found-eq-0 guard is proven non-zero-exiting via `TEST_276_PREFIX=test-276-nonexistent-prefix-` rather than merely asserted.
- `tests/fixtures/tool-honesty/switch-dispatch.cjs` is a scannable synthetic MCP tool (`fixture_switch`) with a top-level `switch (command)` over a two-value `z.enum`, one writing case (`fs.writeFileSync`) and one echo case.
- `tests/test-276-tool-honesty-switch-branches.cjs` proves D-1 directly against `splitBranches` (not merely through `scanAll()` rows, which iterate vocabulary independent of the bug and would have passed today), against the live `room_content` handler, and enumerates the TOOLHON-05 boundary gap -- all four required assertions are observed FAILING pre-fix.
- The RED commit contains exactly the test file and its fixture, verified via `git diff --cached --name-only` before commit and `git show --stat HEAD` after; zero files under `scripts/` touched by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: tests/run-all-276.sh, the glob-discovery aggregator** - `45412642` (test)
2. **Task 2 + Task 3: the switch-dispatch fixture and the RED splitter proof** - `4c4f98a3` (test) -- per the plan's own instruction, Task 2's fixture is not committed alone; it lands together with Task 3's test in one commit, matching the `209b604f` precedent where the test and its fixtures landed as one commit.

_No plan-metadata commit issued yet; this SUMMARY and the STATE/ROADMAP updates land in the state_updates + final_commit steps below._

## Files Created/Modified

- `tests/run-all-276.sh` - Phase 276 test aggregator: glob-discovers `tests/test-276-*`, hard-fails on zero discovery, sweeps this phase's six production targets for Brain/network egress tokens, fences the same targets against the em-dash codepoint.
- `tests/fixtures/tool-honesty/switch-dispatch.cjs` - synthetic MCP tool `fixture_switch`, `switch (command)` over `write-thing` (writes) / `echo-thing` (no write), the shape the checker's four-positional-argument `server.tool(` reader can scan.
- `tests/test-276-tool-honesty-switch-branches.cjs` - the RED test: 6 assertion groups (TOOLHON01_SPLIT, TOOLHON01_VERDICT, TOOLHON01_LIVE_TREE, TOOLHON05_BOUNDARIES, HYGIENE, FALSE_VERIFICATION_COMMENT), 17 individual `check()` calls, 6 passed / 11 failed against the unmodified checker.

## Decisions Made

- Assertion 1 (the core branch-split proof) had to be redesigned away from the plan's literal wording. The plan states: "assert the returned rows contain a row with `command === 'echo-thing'` AND a row with `command === 'write-thing'` ... This is the assertion that fails today." Verified against the live `scanAll()` API this claim does NOT hold: `scanAll` iterates the schema's `z.enum` vocabulary independent of whether `splitBranches` actually recognized any case label, so both rows exist today regardless of the bug (`echo-thing` and `write-thing` both present, both wrongly verdict `OK` with reason `"a write primitive is reachable"`). A rows-presence assertion would have silently PASSED pre-fix, defeating the RED requirement. Fixed (Rule 1, auto-fix bug in the plan's own literal wording -- the underlying intent, "the branches are split at all," was correct, only the specific API surface named was wrong) by asserting directly on `splitBranches`'s returned `branchMap` keys instead, which genuinely is `{}` today. The `scanAll()`-level assertion (TOOLHON01_VERDICT: echo-thing must not carry the write reason) still covers the plan's second, correctly-stated assertion and is the one that demonstrates the user-visible consequence.
- Corrected an authoring mistake mid-task: two literal em-dash glyphs were accidentally written into the test file's own source (in a header comment and in the HYGIENE code block) while trying to express the six-character JS escape sequence for U+2014 - the tool-call JSON transport decoded that escape into the real character before it reached the file. Caught immediately via `grep -nP '\x{2014}'` before the commit and fixed via a targeted Python rewrite so the file's own source carries the literal escape-sequence text, never the glyph. Re-verified clean before staging.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's literal wording] Assertion 1 redesigned from rows-presence to direct branchMap inspection**
- **Found during:** Task 3, while drafting TOOLHON01_SPLIT
- **Issue:** The plan's literal assertion ("rows contain both commands") does not fail against the pre-fix checker; `scanAll()` always emits one row per `z.enum` vocabulary entry regardless of whether `splitBranches` recognized any case label. Verified live: `node -e "...scanAll(...)"` against the fixture returned both `write-thing` and `echo-thing` rows today, both `OK`.
- **Fix:** Added a `locateToolCallHandlerBody()` helper built from the checker's own exported primitives (`maskNonCode`, `scanBalanced`, `splitTopLevelArgs`, `extractStringLiteralConcat`) to extract the fixture's handler body text, then call the exported `splitBranches` directly and assert its `branchMap` contains both `write-thing` and `echo-thing` keys. This is genuinely `{}` today (confirmed via manual `node -e` probe before writing the assertion).
- **Files modified:** `tests/test-276-tool-honesty-switch-branches.cjs`
- **Verification:** `node tests/test-276-tool-honesty-switch-branches.cjs` shows both `TOOLHON01_SPLIT` checks as `FAIL` with `branchMap keys=[]`.
- **Committed in:** `4c4f98a3` (part of the Task 3 commit)

**2. [Rule 1 - Bug] Literal em-dash glyphs accidentally introduced, then removed**
- **Found during:** Task 3, immediately after first draft of the test file
- **Issue:** Attempting to document the JS escape sequence for U+2014 in a comment and in the HYGIENE code produced two literal em-dash characters instead, because the tool-call transport decoded the backslash-escape before it reached the file.
- **Fix:** Rewrote both sites via a targeted Python string replacement so the file carries the literal escape-sequence text, never the glyph; re-verified with `grep -nP '\x{2014}'` (no match) before staging.
- **Files modified:** `tests/test-276-tool-honesty-switch-branches.cjs`
- **Verification:** `grep -nP '\x{2014}' tests/test-276-tool-honesty-switch-branches.cjs` returns no match; `grep -c "u2014"` returns 3.
- **Committed in:** `4c4f98a3` (part of the Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both caught and corrected before the task's own verification step, neither reached a commit in a broken state).
**Impact on plan:** No scope creep. Both fixes were necessary for the RED test to genuinely be RED and for repo hygiene; neither touched a production file or changed the plan's declared artifacts.

## Issues Encountered

None beyond the two auto-fixed items above.

## RED Test Output (recorded verbatim per acceptance criteria)

```
node tests/test-276-tool-honesty-switch-branches.cjs
```
exits **1**. Summary line: `6 passed, 11 failed`. The 11 failures, verbatim:

```
- splitBranches on fixture_switch recognizes a write-thing branch :: branchMap keys=[]
- splitBranches on fixture_switch recognizes an echo-thing branch :: branchMap keys=[]
- fixture_switch.echo-thing does NOT carry the reason "a write primitive is reachable" :: echoRow={"tool":"fixture_switch","command":"echo-thing","file":"tests/fixtures/tool-honesty/switch-dispatch.cjs","verdict":"OK","reason":"a write primitive is reachable","claimPhrase":null}
- splitBranches recognizes more than 0 branches in the live room_content handler :: recognizedCount=0 keys=[]
- script header enumerates B-1 :: not found: B-1
- script header enumerates B-2 :: not found: B-2
- script header enumerates B-3 :: not found: B-3
- script header enumerates B-4 :: not found: B-4
- script header enumerates B-5 :: not found: B-5
- script header enumerates B-6 :: not found: B-6
- scripts/check-tool-honesty.cjs no longer claims the fall-through grouping was verified against real fall-through (it never was; the switch path produced no label) :: false claim still present: true
```

`bash tests/run-all-276.sh` exits **1** (`PASS=2 FAIL=1 SKIP=0`) -- this is Wave 0's correct end state per the plan objective, not a defect. Plan 276-06 must flip both commands to exit 0 with its one-line `splitBranches` fix and its header-boundary + comment-correction edits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 276-06 has an executable, unambiguous target: `node tests/test-276-tool-honesty-switch-branches.cjs` must go from `6 passed, 11 failed` (exit 1) to all-passed (exit 0), and `bash tests/run-all-276.sh` must go from `PASS=2 FAIL=1` to all-passed, without touching this plan's test or fixture files.
- `tests/run-all-276.sh` is ready for every subsequent 276-* plan to register its own test file into by simple filename convention (`tests/test-276-*`); no runner edit required.
- No blockers. This plan wrote no production code and touched nothing under `scripts/`, `lib/`, or `bin/`, matching the plan's own success criteria.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

## Self-Check: PASSED

All created files verified present on disk (tests/run-all-276.sh, tests/fixtures/tool-honesty/switch-dispatch.cjs, tests/test-276-tool-honesty-switch-branches.cjs, this SUMMARY.md) and both task commits (45412642, 4c4f98a3) verified present in git log.
