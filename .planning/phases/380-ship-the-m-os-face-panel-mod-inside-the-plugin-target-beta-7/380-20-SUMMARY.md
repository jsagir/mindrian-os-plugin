---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 20
subsystem: face-panel-room-tree-and-final-gate
tags: [mos-face, G5, G6, G7, G8, room-tree, balanced-pages, crumb, cap-note, too-small, final-gate, D-04, D-08]
requires:
  - phase: 380-19
    provides: the status words first, the band, the truthful words (gaps 1, 2, 3, 4, 9, 11, 12, 13)
provides:
  - hooks/tree.ts - the even pager, the crumb rule, noteRowsOf, crumbRowPlan, tooSmallLines, the list verb
  - a pane too short for the tree that says what to do and draws no name
  - the final gate: every failed image of plan 380-10 captured again on a real terminal and opened
affects: [380-11]
tech-stack:
  added: []
  patterns:
    - "one pure rule asked by the pane and by the typed command (noteRowsOf), so a page holds the same names in both"
    - "pages are an even split (base and extra), never a lonely last page"
key-files:
  created:
    - ui/mos-face/tests/tree-fix.test.ts
    - ui/mos-face/tests/tree-fix-pane.test.tsx
  modified:
    - ui/mos-face/hooks/tree.ts
    - ui/mos-face/hooks/register.tsx
    - ui/mos-face/tests/tree.test.ts
    - ui/mos-face/tests/tree-pane.test.tsx
    - ui/mos-face/README.md
    - lib/mos-face/dist
key-decisions:
  - "/mos-tree list is accepted as a verb (the plan 380-18 summary becomes true; a verb every person guesses first no longer answers with an error)"
  - "The cap note decision reads totals only, as an upper bound, so the window does not change between pages"
  - "The typed command and the pane page with the same window (found by the final gate, fixed with TF9)"
requirements-completed: [MOD380-07, MOD380-05, MOD380-01]
completed: 2026-10-24
---

# Phase 380 Plan 20 Summary: the room tree reads at every size, and the final gate is run

One-liner: pages of the room tree are an even split (18 names in a window of 17 are two pages of 9), the crumb keeps the room name and marks what it shortened with ~, a capped folder says "first 300 of 2000" on its own row when it must, a pane that is too short says in four plain lines what to do and draws no name, /mos-tree list opens the view, and 35 images of a real terminal were captured again and opened one by one.

Statement: Implementation complete; visual verification by the person's own review of the final images (not blocking).

## Commits

Release tree /home/jsagi/dev/MindrianOS-Plugin-release, branch main, not pushed. PRE_SHA 033eb328e (380-20-PRE-SHA.txt). HEAD 7c710db04.

| Step | Commit | Subject |
|------|--------|---------|
| RED | 71951e26e | test(380-20): RED tests for balanced pages, the crumb, the too-small lines and the list verb |
| GREEN | 163427447 | feat(380-20): the room tree pages are balanced, the crumb keeps the room, a pane too short says what to do, and /mos-tree list opens the view |
| dist | 39b5ea442 | build(380-20): dist rebuilt for the room tree repair |
| RED (found by the gate) | b73ccd3fc | test(380-20): RED test TF9, the typed command pages the same rows as the pane for a capped folder |
| GREEN | 04b68438f | fix(380-20): the typed /mos-tree command pages the same window as the pane when a cap note row shortens it |
| dist | 7c710db04 | build(380-20): dist rebuilt for the command window fix |

Plan 380-19 in the release tree (from its summary): 15c5b8c9c, 8fcb0a9c4, 5de38777d, c831209c4, 9005eb072, 7be965d32, 69f773c87, 9eed671f3, abfd18718, 033eb328e.

Branch tree /home/jsagi/dev/MindrianOS-Plugin (feat/eureka-adapter-rebased). Plan 380-19: e073e80ad, 9f319aec2, 5e9b17f4e, b672bce3a, c479cbe4a. Plan 380-20: 7bf4a72ae (evidence, proposals P19-8 to P19-11, pre-sha), 6ecfea67a (TF9 evidence), d5b59646b (final gate captures and record), and the commit of the review and this summary.

## Evidence (380-20-evidence)

| Step | RED | GREEN |
|------|-----|-------|
| Task 1 | red-tree.txt (36 fail: 23 new tests and 13 changed expectations; TF8, one pure test that guards a clamp and the 34 originals pass) | green-tree-pure.txt (103 pass, 0 fail), green-tree-pane.txt (404 pass, 0 fail) |
| TF9 (found by the final gate) | red-tf9.txt (1 fail) | green-tf9.txt (405 pass, 0 fail) |
| Task 2 | none | capture-driver/ (specs, logs, driver); screens-19/ (35 PNG with ANSI and text, index.json) |

