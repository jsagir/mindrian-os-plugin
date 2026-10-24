# 380-20-SCREENSHOTS: the final gate, image by image (plan 380-20)

## Gaps (read first)

STATUS DONE for every pass condition of the table of plan 380-20 that the panel code owns. Two conditions are not a plain pass:

1. Gap 12 (the load notice): the notice is now one short box (PROVEN: wide.png, std.png). It still covers host text when the screen is 50 columns or 28 columns wide (PROVEN: narrow.png, small.png). The box is drawn by the host; the panel gives only the text. Class: host behavior. It goes to the owner list. At 80 and 120 columns it covers nothing (PROVEN: std.png, wide.png). In job-hint.png the box is already gone, so that image does not show it (UNVERIFIED for that image).
2. Gap 13, the part "THEO row and NOW agree": the THEO row is below the last row at 120 by 40 (pane-wide.png, installed/wide.png), so those two images cannot show it. sent-denied.png at 140 by 45 shows the THEO row (on) and a NOW line that says nothing about Theo, so the two agree there (PROVEN).

Gap 10 (the Handover face) is not in scope: it needs a ruling. Gap 11 is closed for the ROOM row on the panel; the name that the plugin status line shows is a separate owner item (scripts/context-monitor, outside ui/mos-face).

One defect of this plan was found by the final gate and fixed (loop 1 of 2): the first capture set showed the typed /mos-tree answer "1-17 of 300" beside a pane that drew "1-16 of 300" after the cap note row took one row. Cause: the command paged with the window of the last drawn view, before the pane drew the new folder. Test TF9 failed first (380-20-evidence/red-tf9.txt), the fix is commit "fix(380-20)", the dist was rebuilt and every image in this record was captured again (the first set was thrown away). In the final images the pane and the text agree (tree-2000-p1-small.png 1-16 of 300 in both; tree-2000-p1-big.png 1-25 of 300 in both).

## Mode (protocol Rule 5)

Every PNG named in this record was opened with the Read tool by the executor, in the final run. A result is PROVEN only for what an opened image shows. The .txt and .ansi files were used only to confirm what I saw and for the word and dash searches. A check that an image does not show is UNVERIFIED, never a pass. No prompt was typed and no model was called: the driver typed only registered slash commands, after it read the prompt line.

## Tools

