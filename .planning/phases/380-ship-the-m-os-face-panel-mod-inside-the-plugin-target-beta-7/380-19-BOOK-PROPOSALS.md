# 380-19 book proposals (draft segment text; the book is not edited)

Source: mos-brand book e947a5d, segments/experience/terminal/entries/2026-10-20/GUIDE.md. Status of the cited segment: proposed. Line numbers are as cat -n prints them. Plan 11 folds these proposals into the follow-up list. Later tasks of plan 19 append here only when they find a rule the book lacks.

## P19-1 Status words and the Job above the decisions in a panel that has little room

Cited lines: 91 (Order: "Decisions first") and 107 ("decisions stay on top"). Conflict: the owner ruled for this panel (D-08 and the card of gap 1, 2026-10-24) that the room, filed count, version, context and the Job line come before the decisions, because a docked panel of 35 rows and an inline pane of 6 rows hide everything that stands low.

Paste-ready text for the Side panel template, Order row:

> When a panel has fewer than 12 rows, the status words come first: the room, what is filed, the version, the context and the Job line, one row each. The decisions follow, and the pinned status line says the one state that needs action in one breath, so the decision stays on screen even when the panel has no room for it.

Why: the first real run showed the Job, the buttons and four status rows below the fold at 120 by 40 and out of view at 80 by 24. Status of the cited segment: proposed.

## P19-2 Compaction follows the width of the screen; the width ladder follows the width of the panel

Cited lines: 28 ("compact it below 60 columns") and 99 to 107 (the Width ladder, 50 columns or more shows the tile). The two lines can be read as one rule on one width. A docked panel is 46 columns on a screen of 110 columns or more, so a panel-width reading of line 28 would drop the tile from every docked panel while the ladder keeps a smaller tile from 40 columns.

Paste-ready text for the Rules that hold everywhere list:

> Compact means the screen is under 60 columns wide: words and a text bar, no face tile, no canvas, every action kept. The Width ladder is about the width of the panel itself, and it applies on a screen that is not compact.

Why: the owner ruled this reading on 2026-10-24. Status of the cited segment: proposed.

## P19-3 The fold under 24 rows also folds the tile to a words row; under 12 rows the Job takes one row

Cited line: 107 ("Under 24 rows: Pictures fold to words; decisions stay on top"). The book is silent on how many rows a words header takes and on blank rows.

Paste-ready text for the Width ladder, rows part:

> Under 24 rows the face tile and the canvas fold to words: one header row with the line face and the state word, and a text bar for the context. Under 12 rows the Job line takes one row and no blank row stands between the header, the status words and the Job.

Why: at 6 rows (an inline pane at 80 by 24) four tile rows and a blank row use five of the six rows. Status of the cited segment: proposed.

## P19-4 The band under 60 columns, under 30 columns and under NO_COLOR

Cited lines: 24, 28, 96, 97 and 106.

Paste-ready text for the States and Plain mode rows:

> The band above the prompt follows the panel. Under 60 columns of screen it draws words only. Under 30 columns it draws one message that names the 30 columns it needs. Under NO_COLOR or plain mode it draws the line face and the state word, never block bars.

Why: the first real run showed six white bars under NO_COLOR and nothing at 28 columns (nocolor.png, small.png). Status of the cited segment: proposed.

## P19-5 A button label never wraps

Cited: the layout bug table of the terminal consult skill ("a label that wraps away from its brackets: shorter label, one line"), and line 27 of the guide (never draw something that looks pressable unless a real mechanism presses it; a button that breaks over two lines looks broken).

Paste-ready text for the Rules that hold everywhere list:

> A button label stays on one line. When the line is short, a shorter label takes the place of the long one (for the dashboard button, /m:os in place of /m:os dashboard) before the hint text wraps.

Why: the dashboard button wrapped over two lines at 50 columns and split inside a word at 28 columns (narrow.png, small.png). Status of the cited segment: proposed.

## P19-6 A room shown that is not the bound room says so on its row

Cited line: 92 (One signal). When the session is not bound, the room tools still return the registry's active room. A row that names that room without a word that it is not bound contradicts the row that says nothing is bound.

Paste-ready text for the One signal row:

> A room that is shown but not bound to this session says "not bound" on its own row. The word stands where the room is named, so the two rows never disagree.

Why: installed/wide.png shows ROOM demo-room beside WRITES TO nothing. Status of the cited segment: proposed.

## P19-7 A service that was not checked is not a service that failed

Cited line: 96 (States: initial, partial and error each have words) and the honesty rule above the priority order.

Paste-ready text for the States row:

> A service that was not checked says "not read". It never says "not answering". Only a check that ran and failed says the service failed.

Why: NOW said Theo was not answering when no Theo host was recorded and nothing had been checked, while the THEO row said on (380-19-FACTS.md, gap 13). Status of the cited segment: proposed.

## P19-8 Balanced pages

Cited lines: 94 (Folded parts: one line each, the last good reading visible) and 95 (Keyboard routes: every button has a slash command). The book is silent on long lists. The tui-design skill (Tables and lists: virtualize lists that grow; keep positions stable) is the ground.

Paste-ready text for the Rules that hold everywhere list:

> A long list is split into pages of even size. Every page holds the same number of names or one name fewer. No page is empty, and the last page is never one name. The controls stay right under the last row of the page and do not move between pages.

Why: 18 names in a window of 17 gave pages of 17 and 1, and page 2 drew one name over 16 empty rows (tree-sections-p2-small.png of plan 380-10). Status of the cited segment: proposed.

## P19-9 The crumb

Cited line: 95 (a hint line names the routes) and the tui-design skill (truncate paths with a mark so the last part survives and the root is not lost). The book is silent on paths.

Paste-ready text for the Rules that hold everywhere list:

> A path line keeps the root name. When the path is too long, the middle folders become the mark ~, and the last name is cut at its end with the mark. A path never starts with the mark.

Why: the crumb was cut at its start, so "demo-room / archive-2000" became "~rchive-2000" and the room name was lost (tree-2000-p1-small.png). Status of the cited segment: proposed.

## P19-10 A pane too short for a view says what the person can do

Cited line: 96 (States: too small names what it needs). The line names the width of the band. The book does not say what to do when the rows are too few.

Paste-ready text for the States row:

> Too small names what it needs and what the person can do: make the terminal taller, or dock the panel, and the width that docking needs. A too small pane never prints the content of the view as text.

Why: the inline pane of an 80 by 24 terminal gets about 6 rows, so the tree showed a cut line and Close only (tree-inline-80x24.png). Owner ruling of gap 5, 2026-10-24. Status of the cited segment: proposed.

## P19-11 A cap note has a row of its own when it does not fit

Cited line: 96 (States: partial has words). A list cut by a cap is a partial state and must say so. The book does not say where the words go.

Paste-ready text for the States row:

> A list cut by a cap says how many names show and how many exist (first 300 of 2000). When the path, the counter and these words do not fit one row, the words take a row of their own. The path keeps its whole name.

Why: the counter row held 30 cells and left 12 for the crumb (tree-2000-p1-small.png). Status of the cited segment: proposed.
