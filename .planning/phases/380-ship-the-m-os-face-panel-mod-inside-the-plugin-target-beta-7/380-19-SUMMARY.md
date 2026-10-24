---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 19
subsystem: face-panel-layout-and-truth
tags: [mos-face, G1, G2, G3, G4, G9, G11, G12, G13, overview-by-size, band, hint-line, D-03, D-04, D-08, D-09, D-10]
requires:
  - phase: 380-10
    provides: the 13 gaps of the first real-terminal run (380-SCREENSHOTS.md)
provides:
  - hooks/overview.ts - the pure layout rules (overviewLayout, isCompact, screenColumnsOf, bandLayout, hintLayout)
  - the overview that puts ROOM, FILED, VERSION, Context and the Job before the decisions and folds by size
  - a band and a hint line that draw words under 60 columns and under NO_COLOR and keep one line
  - words that claim only what is true (advice text, ROOM row, NOW line, load notice)
affects: [380-20, 380-11]
tech-stack:
  added: []
  patterns:
    - "one pure layout module asked by the pane, the band and the hint line"
    - "compact reads the viewport (the screen), the width ladder reads the pane"
key-files:
  created:
    - ui/mos-face/hooks/overview.ts
    - ui/mos-face/tests/truth.test.tsx
    - ui/mos-face/tests/overview.test.ts
    - ui/mos-face/tests/overview-pane.test.tsx
    - ui/mos-face/tests/band.test.tsx
  modified:
    - ui/mos-face/hooks/register.tsx
    - ui/mos-face/hooks/status.ts
    - ui/mos-face/hooks/lines.ts
    - ui/mos-face/hooks/probe.ts
    - ui/mos-face/hooks/advice.ts
    - ui/mos-face/hooks/job.ts
    - ui/mos-face/tests/support.ts
    - ui/mos-face/tests/status.test.tsx
    - ui/mos-face/tests/tree-pane.test.tsx
    - ui/mos-face/README.md
    - lib/mos-face/dist
key-decisions:
  - "Compact is the width of the SCREEN (viewport columns), the width ladder is about the PANEL (owner ruling 2026-10-24; proposal P19-2)"
  - "Status words and the Job come before the decisions in this panel (owner ruling of gap 1; conflicts with GUIDE.md lines 91 and 107; proposal P19-1)"
  - "A Theo that was not checked is not a Theo that failed: NO_HOST and reachFailed in status.ts"
  - "The dashboard button uses the short label /m:os when the long label does not fit"
  - "Gap 10 is in no plan and needs a ruling"
requirements-completed: [MOD380-07, MOD380-08, MOD380-03, MOD380-05]
duration: about 3h of work across two sessions
completed: 2026-10-24
---

# Phase 380 Plan 19 Summary: the panel says what is true and shows the status words first

One-liner: a pure layout module (hooks/overview.ts) now decides what the pane, the band and the hint line draw at each size, so ROOM, FILED, VERSION, Context and the Job stand before the decisions, a screen under 60 columns and NO_COLOR draw words, a screen under 30 columns gets one message, and the ROOM row, the NOW line, the advice text and the load notice no longer claim what is not true.

Statement: Implementation complete; visual verification pending (plan 380-20 captures the images on a real screen).

## Commits

Release tree /home/jsagi/dev/MindrianOS-Plugin-release, branch main, not pushed. PRE_SHA d8e135577, HEAD 033eb328e.

| Task | Step | Commit | Subject |
|------|------|--------|---------|
| 2 | RED | 15c5b8c9c | test(380-19): RED tests for the advice words, the load notice, the ROOM row and the NOW line |
| 2 | RED | 8fcb0a9c4 | test(380-19): RED tests for the Theo light and /mos-text when Theo was not checked |
| 2 | GREEN | 5de38777d | feat(380-19): the advice words claim no delivery, ROOM says not bound, NOW does not fail an unchecked Theo, a short load notice |
| 3 | RED | c831209c4 | test(380-19): RED tests for the overview by size ... |
| 2 | dist | 9005eb072 | build(380-19): dist rebuilt for the truth of the words |
| 3 | GREEN | 7be965d32 | feat(380-19): the status words and the Job come first, the overview folds by size ... |
| 3 | dist | 69f773c87 | build(380-19): dist rebuilt for the overview by size |
| 4 | RED | 9eed671f3 | test(380-19): RED tests for the band and the hint line ... |
| 4 | GREEN | abfd18718 | feat(380-19): the band draws words under 60 columns and under NO_COLOR ... |
| 4 | dist | 033eb328e | build(380-19): dist rebuilt for the band and the hint line |

Branch tree /home/jsagi/dev/MindrianOS-Plugin (branch feat/eureka-adapter-rebased): e073e80ad (task 1: facts, proposals, pre-sha), 9f319aec2 (truth and overview evidence), 5e9b17f4e (band evidence), and the commit of the review and this summary.