claude 2.1.310 (Claude Code), tmux 3.7, Playwright 1.58.2 (chromium), node v22.23.1 (screens-19/index.json). Truecolor sequences are present in every capture except the NO_COLOR ones. The capture draws the tmux screen in the harness font (DejaVu Sans Mono) on the harness ground (#2b2b2b), not the person's font. Load average at the runs: 2.6 to 5.9 (index.json), under the limit of 6.

## Subject

A byte copy of lib/mos-face/dist of the release tree (25 files, every sha256 equal to dist/manifest.json, 0 mismatches; source hash e80290edf88dbb45), laid out like the shipped wiring (lib/mos-face/dist, hooks/mos-face.json, plugin name mos). Release tree HEAD 7c710db04 (branch main, not pushed). The installed images use the packed payload of the same tree (npm pack --ignore-scripts, npm ci --ignore-scripts, 137 packages). Scratch HOME, scratch config folder, login by symlink only; MINDRIAN_BRAIN_URL was http://127.0.0.1:9 for the installed run (dead on purpose, Canon Part 8). The scratch root was deleted after the record was written.

## Deviations from the plan text (root causes)

1. The first full capture set (dist of commit 39b5ea442) was thrown away after the TF9 fix; all images here come from the second set. Root cause: the defect above.
2. The scratch root sits under the session scratch folder, not mktemp -d in the system temp folder, because the session rule names that folder. It holds no repo file.
3. explore-list.json: the captures were renamed explore-list-before and explore-mos-tree-list, as the plan says. The driver files are the plan 380-19 files with the scratch path replaced (copy in 380-20-evidence/capture-driver, home paths of the harness left in the scripts, not in the images).
4. The docked pane at 120 by 29 draws the words header (the pane has under 24 body rows there), so a window of 14 rows (tile header) did not occur; the pages of 9 names come from the window of 17 rows (TF3 pins the same split by test).

## Images, one by one

Each table row: the gap or check, the result, what I saw, the label. C7 (no dash, ICM, Brain, MCP in the panel area) and C10 (no real room name or home path) hold for every image: the word search of every .txt found no dash, no ICM, no Brain, no MCP and no home path (section "Word and dash hits").

### wide.png (band, 120 by 40)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| regression | pass | the band: tile, Theo | MindrianOS, [ Hide ], Rest | Theo 0 this turn, 0 in all, the quote, [ /m:os dashboard ]; the load notice is one box at the top right and covers no host text | PROVEN |
| gap 12 | pass at this width | one short box "/m:os loaded. /mos-state opens it." | PROVEN |

### std.png (band, 80 by 24)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| C1 | pass | the band fits, the words are readable, no half row | PROVEN |
| gap 12 | pass at this width | one short box at the top right; the host cwd line is whole | PROVEN |

### narrow.png (band, 50 by 30)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 2, C2 | pass | no tile; the words "[o|o] Rest | Theo 0 this turn, 0 in all", the quote cut with ~, [ Hide ] and the dashboard button are on screen | PROVEN |
| gap 4 (button) | pass | the dashboard button is the short label [ /m:os ] on one line, no split word | PROVEN |
| gap 12 | host behavior | the box covers the host header: only C, O and / of the first three header lines remain | PROVEN |
| new finding | minor | a grey block sits under the right of the button row, right of "for agents" (cause UNVERIFIED, looks like host select shading) | PROVEN (image); cause UNVERIFIED |

### nocolor.png (band, 80 by 24, NO_COLOR)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 3, C3 | pass | no white bars; the line face and the state word "[o|o] Rest | Theo 0 this turn, 0 in all" show as words; [ Hide ] and the dashboard button show as plain text | PROVEN |

### small.png (band, 28 by 20)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 4, C5 | pass | the band says "/m:os needs 30 columns" (two rows) and has [-]; the dashboard button is [ /m:os ] on one line, no split word | PROVEN |
| gap 12 | host behavior | the box wraps to two rows and covers the host notice text (only fragments "au", "ch", "ri", "in", "ex" remain) | PROVEN |

### chip.png (band, 100 by 30)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| regression, C11 | pass | the chip "Larry | MindrianOS" is the reply's own lead (quoted); the band below reads as before | PROVEN |

### pane/pane-wide.png (docked, 120 by 40)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 1 | pass | tile and label, then ROOM, FILED, VERSION, the Context gauge row, the whole Job block (heading, statement, [ Not this ], [ Fix: /mos:jtbd set ]), then WRITES TO, NOW and NEXT headings | PROVEN |
| gap 13 | pass for NOW | NOW says "1 section have reasoning older than their files"; it does not say Theo is not answering | PROVEN |
| gap 13 (THEO row) | not shown | the THEO row is below the last row | UNVERIFIED |
| C12, C13 | pass for the rows shown | the Job block is whole at 120 by 40 (it was cut in plan 10) | PROVEN |
| regression (idle gauge) | unchanged | eight white boxes and the label "Context gauge: waiting for the first reply" (P17-2, PREFERENCE) | PROVEN |

### pane/pane-std.png (inline, 80 by 24)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 1 | pass | the first rows are the words header "Theo | MindrianOS [o|o] Rest", ROOM, FILED, VERSION, Context, the Job row (cut at the right edge); no tile, no canvas | PROVEN |

### pane/pane-inline-60x24.png (inline, 60 by 24)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 1 | pass | the same six rows; the Job row is cut at the right edge | PROVEN |

### pane/pane-narrow.png (inline, 50 by 30)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gaps 1 and 2 | pass | words header, ROOM, FILED, VERSION (cut with ~), Context in words, the Job row, then [ Not this ] [ Fix: /mos:jtbd set ] and the WRITES TO heading; no tile | PROVEN |
| text bar | not shown | a text bar appears only with a context reading, and none exists here | UNVERIFIED |

### pane/pane-nocolor.png (inline, 80 by 24, NO_COLOR)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| regression, C3 | pass | words only, a single line frame, ROOM, FILED, VER, Context, Job row; the chat chip is plain "Larry | MindrianOS" | PROVEN |

### pane/pane-small.png (inline, 28 by 20)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| regression, C5 | pass | "/m:os needs 30 columns" and the line that says to widen the panel and that /mos-state still works | PROVEN |

### pane/tree-inline-80x24.png, tree-inline-60x24.png, tree-inline-50x30.png, tree-inline-nocolor-80x24.png (gap 5)

| Image | Result | What I saw | Label |
|-------|--------|------------|-------|
| tree-inline-80x24.png | pass | the pane says "/m:os needs 9 rows to browse the room", then "Make the terminal taller, or dock the panel.", "Docking needs a terminal 110 columns wide.", "Or type /mos-tree in the prompt box.", then [ Close ]; no section or file name inside the pane; the chat text above is the page of the typed command (1-9 of 18) | PROVEN |
| tree-inline-60x24.png | pass | the same four lines and Close; chat text 1-9 of 18 | PROVEN |
| tree-inline-50x30.png | pass | the same four lines and Close, none cut at 50 columns; the chat text wraps its hint line. The grey block beside the dashboard button (see narrow.png) shows again | PROVEN |
| tree-inline-nocolor-80x24.png | pass | the same four lines and "[ Close ]" as plain text in a line frame | PROVEN |

### pane/tree-2000-p1-small.png (gap 6)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 6 | pass | the crumb is "demo-room / archive-2000" whole, the counter "1-16 of 300" on the same row, and "first 300 of 2000" on a row of its own under it; 16 file rows; Up, Next, Find, Close; the typed answer also says 1-16 of 300 | PROVEN |

### pane/tree-sections-p1-small.png and tree-sections-p2-small.png (gap 7)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 7 page 1 | pass | "demo-room 1-9 of 18", 9 names, then [ Next ] [ Find ] and [ Close ] directly under the last name | PROVEN |
| gap 7 page 2 | pass | "demo-room 10-18 of 18", 9 names, no empty row, [ Previous ] [ Find ] and [ Close ] directly under the last name, at the same place as on page 1 | PROVEN |

### pane/explore-mos-tree-list.png and explore-list-before.png (gap 8)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 8 | pass | after /mos-tree list the chat shows the page ("all 18" and the 18 names), not the usage line, and the pane shows the browse view | PROVEN |
| before image | context | explore-list-before.png shows the overview (ROOM, FILED, VERSION, Context, Job, WRITES TO, NOW, NEXT) before the command | PROVEN |

### pane/sent-denied.png (gap 9)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 9 | pass | the chat text says "Asking Theo. If Theo is reached, it gets ... The panel says what went, or that nothing did." and does not say "are sent"; the pane says "Theo was not asked: the call was not allowed" | PROVEN |
| gap 13 (THEO row) | pass | the pane shows THEO on and the NOW line says nothing about Theo | PROVEN |

### pane/sent-answered.png (regression)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| regression | pass | the pane says Theo was sent the excerpt and names what was left out (a link, code) | PROVEN (against a stub, not Theo) |

### pane/job-hint.png (gap 12 and the hint)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| job hint | pass | "Job: no guess yet. Say what you want to decide, test or find, in two different phrases, and one may come." | PROVEN |
| gap 12 | not shown | no load notice box on this image | UNVERIFIED |

### pane/tree-toosmall-120x13.png, tree-sections-big.png, tree-2000-p1-big.png, tree-2000-p2-big.png, tree-folder16-small.png, tree-folder16-big.png, tree-find-legal-small.png, tree-find-legal-big.png, tree-cleared-big.png (regression)

| Image | Result | What I saw | Label |
|-------|--------|------------|-------|
| tree-toosmall-120x13.png | pass | the docked pane of 8 rows: the four plain lines and [ Close ]; no name | PROVEN |
| tree-sections-big.png | pass | tile header, "demo-room all 18", 18 section rows, Find, Close, hint, Refresh; one page | PROVEN |
| tree-2000-p1-big.png | pass | "demo-room / archive-2000 1-25 of 300" whole, "first 300 of 2000" on its own row, 25 file rows, Up, Next, Find, Close; the chat text says 1-25 of 300 | PROVEN |
| tree-2000-p2-big.png | pass | "26-50 of 300", Up, Previous, Next; the chat text says 26-50 of 300 | PROVEN |
| tree-folder16-small.png | pass | "demo-room / evidence-16 all 16", 16 rows on one page, Up, Find, Close | PROVEN |
| tree-folder16-big.png | pass | the same 16 rows with the tile header | PROVEN |
| tree-find-legal-small.png, tree-find-legal-big.png | pass | 'demo-room 2 matches for "legal"', two rows, Find, Close | PROVEN |
| tree-cleared-big.png | pass | back to "all 18" | PROVEN |

### installed/wide.png and installed/band.png (gaps 11 and 13, the packed layout)

| Check | Result | What I saw | Label |
|-------|--------|------------|-------|
| gap 11 | pass | ROOM reads "demo-room, Discovery stage, not bound" beside "WRITES TO nothing - this session is not bound" and [ Bind a room ]; the two rows agree | PROVEN |
| gap 13 | pass for NOW | NOW says "This room has no identity yet, so its reasoning cannot be trusted to belong to it"; no Theo claim | PROVEN |
| gap 13 (THEO row) | not shown | below the last row | UNVERIFIED |
| plugin status line | open (owner) | the plugin line under the prompt still reads "MindrianOS" for the room and Next: map unknowns | PROVEN |
| band.png regression | pass | the band as in wide.png beside the plugin status line | PROVEN |

## C1 to C14: the best image for each

| Check | Best image | Result | Label |
|-------|-----------|--------|-------|
| C1 fits at 80 by 24 | std.png, pane/pane-std.png | pass | PROVEN |
| C2 under 60 columns: words and text bar | narrow.png, pane/pane-narrow.png | pass for words; the text bar needs a context reading and none exists | PROVEN, bar UNVERIFIED |
| C3 NO_COLOR | nocolor.png, pane/pane-nocolor.png | pass | PROVEN |
| C4 canon colors, badge | wide.png | pass; the Larry words are the quoted chat chip | PROVEN |
| C5 too small names the width | small.png, pane/pane-small.png | pass | PROVEN |
| C6 every pressable has a mechanism | none | tmux cannot click; the unit tests press the keys | UNVERIFIED |
| C7 no dash, ICM, Brain, MCP | every .txt | none found | PROVEN |
| C8 contrast | wide.png, pane/pane-wide.png | readable | PROVEN |
| C9 state name from the book | wide.png | Rest | PROVEN |
| C10 no real name, no home path | every file | none found | PROVEN |
| C11 chip quotes the lead | chip.png | pass | PROVEN |
| C12 status fields | pane/pane-wide.png, pane/sent-denied.png | ROOM, FILED, VERSION, Context, WRITES TO, NOW, NEXT MOVE, STALE, HEALTH, THEO, SPEAKS shown; STANCE, MODE and ASK are below the last row | PROVEN for those shown; the rest UNVERIFIED |
| C13 Job line | pane/pane-wide.png | the whole Job block at 120 by 40 | PROVEN |
| C14 canon faces | wide.png, pane/pane-wide.png | the Rest face is drawn from the asset; the other ten faces were not captured in this plan; the Handover difference is gap 10 (not in scope) | PROVEN for Rest, the rest UNVERIFIED |

## Word and dash hits

| Search | Result |
|--------|--------|
| em-dash or en-dash in any .txt, .ansi or .json of screens-19 | none |
| ICM, Brain, MCP as words in any .txt | none |
| the home path or the user name in any file of screens-19 | none |
| a real room name | none; the only room is the fixture demo-room |
| Larry in a .txt | 15 hits, all the chat chip "Larry | MindrianOS" written by the synthetic reply (quoted, the panel wrote none): chip.txt:10, installed/band.txt:10, installed/wide.txt:10, pane/pane-std.txt:6, pane/pane-narrow.txt:7, pane/pane-nocolor.txt:6, pane/pane-inline-60x24.txt:5, pane/pane-wide.txt:11, pane/sent-answered.txt:11, pane/sent-denied.txt:11, pane/job-hint.txt:10, pane/tree-sections-big.txt:9, pane/tree-sections-p1-small.txt:2, pane/explore-mos-tree-list.txt:4, pane/explore-list-before.txt:10. The installed images also show the host agent name "mos:larry-extended" in lower case: host text, not panel text. |

## Review (mindrian-tui-consult output)

Verdict: the tree and the status words now read at the sizes people use, and the panel claims only what is true; what is left is host behavior and owner rulings.

Five worst problems:

1. The load notice box covers host text at 50 and 28 columns (narrow.png, small.png). Fix: none in the panel (the host draws the box); owner decides whether to delay or drop the notice under 60 columns. PROVEN, host behavior.
2. The idle Context canvas is eight white boxes at 120 by 40 (pane-wide.png) beside the label that already says the same. Fix: fold the idle canvas to the text line after a ruling (P17-2). PROVEN image, PREFERENCE.
3. At 80 by 24 the inline pane has about 6 rows, so the tree cannot be browsed in it (tree-inline-80x24.png). The pane now says what to do. Fix: dock the panel or type /mos-tree; any other route needs a host change. PROVEN; owner ruling of gap 5 kept.
4. A grey block sits beside the dashboard button at 50 columns (narrow.png, tree-inline-50x30.png). Fix: check the width of the host select label against the button text. PROVEN image, cause UNVERIFIED.
5. Words: NOW reads "1 section have reasoning older than their files" and the Job statement says "Hughes 1983 reverse salient" (pane-wide.png). Fix: agree the verb; use plain words for the Job statement (owner list). PROVEN, PREFERENCE for the Job wording.

What still needs a real screen: the person's own font and theme; a click on any button or name; resize after the pane is open; the THEO, STANCE, MODE and ASK rows at 120 by 40; the text bar with a live context reading; a real room (file age, so the new mark is not on every row); Windows; Desktop and Cowork (a deliberate skip).

## The 13 gaps of plan 10

| Gap | Status | Image |
|-----|--------|-------|
| 1 status words and Job before the fold | closed | pane/pane-wide.png, pane-std.png, pane-inline-60x24.png, pane-narrow.png |
| 2 under 60 columns: words, no tile | closed | narrow.png, pane/pane-narrow.png |
| 3 NO_COLOR band | closed | nocolor.png |
| 4 band under 30 columns | closed | small.png |
| 5 the pane too short for the tree | closed (as ruled: the pane says what to do and draws no name) | pane/tree-inline-80x24.png, tree-inline-60x24.png, tree-inline-50x30.png, tree-inline-nocolor-80x24.png |
| 6 the crumb | closed | pane/tree-2000-p1-small.png |
| 7 the pager | closed | pane/tree-sections-p1-small.png, tree-sections-p2-small.png |
| 8 /mos-tree list | closed | pane/explore-mos-tree-list.png |
| 9 "are sent" after a denial | closed | pane/sent-denied.png |
| 10 the Handover face | not in scope (needs a ruling) | none |
| 11 ROOM beside WRITES TO | closed on the panel; the plugin status line room name stays an owner item | installed/wide.png |
| 12 the load notice | open as host behavior (one short box; still covers host text under 60 columns) | std.png, narrow.png, small.png |
| 13 NOW and the Theo claim | closed for NOW; the THEO row beside it shows only at 140 by 45 | pane/pane-wide.png, installed/wide.png, pane/sent-denied.png |
