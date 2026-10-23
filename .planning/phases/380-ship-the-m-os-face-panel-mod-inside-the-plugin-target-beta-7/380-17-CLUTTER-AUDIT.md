# 380-17 clutter audit of the current panel

Date: 2026-10-24. Code read: release tree main at d1c7bc205 (plan 16 done). Shots read: real-6, real-7, real-8, real-10 (real-9 is a byte copy of real-8; cmp reported identical). Method: tui-design skill (the clutter audit, responsive floor), mindrian-tui-consult skill (review output), mos-brand book e947a5d GUIDE.md of segments/experience/terminal (status proposed). No product code changed in this task.

Labels: PROVEN = an opened image or a mounted run shows it. UNVERIFIED = props or code only. PREFERENCE = taste of a skill.

Two limits to know first.
- The panel in the shots is about 85 columns wide (PROVEN: the 79 character Job line spans 750 of 808 pixels). The mounted panes are 56, 44, 35 columns and two short sizes. Wrap counts of the mounted panes are estimates from character length (UNVERIFIED, no paint is produced).
- The shots were taken with plugin beta.73, before plan 16. The Job hint in real-6 is the old wording. Counts do not depend on it.

## 1. The shots, counted (all PROVEN unless noted)

Row pitch is 19 pixels in the 2000 pixel shots. real-6 pane: first row at y 64, last at y 807, so (807 - 64) / 19 + 1 = 40 rows. The list below accounts for all 40.

### real-6.png (idle, unbound, whole overview, no list open)

| Class | Rows | Share of 40 | What |
|---|---|---|---|
| Bright planes | 10 | 25% | face tile 6 rows (shares its rows with the 3 label rows), context canvas 4 rows |
| Blank separators | 8 | 20% | one blank Text row between blocks |
| Headings | 4 | 10% | WRITES TO, NOW, NEXT, ASK |
| Button rows | 6 | 15% | 12 buttons: Bind a room, Fix, Ask Theo now, Words, Whole room, Sections, 5 lights, Refresh |
| Hint rows | 3 | 8% | "Theo will suggest...", the sent line, "click, or type..." |
| Data rows | 9 | 23% | Context, ROOM, FILED, STALE, HEALTH, NEXT MOVE, Job, THEO, VERSION |

Total 40. Rows that are not data: 31 of 40. Data rows are 9 of 40.

### real-7.png (Sections open, team open, scrolled, header off the top)

The face, the label and the quote are not on screen (the first visible row is the canvas). Pixel pitch 28, first row y 102, last y 1516: 51 rows. Of them: 10 section rows and 7 file rows are buttons (17 of 51, 33%), the "+4 more sections" row, 4 canvas rows, 7 blank rows, 4 headings. The tree is taller than the room, so the host scrolled the body. PROVEN.

### real-8.png (the contradiction, legal-ip open)

52 rows (first row y 58, Refresh row y 1039, pitch 19). The face tile is cut at the top (2 of 6 rows show). 10 section rows and 5 file rows are list buttons (15 of 52, 29%). "Theo was not asked" and "Theo was sent" show in the same block (G1, fixed in plan 16). The host line "denied by auto mode, Classifier unavailable" is outside the pane.

### real-10.png (9 percent, an open list of 15 files)

52 rows (first row y 48, last y 1028). The face, the label, the header and the Refresh row are off screen. 25 rows are list buttons (10 section rows, 15 file rows) plus a path row; with the 4 other button rows that is 29 of 52 (56%). All 4 canvas rows show and the painted blue strip is the 9 percent reading; "Context 9% - ok" is the only text of the gauge. PROVEN.

## 2. The mounted panes, counted

Source: a throwaway test in a scratch copy of ui/mos-face outside both repos (deleted after the run). The lists are in 380-17-evidence/rows-WIDTHxROWS.txt. Room bound, fixture files, no usage yet (the idle gauge).