## Evidence (380-19-evidence)

| Task | RED | GREEN |
|------|-----|-------|
| 1 | g13-run.txt, g11-run.txt (diagnosis runs) | 380-19-FACTS.md |
| 2 | red-truth.txt, red-truth2.txt | green-truth.txt |
| 3 | red-overview.txt | green-overview-pure.txt, green-overview.txt |
| 4 | red-band.txt | green-band.txt |

Honesty notes. The first RED output of task 3 and the first GREEN output of task 2 were not saved when the first session ended. Both were regenerated in a scratch copy cut with `git archive` from the commit of that step (c831209c4 and 5de38777d); each file says so on its first lines. The scratch copies are deleted. At c831209c4 the test OV10 failed because the helper `keyed()` read a key that the tree does not carry; the GREEN step changed the helper to `labelled()` (a test change, not a source change).

## Layout table as built (overviewLayout, pinned by OV-P1 to OV-P3)

| Body rows | Pane columns | Screen | Class | Header | Canvas | Text bar | Job form | Blank rows between top groups |
|-----------|--------------|--------|-------|--------|--------|----------|----------|-------------------------------|
| 35, 40, 24 | 46 | 120 | full | tile 8 | yes | no | full | yes |
| 40 | 56 | none | full | tile 12 (mini 6, line words 3 rows) | yes | no | full | yes |
| 40 | 35 | none | full | words 3 rows | no | yes | full | yes |
| 40 | 46 | 50 (compact) | full | words 3 rows | no | yes | full | yes |
| 23 to 12 | 46 | 120 | short | words 1 row | no | yes | full | no |
| 11 and fewer | any | any | tiny | words 1 row | no | yes | one row | no |

Rules: tiny under 12 rows, short under 24, else full. Tile only when full, not compact, not plain, tier not narrow, style not line. Compact is a screen under 60 columns; no viewport is not compact. Band: tile 12 (mini 6) from 60 columns, words under 60 and in plain mode, a message under 30 columns, Hide on its own row under 36 body columns. Hint line: long label while hint + 2 + 19 cells fit the screen, else `/m:os`, else the hint is cut to screen less 11 cells and dropped under 4.

## Rows each part ends on (estimate by the validated row counter, OV2)

At 46 columns the same figures came out at 35, 40 and 24 rows: VERSION ends on row 9, Context ends on row 15, the Job buttons end on row 22, WRITES TO starts on row 24, NOW starts on row 27. At 35 and 40 rows all of them are inside the rows (OV2, OV3). At 24 rows VERSION, Context, the Job buttons and the start of WRITES TO are inside; NOW starts below the fold (OV2 pins only the first three). PROVEN by the test run, as an estimate of the screen, not a measurement.

## Gaps closed in source

| Gap | Result | Where |
|-----|--------|-------|
| 1 | status words and the whole Job block before the decisions and before any picture that can fold; tiny and short classes | Task 3, OV1 to OV7 |
| 2 pane | screen under 60 columns: words and a text bar, no tile, no canvas, every action kept; button labels cut to the row | Task 3, OV8, OV10 |
| 2 band and hint | band words under 60 columns; dashboard label `/m:os` when the long one does not fit; Show box from 60 columns | Task 4, BD1, BD7, BD8, BD9 |
| 3 | band under NO_COLOR draws the line face and the state word, no block bars | Task 4, BD3, BD4 |
| 4 | band under 30 columns says `/m:os needs 30 columns` and names /mos-state | Task 4, BD5 |
| 9 | advice text says "Asking Theo. If Theo is reached, it gets ... The panel says what went, or that nothing did." No "are sent" | Task 2, W1 to W3 |
| 11 | cause PROVEN (the ROOM row had no word for an unbound session); ROOM row ends with ", not bound". The status line room name comes from plugin script scripts/context-monitor lines 675 to 700 and is NOT fixed (outside ui/mos-face) | Task 2, W5 to W8 |
| 12 | the load notice is `/m:os loaded. /mos-state opens it.` (one line, 34 characters). Whether the overlap with the host notice is gone is for the real screen check of plan 380-20; the rest is host behavior | Task 2, W4 |
| 13 | cause PROVEN (a Theo host that was never recorded was read as a failed check); NOW, the Theo light and /mos-text fail only a check that ran | Task 2, W9 to W16 |

## Changed expectations of earlier tests

| File | Test | Old | New | Reason |
|------|------|-----|-----|--------|
| tests/status.test.tsx | P8 | order WRITES TO, NOW, NEXT, JOB, status words, ASK | ROOM, FILED, VERSION, Context, JOB, WRITES TO, NOW, NEXT, the other status words, ASK | owner ruling of gap 1 |
| tests/tree-pane.test.tsx | T22 | overview counted 40 rows at 56 by 40 | 41 rows | one blank row more (gap between header, status words and Job); same helper, same exactness |
| tests/tree-pane.test.tsx | fixture of the pane tests | no Theo host recorded | a Theo host whose check is refused | an unrecorded host is no longer a failure, so the NOW fix button needs a host that failed |
| tests/support.ts | world options | none | `httpStatus` (default 200, `hang` never answers) | W10 and W12 need a failing health check |

