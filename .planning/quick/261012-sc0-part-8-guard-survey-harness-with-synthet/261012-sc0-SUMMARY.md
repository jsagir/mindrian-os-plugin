---
phase: quick-261012-sc0
plan: "01"
status: complete
completed: 2026-10-12
commits:
  - da09144cf  # helper + corpus
  - 46a87b29c  # RED
  - 102813ce6  # GREEN, baseline stamp
  - ff9497912  # runners + CHANGELOG
gate_test: tests/test-3692-guard-survey-gate.cjs
gate_leg_label_366: "3692 Part 8 guard survey gate (synthetic rooms, quick 261012-sc0)"
gate_leg_label_3692: "3692: Part 8 guard survey gate, synthetic rooms (quick 261012-sc0)"
commit_trailer: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com> (last line of every commit message, after a blank line)"
---

# Quick 261012-sc0: Part 8 guard survey gate

Seeded synthetic-room survey of the Part 8 egress guard, stamped against the landed S1 lexicon, wired as a hard leg in the release suite (`tests/run-all-366.sh` section 2d) and as a run_if leg in `tests/run-all-3692.sh`.

## Gate test name (for companion quick 261012-sph)

- File: `tests/test-3692-guard-survey-gate.cjs`
- Run: `node tests/test-3692-guard-survey-gate.cjs`
- Re-stamp: `node tests/test-3692-guard-survey-gate.cjs --stamp --reason "<why>"`
- Alternate baseline: `--baseline <path>`
- Exports: `{ measure, compare, canStamp }`
- Baseline: `tests/fixtures/3692/guard-survey-baseline.json` (`known_leaks[].status`, `open` or `fixed`)
- Helper: `tests/helpers/synthetic-room-db.cjs`; corpus: `tests/fixtures/3692/guard-survey-corpus.json`

## Commits

| Task | sha | Subject |
|------|-----|---------|
| 1 | da09144cf | seeded synthetic room builder and the guard survey corpus |
| 2 RED | 46a87b29c | RED, Part 8 guard survey gate against a deliberately wrong baseline |
| 2 GREEN | 102813ce6 | stamp the Part 8 guard survey baseline after the S1 lexicon fix |
| 3 | ff9497912 | the Part 8 guard survey gate rides the release suite and the 369.2 runner |

All 4 are ancestors of HEAD (PROVEN, `git merge-base --is-ancestor`). Commits used `git commit --only ... -- <paths>`. Nothing under `.planning/` was staged. PLAN.md and SUMMARY.md are not committed (orchestrator commits docs). No push, release or version bump.

## Pre-flight (PROVEN)

- Pre-change HEAD: 9bbf24a7b (in `261012-sc0-pre-sha.txt`). 261012-sbz GREEN commit c8e59445d is in HEAD.
- `_genericTokenSet` exported (exit 0). `node tests/test-3692-lexicon-generic-entries.cjs`: PASS: 9 FAIL: 0.
- The landed gate-lexgen lists in the sbz test equal the plan lists. No difference.

## Stamped baseline (measured on the landed lexicon)

Stamp reason: `initial stamp after the S1 lexicon fix (quick 261012-sbz); GAP1 and GAP2 open`. stamped.head 46a87b29c (HEAD at the time of the stamp, the RED commit), stamped.date 2026-10-12.

| Metric | Stamped value | Planner probe | Difference |
|--------|---------------|---------------|------------|
| 26 set, blocked with no room | 0 | 0 | none |
| 26 set, induced pairs | 1: `gate-segment:N6:room_term` (the pinned S1 residual, DS-3) | same | none |
| Extended set size | 522 (B 415, C 96, D 11) | 522 | none |
| Extended, blocked with no room | 37 | 37 | none |
| Extended, induced | 0 in all 6 rooms | 0 | none |
| Negatives allowed | 0 of 70 | 0 of 70 | none |
| Retention refused / entries | claim 7/7, person 1/1, venture_name 1/1, room_name 6/6, room_term 41/41, room_file 1/1 (57/57) | same | none |
| Must-refuse probes | 10 of 10 refused, expected token_class | same | none |
| GAP1 | open, allowed in 7 of 7 configurations | allowed 7/7 | none |
| GAP2 | open, allowed in 7 of 7 configurations | allowed 7/7 | none |
| Gate time | ELAPSED_MS 2004 and 1989 (WALL 2.10 s and 2.09 s) | about 4 s | faster |

The measured values equal the planner values. No other induced pair appeared, so there was no second residual. MEASURED_SHA256 is `9fb08281a435c35fd1d444d961c95261fb06f0d08185bcd01fdfaa28f731ed8d` on all 3 green runs and on the RED run.

## Task evidence (PROVEN, files in the quick folder)

