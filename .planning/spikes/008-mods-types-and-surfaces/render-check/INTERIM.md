# Spike 008 interim render check (plan 369.26-09)

Written by `node ui/mindrian-workspace-mod/scripts/render-check.cjs --all`. Items 1 to 3, 5, 7 to 12 of UI-SPEC 17.2 that can be measured before the tab bodies exist; plan 17 runs the full twelve on the finished mod.

## STATUS: PENDING (the live run has not happened)

ENV GAP: the agent that built this harness had no logged-in Claude Code (`claude auth status` reported loggedIn false), so no real capture exists yet and none was faked. The harness itself is proven against a fake terminal program (tests/test-369.26-render-harness.cjs). Every row below is PENDING until the navigator runs, in their own logged-in terminal from the repo root:

    node ui/mindrian-workspace-mod/scripts/render-check.cjs --all

That command overwrites this file with the real results, and keeps the "Navigator answer" section below.

## UI-SPEC 17.2 results

| # | Check | Result | Evidence file (under interim/) | If it fails, the fallback chosen |
|---|---|---|---|---|
| 1 | Box backgroundColor paints a solid block (hex string) | PENDING (live run needed) |  | plain mode (UI-SPEC section 12); the words still read |
| 2 | The 10x3 and 9x1 logos line up cell for cell, no seams | PENDING (live run needed) |  | the text mark B01 (M:OS) instead of the logo |
| 3 | Ten 1-column cells draw a contiguous run; the middle dot draws; 62 percent gives 6 | PENDING (live run needed) |  | drop the bar; the number remains |
| 4 | The half-block glyph stacks red over yellow in one cell (optional) | NOT REACHED (plan 17 closes it) |  | side by side (already the default) |
| 5 | Text dimColor is present (readability is the human's) | PENDING (live run needed) |  | bold or plain weight instead of dim; no grey |
| 6 | A Button inside a bordered Box keeps hotkey, focus and wrapped label | PENDING (plan 14 ran with no logged-in Claude Code: ENV GAP; CHOICE_FORM left at the default 'boxed'; plan 17 closes it) |  | the engine's plain 1: label form (set CHOICE_FORM to 'plain' in src/pane/review/choice-buttons.tsx; a harness test pins both forms) |
| 7 | A hotkey fires with the prompt box focused (typed o) | PENDING (live run needed) |  | o and h only after focus moves; the workspace command opens the pane |
| 8 | The band's width when the pane is docked, and what maxRows includes | PENDING (live run needed) |  | no change: tiers already follow the props |
| 9 | The engine's own Pane title or chrome | PENDING (live run needed) |  | keep P00 short |
| 10 | The middle dot U+00B7 bytes reach the screen (font rendering is the human's) | PENDING (live run needed) |  | use > and . instead of the triangle and the middle dot |
| 11 | What NO_COLOR and TERM=dumb do to backgroundColor | PENDING (live run needed) |  | no change needed: blocks still read as labeled text |
| 12 | Truncation with wrap="truncate-end" inside a growing block | NOT REACHED (plan 17 closes it) |  | a shorter label |

### What each result is based on

- Item 1 (PENDING (live run needed)): no live run yet.
- Item 2 (PENDING (live run needed)): no live run yet.
- Item 3 (PENDING (live run needed)): no live run yet.
- Item 4 (NOT REACHED (plan 17 closes it)): no live run yet.
- Item 5 (PENDING (live run needed)): no live run yet.
- Item 6 (PENDING, plan 14): no live run yet. The card is built and tested on the engine's harness on four surfaces with both forms; what only a real screen shows is below.
- Item 7 (PENDING (live run needed)): no live run yet.
- Item 8 (PENDING (live run needed)): no live run yet.
- Item 9 (PENDING (live run needed)): no live run yet.
- Item 10 (PENDING (live run needed)): no live run yet.
- Item 11 (PENDING (live run needed)): no live run yet.
- Item 12 (NOT REACHED (plan 17 closes it)): no live run yet.

## Item 6 hand-off (plan 14: the Review card's choice buttons)

Status: ENV GAP at plan 14 (`claude auth status` reported loggedIn false; `render-check.cjs` exit 77). Nothing was faked. The form in the source is `CHOICE_FORM = 'boxed'` (a single-border Box around a Button labeled `[n] label`, UI-SPEC C-27); plan 17 reads the real screen and, if the boxed Button loses its hotkey, its focus or its wrapped label, flips it to `'plain'` (the engine's `n: label`) and records the result here.

What to read on the live screen (wide sample, 160x45, the pane open on the Review tab with the sample card):
1. Are the three choices drawn as outlined boxes, the labels wrapped inside the box when long, not cut off?
2. Does the recommended choice carry the primary accent, the others not?
3. Does pressing `1` reach the button (the card is sample data with a fixture gate id: the pane must show a refusal sentence, E01 or E06, and never a saved sentence)?
4. Pane width 72 and over: one row; 40 to 71: stacked with "Choose one:" above.
Plain mode (`workspace plain`): the suggested choice is the primary Button and the suggestion line starts with a greater-than mark. A Button cannot be drawn `inverse` at rest (only on hover), so UI-SPEC 12.2's "inverse" for the suggested choice is not reachable; the greater-than mark and the primary variant carry it.

## Two answers the build needs

1. Did the pane open with focus when the composer was empty? PENDING (live run).
2. How many columns did the band get with the pane docked (item 8)? PENDING (live run).

## Fallback decisions (plans 10 to 14 read this before building)

None yet: decided after the live run. Until then every plan keeps the primary design.

## Navigator answer

(not yet given: the navigator reads the HTML captures under interim/ and replies here, then plans 10 to 14 may depend on this paint)