| Case | Face | Canvas | Rows if nothing wraps | Rows with estimated wrap |
|---|---|---|---|---|
| 56 by 40 | 6 rows, 12 cells | 4 rows | 40 | 47 (UNVERIFIED) |
| 44 by 24 | 4 rows, 8 cells | 4 rows | 38 | 46 (UNVERIFIED) |
| 35 by 24 | words only | none | 33 | 46 (UNVERIFIED) |
| 56 by 40, NO_COLOR | words only | none | 33 | 40 (UNVERIFIED) |
| 76 by 9 (short, an 80 by 24 inline pane) | 4 rows | none (short) | 34 | 37 (UNVERIFIED) |
| 56 by 9 (short, a 60 column split) | 4 rows | none (short) | 34 | 41 (UNVERIFIED) |
| 29 by 24 | the too-small state | none | 2 | 2 |

## 3. The four counts

### (a) Border-nesting depth (Border)

| Path from the terminal edge | Borders | Which |
|---|---|---|
| To a plain text row, dock | 1 | the host pane frame (the vertical rule at the left of the dock, and a row of its own for the close mark) |
| To a button label, dock | 2 | the host pane frame, then the host square brackets of the button |
| To a button label, inline above the prompt | 3 | the frame draws top and bottom borders (2 rows, from the Pane remark "an inline border's two"), then the brackets (UNVERIFIED: inline not seen) |
| Grounds (planes, not borders) | 2 | the ink ground of the whole panel, and a raised grey ground behind every button (12 of 12 buttons) |

The panel draws no border of its own (borderStyle is empty in every Box of the rows files). Depth 2 to a label is within the rule "more than one border is usually too much" by one, and the second one is the host's bracket, which a mod cannot remove (Button is host drawn). Verdict: no cut inside the mod.

### (b) Signals per state (Signals)

| State | Signals in the panel | Where | Label |
|---|---|---|---|
| Stale reasoning | 4 | STALE row, NOW heading words, Fix button, "Room stale" light | PROVEN real-6 |
| Session not bound | 3 in the panel plus 1 outside | heading words "nothing - this session is not bound", Bind a room button, and the ROOM row that names another room (jhtv-oliver-kuntz) two rows below; the host line "not bound to a room" is outside | PROVEN real-6 |
| Context waiting | 2 | eight white boxes (a picture), "Context: waiting" (words); the host line shows no context | PROVEN real-6 |
| Theo health | 2 plus 1 outside | THEO row, "Theo ok" light; the host line shows a brain icon with "on" | PROVEN real-6 |
| Next move none yet | 2, and a conflict | "NEXT MOVE none yet", "Theo will suggest once the talk gives something to go on."; the host line beside it says "Next: ship-native-fire" in real-6 and real-8 | PROVEN real-6 (the cause of the disagreement is UNVERIFIED) |
| Words sent to Theo | 2 | the Words: shared button, the sentence "Theo is sent a short excerpt of your own words..." | PROVEN real-6 |
| New file in a list | 3 | the diamond marker, the word "new", the blue ground | PROVEN real-7 |
| Suggestion hint, when Theo has an answer | 2 rows with the same instruction | "click: a question about your case goes in the prompt box..." and "click a number: a question about your case goes in the box..." (register.tsx, NEXT block) | UNVERIFIED (code, both rows draw when a framework and commands exist) |

### (c) Markers present on every row of a kind (Markers)

| Marker | Rows that carry it | Rows of the kind | Share | Reading |
|---|---|---|---|---|
| Cobalt bar before the heading | 4 | 4 headings | 100% | marks nothing; the capital words already mark a heading (PREFERENCE) |
| Triangle on a light | 5 | 5 lights | 100% | it does carry open or closed, but all are closed at rest |
| Triangle on a section row | 10 | 10 section rows (real-7) | 100% | 9 of 10 closed, so the mark shows the default |
| Square brackets on a button | 12 | 12 buttons (real-6) | 100% | host drawn, cannot be removed |
| Greater-than on a folder entry | 3 | 8 entries (real-7) | 38% | carries information (a folder) |
| Diamond new | 3 | 8 entries (real-7) | 38% | carries information, but said 3 times (see b) |

### (d) Chrome share (Chrome)

Class rules: data = a fact row (Context, ROOM, FILED, STALE, HEALTH, NEXT MOVE, Job, THEO, VERSION). Chrome = heading, hint line, light row, refresh row. Button row = a row of buttons. Blank = a blank separator. Bright = face and canvas.