- RED (`261012-sc0-red.txt`): exit 1, `GATE: FAIL (5 rows)`. The 5 FAIL rows: pos26.induced, ext.blocked_no_room, retention.room_term, known_leaks.GAP1, known_leaks.GAP2. L0, C0, H, N passed. No hard rule failed.
- Stamp (`261012-sc0-stamp.txt`): exit 0. The new baseline compares with all rows OK.
- GREEN (`261012-sc0-green-1/2/3.txt`): exit 0, `GATE: PASS`, `PASS: 5 FAIL: 0`, 1 distinct MEASURED_SHA256.
- Mutations (`261012-sc0-mutations.txt`): ext-minus (ext.blocked_no_room 36) exit 1; residual-empty exit 1; gap-fixed exit 1; ext-plus (38) exit 0 with `IMPROVED` and the `NOTE: numbers improved; re-stamp on purpose` line.
- `--stamp` without `--reason`: usage, exit 2.
- C0: 9 regression mutations give FAIL, 3 improvement mutations give IMPROVED with no FAIL; canStamp is false for the 6 hard-rule regressions and true for the 3 soft ones.
- H: the CLI hook with the no-network preload: N1 exit 0, X2 exit 2, `which framework fits Veldmark` exit 2, no NETWORK_ATTEMPT_356.
- N: fetch calls 0; elapsed under the 60 s budget (measured about 2 s).

## Runner totals (`>>> ` line diffs)

| Runner | Before | After | `>>> ` diff |
|--------|--------|-------|-------------|
| `LC_ALL=C bash tests/run-all-366.sh` | PASSED=71 FAILED=0 SKIPPED=0 KNOWN=1 | PASSED=72 FAILED=0 SKIPPED=0 KNOWN=1 | 1 added line: `3692 Part 8 guard survey gate (synthetic rooms, quick 261012-sc0): PASSED` |
| `bash tests/run-all-3692.sh` | PASSED=71 FAILED=0 SKIPPED=0 KNOWN=0 | PASSED=72 FAILED=0 SKIPPED=0 KNOWN=0 | 1 added line: `3692: Part 8 guard survey gate, synthetic rooms (quick 261012-sc0): PASSED` |

`node tests/test-366-suite-gate.cjs` exits 0. `scripts/release-lib/suite-gate.sh`, `scripts/release.sh`, `tests/test-366-suite-gate.cjs`, `lib/`, `.planning/debug/` and `tests/test-3692-lexicon-generic-entries.cjs` are byte-unchanged against 9bbf24a7b (PROVEN, `git diff --quiet`). The KNOWN=1 in run-all-366 is pre-existing and unchanged.

## CHANGELOG

One bullet appended as the last item under the existing `### Added` heading of `## [Unreleased] -- v2.0.0-beta.66 (in progress)`. No second heading was created. `git diff --numstat` showed 1 added line, 0 removed. The bullet says "about 2 seconds".

## Deviations from Plan

**1. [Rule 2 - synthetic-only fixtures] Negatives X3, X5, X9 use the sbz test strings, not the debug corpus.cjs strings**
- Found during: Task 1
- Issue: the debug corpus strings for X3, X5 and X9 contain "Nimbus Robotics", "Calder gripper" and "Harbor Freight Partners". "Harbor Freight" is a real company name. Orchestrator ruling 4 and the repo rule allow no real company names.
- Fix: the corpus file uses the already-landed synthetic strings from `tests/test-3692-lexicon-generic-entries.cjs` for X3 (`fennickrobotics.example`), X5 (Fennick Robotics, Thessaly gripper, Harbor Quill Partners) and X9 (Fennick Robotics Ltd). Expected classes are unchanged. All 10 negatives block in all 7 configurations.
- Files: `tests/fixtures/3692/guard-survey-corpus.json`. Commit da09144cf.

**2. [Minor] The RED baseline stamped.head is `red`; the stamped baseline head is 46a87b29c**
- The stamp ran before the GREEN commit, so `stamped.head` names the RED commit. This is the HEAD at stamp time, as designed.

No other deviation. No unowned dirty tracked file was seen in `lib`, `tests`, `scripts` or `CHANGELOG.md`.

## Known Stubs

None.

## Threat Flags

None. No network, no Brain call, no real room, no committed room.db. The GAP1 key probe is stored in 2 parts; the repo holds 0 contiguous `sk-ant-api03` strings (PROVEN, grep count 0).

## Follow-ups for the main session

1. Repoint `tests/test-3692-lexicon-generic-entries.cjs` to `buildRoom(dir, 'gate-lexgen')` in a later quick.
2. The GAP fix quick (companion 261012-sph) runs `node tests/test-3692-guard-survey-gate.cjs --stamp --reason "<why>"` so GAP1 and GAP2 flip to `fixed`. Until then the gate expects both to be allowed. A fixed probe that is allowed fails the gate.
3. The debug sessions take a Resolution note (the main session updates them).
4. A catalog refresh can raise `ext.blocked_no_room` and stop a cut. That needs a deliberate re-stamp with a reason.
5. The gate-segment residual (`gate-segment:N6:room_term`, the word "segment") stays visible on every cut. A guard change that removes it prints IMPROVED.

## Self-Check: PASSED

- Files exist: helper, corpus, baseline, gate test (PROVEN, committed).
- Commits da09144cf, 46a87b29c, 102813ce6, ff9497912 are ancestors of HEAD (PROVEN).
- `git status --short -- lib tests CHANGELOG.md` is empty (PROVEN).
