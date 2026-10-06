---
spike: 008
name: mods-types-and-surfaces
type: standard
validates: "Given Claude Code 2.1.289, when the mods type declarations are read, then it is known which surfaces, props, prompt and command hooks exist, and whether a mod can replace settings.json statusLine"
verdict: PENDING
verdict_status: "PENDING (human): the rendered check needs a logged-in Claude Code; runbook and result template are ready in render-check/ (plan 369.26-17)"
related: [005, 007]
tags: [claude-code-mods, ui, band, pane, statusline]
---

# Spike 008: mods types and surfaces

Read-only research spike. Source of truth is the type file Claude Code writes when the
built-in `plugin-authoring` skill loads (`<skill dir>/types/claude-code.d.ts`, 20,424 lines,
build 2.1.289). Nothing was run in a mod yet. Every row below was read from that file
(line numbers are in that file); anything not read is marked UNVERIFIED.

## What This Validates

Given Claude Code 2.1.289, when the type declarations are read, then the band, pane, prompt
and command surfaces are known, and the statusLine question has a read answer.

## Findings (read from the declarations)

| Question | Answer | Where |
|---|---|---|
| Where do the types come from? | The engine writes them when the `plugin-authoring` skill loads; after a mod loads, `<mod>/.claude-plugin/types/` holds the same. No command to run. | skill text |
| Can a mod replace `statusLine`? | NO. `$.ui.status(text)` is one plain-text line per plugin, "beside the engine's own pinned notices". No declaration touches settings.json `statusLine`. Replacing it is a user config change, not mod API. The old `statusline-mos` therefore stays as an independent fallback by construction. | 2364-2375, grep "statusline" |
| AbovePrompt band | Terminal and desktop only. Props: `hasSurvey`, `isWorking`, `maxRows` (capped at half the terminal rows, prompt included), `bodyColumns` (column width less the engine's 5 for `[-]`), `scroll`, `view`. The person can collapse it. A taller tree scrolls. Buttons arm hotkeys only while wholly inside the window. | 9713-9759 |
| Pane | Every surface. `title`, `isFocused`, `bodyColumns`, `placement: 'dock' or 'inline'` (dock beside transcript in fullscreen from 110 columns), `scroll`. One instance per id. Opened unasked it seats from 144 columns; opened by a person's action it seats at any width (skill text). | 9760-9810 |
| Box | flex props, `backgroundColor`, `borderStyle`, `borderColor`, `padding*`, `margin*`, `gap`, width/height, `hover`, `position: absolute`. | 841-930 |
| Text | `color`, `backgroundColor`, `bold`, `dimColor`, `italic`, `underline`, `inverse`, `wrap` incl. `truncate-end`. Colors are strings (hex form assumed, UNVERIFIED until a render). | 12011-12029 |
| Button | `label`, `key`, `hotkey` (one digit or one lowercase letter), `variant: primary or secondary`, `plain`, `autoFocus`, `dimColor`. Terminal draws `[ label ]`. | 1000-1084 |
| Markdown | prop is `text` (not `children`), max 10,000 chars, only https/http/file links clickable, `onLinkPress`. | 5510-5534 |
| Select | `key`, `options`, `value`, `label`, `onSelect(value, e)`, `autoFocus`. | 9948-9980 |
| Prefill vs run | `$.prompt.fill({ text, mode })` puts text in the prompt box, the human submits. `$.prompt.submit({ text })` runs a turn. `$.prompt.read()` returns the draft. A `prompt.submit` hook can add `context`. | 2835-2872 |
| Slash command | `$.command.register({ name, description })` plus an `on('command.run', { command })` hook returning `{ text }`. | pane example |
| Files and processes | `$.fs` read/write/list/exists/stat (read limit 4 MiB, plugin files under `$.plugin.root`); `$.process.run` by argv. | 3121+ |
| State | `$.state` session-scoped (atoms, contract in `types/index.d.ts`); `$.store` cross-session. | skill text |
| Validation | `claude plugin validate <dir>`; `claude plugin test <dir>` runs `*.test.ts` importing from `claude-code/testing`, `mount` per surface, loop over `['terminal','desktop']`. The kit tests hooks and descriptions, not paint. | CLI help, reference.md |

## Not verified yet

- Whether `Box backgroundColor` fills a flex region as a solid block in the real terminal
  (a paint question; the test kit does not cover paint). Needs one hot-reloaded render.
  (Plan 369.26-17 runs it: `render-check/RUNBOOK.md`, item 1.)
- Hex strings versus named colors; truecolor versus fallback; NO_COLOR behaviour. (Items 1 and 11.)
- `AskUserQuestion` site contract (not read yet).

### Resolved without a render (plan 369.26-17, 2026-10-06)

- Whether `claude plugin validate` accepts `Box backgroundColor` hex: YES. The finished mod
  (which paints every block with a hex `backgroundColor`) and a three-file throwaway probe mod
  both pass `claude plugin validate`, and the finished mod passes `claude plugin test` (512 tests). That is acceptance by
  the validator, not proof of paint.

## Impact on the design

- The band cannot replace the status bar; it sits beside it. "Replace" means the navigator removes
  `statusLine` from settings.json after the band is proven. Until then both draw.
- Action buttons should `$.prompt.fill` a `/mos:` command and let the human submit. `$.prompt.submit`
  is for non-material, already-approved moves only.
- Raster, Image and Client were not read this pass; the first build needs only Box, Text, Button,
  Markdown and Select.

## Results

**Verdict: PENDING (human).** The rendered check needs a logged-in Claude Code and the person
reading the real screen. The agent that prepared it had no login (`claude auth status`:
`loggedIn: false`), so every live row is PENDING-HUMAN and nothing was faked. Declarations still
answer the statusLine, prefill, command and surface questions without running anything (above).

Where the work is: `render-check/RUNBOOK.md` (what the navigator runs and reads, one command:
`node ui/mindrian-workspace-mod/scripts/render-check.cjs --final`), `render-check/RESULTS.md`
(the result template, every live row PENDING-HUMAN with its closing instruction, plus the
questions found) and, once run, `render-check/final/`. Verdict rule, fixed before measuring:
VALIDATED when every one of the 12 items passes or its UI-SPEC fallback renders correctly and is
recorded and the live round trip saved exactly one decision and said so only after the runtime
did; PARTIAL when any item has no working fallback or the round trip needs a design change;
INVALIDATED when item 1 fails AND plain mode also fails to carry the meaning.

### The 12 items (UI-SPEC 17.2)

| # | Check | Result |
|---|---|---|
| 1 | `Box backgroundColor` paints a solid block (hex) | PENDING-HUMAN |
| 2 | 10x3 and 9x1 logos line up, no seams | PENDING-HUMAN |
| 3 | Ten 1-column bar cells, contiguous, 62 percent gives 6 | PENDING-HUMAN |
| 4 | Half-block glyph stacks red over yellow | PENDING-HUMAN |
| 5 | `dimColor` readable on black and cream | PENDING-HUMAN |
| 6 | `Button` in a bordered `Box` keeps hotkey, focus, wrapped label | PENDING-HUMAN |
| 7 | Hotkeys with the prompt focused | PENDING-HUMAN |
| 8 | Band width when docked; what `maxRows` includes | PENDING-HUMAN |
| 9 | The engine's own pane title | PENDING-HUMAN |
| 10 | `▶` and `·` render in the WSL terminal | PENDING-HUMAN |
| 11 | What `NO_COLOR` does to `backgroundColor` | PENDING-HUMAN |
| 12 | Truncation with `wrap="truncate-end"` in a growing block | PENDING-HUMAN |

Full table with evidence files and the instruction that closes each row:
[render-check/RESULTS.md](render-check/RESULTS.md).

### Measured without a login (2026-10-06, hermetic room, the repo's own local servers)

Source: `ui/mindrian-workspace-mod/scripts/gate-probe.cjs`; JSON in `render-check/non-live/gate-probe.json`.

- A card raised by another process is listed by `gate_list`; a direct answer from a second
  server process is refused `unknown_gate` (the mod's E01), records unchanged; `session_mismatch`
  (E04) needs two sessions in one process.
- The mirror (`gate_render mirror_of`) gives a new id and leaves no record; answering it saves one
  decision (`answered_via: mcp_relayed`); two presses at once leave exactly one decision node; the
  raiser answering afterwards is told `answered_elsewhere`.
- Decide later makes no call; reads leave the records identical.
- On Claude Code a card is always the AskUserQuestion card, so the `card_pending` refusal is
  reachable only on a non-Claude host.
- `CLAUDE_ACTIVE_ROOM` alone does not bind a session; a binding file for the session id does.
- Server names: the plugin is `mos`, the keys are `mindrian-os` and `mindrian-brain`, giving
  `plugin:mos:mindrian-os` and `plugin:mos:mindrian-brain` (the names the mod uses), corroborated by
  real transcripts on this machine; the live `/mcp` screen is still the confirming check.
- The guarded Brain shim registers six tools; `framework_techniques` is not one of them ("Tool
  framework_techniques not found"). Navigator decision Q-17-1 in RESULTS.md.