| Case | Data rows | Chrome rows | Button rows | Blank rows | Bright rows | Data characters | Chrome characters | Non data rows per data row |
|---|---|---|---|---|---|---|---|---|
| real-6 (shot) | 9 | 7 | 6 | 8 | 10 | not counted | not counted | 3.4 |
| 56 by 40 | 10 | 12 | 7 | 8 | 10 | 282 | 394 | 3.7 |
| 44 by 24 | 11 | 12 | 7 | 8 | 8 | 282 | 386 | 3.2 |
| 35 by 24 | 13 | 16 | 9 | 8 | 0 | 273 | 391 | 2.5 |
| 56 by 40, NO_COLOR | 10 | 15 | 7 | 8 | 0 | 273 | 404 | 3.0 |

Rows in the mounted cases include the estimated wraps (UNVERIFIED). Characters: the chrome text is longer than the data text in every case (394 against 282 at 56 by 40). The blank separators are 8 rows (20% of the 40 rows of real-6), the hint rows 3.

The pixel share of the two bright planes in real-6 is 10 of 40 rows (25%), and in idle they carry no information (eight white cells, one word row below).

## 4. The floor test (Floor)

Host facts (PROVEN, read in .claude-plugin/types/claude-code/index.d.ts): the pane docks beside the transcript only in fullscreen from 110 columns; otherwise it sits inline above the prompt (Pane placement). The band above the prompt is capped at half the terminal rows, the prompt included (AbovePrompt maxRows remark). scroll.bodyRows is the room for the body, never the rows showing (Pane scroll remark). The Pane remark says that inline the frame fits the tree; how much of the height an inline pane may take is not stated (UNVERIFIED for a Pane, PROVEN as a rule for AbovePrompt).

### 80 by 24

- Placement: inline, since 80 is under 110 (PROVEN by the type remark, not seen on a screen).
- Room: about 9 rows after the prompt and the two border rows if the AbovePrompt rule applies (UNVERIFIED for a Pane). The panel then takes the short path (bodyRows under 24, register.tsx): the face is 8 cells, the canvas folds, and the gauge becomes words.
- The overview is 34 rows if nothing wraps and about 37 with wrap (the 76 by 9 case). That is 3.8 times the room. The host scrolls the body. What wins: the head (face, label, quote, Context, WRITES TO). What hides: NOW and its Fix button (row 15 of 34 when unwrapped), NEXT, Job, THEO, VERSION, ASK, the lights, Refresh. The row with the most important action (NOW and Fix) is below the fold, and nothing in the panel decides that it should come first. UNVERIFIED on screen, PROVEN by the row lists.
- What truncates: the header lines (Text with truncate-end). What wraps: the Job line (105 characters) and the hints (the skill says truncate, do not wrap; here prose wraps and each wrap costs a row).
- Drill-down: the Sections list and the lights open in place and grow the body. There is no drill-down that replaces the overview, so an open list pushes the head out (G2, PROVEN in real-7, real-8, real-10).

### In a 60 column split (60 by 24)

- Placement: inline (under 110). Inner width 56 (the 56 by 9 case). Tier wide (50 or more), face 8 cells in short mode.
- Overview 34 rows unwrapped, about 41 with wrap, against about 9 rows of room (UNVERIFIED). Same winner and same hidden rows as at 80 by 24, with 7 more rows lost to wrap (NOW 55 characters, the hints, Job 105, the lights row 49 characters).

### Narrow and plain

- 35 columns: words replace the face and the canvas (33 rows unwrapped, about 46 with wrap). 40 columns is the narrow threshold in code (tier). NO_COLOR gives the same words only layout (33 rows).
- Below 30 columns the truthful too-small state shows (PROVEN by the 29 by 24 run): "/m:os needs 30 columns" and "Widen the panel. The status line and /mos-state still work." There is no too-short state: a short pane folds the pictures and then scrolls.

## 5. Verdict (in the shape of the consult skill)

Verdict: usable and honest in the main, but tall and said twice: the overview is 40 rows with 9 of data, and its key action sits below the fold on every small screen.

The five worst problems, each with the exact fix and a label.

