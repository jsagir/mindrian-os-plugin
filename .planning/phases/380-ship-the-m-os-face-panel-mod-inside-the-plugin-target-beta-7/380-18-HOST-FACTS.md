# 380-18 host facts: what the host can and cannot do for a long list

Date: 2026-10-24. Plan 380-18 (G7 the room tree, G2 the face stays in view).

## Source-of-Truth Preamble

- CODE claims read against: branch main of the release tree /home/jsagi/dev/MindrianOS-Plugin-release @ 058af2f0edfa4fdc1f48e05fe01b346c7d754cfb.
- TYPES claims read against: ui/mos-face/.claude-plugin/types/claude-code/index.d.ts (the laid file, 663768 bytes, 16973 lines, modified 2026-10-23).
- WIRE claims: none. This plan makes no network call.
- Date of audit: 2026-10-24.
- Re-verification rule: a type claim below is read from the laid file, with its line. A claim about a real screen is UNVERIFIED until plan 10 captures it.

Labels: PROVEN = I read it in the file at the line named, or I ran it. UNVERIFIED = no real screen or no run shows it. PREFERENCE = taste of a skill.

## 1. What the host can do

| Fact | Line | Operative phrase | Label |
|---|---|---|---|
| A Pane body scrolls inside a frame; the window is the engine's, moved by the person's keys while the pane is focused | 10904, `scroll` remark | "The body's window over the tree: engine-owned, moved by the person's keys while the pane is focused. Read-only." | PROVEN |
| scroll.bodyRows is the room, never the rows showing | 10907 | "`bodyRows` is the room's rows, never the rows showing: the most the frame may take less the engine's (an inline border's two, the tab row while one shows, a dock's row for the close mark). Inline the frame fits the tree." | PROVEN |
| A tree taller than the room is scrolled by the host, so the top leaves the screen | 10904 to 10910 | the window moves over the tree; the header is part of the tree | PROVEN by the type; PROVEN on screen by real-7.png, real-8.png, real-10.png (plan 17 audit) |
| The pane docks beside the transcript from 110 columns in fullscreen, else sits inline above the prompt | 10897, 1794, 15063 | "docked in fullscreen, else above the prompt"; "`dock` beside the transcript (the terminal in fullscreen from 110 columns), or `inline` above the prompt" | PROVEN |
| The inline room for a Pane is not stated | 10907 | only "an inline border's two" is named; the band rule (half the terminal rows, the prompt included) is stated for AbovePrompt at 10832 | PROVEN that it is not stated; the 76 by 10 case is an ASSUMED room |
| A person focuses a pane with ctrl+x tab or a click | 10871, 10886 | "keyed by the person (ctrl+x tab, Esc)"; "True while the person has given the pane the keyboard: Tab walks its elements, a Button's `hotkey` presses it, the arrows scroll." | PROVEN as text; UNVERIFIED on a real screen |
| Button hotkey: one digit or one lowercase letter, only while the plugin's site holds the focus, never from the composer | 9872 to 9877 | "presses it while the plugin's site holds the focus"; "never from the composer, save a bare digit in an empty one pressing a band Button" | PROVEN as text |
| ui.scroll scrolls a render instance, an element by key, or a site's edge | 2565 | "Scrolls something into view as the DOM's `scrollIntoView` would" | PROVEN as text |
| ui.focus moves the focus ring onto an element, only while the site holds the keys | 2580 | "A site not holding the keys, or holding them on another's element, is `{ deny }`" | PROVEN as text |
| Input exists on the terminal surface; while it has focus every printable key reaches it and Esc returns them | 5624 | "while it has focus every printable key reaches it alone and Esc returns them" | PROVEN as text; the types name the band and the focus ring, a Pane use is UNVERIFIED |
| A Client region has its own onKey; Escape returns the focus and never arrives | 1449, 1629 | "Escape never arrives: it returns the focus." | PROVEN as text |
| A pane opened with closeOnEscape lets Escape close it; left out, Escape returns the keys and the pane stays | 7614 to 7624 | "Left out, Escape returns the keys and the pane stays." | PROVEN as text |

