# G5 book consult (plan 380-17, Task 2, Step 1)

Canon: mos-brand book e947a5d, read with git show e947a5d:PATH. The live checkout is at 9f4ee34, two commits ahead; no path below was read from the checkout.
Status of the terminal segment: proposed (segments/experience/terminal/entries/2026-10-20/GUIDE.md).

## Rules found

| Rule | Segment path | Where it applies |
|---|---|---|
| "Words carry the meaning. Color never does alone." | segments/experience/terminal/entries/2026-10-20/GUIDE.md, Rules that hold everywhere (proposed) | Eight white boxes alone say nothing; the words beside them must say what they are. |
| "A state is said once in the panel." | same file, Side panel template, One signal (proposed) | Each of the two idle sentences says the waiting state once; the reading line never holds the word gauge. |
| "Initial, loading, empty, partial, error, stale and too small each have words." | same file, Side panel template, States (proposed) | The idle gauge is the initial state of Context; it gets words that say what the boxes are and when they fill. |
| "The only bright planes are the Theo face tile and the context canvas, drawn as a paper ring with ink lines." | same file, Ground and color (proposed) | The canvas stays as drawn. Its pixels are pinned (tests/meter-pin.test.ts, 18 pins). |
| "the book has no token for secondary text on ink. The panel uses dimmed paper." | same file, Ground and color, open question (proposed) | A dimmed canvas would need a secondary-on-ink color. The book has none (and D-11 forbids an invented hex). |
| Voice is clear, practical, grounded; "say what a person can do". Plain short sentences. Never em dashes. | segments/writing/voice/entries/2026-10-19/content.html | The new strings are one plain sentence each, hyphens only. |
| White (#FFFFFF) is "open material planes and handover"; in Theo's face "white handover". | segments/foundations/color/entries/2026-10-19/content.html | The idle canvas fills its blank cells with white. That reuses the handover color for "nothing yet". The book does not rule on it. Recorded as the open question P17-2. |
| Contrast: ink on white 18.88 to 1, body text passes. | segments/foundations/color/entries/2026-10-19/content.html | The words are ink on the ink-ground panel in paper text; no new color is used. |
| Evidence status is not shown by color alone; blue is attention, not proof. | same file | The idle gauge uses no color. |
| Rule 1, never em dashes; rule 5, facts, assumptions and results stay distinct. | references/brand-rules.md | The idle sentence says "waiting", it does not claim a reading. |

## The choice: label, do not dim

The idle boxes are labelled in words. They are not dimmed, not redrawn and not removed.
- A dim needs a secondary-on-ink color. The book has no token for it. D-11 says no invented hex. PROVEN (GUIDE.md, Ground and color).
- A dim changes the idle pixels. The 18 pins of tests/meter-pin.test.ts include the undefined case and are not edited. PROVEN (the pin file).
- Words carry the meaning (the first rule above). The words are the missing part, not the pixels.
- Cutting the idle canvas saves 4 of 40 rows (380-17-CLUTTER-AUDIT.md). That cut is not part of G5 and needs a ruling.

## The strings

| Case | String |
|---|---|
| Idle, boxes drawn | Context gauge: waiting for the first reply |
| Idle, no boxes (narrow, plain, short) | Context: waiting for the first reply |
| Reading (unchanged from today) | Context 62% - watch (label, rounded percent, " - ", the band words) |

## The book's own review on the strings

Command (scratch consumer outside both repos, the CLI run from a git archive export of e947a5d, every command with --project): init, configure --intake, adopt --apply, review --file on a text file with the three strings. Raw output: G5-BOOK-REVIEW-RAW.md in this folder.

Result: exit 2, status REVIEW-REQUIRED, findings: []. The book says a clean scan still returns REVIEW-REQUIRED and that the scan cannot judge truth, accessibility or visual design. So: no finding of the heuristic prose scan (PROVEN, raw output); the judgment of the paint is UNVERIFIED until plan 10 shows the gauge on a real screen.

Book repository untouched: git -C /home/jsagi/mos-brand status --short counted 2 lines before and 2 after (the two foreign untracked consumer files that were there before), HEAD 9f4ee34 before and after. PROVEN (the raw file records BOOK_STATUS_BEFORE_COUNT and BOOK_STATUS_AFTER_COUNT).

## Where the book is silent

- The book has no rule for the idle state of a gauge. Proposal P17-1 in 380-16-BOOK-PROPOSALS.md.
- The book does not say whether a blank cell may be white (the handover color). Question P17-2 (PREFERENCE, for the navigator).
