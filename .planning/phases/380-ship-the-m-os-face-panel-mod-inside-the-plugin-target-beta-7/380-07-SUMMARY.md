---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 07
subsystem: ui-mod-colors-states-book-review
tags: [mos-face, canon, colors, state-names, geometry, decisions, book-review, scratch-consumer]
requires: [380-06]
provides:
  - ui/mos-face/tests/colors.test.tsx (K1 to K9, 15 tests)
  - ui/mos-face/tests/canon.ts (the 11 canon poses by value, sha256 of the book asset)
  - tests/test-380-decisions.cjs (static scans K1s K3s K6s, T1, D1 to D7)
  - ui/mos-face/scripts/book-review.cjs (scratch-consumer run of the book review)
  - README section Decisions (N2, N4, N5, N6, N7, N9, HOLLOW, GEOMETRY)
  - 380-BOOK-REVIEW.md (verdict, five worst problems, humanChecks with evidence)
affects: [380-08, 380-10, 380-11]
requirements-completed: [MOD380-04]
completed: 2026-10-23
---

# Phase 380 Plan 07: Canon colors, exact state names, written decisions and the book review - Summary

The face now draws the canon poses number for number, the labels are the book's exact state names, every decision the book does not rule is written down with its default and its segment, and the book's own review ran on the shipped copy in a scratch consumer with the book byte-unchanged.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched. `git rev-list --count origin/main..main` is 25 (20 earlier plus the 5 below). The evidence and this SUMMARY are in the branch tree `/home/jsagi/dev/MindrianOS-Plugin`.

## Commits

Release tree:

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 476a17c4a | test(380-07): RED tests for canon colors, exact state names and written decisions (D-02) |
| 2 | 796553769 | fix(380-07): face poses and planes equal the canon asset, number for number (D-02) |
| 2 | 46ec7226f | feat(380-07): exact book state names and the written decisions N2 N4 N5 N6 N7 N9 (D-02) |
| 3 | e8c3f1a06 | fix(380-07): no double hyphen and no unchecked superlative in the drawn copy (book voice rules) |
| 3 | b4e0dc950 | feat(380-07): scratch-consumer book review of the shipped copy (D-01) |

Branch tree: 1b6a677be docs(380-07): book review of the shipped copy (force-added, `.planning/*` is ignored). The commit of this SUMMARY follows it.

## Canon used

The canon is the mos-brand book e947a5d (read only). The live checkout was at 9f4ee34 (two commits ahead) during the work. `git diff --stat e947a5d HEAD -- segments/identity segments/foundations` printed nothing, so the segments used are the same. The review script exported e947a5d with `git archive` into the scratch folder and ran that CLI. Citations used: `segments/foundations/color`, `segments/identity/theo/states`, `segments/identity/theo` (asset `entries/2026-10-19/asset-fa8504998f.json`, renderer `asset-d96217b320.js`), `segments/experience/accessibility`, `segments/writing/voice`, `references/brand-rules.md`, and `segments/experience/terminal` (PROPOSED, marked so each time).

## Root cause (PROVEN, stated before the patch)

