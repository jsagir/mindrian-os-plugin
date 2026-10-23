# 380-16 book proposals (draft segment text; the book is not edited)

Plan 11 folds these proposals into 380-BOOK-FOLLOWUPS.md as A8 onward. Later plans append to this file.

## P16-1 Amendment to the proposed "Opt-out and consent controls" entry (plan 11, A2)

Paste-ready text for the segment:

> When a person's own words are sent to a service, the screen says what was removed from them before they were sent. It names the kind of thing (a link, an email address, a file path, code, a key-like string, a name, the rest of a long message) and never shows the removed text.
>
> One ask has one honest sentence about delivery. It is one of: sent, may have been received, not asked, or handles only. The panel never shows "sent" and "not asked" for the same ask. A call that failed on the way is "may have been received", never "not asked". A new ask clears the sentence of the old one while it is in flight.

Why: honesty sits above usability and brand in the priority order (mos-brand book e947a5d, segments/experience/terminal, Priority order). "A state is said once" (Side panel template, One signal). Rule 5 of references/brand-rules.md: facts, assumptions and results stay distinct.

Status of the cited terminal segment: proposed.

## P17-1 Idle state of a gauge (plan 380-17, G5)

Paste-ready text for the segment (Side panel template, States row, or the Ground and color part):

> A gauge that has no reading yet says in words what it is and when it fills. It never shows only empty cells. Its blank cells are paper, and no new token is needed to say they are blank. When a reading exists, the words give the figure and its band, and the word gauge is dropped, because a state is said once.

Why: the first real terminal run showed eight white boxes under the face with the word "waiting" below, and the navigator read them as empty boxes (380-USER-SHOTS-FINDINGS.md, G5). The States row says initial and empty each have words, but it does not say what the words must contain. The idle gauge in the panel now says "Context gauge: waiting for the first reply" (mos-brand book e947a5d, segments/experience/terminal, status proposed). Rule 5 of references/brand-rules.md: facts, assumptions and results stay distinct; waiting is not a reading.

## P17-2 White as the color of a blank cell (plan 380-17, G5) - question, PREFERENCE

White (#FFFFFF) is the handover color of Theo's face and, in the color segment, "open material planes and handover" (segments/foundations/color/entries/2026-10-19/content.html). The idle context canvas fills its blank cells with white, so "nothing yet" and "handover" use one color. The book does not rule on this. Question for the navigator: may a blank cell of the gauge stay white, or does the book want a different treatment (for example paper, which is the dimmed-paper question of the secondary-text token)? Nothing was changed for this question. PREFERENCE.

Status of the cited terminal segment: proposed.

## P18-1 Long lists in a side panel (plan 380-18, G7 and G2)

The book is silent on a list that is longer than the room a side panel has. The first real terminal run showed the cost: an open list of 16 files pushed the face and the header off the top (380-USER-SHOTS-FINDINGS.md, G2), and "+4 more sections" was plain text that nothing could reach (G7).

Paste-ready text for the segment (Side panel template, a new row "Long lists"):

> A list that is longer than the room is a window with a counter. The counter says which rows show (for example 1-10 of 14). Page controls appear only when they can act: there is no Previous on the first page and no Next on the last. A filter works from the prompt box, and it shows how many names match. Every depth has a visible way back. A truthful too-small state names the rows it needs and tells the person which command still works. The panel keeps its whole body inside the rows the host gives it, so the host never scrolls the header away. A list that can grow without limit is capped, and the cap is said in words (first 300 of 2000). No name of the list is plain text that cannot be reached.

Why: the Side panel template already says "Order: decisions first" and "Folded parts: one line each, open on a click, one open at a time". It does not say what a folded part does when it is taller than the panel. Honesty sits above usability and brand (segment experience/terminal, Priority order); a hidden name that looks like a count is a small untruth. Status of the cited terminal segment: proposed.

## P18-2 Host facts a mod author needs (plan 380-18)

Paste-ready text for the segment (Measured on a real terminal, or a new part "What the host does not give a mod"). Each line is from the laid claude-code types (380-18-HOST-FACTS.md has the line numbers) and is not yet proven on a real screen:

> The host has no pinned header above a scrolling body. Escape is the person's own key: it returns the focus, and a mod does not bind it. A button hotkey fires only while the pane holds the keys, never from the prompt box. A pane shows its body in a window of scroll.bodyRows rows; a body that is taller is scrolled by the host.

Label: PROVEN as type text, UNVERIFIED on a real screen. The book table "Measured on a real terminal" has the row "Hotkeys do not fire from the prompt box"; the other three rows are new.

## P18-3 A mark on every row (plan 380-18, from the clutter audit of plan 380-17)

Question for the navigator, PREFERENCE. The audit (380-17-CLUTTER-AUDIT.md, section 3c) counted marks that appear on every row of a kind: the cobalt bar before 4 of 4 headings, the triangle on 10 of 10 section rows (9 of 10 closed, so the mark shows the default), and the square brackets of the host on every button. The browse view of plan 18 keeps the triangle on a section row and the arrow on a folder row as they were, because the audit's cut list beyond G1 to G7 is not ruled. Proposed rule if the navigator agrees: a mark that is on every row of a kind carries no information, so it is dropped, and a mark stays only where it separates one row from the others (a folder from a file, a new file from an old one, a changed section from a still one).

Status of the cited terminal segment: proposed.
