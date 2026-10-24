# Code Review: plan 380-18, the paged room tree (G7) and the header that stays in view (G2)

Reviewer: code-reviewer skill pass by the executor, on the diff PRE_SHA 058af2f0e to HEAD of the release tree (main), files ui/mos-face, lib/mos-face and tests. Date 2026-10-24.

Intent in one sentence: the room tree becomes a paged browse view that keeps its whole body inside scroll.bodyRows, so every section and every file is reachable by click or by /mos-tree and the face and header never scroll away.

## Summary

The change adds a pure model (hooks/tree.ts), a browse view and the /mos-tree command (hooks/register.tsx), 24 pane test groups and a pure test file, and rebuilds the dist. The checklist was walked: design, logic, security, performance, tests, naming, error handling, documentation. No critical or major finding. Seven minor items and four questions.

Checked and found as the plan asks:

- Every union has an exhaustive switch with a never check: counterText, rowsIn and controlsOf (hooks/tree.ts lines 91, 104, 210), runTree and control() (hooks/register.tsx lines 834 and 1537). parseTreeArgs switches on a string, so it ends in a default that returns unknown.
- No enum, no explicit any, no needless assertion (grep of the diff; the type check has zero errors).
- The pager never shows a page that does not exist: pageOf filters, then clamps, then slices (tree.ts line 64); tests T-P2 clamp a page below 0, a page past the last and a NaN page. It never loses a name: T-P2 joins the pages of 16 items and gets all 16, T1 and T2 join the section buttons of all pages and get all 14 and all 16.
- The entry cap says the rest in words: crumb row "first 300 of 2000" and the same words in the /mos-tree counter line (T11, T20).
- No control is drawn that cannot act: controlsOf lists Up only inside a folder, Previous only after page 1, Next only before the last page (T-P10, T5, T19). Find puts a stem in the prompt box (a verified mechanism); Close toggles the view.
- No string with an em-dash or en-dash, Larry, ICM, Brain or MCP in the new code (grep). The README mentions Larry only in the old D-07 sentence of plan 13.
- The body never exceeds scroll.bodyRows: treeLayout (tree.ts line 39) and the render (register.tsx line 1398) were read together. Fixed rows plus the window equal the body rows at every size from 9 to 60 rows (T-P1 sweep). The pane tests T2, T11, T12, T17, T19 count the drawn rows with a helper that was first checked against the 40 rows of the plan 17 audit (T22). The helper reads Text and Button as one row, so the claim rests on no Text wrapping: every Text of the view is cut with truncate-end or fitted, and a test measures the widest line against the pane (T17, T24).
- The listing is read once per open: readFolder is the only fs.list call of the tree (register.tsx line 670); T15 shows paging, filtering, Up to the list and the prompt hooks add no read and no call.
- The filter text stays on this machine: the atom treeFilter is read only by the tree code (grep of hooks); T23 runs a filter, two turns and an ask and finds the filter word in no recorded call.
- The changed pinned lists add one name and weaken nothing: copy.test.tsx C2 (list and title), test-380-copy.cjs S5 (14 to 15), test-380-budget.cjs G2 (one name). See minor item 1 for the two test bodies that also changed.
- The originals are untouched: git diff PRE_SHA..HEAD shows no change in ui/mos-face/panel.test.tsx; it declares 34 tests and they pass.
- The README claims only what the facts file proved; the host limits cite the line numbers of the laid types file. The dist is fresh (build --check, 24 dist files verified).

## Critical issues (must fix)

None.

## Major issues (should fix)

None.

## Minor issues

1. [ui/mos-face/tests/job.test.ts J8; ui/mos-face/tests/copy.test.tsx C1 next move; ui/mos-face/tests/support.ts] Process. The plan said no earlier test body changes. Three small edits were unavoidable. J8 asserted exactly 14 registered commands, so its count and its title became 15. C1 next move pressed Sections and then looked for the lights, but the plan makes the browse view draw nothing else; one line (press the same key to close the tree) was added before the lights are read. support.ts gained a backward compatible list option so a test can serve a folder. Each is recorded in the SUMMARY. Suggest the navigator accepts them; none weakens an assertion.
2. [hooks/register.tsx lines 1524 to 1545] The widest control row is Up, Previous, Next, Find, Close: 23 characters of labels, 20 cells of host brackets (assumed 4 cells for each button, taken from the "[ Bind a room ]" of the real shots) and 4 gaps: 47 cells against 50 at 52 columns. The 4-cell chrome is read from a screenshot, not from the types (UNVERIFIED). Plan 10 captures it.
3. [hooks/register.tsx line 1291] The window height comes from scroll.bodyRows. How the host re-draws after a terminal resize is UNVERIFIED (the redraw call is documented, a real resize was not seen).
4. [hooks/register.tsx line 596] treeSize is a module variable written by the render and read by /mos-tree, so a page means the same rows in the pane and in the text. It is 10 until a pane has drawn, and it is reset at session start. A second pane id would share it; only one pane draws the tree.
5. [hooks/tree.ts line 104] The counter for a filtered list adds the filter in words (2 matches for "legal"). The plan named only the unfiltered strings; this is an addition so the person sees that a filter is on.
6. [hooks/register.tsx, Close] Closing the browse view resets the folder, the page and the filter, so the next Sections press starts at the list. The old dropdown kept the open section. This is a design choice for a predictable way back; the navigator may prefer the old memory.

7. [tests/test-380-rename.cjs R2; tests/test-380-engine-tests.cjs] Two pins that the aggregator found late. R2 pinned 37 atoms; the tree adds 3, so it counts 40. The engine gate compares the pass count with the number of test( declarations at the start of a line, so a test that a loop generates was not counted; the loops were unrolled into one declaration each. The first aggregator run also failed the shots harness because it ran under a scratch HOME without the browser cache; PLAYWRIGHT_BROWSERS_PATH to the real cache (read only) fixed the run. Lesson for the next plan: run the aggregator once after the first GREEN, not only at the end.

## Positive feedback

- The model is pure and small; the layout table, the pager and the parser are tested without the engine (66 pure tests).
- The one source of truth for the rows of the view is treeLayout, and a sweep test proves fixed plus window equals the body at 624 size and mode combinations (52 row counts, 6 widths, plain and not).
- A folder is read first and stored with its path in one step (ed7642c7c), so one folder's names never show under another folder's crumb.
- The red run was kept, with the reason for each failure (red-tree.txt), and the timing of the two tests that sit near the 5 second limit was measured alone: W3 and W4 take about 0.5 second in isolation before and after the change, so the timeouts under load are not caused by this plan.

## Questions for the author

1. /mos-tree prints file and folder names as the command answer, so the session model reads them. That is the same exposure as /mos-text, and the Part 8 guard stays at the shim, but the question stands: does the navigator want the command to print counts only for a folder?
2. Should Clear be a button when a filter is on? It is not drawn now: Close resets the filter and /mos-tree clear removes it. A sixth button would not fit at 52 columns in the worst case.
3. Should the overview (no list open) also be shortened for 80 by 24? Not here: the audit cuts beyond G1 to G7 are not ruled.
4. Does the engine time out a hung fs.list? Not tested here; the read has no cut-off of its own (the same as before this plan).

## Verdict

Approve. No critical finding, so the plan is not blocked.