Honesty note: green-tree-pure-first-run.txt is the first full run after the pure part. It shows 5 failures: TF1, TF2, TF3 and TF5 (they need the pane, written next) and TF-P4 (a test bug: at width 1 with a one-letter room the whole name fits, so the result is the room, not the mark; the test now checks length 1). green-tree-pure.txt is cut from the final full run.

## Changed expectations of plan 380-18 tests

Each change keeps the assertion as strong as it was. Reason for all: the pages are an even split (owner ruling of gap 7) or the crumb keeps the room (owner ruling of gap 6).

| File | Test | Old | New |
|------|------|-----|-----|
| tests/tree.test.ts | T-P2 size plus 1 | pages 10 and 1, ranges 1-10 and 11-11 | pages 6 and 5, ranges 1-6 and 7-11 |
| tests/tree.test.ts | T-P2 14 items at size 10 | 1-10 and 11-14 | 1-7 and 8-14 |
| tests/tree.test.ts | T-P2 a page past the last | page 1, 11 to 14 | page 1, 8 to 14 |
| tests/tree.test.ts | T-P4 a paged page | 1-10 of 14, 11-14 of 14 | 1-7 of 14, 8-14 of 14 |
| tests/tree.test.ts | T-P12 rows of a page | slice(10) | slice(7) |
| tests/tree.test.ts | T-P6 a crumb too long | starts with ~, ends with sizing | starts with the room name, does not start with ~, ends with ~ |
| tests/tree-pane.test.tsx | fixture PAGE_ONE and PAGE_TWO | 10 names and 4 names | 7 names and 7 names |
| tests/tree-pane.test.tsx | T1, T5, T7, T9, T12, T19 | counters 1-10 of 14 and 11-14 of 14; 10 or 4 section rows | 1-7 of 14 and 8-14 of 14; 7 section rows |
| tests/tree-pane.test.tsx | T20 | line 1 is 1-10 of 14; ten name lines | 1-7 of 14; seven name lines |

Unchanged on purpose: T11 (300 names in 10 rows are 30 pages of 10) and T13 (the too-small pane holds /mos-tree and only Close). panel.test.tsx is byte identical to its state before plan 380-19 (git diff of 380-19-PRE-SHA against HEAD is empty); its 34 tests pass.

## Rules as built

Balanced pager (pageOf): filter first, then pages = ceil(n / window); each page holds floor(n / pages) names and the first (n mod pages) pages hold one more.

| Names | Window | Pages |
|-------|--------|-------|
| 18 | 17 | 9, 9 |
| 21 | 5 | 5, 4, 4, 4, 4 |
| 14 | 10 | 7, 7 |
| 11 | 10 | 6, 5 |
| 10 | 10 | one whole page |
| 300 | 10 | 30 pages of 10 |
| 300 | 17 | 18 pages: twelve of 17, six of 16 |

Crumb (crumbText), in order: the whole path; with two folders or more the room, ~ and the last folder; the last folder cut at its end with ~ when 4 characters of it fit; the room and ~; the room alone; the room cut at its end with ~. Never a leading ~ unless the width is 1; never wider than the width.

Cap note (noteRowsOf, crumbRowPlan): a row of its own only when names were left out, the whole crumb plus 2 plus the longest counter (an upper bound from the totals) do not fit one row, and at least 4 window rows remain. The pane and the typed command use the same decision.

Too small (tooSmallLines): "/m:os needs N rows to browse the room", "Make the terminal taller, or dock the panel.", "Docking needs a terminal 110 columns wide.", "Or type /mos-tree in the prompt box."; 5 rows or more all four and Close; 4 rows three and Close; 3 rows two and Close; 2 rows one and Close; 1 row one. Never more rows than given; no name drawn.

List verb: list in any case, nothing after it, is the list command; "list now" stays unknown.

## The 13 gaps of plan 10 (from 380-20-SCREENSHOTS.md)

| Gap | Status | Image that shows it |
|-----|--------|---------------------|
| 1 status words and Job before the fold | closed | pane/pane-wide.png, pane-std.png, pane-inline-60x24.png, pane-narrow.png |
| 2 under 60 columns: words, no tile | closed | narrow.png, pane/pane-narrow.png |
| 3 NO_COLOR band | closed | nocolor.png |
| 4 band under 30 columns | closed | small.png |
| 5 the pane too short for the tree | closed as ruled (says what to do, no name drawn) | pane/tree-inline-80x24.png, tree-inline-60x24.png, tree-inline-50x30.png, tree-inline-nocolor-80x24.png |
| 6 the crumb | closed | pane/tree-2000-p1-small.png |
| 7 the pager | closed | pane/tree-sections-p1-small.png, tree-sections-p2-small.png |
| 8 /mos-tree list | closed | pane/explore-mos-tree-list.png |
| 9 "are sent" after a denial | closed | pane/sent-denied.png |
| 10 the Handover face | not in scope (needs a ruling) | none |
| 11 ROOM beside WRITES TO | closed on the panel; the plugin status line room name is an owner item | installed/wide.png |
| 12 the load notice | open as host behavior (one short box; covers host text under 60 columns) | std.png, narrow.png, small.png |
| 13 NOW and the Theo claim | closed (the THEO row shows only at 140 by 45) | pane/pane-wide.png, installed/wide.png, pane/sent-denied.png |

