# Quick 261106 Summary: phase-guard tolerates planning markdown in rule a

Outcome: `node tools/perf/phase-guard.cjs db2ea3b05bb70b55741bdeb40b545801b0c37cbe` prints OK (446 commits, exit 0).

## Root cause

Commit 5d58018aa02cc432235fe892745a66b2ab566744 is a main-session planning-document commit. It touched `384-LEADS.md` (a phase path) and two other `.planning/` markdown files. Rule a flagged any phase-path commit that also touched a path outside the phase paths. The commit has no product path and no code. History is not rewritten.

## Change (two steps, fix forward)

1. d41727510: first attempt. An explicit sha list (`KNOWN_PLANNING_ONLY_COMMITS`) with a run-time check. That commit itself mixed `tools/perf` with `.planning/quick` files, so it tripped rule a. It was not rewritten.
2. 7144d5609: the general fix. Rule a now ignores a path under `.planning/` that ends in `.md` (`isPlanningMarkdown`), in addition to the three tracking files. Reason: rule a keeps phase commits away from product paths. A planning markdown file next to guard code touches no product path, and rule b and rule c still catch product paths. A product path, a non-.md `.planning` file (for example .json) and any other path are still rule a violations. The sha list, `isPlanningOnly` and the note line were removed because the wider rule made them redundant. The commit touches only `tools/perf` and `tests/test-384-perf-harness.cjs`.

3. 12065a6da: Wave 2 follow-up. Plans 384-13 to 384-20 are fix plans by design. `PHASE_PATHS` gains `tests/fixtures/384-`. A commit tagged `(384-13)` to `(384-20)` (`WAVE2_TAG`) may touch product paths, `tests/`, phase paths, tracking files and planning markdown. `package.json`, `npm-shrinkwrap.json`, `hooks/hooks.json` and any other path stay rule a violations for these tags. Rules b and c do not apply to such a commit. They are unchanged for every other commit (a 384-01 to 384-12 tag on a product path still fails rule b). The guard prints `note: wave 2 fix commit may touch product paths: <short sha>`. A Wave 2 commit is not counted as a peer (the peer count stays 85). B10 test arms cover it (RED first, then GREEN; 35 arms ok in the B8 to B10 runner). The real range now prints OK with the note for ff8ecf2e5.

## TDD

- RED: the new B9 arms failed against the d41727510 code (a phase path plus `.planning/quick/x/PLAN.md` was a violation; the real range failed on d41727510).
- GREEN: all B8 and B9 arms pass (23 ok, 0 fail). The B8 arm for `.planning/other.md` changed from "fails" to "passes", and an `.planning/other.json` arm now holds the "fails" case.

## Verification

- B8 and B9 arms only (scratch runner, `nice -n 19 taskset -c 4-7`): 23 ok, 0 fail. The full test file was not run (a peer executor takes timing measures in this tree).
- `node tools/perf/phase-guard.cjs db2ea3b05bb70b55741bdeb40b545801b0c37cbe`: OK, no other violation.

## Deviations

The first approach (sha list) was replaced on the coordinator's instruction. No history rewrite.
