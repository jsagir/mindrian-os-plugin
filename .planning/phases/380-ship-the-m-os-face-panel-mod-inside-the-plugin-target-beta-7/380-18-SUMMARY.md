---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 18
subsystem: face-panel-room-tree
tags: [mos-face, G7, G2, room-tree, pager, mos-tree, D-04, D-08]
requirements: [MOD380-07, MOD380-05]
completed: 2026-10-24
---

# Plan 380-18 Summary: the room tree (G7) and the header that stays in view (G2)

One-liner: the Sections button now opens a paged browse view (pinned header, crumb row with a counter, a fixed-height window, only the controls that can act, a hint that promises no key) that keeps its whole body inside scroll.bodyRows, so every section and every file is reachable by click or by /mos-tree and the host never scrolls the face away; the pure model is in hooks/tree.ts.

Statement: Implementation complete; visual verification pending (plan 10 captures the tree on a real screen; hotkeys, Tab walking and Input remain UNVERIFIED and undrawn).

The navigator's wish from the real screen: "+4 more sections" was plain text and could not be reached. It is gone. All 14 sections (and all 16 files of a folder) are listed across pages with a counter, by click or by slash command.

## Commits

Release tree /home/jsagi/dev/MindrianOS-Plugin-release, branch main, not pushed (PRE_SHA 058af2f0e, HEAD d8e135577):

| Step | Commit | Subject |
|------|--------|---------|
| RED | 15d437ffc | test(380-18): RED tests for the paged room tree, pinned lists name mos-tree, contract stub |
| GREEN model | cbfd76a8c | feat(380-18): the pure tree model, layout, pager, filter, counter, crumb, hint, command parser |
| GREEN pane | cb2058c58 | feat(380-18): the room tree is a paged browse view with a pinned header and /mos-tree |
| Dist | a346801d1 | build(380-18): dist rebuilt for the paged room tree |
| Docs | eb49c1151 | docs(380-18): README room tree and the host limits |
| Fix | c2c46c968 | fix(380-18): a long section name is cut and its count stays; tests that the filter stays local |
| Dist | fc8c38416 | build(380-18): dist rebuilt for the long section name |
| Refactor | ed7642c7c | refactor(380-18): a folder is read first and stored with its path |
| Dist | 4fca5855f | build(380-18): dist rebuilt after the folder read refactor |
| Docs | 616cc0d50 | docs(380-18): README counts the 24 pane test groups |
| Tests | d8e135577 | test(380-18): one test declaration for every generated test, the rename pin counts 40 atoms |

Branch tree /home/jsagi/dev/MindrianOS-Plugin: c082c1730 (host facts, RED evidence), 539f9313a (model evidence), 44fec6bef (pane evidence), 20e050124 (book proposals P18), and the commit of the final gates, the review and this summary.

## Evidence

- RED: 380-18-evidence/red-tree.txt. 222 pass, 105 fail at that run. The pure tests failed with "not implemented". Pane tests T1 to T20 failed on the old behavior (10 sections and no controls, no tree buttons, /mos-tree not registered). T18 (the originals), T21 (the overview) and T22 (the row counter equals the 40 rows of plan 17) passed by design. The 34 tests of panel.test.tsx passed. A few unrelated tests (C1 search, C1 found, W6) hit the 5000 ms limit under load; no timeout was raised.
- GREEN model: 380-18-evidence/green-tree-model.txt (66 pure tests pass; later 67).
- GREEN pane: 380-18-evidence/green-tree-pane.txt (328 pass, 0 fail at that run).
- Final gates: 380-18-evidence/final-gates.txt. typecheck exit 0; claude plugin test in ui/mos-face 330 pass, 0 fail (330 declarations); bash tests/run-all-380.sh PASSED=19 FAILED=0 SKIPPED=0 KNOWN=0. Each run alone, scratch HOME and CLAUDE_CONFIG_DIR, login file by symlink (its modification time is unchanged).
- Timing check (PROVEN): W3 and W4, the slowest tests, take about 0.5 second alone before and after this plan (6 paired runs). The 5 second timeouts seen under load come from load (17 test files start together, plus other sessions at load average 7 to 25), not from this change.

## The layout as built (treeLayout, pinned by the pure test)

