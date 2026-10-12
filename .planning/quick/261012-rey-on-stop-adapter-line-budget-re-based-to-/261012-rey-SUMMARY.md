---
phase: quick-261012-rey
plan: "01"
status: complete
subsystem: release-gate
tags: [on-stop, line-budget, adapter-budget, release-suite, seed]
commits:
  - 2c0eae9f5
  - 3aead34aa
  - 8a73d929c
requirements: [QUICK-261012-REY]
metrics:
  measured_M: 658
  chosen_B: 680
  completed: 2026-10-12
---

# Quick 261012-rey: on-stop adapter line budget re-based, gate wired, SEED-125 filed

One-liner: the on-stop line budget is re-based from 570 to 680 (measured 658 plus the 198-09 margin rule), the adapter-budget test now runs as a hard leg of tests/run-all-366.sh (the release suite), its summary line follows the exit code, and SEED-125 holds the thin on-stop refactor.

## Commits (explicit paths, `git commit --only`)

| Task | Sha | Files |
|------|-----|-------|
| 1 | 2c0eae9f5 | tests/test-198-adapter-budget.test.cjs |
| 2 | 3aead34aa | lib/mcp/hook-adapter-audit.cjs, tests/run-all-366.sh, CHANGELOG.md |
| 3 | 8a73d929c | .planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md (added with `git add -f`) |

Trailer on all three: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (orchestrator ruling; the executor runs on Sonnet 5.5; this replaces the Fable 5.1 trailer named in the plan).

## Measurement and rule

- M = 658 lines, by `split('\n').length`, at HEAD 2c0eae9f5. The last on-stop commit is 26629ecff (2026-10-06). scripts/on-stop is byte-unchanged.
- Rule: B = smallest multiple of 10 that is at least M + 20. B = 680.
- Record: 261012-rey-measure.txt.
- Growth history verified by `git show <sha>:scripts/on-stop`: 547 (7226232a7), 553 (f63d1ddce), 580 (8462f41ad), 605 (0d02e112e), 612 (c7fb00dba), 618 (01c3ca19d), 658 (26629ecff).

## Gate leg

Leg name: `198 SPEC-5 adapter budget (import audit + line-count)`, a hard `run` in section (2c) of tests/run-all-366.sh, reached by release.sh Step 0.6c through RELEASE_GATE_SUITES. suite-gate.sh, release.sh and doctor.cjs are untouched.

## Verify results (quoted)

Task 1, red at the 570 budget:
- test exit=1; `PASS:` lines = 0; last line `FAIL: test-198-adapter-budget (14 of 15 tests passed, exit 1)`; TAP `# tests 15`, `# pass 14`, `# fail 1`.
- run-all-366 red: `>>> 198 SPEC-5 adapter budget (import audit + line-count): FAILED`; tail `PASSED=70 FAILED=1 SKIPPED=0 KNOWN=1`.
- Only other non-PASSED leg: `>>> pin 355 direction agreement: KNOWN (pre-existing red, signature matched)`. Pre-existing, not touched. No FAILED leg other than the new one existed at HEAD.

Task 2, green at 680:
- test exit=0; last line `PASS: test-198-adapter-budget (15 of 15 tests passed)`; TAP `# tests 15`, `# pass 15`, `# fail 0`.
- `bash tests/run-all-198.sh`: last line `Passed: 17   Failed: 0   Skipped: 0`.
- run-all-366 green: tail `PASSED=71 FAILED=0 SKIPPED=0 KNOWN=1`. The diff of `>>> ` lines red vs green shows exactly one changed line, FAILED to PASSED, for the 198 SPEC-5 adapter budget leg.
- suite-gate: `suite-gate: PASS -- tests/run-all-366.sh`.
- Dash count 0 in all edited files; the local-only tokens do not appear in hook-adapter-audit.cjs (the 198 Part 8 leg is inside the run-all-198 pass).

Task 3:
- SEED-125 tracked (`git ls-files --error-unmatch` lists it), 0 dashes. Block ranges re-measured and confirmed: 241-247, 331-343, 376-385, 408-523 (116), 546-556, 569-609 (41), 648-655; sentinels at 47 and 136.
- doctor --acceptance before: exit 0, 89 s, `Acceptance full: 24/24 points passed.` Failed set: empty (24 points `done ok`).
- doctor --acceptance after: exit 0, 90 s, `Acceptance full: 24/24 points passed.` Failed set: empty. Point set equal (SAME-POINT-SET). The only text difference is the HEAD sha inside the real-room-run WARN text (behind HEAD 656d986bd54c before, 8a73d929cec8 after). That WARN is pre-existing and the point stays PASS.
- Note: the plan grep pattern `done FAIL` matches no line in either run; the doctor prints `done ok` for a pass, so the failed set was read as "every point done ok".

Final checks:
- 2c0eae9f5, 3aead34aa, 8a73d929c are all ancestors of HEAD (PROVEN by `git merge-base --is-ancestor`).
- `git status --short -- lib tests scripts CHANGELOG.md .planning/seeds` is empty. `git status --short -- scripts/on-stop hooks` is empty.
- No push, no release, no version bump, no network.

## Deviations from Plan

1. CHANGELOG: a `### Fixed` heading already existed (from quick 261012-rew). The new bullet was appended under it, as the orchestrator ordered. No second heading.
2. Trailer: Sonnet 5.5 instead of Fable 5.1 (orchestrator ruling 1).
3. Orchestrator ruling 3: PLAN.md and SUMMARY.md are not committed here.
4. Measurement files and logs in the quick directory are gitignored and uncommitted.

No auto-fix rules triggered. No stubs. No new threat surface.

## Follow-ups for the main session

- The 369 close-gate notes still quote "618 against 570".
- The header table of tests/run-all-3551.sh (line 38) still lists this leg as a documented red; its FAILED count drops by 1.
- .planning/debug/search-surface-qa-sweep-20261012.md item 6 Resolution and knowledge-base.md take a block when the sweep resolves.
- tests/run-all-366.sh still carries one KNOWN leg (pin 355 direction agreement), pre-existing.

## Self-Check: PASSED

All three shas exist and are ancestors of HEAD; all five files exist and are committed; SEED-125 is tracked.