All regression images passed (wide, chip, pane-nocolor, pane-small, tree-toosmall-120x13, tree-sections-big, tree-2000-p1-big and p2-big, tree-folder16-small, tree-find-legal-small, sent-answered, installed/band).

## Verification (PROVEN, run on 2026-10-24)

- node scripts/typecheck.cjs in ui/mos-face: 0 errors after every task.
- claude plugin test . in ui/mos-face: 405 pass, 0 fail (23 files); tree-fix.test.ts 17 tests and tree-fix-pane.test.tsx 9 tests pass.
- tests/test-380-build.cjs 115 passed; test-380-copy.cjs 37; test-380-budget.cjs 11; test-380-egress.cjs 29; test-380-rename.cjs 8; face-commands.cjs --check 0 problems; scripts/build-mos-face.cjs --check fresh.
- bash tests/run-all-380.sh: PASSED=19 FAILED=0 SKIPPED=0 KNOWN=0.
- 35 PNG opened with the Read tool; every judgment is in 380-20-SCREENSHOTS.md with its label.

## Review

380-20-REVIEW.md: verdict Approve. No critical finding. One major finding (the command window differed from the pane window), found by the final gate and closed with TF9. Four minor findings (upper-bound note row, cut lines under 44 columns UNVERIFIED, 4-character rule, the 110-column threshold not shown by an image).

## Owner list (needs a ruling)

1. Gap 10: the Handover face at 12 cells (PREFERENCE; changes the canon raster pins and the D-10 hash tests).
2. Gap 12: the load notice box covers host text under 60 columns (host behavior); delay or drop it there?
3. The status line room name (scripts/context-monitor, outside ui/mos-face): it names a folder, not the bound room.
4. NEXT MOVE says "none yet" beside the host line (cause UNVERIFIED).
5. The Job statement wording "Hughes 1983 reverse salient" is not plain English (hooks/jobs.ts); NOW grammar "1 section have".
6. The idle Context canvas (eight white boxes) at 120 by 40 (P17-2, PREFERENCE) and the cuts of the clutter audit still unapplied.
7. A grey block beside the dashboard button at 50 columns (narrow.png; cause UNVERIFIED).
8. Book proposals, none applied to the book: P19-1 status words above decisions, P19-2 screen against panel width, P19-3 tiny class and blank rows, P19-4 the band under 60 and under 30 columns and under NO_COLOR (lines 24, 28, 96, 97, 106), P19-5 a button label never wraps, P19-6 a room shown but not bound says so (line 92), P19-7 a service not checked is not failed (line 96), P19-8 balanced pages (lines 94, 95), P19-9 the crumb keeps the root (line 95), P19-10 a pane too short says what to do (line 96), P19-11 a cap note has its own row (line 96). All in 380-19-BOOK-PROPOSALS.md.

## Canon and rules cited

mos-brand book e947a5d, segments/experience/terminal/entries/2026-10-20/GUIDE.md (status proposed): lines 91 to 97 (Side panel template: Order, One signal, Folded parts, Keyboard routes, States, Plain mode) and 99 to 107 (Width ladder); segments/writing/voice. The book is silent on long lists, crumbs and a pane that is too short, so proposals P19-8 to P19-11 were written and the book was not edited. Skills: mindrian-tui-consult (usability first, honesty above both; a hint that names a key says where it works; layout bug table; review output), tui-design (virtualize lists that grow, keep positions stable, truncate paths so the last part survives and the root is kept, floor test at 80 by 24), typescript-pro, test-master (failing test first and watched), code-reviewer.

## Deviations from Plan

1. [Rule 1 - Bug] The first capture set showed the typed answer "1-17 of 300" beside a pane of "1-16 of 300". Root cause and fix are in the Review section; the whole capture set was taken again.
2. [Rule 1 - Test bug] TF-P4 expected the mark at width 1 for a one-letter room whose full name fits; the test was fixed (see Evidence).
3. [Process] The scratch root sits under the session scratch folder, not mktemp -d in the system temp folder; it was deleted after the record was written.
4. [Guard] The release tree is a linked worktree on main as the plan designates; commits used git commit --only with explicit paths, as in earlier plans. The branch tree commits also used git commit --only instead of the gsd-tools commit call (the caller asked for --only).
5. [Instruction] The plan says STATE.md and ROADMAP.md were not edited. By the caller's instruction ROADMAP.md was updated only through the gsd-tools roadmap.update-plan-progress handler, and no state.* handler was run (another session may execute phase 379.1).

## Known Stubs

None.

## Self-Check

PASSED. The six release-tree commits and the three branch-tree commits named above exist (git cat-file); the review, the screenshot record, the evidence folder and screens-19 exist; the added lines hold no em-dash or en-dash.
