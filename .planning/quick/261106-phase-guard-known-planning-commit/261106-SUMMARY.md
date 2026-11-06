# Quick 261106 Summary: phase-guard known planning-only commit

Outcome: phase-guard rule a has an explicit, run-time verified exception list. `node tools/perf/phase-guard.cjs db2ea3b05bb70b55741bdeb40b545801b0c37cbe` now prints OK.

## Root cause

Commit 5d58018aa02cc432235fe892745a66b2ab566744 is a main-session planning-document commit. It touched `384-LEADS.md` (a phase path) and two other `.planning/` markdown files. Rule a flags any phase-path commit that also touches a path outside the phase paths. The commit has no product path and no code. History is not rewritten.

## Change

- `tools/perf/phase-guard.cjs`: added `KNOWN_PLANNING_ONLY_COMMITS` (one full 40-character sha, with a comment giving the reason). Rule a reads it. The exemption applies only when every file of the commit is under `.planning/` and ends in `.md` (`isPlanningOnly`, checked at run time). The guard prints `note: known planning-only commit exempt from rule a: <short sha>`. `checkHistory` takes an optional 4th argument (the list) and returns `notes`. Rules b and c do not read the list.
- `tests/test-384-perf-harness.cjs`: new arms B9 (7 synthetic arms plus the real-range arm, skipped when the history is absent).

## TDD

- RED: the B9 arms failed before the change (no exported list, no notes, exempt sha still a violation). The real range failed rule a.
- GREEN: all B8 and B9 arms pass. The real range up to the planning commit passes and prints the note.

## Verification

- B8 and B9 arms run through a scratch runner (only the guard arms, no full suite): 21 ok, 0 fail. The full test file was not run, on request (another executor works in this tree).
- `node tools/perf/phase-guard.cjs db2ea3b05bb70b55741bdeb40b545801b0c37cbe`: 443 commits checked, OK, exit 0, the exemption note printed. No other rule violation.

## Deviations

None.