1. The plan said "face.ts already uses the canon hexes". True for the tokens, false for the poses. POSES held an older copy of the geometry (robot-faces v2.6.0). A script compared all 7 drawn poses with the canon asset: every one differs in eye size, bar angle or both, search differs in the crossing point and the bar position, and Boundary drew a black plane (canon: red; in the canon black means "Your decision"). The navigator instruction (use the canon's exact geometry, never a redraw) and D-02 (colors by state per the canon) both required the fix.
2. The labels Searching, Nothing found and Hand over were not the book's state names. Limit was already printed through a ternary in register.tsx.
3. The plan 06 dump switch `MOS_COPY_DUMP` never fired. The engine runs a test in a sandbox with no `process` and no env (probe in a scratch copy: `typeof process` undefined, `$.env` undefined). So the book review had no copy to read.
4. The copy scanners of plan 06 looked for the em dash and the en dash only. The voice segment also forbids a double hyphen used as a dash and lists words to avoid. Six registry why lines held a double hyphen (5) or an unchecked superlative (1).

## RED list (commit 476a17c4a, PROVEN)

`claude plugin test .`: 87 pass, 4 fail. Failing: K5 exact names, K7 geometry, K7 colors by state, K9 raster. K1 to K4 and K6 passed in RED (the tokens and contrast were already right).
`node tests/test-380-decisions.cjs`: 14 passed, 39 failed (README Decisions missing, labels wrong, unmapped states missing, GEOMETRY entry missing). T1, K1s, K3s and K6s passed.

## GREEN run (PROVEN)

| Command | Result |
|---------|--------|
| `claude plugin test .` in `ui/mos-face` (also `node tests/test-380-engine-tests.cjs`) | 91 pass, 0 fail (34 original plus 57 added). 91 equals the declarations on disk: 34 + 10 + 15 + 15 + 14 + 3 |
| `node tests/test-380-decisions.cjs` | 53 passed, 0 failed |
| `node tests/test-380-copy.cjs` | 22 passed, 0 failed |
| `node ui/mos-face/scripts/face-commands.cjs --check` | 112 WHY lines, 0 drift warnings, 0 problems |
| `node ui/mos-face/scripts/typecheck.cjs` | exit 0 |
| `bash tests/run-all-380.sh` | `PASSED=10 FAILED=0 SKIPPED=3 KNOWN=0` (3 skipped: build, installed layout and gate wiring, legs of plans 08 and 09) |
| `LC_ALL=C /usr/bin/grep -rlP '\xE2\x80[\x93\x94]'` over README, hooks, tests, scripts, tests/test-380-*.cjs and the evidence file | no hit |

## Contrast numbers tested (K2, equal to the book table within 0.05)

ink on paper 17.31, soft on paper 8.25, paper on cobalt 7.63, paper on red 4.60, ink on yellow 11.23, ink on white 18.88 (book 18.88), yellow on paper 1.54 (never text). Every move chip pair is at least 4.5. Dimmed paper (paper at 50 percent over ink, #848380) over ink is 4.98. The book differs from the plan only by one added number (ink on white 18.88). Two pairs in the panel are below the floor and are recorded, pinned by K2 and not changed: the heading marker is soft ink on ink 2.10 and cobalt on ink 2.27 (under 3 to 1 for non-text; focus is carried by color alone). Open for plans 10 and 11.

## Mutation runs (PROVEN, scratch copies, no git checkout)

| Mutation | Caught by |
|----------|-----------|
| rest bar angle 18 to 19 | K7 geometry |
| yellow chip text set to YELLOW | K2 (chip pairs), K3 |
| Limit label back to Nothing found | K5 |
| Boundary plane back to ink with paper eye | K7 geometry, K7 colors, K9, R1 pins |

## What changed

- face.ts: POSES equal the canon (e1, e2, s, r, plane, c1, c2, hollow) for rest, listen, search, found, none (Limit), refused (Boundary), handover. The `edge` flag is replaced by the per-pose crossing point `r`. `rasterState` draws the plane, divider and ground line from `r`; the ground line is the one row that holds y = r[1]; the running mark follows `r`. LABEL holds Rest, Listening, Search, Found, Limit, Boundary, Handover.
- register.tsx: the two `state === 'none' ? 'Limit' : LABEL[state]` ternaries are gone.
- README: section Decisions (N2, N4, N5, N6, N7, N9 with the 11-state table, HOLLOW, GEOMETRY), each citing "mos-brand book e947a5d" and a segment path; terminal segment marked PROPOSED; run line for the book review.
- face-commands.cjs: 6 plain-words overrides (deck, mullins, mva-report, show, stance, trending-to-absurd); commands.ts regenerated (6 lines, 6 insertions and 6 deletions).
- copy.test.tsx, test-380-copy.cjs, face-commands.cjs: the scanners also catch the double hyphen, the voice avoid list and unchecked superlatives (C4, S1 and the generator check).
- book-review.cjs: the scratch-consumer run described in the plan.

Strings fixed after the review (full old and new text in commit e8c3f1a06): /mos:deck, /mos:mva-report, /mos:show, /mos:stance and /mos:trending-to-absurd (double hyphen replaced by brackets, a colon or a full stop; `ONE` and `JOB` set in lower case), and /mos:mullins ("the most rigorous opportunity screen ever published" became "screen an opportunity against seven domains").

## Book review (full text in 380-BOOK-REVIEW.md)

- Book HEAD before and after: 9f4ee34; `git status --short` before and after: the same 2 lines; BOOK_STATUS_BEFORE_COUNT=2. The plan's verify command printed VERIFY-OK (count equals live count, 40 label hits, no dash).
- The CLI that ran: an export of e947a5d. Steps exit codes: init 0, configure 0, adopt 0, checklist 0, review 2, doctor 0.
- Verdict: the book's scan returns `findings: []` and REVIEW-REQUIRED for 40,731 characters (615 copy lines plus `/mos-text`). It always returns REVIEW-REQUIRED. The book scan does not check a double hyphen or the voice word list, so the two real copy defects came from my own scan against the voice segment, and are fixed.
- Five worst problems: (1) poses not canon, FIXED; (2) double hyphen and superlative, FIXED; (3) heading marker contrast 2.10 and 2.27 and color-only focus, OPEN; (4) stack words in a few registry why lines (Cypher, PostToolUse, connector frontmatter, a script file name), OPEN, PREFERENCE; (5) only the Rest band seen in a real terminal, OPEN.
- Real screen seen (PROVEN for these two): captures of a real Claude Code 2.1.309 session in the capture harness, wide 120 by 40 and narrow 50 by 30, both opened. They show the box above the prompt with the Rest tile, "Theo | MindrianOS", Hide, "Rest | Theo 0 this turn, 0 in all". The face change is compared against the canon renderer in a browser (7 pixel grids beside the canon SVGs), image opened: `/tmp/claude-1000/-home-jsagi/c03816a4-113f-4230-9448-0156b88f0247/scratchpad/k7/compare.png`. Not a terminal capture. Implementation complete; visual verification of the other 6 states pending (plan 380-10).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug, plan fact wrong] The poses were not the canon**
- Found during: Task 1 (reading the canon asset for the tests). Fix: commit 796553769 (the pin edit is listed below). Needed also by the navigator instruction. The plan limit "do not change a color, a pose" was written on the false fact; D-02 and the instruction took priority. The change is one commit and can be reverted alone.

**2. [Rule 3 - Blocking] The engine tests read no file and no env**
- The plan put K1 (the literal set of face.ts) and K6 (green scan of four files) in colors.test.tsx. The sandbox has no fs. Those two static scans are legs K1s and K6s of tests/test-380-decisions.cjs; colors.test.tsx holds the value checks. `ui/mos-face/tests/canon.ts` was added (not in the plan file list) so the engine test can compare with the canon by value; T1 compares it with `git show e947a5d:<asset>` and its sha256 when the book checkout is present.

**3. [Rule 1 - Bug] The plan 06 dump switch could never fire**
- Root cause above. Fix: a global set at a marker by the scratch copy, no env. The shipped test prints nothing. Commit e8c3f1a06.

**4. [Rule 2 - Missing critical rule] The copy scanners missed two book rules**
- Double hyphen, voice avoid list, unchecked superlatives. Fix above. This is outside the plan's literal limit ("fix only a string in voice.ts or register.tsx"), because the defective strings live in commands.ts and are generated; the fix is in the generator's override map, which keeps the drift gate valid.

**5. [Rule 1 - Bug in my own test] K9 sampled a column outside the tile**
- Column 15 has its center at x = 387.5, right of the plane edge 386. It now samples column 14. Committed with the geometry fix.

**6. [Method] The book checkout moved ahead of the pin**
- HEAD 9f4ee34, not e947a5d. The script exports the pin with git archive when HEAD differs. The evidence names the CLI that ran.

**7. [Method] The book CLI flow**
- `configure` refuses to overwrite a hand-edited `.mindrian/intake.json`, so the script removes the unedited init template in the scratch consumer and passes the completed intake from the consumer root.

**8. [Commit layout]** The LABEL change in face.ts landed in the geometry commit (same file, same hunk area), not in the Task 2 commit. The Task 2 commit holds register.tsx, panel.test.tsx and the README.

### Edits to adopted tests (panel.test.tsx), complete list

1. Line 542, test "the panel reads quietly: its own tool calls do not light the face": the assertion `text: /Searching/` is now `text: /^Search/` (the label is now Search). The count stays 34. No other adopted assertion was edited.

### Edits to other existing tests (not adopted)

- tests/raster-pin.test.ts: the 84 state pins (R1) are re-taken on the canon poses; header comment and the R1 title updated. The pins were "never edited" by plan 02; this is the one recorded exception, because the poses changed on purpose. R2 (crew) and R3 (canvas) pins are the original ones.
- tests/copy.test.tsx: scanner rules (double hyphen, avoid list, superlative); C7 uses a global instead of env.
- tests/test-380-copy.cjs: the same scanner rules.
- tests/colors.test.tsx (mine, K9 column).

## Decisions made

- N2, N4, N5, N6, N7, N9, HOLLOW and GEOMETRY are written in README section Decisions with the defaults of the plan.
- State names: the labels use the names of the ruled states segment (Search, Limit, Handover). See NEEDS_HUMAN in the report.
- The 14 unit frame of the canon tile and the outline of a hollow pose are not drawn (smaller than one cell); HOLLOW stays, recorded as non-canon.

## Open items for plans 10 and 11

Plan 380-10 (real screen): capture Listening, Search, Found, Limit, Boundary and Handover; plain mode; 80 by 24 with the dock; wrapping of the longest why lines at 40 and 30 columns; the host dim rule for dimmed paper; the focus marker contrast (problem 3).
Plan 380-11 (navigator and book): confirm the state label spelling (names of the states table or the visible labels of the asset); one spelling of three state names in the book (proposed terminal guide, states table, asset); cobalt on ink fails 3 to 1 and the book has no lighter cobalt for text on ink; the three proposals N5, N6, N7 (opt-out segment, secondary text token, Desktop and Cowork fallback); HOLLOW ruling; the widened word list for stack words in registry why lines (/mos:skill, /mos:new-surface, /mos:dogfood-flush, /mos:graph, /mos:dial-memory-refresh, /mos:explain-decision, /mos:memory-cortex-reach); badge order "Theo | MindrianOS" against brand rule 3; adopt the book workflow in the plugin repo (the repo has no .mindrian intake); N1 stale "Canon v5" text.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access or schema in the panel. T-380-25 is mitigated (scratch consumer, status compared before and after, exit 1 on a difference; the live count equals BOOK_STATUS_BEFORE_COUNT). T-380-26 (proposed segment cited as proposed) is mitigated in the README and in the evidence, gated by D5. T-380-27 (color alone) is partly mitigated: K2, K4 and the plain-mode test keep words on every meaning; the focus marker remains open (problem 3). T-380-28 (blue read as proof) is mitigated by K4 and the README.

## Not measured

- No real-terminal capture of the states other than Rest. The idle CPU of the panel is still plan 380-10.
- The branch tree has two modified files that are not mine (380-CONTEXT.md and scripts/__pycache__/compute-hsi.cpython-312.pyc). Not touched, not staged. STATE.md and ROADMAP.md were not written (a peer may be executing; the orchestrator owns them).

## Self-Check: PASSED

- Files found: ui/mos-face/tests/colors.test.tsx, ui/mos-face/tests/canon.ts, tests/test-380-decisions.cjs, ui/mos-face/scripts/book-review.cjs (release tree); 380-BOOK-REVIEW.md (branch tree).
- Commits found: 476a17c4a, 796553769, 46ec7226f, e8c3f1a06, b4e0dc950 (release tree `git log`), 1b6a677be (branch tree).