## 2. What the host cannot do, or leaves UNVERIFIED

- No pinned header above a scrolling body. PROVEN by a search: the command grep -n -i "sticky\|pinned header\|fixed region\|pin.*header" over the laid types file prints 0 lines. Consequence: the header stays in view only when the whole body fits the room, so the plugin keeps its body inside scroll.bodyRows.
- Escape is the person's own key. It returns the focus, and the types say it never arrives at a Client's onKey. For a Pane the types name Esc as the person's key (10871). Whether any mod hook receives Escape on a pane is UNVERIFIED. This plan binds no Escape.
- A hotkey never fires from the prompt box. PROVEN as text (9872 to 9877). So a hint that names a key must say where it works. This plan names no key; it names the slash command, which works from the prompt box.
- Tab walking and the focus chord on a real screen: UNVERIFIED. Plan 10 may try them.
- Input in a Pane on a real screen: UNVERIFIED. This plan draws no Input. The filter is the slash command /mos-tree find.
- Whether the pane draws again with new bodyRows after a terminal resize: UNVERIFIED (the types say the engine re-runs ui.render when props change, 16703, but no real resize was seen). The panel reads bodyRows at every render, so a new value is used when it arrives.
- The real height an inline pane may take at 80 by 24: UNVERIFIED. The tests use 76 by 10 as an assumed room (see section 5).

## 3. The decision

1. Keep the body inside scroll.bodyRows. The host then has nothing to scroll, and the header is always in view.
2. Page the list in the plugin. The window is as tall as the rows left after the header, the crumb row, the controls, the hint and the refresh row.
3. The keyboard route is the slash command /mos-tree, which works from the prompt box everywhere (GUIDE.md: "A slash-command hint is always safe").
4. Draw no hotkey and no Input until a real screen proves them. Nothing pressable is drawn without a mechanism that presses it: a click, or the slash command.
5. Later option, after plan 10: a Client region with its own onKey. Cost: a second module, a build change, and an unverified key focus. Not done here.

## 4. Borrowed patterns

Principles only. No color and no word of the reference tools is copied (mindrian-tui-consult, Adaptation rules).

| Reference | The person's job | Reference behavior | Smallest mod adaptation | Verified host mechanism | Real-screen tests still needed (plan 10) |
|---|---|---|---|---|---|
| lazygit: list beside detail, a predictable way back | Pick a section, see its files, go back without losing place | A list and a detail pane; one key to go back | List-to-detail in one pane: the section list is replaced by the folder view; an Up button and /mos-tree up go back one level | Button onPress (click); command.run for the slash route | Click a section, click Up, check the page you left is the page you return to |
| yazi: the location stays clear while the selection changes | Always know where I am in the room | A header line that names the path while the list changes | A crumb row: the room name and the open path, cut at the start so the last part survives, plus the counter | Text rows inside scroll.bodyRows | Read the crumb at 56 by 40 and 44 by 24 |
| k9s: filterable lists with a count and a breadcrumb | Find one name in a long list | A filter prompt, a count of the rows, a breadcrumb | /mos-tree find WORD sets a smart-case filter; the counter says "FROM-TO of N" or "no match for ..."; a Find button puts the stem in the prompt box | command.run; Button puts the stem with prompt.fill | A filtered list; a filter with no match |

## 5. What plan 10 must capture for this plan

1. The tree, page 1 and page 2, at 56 by 40 and at 44 by 24.
2. A filtered list (/mos-tree find legal).
3. The too-small state (a pane under 9 rows).
4. A drill into a 16-file folder (the header stays, the counter says 1-10 of 16).
5. An interactive try of Tab, Enter and a hotkey only if a later plan adds one. This plan adds none.
6. The inline pane at 80 by 24 and in a 60 column split: the real room it gets (the tests assume 76 by 10 and 56 by 22).