| Body rows | Columns | Plain | Header | Hint rows | Control rows | Fixed rows | Window rows |
|-----------|---------|-------|--------|-----------|--------------|------------|-------------|
| 40 | 56 | no | tile (3 rows) | 2 | 1 | 8 | 32 |
| 24 | 44 | no | tile | 3 | 2 | 10 | 14 |
| 24 | 35 | no | words (1 row) | 3 | 2 | 8 | 16 |
| 23 | 56 | no | words | 1 | 1 | 4 | 19 |
| 11 | 44 | no | words | 1 | 2 | 5 | 6 |
| 9 | 35 | no | words | 1 | 2 | 5 | 4 |
| 8 | 56 | no | too small, needs 9 | | | | |
| 40 | 56 | yes | words | 2 | 1 | 6 | 34 |

Constants as the plan states: tile header when rows are 24 or more, columns 40 or more and plain is off; controls 1 row from 52 columns else 2; hint 1 row under 24 rows, else 2 rows from 56 columns, else 3; refresh row from 24 rows; crumb row always 1. No measured reason forced another constant. A sweep test (9 to 60 rows, 6 widths, plain and not, 624 cases) proves fixed rows plus window rows equal the body rows.

## The host facts that decided the design (380-18-HOST-FACTS.md, line numbers of the laid types file)

- PROVEN as type text: scroll.bodyRows is the room, never the rows showing (line 10907); the host scrolls a taller body (line 10904). A search for sticky, pinned header and fixed region finds 0 lines: the host has no pinned header. So the plugin keeps its body inside the rows and pages the list itself.
- PROVEN as type text: a hotkey fires only while the pane holds the keys and never from the prompt box (lines 9872 to 9877); Escape is the person's own key and returns the focus (lines 1449, 10871). So the keyboard route is /mos-tree, and no hotkey and no Input is drawn.
- UNVERIFIED on a real screen: Tab walking, the focus chord, Input in a pane, the redraw after a resize, the real room of an inline pane at 80 by 24 (the tests assume 76 by 10).

## Borrowed patterns (principles only; the facts file has the five-column table)

lazygit: list to detail with a predictable way back (Up, Close, /mos-tree up). yazi: the location stays clear (the crumb row). k9s: a filter with a count and a breadcrumb (/mos-tree find, the counter).

## Files changed in the pinned lists, and why

- ui/mos-face/tests/copy.test.tsx C2: mos-tree added to the sorted command list; title says 15 commands.
- tests/test-380-copy.cjs S5: the handler count 14 to 15; the comment names plan 380-18 and mos-tree.
- tests/test-380-budget.cjs G2: command.run{command=mos-tree} added; the comment says 15 names.
- Not named by the plan, found by running the tests (Rule 3, see Deviations): ui/mos-face/tests/job.test.ts J8 (count 14 to 15), ui/mos-face/tests/copy.test.tsx C1 next move (one line), tests/test-380-rename.cjs R2 (37 atoms to 40).

## Deviations from Plan