1. The overview is 34 to 40 rows and every open list grows it, so the face, header and gauge scroll away (real-7, real-8, real-10) and at 80 by 24 or in a 60 column split NOW and its Fix button are hidden. Fix: cap the Sections list and its file list with "+N more" (hooks/register.tsx sectionList, the entries map), or pin the head. PROVEN for the shots, UNVERIFIED for the inline sizes. Applied by plan 18.
2. Same state said 3 or 4 times, and two disagreements. STALE row, NOW heading, Fix button and the Room stale light all say stale reasoning (4). ROOM names a room right under "nothing - this session is not bound". The panel says "NEXT MOVE none yet" beside a host line that says "Next: ship-native-fire". Fix: drop the STALE fact row when NOW already names the stale sections (hooks/lines.ts roomFacts); say in the ROOM row that the room shown is the last used one, not the bound one; find why the panel next move differs from the line. PROVEN (real-6), cause of the third UNVERIFIED. Needs a ruling.
3. The idle gauge: 4 rows of eight blank boxes plus a 6 row face are 10 of 40 rows (25%) and tell nothing while Context is waiting. Fix applied in this plan: the words beside the boxes say they are the context gauge and wait for the first reply. A cut of the canvas rows while idle would save 4 rows. PROVEN. The label is applied here. The cut needs a ruling.
4. Eight blank separator rows and three hint rows are 11 of 40 rows (27%), and in the 80 by 24 case they push the first action off screen. Fix: in the short path drop the 8 blank Text rows (register.tsx, the Text with a single space) and fold the three hints into the heading words. UNVERIFIED on screen, PROVEN by the row lists. Needs a ruling.
5. A mark on every row: the cobalt bar on 4 of 4 headings, the triangle on 15 of 15 lights and section rows, and the diamond plus "new" plus blue ground for one fact. Fix: drop the bar before headings and keep one signal for new entries. PREFERENCE. Needs a ruling.

Still needs a real screen: an inline pane at 80 by 24 and in a 60 column split (plan 10), the real height an inline pane may take, and the paint of the idle gauge words.

## 6. The cut list

Plans 16, 17 and 18 apply only what closes G1 to G7. Every other cut is listed and not applied in this phase run. The full rubric score of the consult skill is not produced here: the inspection of plan 10 owns it.

| Cut | Audit count | Label | Who applies it |
|---|---|---|---|
| Cap the Sections list and the file list (+N more) | 15 to 25 list buttons of 51 or 52 rows in real-7, real-8, real-10 | PROVEN | plan 18 (G2) |
| Label the idle gauge in words | 10 of 40 rows bright and silent | PROVEN | plan 17 (G5), done in Task 2 |
| Drop the idle canvas rows until the first reading | 4 rows | PROVEN count, PREFERENCE cut | applies: needs a ruling |
| Drop the STALE fact row when NOW says it | 4 signals for one state | PROVEN | applies: needs a ruling |
| Say that ROOM is the last used room when the session is not bound | 1 contradiction | PROVEN | applies: needs a ruling |
| Find why NEXT MOVE says none yet beside "Next: ship-native-fire" | 1 disagreement | PROVEN, cause UNVERIFIED | applies: needs a ruling |
| Drop the 8 blank separator rows in the short path | 8 of 40 rows | UNVERIFIED on screen | applies: needs a ruling |
| Fold the three hint rows | 3 of 40 rows | UNVERIFIED on screen | applies: needs a ruling |
| Drop the two duplicate click hints when Theo has an answer | 2 rows | UNVERIFIED (code) | applies: needs a ruling |
| Drop the cobalt bar before headings | 4 of 4 | PREFERENCE | applies: needs a ruling |
| Keep one signal for a new file (not three) | 3 signals | PROVEN count, PREFERENCE cut | applies: needs a ruling |

## 7. Why the idle gauge is labelled and not dimmed (G5, D-11)

Dimming the eight boxes would change the idle pixels. The 18 pins of tests/meter-pin.test.ts (including the undefined case) fix those pixels and are not edited. A dimmed fill needs a secondary-on-ink color. The book has none: GUIDE.md, Ground and color, says "the book has no token for secondary text on ink. The panel uses dimmed paper", and D-11 forbids an invented hex. So the words change and the boxes stay. The book segment is status proposed.
