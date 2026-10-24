# 380-20-REVIEW: code review of the plan 380-20 diff

Diff read: release tree /home/jsagi/dev/MindrianOS-Plugin-release, 033eb328e (PRE_SHA) to HEAD, files ui/mos-face/hooks/tree.ts, hooks/register.tsx, README.md, the tests and lib/mos-face/dist. Skill: code-reviewer (checklist: design, logic, security, performance, tests, naming, error handling, documentation).

## Summary

Intent: the room tree splits a list into even pages, keeps the room name in the crumb and marks what it shortened, gives a pane that is too short four plain lines and Close (no names), puts the cap note on its own row when the crumb and counter do not fit, and accepts /mos-tree list. The change is small and pure where it can be: the rules live in hooks/tree.ts (no engine import, no clock, no I/O) and register.tsx only draws and reads. One defect of the first draft was found by the final gate and fixed (the typed command paged with a window one row taller than the pane); see Major issues (closed).

## Critical issues

None.

## Major issues

1. CLOSED. hooks/register.tsx (levelOf, about line 750; the pane window, about line 1446): the command paged with the window of the last drawn view, so the first answer after opening a capped folder said 1-17 of 300 while the pane drew 1-16 of 300 (tree-2000-p1-small.png of the first capture set). Root cause: the cap note row depends on the folder, and the module kept one number for the window. Fix: the module keeps the tree rows and the inner width of the last drawn pane, and levelOf asks noteRowsOf for the same decision as the pane. Test TF9 failed first (380-20-evidence/red-tf9.txt) and passes (green-tf9.txt). The final images agree (tree-2000-p1-small.png, tree-2000-p1-big.png).

## Minor issues

1. hooks/tree.ts line 225 (noteRowsOf): the longest counter is an upper bound built from the total (the figures at their widest). With a filter that leaves few names the note row can be taken where it was not needed. It is safe (the folder name stays whole) and stable between pages. PREFERENCE.
2. hooks/tree.ts line 261 (tooSmallLines): each line is cut with ~ by fit() at narrow panes. At 50 columns every line was whole (tree-inline-50x30.png); under 44 columns "Make the terminal taller, or dock the panel." is cut (44 characters). UNVERIFIED on a screen at those widths.
3. hooks/tree.ts line 187 (crumbText): the cut of the last folder needs at least 4 characters of the name; below that the crumb falls back to "room ~". The pure sweep (TF-P4) proves the result never exceeds the width and never starts with ~ unless the width is 1.
4. The word "110 columns" in the too-small lines comes from the host Pane remark (docks from 110 columns in the fullscreen layout). The images show docked at 120 and inline at 80, 60 and 50; the exact threshold at 110 is UNVERIFIED by an image.

## Positive feedback

- pageOf has one arithmetic rule (base and extra) and a sweep test of 1 to 400 names against windows of 4 to 40; it cannot lose or repeat a name, and the pages differ by at most one.
- The pane and the typed command now share one decision (noteRowsOf), and the note row is decided from totals, never from the page.
- Nothing new is read at prompt time: TF8 and T15 count calls and reads; T23 shows the filter text in no call. No new atom, hook, tool call, http call or process.
- The too-small pane draws no section or file name (TF1 searches every text and button for every section name).

## Checklist walk

| Area | Finding |
|------|---------|
| Design | rules pure in tree.ts, drawing in register.tsx; contract names as in the plan |
| Logic | pageOf: empty gives the empty page, one name gives a whole page, a window of 0 or not a number counts as 1, the page is clamped, never a page that does not exist; crumb never exceeds its width; the window rows used for paging equal the rows drawn (TF3 counts 14 rows on both pages; TF5 counts 22 rows) |
| Types | no enum, no explicit any, no needless as; the switch of parseTreeArgs has a default branch; controlsOf keeps assertNever; node scripts/typecheck.cjs exits 0 |
| Security | no new call; the filter stays local (T23); the too-small pane never prints names |
| Performance | one directory read for each opened section or folder; the sweep test costs about 1.2 s |
| Tests | failing test first for every fix (red-tree.txt, red-tf9.txt); the 34 tests of panel.test.tsx pass and the file is byte identical to its state before plan 380-19 (git diff of 380-19 PRE_SHA against HEAD is empty); changed expectations of plan 380-18 tests are listed in the SUMMARY and none is weakened |
| Naming | crumbRowPlan, noteRowsOf, tooSmallLines as in the contract; treeRowsBase and treeInnerCols replace treeSize |
| Error handling | a folder that cannot be read still gives "nothing readable inside" (T10) |
| Documentation | README section Room tree states the pager, the crumb rule, the cap note row, the too-small lines and the list verb; claims are limited to what the tests and the opened images show |
| Strings | no em-dash or en-dash in the added lines; no Larry, ICM, Brain or MCP word in the added hook lines (searched) |
| Dist | node scripts/build-mos-face.cjs --check: fresh (source hash e80290edf88dbb45) |

## Questions for author

1. Should the cap note also show when a filter leaves names of a capped folder? Today it follows the same rule as without a filter (upper bound).
2. Should the idle Context canvas fold to the text line at 120 by 40 (proposal P17-2)? It is still drawn (pane-wide.png).

## Verdict

Approve. No open critical or major finding.