panel.test.tsx is byte identical to its state before the plan; its 34 tests pass.

## Verification (PROVEN, run on 2026-10-24)

- `node scripts/typecheck.cjs` in ui/mos-face: 0 errors after every task.
- `claude plugin test .` in ui/mos-face: 379 pass, 0 fail (21 files).
- tests/test-380-egress.cjs 29 passed; test-380-copy.cjs 37 passed; test-380-budget.cjs 11 passed; test-380-rename.cjs 8 passed; test-380-build.cjs 115 passed; `scripts/build-mos-face.cjs --check` fresh.
- `bash tests/run-all-380.sh`: PASSED=19 FAILED=0 SKIPPED=0 KNOWN=0.
- No em-dash or en-dash in the added lines; no Larry in the added hook lines.

## Review

380-19-REVIEW.md: verdict Approve. No critical or major finding. Four minor findings (a hidden band at under 24 columns UNVERIFIED; the hint line assumes 80 columns when the host gives no viewport UNVERIFIED; narrow band cuts the Theo counts, PREFERENCE; the fold line is an estimate).

## Canon and rules cited

mos-brand book e947a5d, segments/experience/terminal/entries/2026-10-20/GUIDE.md (status proposed): line 24, 28, 91, 92, 96, 97, lines 99 to 107, line 111. Skills: mindrian-tui-consult (layout bug table, a label that wraps needs a shorter label), tui-design (floor test, truncate with a mark), typescript-pro, test-master, code-reviewer. Proposals P19-1 to P19-7 are in 380-19-BOOK-PROPOSALS.md; the book was not edited. No new proposal came from tasks 3 and 4.

## Deviations from Plan

1. [Process] The first session ended after the task 2 commits and the task 3 RED commit, with the task 3 GREEN work uncommitted. This session verified that work (typecheck, 366 tests), set T22 to 41, and committed it. No source of the first session was rewritten.
2. [Rule 3 - Blocking] The RED output of task 3 and the GREEN output of task 2 were regenerated from scratch copies (see Evidence).
3. [Rule 1 - Test bug] In task 4 the first tree helper required a `props` object, which an empty Box does not carry; BD1 and BD6 then passed or failed for the wrong reason. The helper was fixed and both tests now assert the holder is not null.
4. [Guard] The release tree is a linked git worktree on `main`, as the plan designates. The pre-commit rule that wants a `worktree-agent-*` branch does not fit this tree; commits were made there with `git commit --only` and explicit paths, as every earlier plan of the phase did.
5. [Scope] The text bar is left out in the tiny class (the Context words carry the figure). The README says so.

## Known Stubs

None.

## Items for the owner (needs a ruling)

1. Gap 10: the Handover face at 12 cells (PREFERENCE; changes the canon raster pins and the D-10 hash tests).
2. The status line room name of gap 11: the plugin line names a folder, not the bound room (scripts/context-monitor lines 675 to 700, outside ui/mos-face).
3. NEXT MOVE says "none yet" beside the host line (cause UNVERIFIED).
4. The Job statement word "Hughes 1983 reverse salient" is not plain English (hooks/jobs.ts).
5. Readings recorded as proposals: P19-1 (status words above decisions), P19-2 (screen against panel width), P19-3 (tiny class and blank rows).
6. The cuts of the clutter audit that stay unapplied (see README, "Overview by size").

## Captures plan 380-20 must make (on a real terminal, each image read)

- Docked pane at 120 by 40 (and 140 by 45, 120 by 29): status words and Job above the decisions; check the 46 by 35 fold against the estimate (VERSION row 9, Context row 15, Job buttons row 22).
- Inline pane at 80 by 24, 60 by 24 and 50 by 30: the measured 6, 6 and 8 rows; the order of the first rows.
- Compact screen at 50 columns: words, text bar, no tile; the hint line shows `/m:os` on one line; the band shows words.
- NO_COLOR: pane and band draw words, no block bars.
- 28 columns: band and pane messages that name 30 columns.
- /mos-advice with a refused call: the chat text claims no delivery.
- A session with no bound room: the ROOM row says "not bound".
- A fixture with no Theo host: NOW and the Theo light do not say Theo is not answering.
- The load notice at session start: whether it still covers the host notice (gap 12).
- A hidden band at a narrow width and the hint line with Show box at 60 columns (UNVERIFIED items of the review).

## Self-Check

PASSED. The 10 release-tree commits exist (cat-file), the review, summary, facts and evidence files exist, and the added lines hold no em-dash.