1. [Rule 3 - blocking, plan conflict] J8 of tests/job.test.ts asserts exactly 14 registered commands. Root cause: the plan listed three pinned files and missed J8. Fix: the count and the title say 15; the 14th is still mos-job. Commit 15d437ffc (RED).
2. [Rule 3 - plan conflict] C1 next move (tests/copy.test.tsx) presses Sections and then looks for the lights. Root cause: the plan's own rule says the browse view draws nothing else of the overview, so the lights are gone while it is open. Fix: one line presses the same key to close the tree before the lights are read. No assertion weakened. Commit cb2058c58.
3. [Rule 3 - blocking] tests/test-380-rename.cjs R2 pinned 37 atoms. Root cause: the tree adds 3 atoms (treePage, treeFilter, sectionMore). Fix: 40. Found by the aggregator. Commit d8e135577.
4. [Rule 3 - blocking] tests/test-380-engine-tests.cjs compares the pass count with the number of test( declarations at the start of a line. Root cause: three groups of my tests were generated by a loop. Fix: one declaration for each test. Commit d8e135577.
5. [Rule 3 - support] ui/mos-face/tests/support.ts gained a backward compatible list option (per-folder listings); ui/mos-face/types/index.d.ts declares the 3 new atoms; hooks/tree.ts gained rowsIn (a total function over the page union) with its test T-P12. Not in the plan file list; each is needed by the plan's own design.
6. [Owner decision, partly missed] The owner decision says every task that changes ui/mos-face source ends with node scripts/build-mos-face.cjs. Tasks 1 and 2 changed source (the stub, the model) and did not rebuild; the dist of commits 15d437ffc and cbfd76a8c was stale for the short time until a346801d1. The final dist is fresh (build --check passes at HEAD).
7. [Judgment, small additions] The counter of a filtered list names the filter (2 matches for "legal"). `/mos-tree list` opens the view; `/mos-tree up` on a closed view does not open it. The slash command `open` does not put a question in the prompt box for a section or folder (a click does); it does for one file. Close resets the folder, the page and the filter. No Clear button is drawn (it does not fit at 52 columns in the worst case; Close and /mos-tree clear do the job).
8. [Rule 1 - found while reviewing] A folder was stored in two steps, so the pane could show one folder's names under another folder's crumb for one frame. Fix: readFolder reads first, then stores the path and the names together (ed7642c7c).
9. The first aggregator run failed 3 legs: the engine gate (a 5 s load timeout and the declaration count), the rename pin, and the shots harness (the scratch HOME has no Playwright browsers). The second run passed with PLAYWRIGHT_BROWSERS_PATH pointing at the real browser cache (read only).

Auto-fix attempts per task: at most 2. No timeout was raised. No push. STATE.md and ROADMAP.md not edited.

## Review verdict

380-18-REVIEW.md: Approve. No critical finding, no major finding, seven minor items, four questions.

## Claims

- PROVEN (ran it or read it): the layout table and its sweep; the pager, filter, counter, crumb, hint and parser (67 pure tests); every section and file reachable across pages by click and by command at 56 by 14, 76 by 10, 56 by 22, 44 by 24 and 35 by 24; a folder of 2000 files shows first 300 of 2000 in 30 pages; too small names 9 rows; plain mode is ASCII; no tool, http or process call and no extra read while paging or filtering; the filter word is in no recorded call; panel.test.tsx is byte identical and declares 34 tests; the dist is fresh; the host facts with line numbers.
- UNVERIFIED: the tree on a real screen (the paint, the 4 cell button brackets, the widest control row of 47 of 50 cells at 52 columns); the redraw after a resize; the room of an inline pane at 80 by 24 and in a 60 column split; Tab, Enter and any hotkey (none is drawn).
- PREFERENCE: no Clear button; Close resets the drill; the wording of the hint lines.

## Canon

mos-brand book e947a5d (read with git show; the checkout is at 9f4ee34), segments/experience/terminal/entries/2026-10-20/GUIDE.md (status proposed): Side panel template (Order, One signal, Folded parts, Keyboard routes, States, Plain mode), Width ladder, Ground and color; segments/writing/voice. The book is silent on long lists in a side panel: proposals P18-1 (long lists), P18-2 (host facts for mods) and P18-3 (a mark on every row, a question) are appended to 380-16-BOOK-PROPOSALS.md. The book repository was not touched. Skills applied: typescript-pro (strict, no enum, no explicit any, unions with exhaustive switch and a never check, type predicate isFolder, satisfies not needed), test-master (RED first and watched, plain-sentence tests, exact assertions, edge paths, fixtures only), tui-design (list virtualization, truncate at the start, filter with a count, floor test at 80 by 24 and a 60 column split, clutter audit counts), mindrian-tui-consult (usability then brand, honesty above both, nothing pressable without a mechanism, a hint that names a key says where it works, list-to-detail instead of three panes, borrowed patterns table), code-reviewer (380-18-REVIEW.md).

## Capture list for plan 10 (real screen)

1. The tree page 1 and page 2 at 56 by 40 and at 44 by 24. Note: the 14-section fixture fits one page at both sizes (windows of 32 and 14 rows). To see page 2 at those sizes the room needs more names than the window: use a room with 15 or more sections at 44 by 24 and 33 or more names at 56 by 40 (the 2000-file folder gives 30 pages). At 76 by 10 and 56 by 14 the 14 sections already page.
2. A filtered list: /mos-tree find legal (the counter says 2 matches for "legal").
3. The too-small state: a pane under 9 rows (the words say /m:os needs 9 rows to browse the room).
4. A drill into a 16-file folder: the header and crumb stay in view, the counter says 1-14 of 16 at 44 by 24 and all 16 at 56 by 40.
5. Also: the inline pane at 80 by 24 and in a 60 column split (the real room it gets), and the width of the controls row (the 4 cell button brackets).
6. An interactive try of Tab, Enter and a hotkey only if a later plan adds one. This plan adds none.

## Known Stubs

None.

## Threat Flags

None new. T-380-73 (a huge folder): capped at 300, a window of rows only, one list read for each open (T11). T-380-74 (names reach Theo): no tool, http or process call from the tree (T15); the command output goes to the local session only. T-380-75 (the filter text): the atom is read only by the tree code and T23 finds the filter word in no call. T-380-76 (hidden names): every window has a counter, a capped folder says first 300 of N, a no-match filter says so. T-380-77 (a control that does nothing): not drawn; no hotkey and no Input.
