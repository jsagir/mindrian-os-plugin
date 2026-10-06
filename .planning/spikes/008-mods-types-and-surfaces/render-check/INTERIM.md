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
| 6 | A Button inside a bordered Box keeps hotkey, focus and wrapped label | NOT REACHED (plan 14 closes it) |  | the engine's plain 1: label form |
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
- Item 6 (NOT REACHED (plan 14 closes it)): no live run yet.
- Item 7 (PENDING (live run needed)): no live run yet.
- Item 8 (PENDING (live run needed)): no live run yet.
- Item 9 (PENDING (live run needed)): no live run yet.
- Item 10 (PENDING (live run needed)): no live run yet.
- Item 11 (PENDING (live run needed)): no live run yet.
- Item 12 (NOT REACHED (plan 17 closes it)): no live run yet.

## Two answers the build needs

1. Did the pane open with focus when the composer was empty? PENDING (live run).
2. How many columns did the band get with the pane docked (item 8)? PENDING (live run).

## Fallback decisions (plans 10 to 14 read this before building)

None yet: decided after the live run. Until then every plan keeps the primary design.

## Navigator answer

(not yet given: the navigator reads the HTML captures under interim/ and replies here, then plans 10 to 14 may depend on this paint)

