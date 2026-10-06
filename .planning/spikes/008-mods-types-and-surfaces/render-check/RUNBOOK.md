# Spike 008 render check: your runbook (plan 369.26-17)

What this is: the part of the check that needs a real, logged-in Claude Code. The agent that prepared it had no login (`claude auth status` said `loggedIn: false`), so it built and tested everything that does not need one and left every live result as PENDING-HUMAN. Nothing below was faked.

What it costs you: about 30 to 40 minutes, mostly waiting. It sends no prompt to any model (the harness only types keys and the two slash commands `/workspace` and `/mcp`), so it should spend no tokens. It touches no real room: the live runs build a throwaway room in the OS temp folder and delete it.

## Before you start (one minute)

In your own WSL terminal, from `/home/jsagi/dev/MindrianOS-Plugin`:

1. `claude auth status` must say `"loggedIn": true`. If not, run `claude`, type `/login`, finish, quit.
2. `tmux -V` must print a version (3.7 is installed).

## Step 1: run the whole check (one command)

```
node ui/mindrian-workspace-mod/scripts/render-check.cjs --final
```

It runs about 65 short sessions at six sizes, in every state, plus the key tests, the half-block probe, the `/mcp` name check, and the live gate round trip. It prints one line per run and ends with the path of the report.

Smaller pieces, if you want to start with the ones that settle the most (each is the same command with a group):

| Command ending | Runs | Time | Settles |
|---|---|---|---|
| `--final --group probes` | the `/mcp` names and the half-block glyph | 1 min | the server names; item 4 |
| `--final --group live` | the live gate round trip, decide later, double press, long folder name | 4 min | the one-press save; item 12; whether the nested session reads the room as bound |
| `--final --group keys` | `o`, `h` and a digit with the prompt focused; NO_COLOR; TERM=dumb | 3 min | item 7; item 11 |
| `--final --group size` | six sizes, three samples, pane open and closed | 15 min | items 1, 2, 3, 5, 8, 9, 10 |
| `--final --group states` | the eight problem states at two sizes | 6 min | the states look |

If the installed plugin is older than this checkout (installed is 2.0.0-beta.59, the checkout is 2.0.0-beta.62), add `--repo-plugin` to the command to load this checkout's servers too. Not tested; skip it unless the live group says the room never reads as bound.

Exit codes: 0 all runs ok, 1 some run failed (the report says which), 77 no login or no tmux (nothing written).

## Step 2: read what it wrote

Everything lands in `.planning/spikes/008-mods-types-and-surfaces/render-check/final/` (git ignores it; the follow-up session force-adds what it keeps).

1. Open `FINAL-RUN.md`. It holds the machine's answer for every item, the live round trip, the `/mcp` names and the numbers for each unverified risk.
2. Open the `.html` pictures in a browser. The table below says which picture answers which of the 12 items and what to look at. The machine can say "the paint is there"; only you can say "it looks right".

| # | Check | Open this picture | What to look at |
|---|---|---|---|
| 1 | Colored blocks paint solid | `size-wide-160x45-open.html` | The place block is solid blue, "A decision is waiting" solid yellow, the purpose and next rows solid cream, the context block black. No stripes, no gaps between cells, no block that stops short. |
| 2 | Logo lines up | `size-wide-160x45-none.html` (tall) and `size-narrow-55x40-none.html` (compact) | Top-left. Tall: blue block, black frame line, red over yellow in the middle, cream, green on the right. Compact: one row, red and yellow side by side. No thin seams between the rows. |
| 3 | Ten-cell bar | `size-wide-160x45-none.html` | "Context used: 62%": ten cells, the first six yellow in one unbroken run, the other four dots. |
| 4 | Half-block glyph | `probe-halfblock.html` | The first cell of the band row: top half red, bottom half yellow. If it shows as one color or a gap, the compact logo stays side by side (the default; nothing to change). |
| 5 | Dim text readable | `size-wide-160x45-none.html`, `live-roundtrip-opened.html` | The hint "o: Open workspace   h: Get help" and the consequence line under the card. Readable on black and on cream? If not, say so; the fallback is plain weight. |
| 6 | Boxed choice buttons | `live-roundtrip-opened.html` | The choices drawn as outlined boxes, "[1] Yes, go with it" with the long labels wrapping inside the box, the suggested one in blue. FINAL-RUN.md also says whether a digit press reached the button. If they look wrong, the fallback is `CHOICE_FORM = 'plain'` in `src/pane/review/choice-buttons.tsx` (the follow-up session flips it). |
| 7 | Hotkeys with the prompt focused | `key-o-empty-after.html`, `key-o-after-text-after.html`, `key-h-empty-after.html`, `key-digit-in-pane-after.html` | FINAL-RUN.md gives a word for each (fired, or the letter went into the prompt). Look at the prompt line in `key-o-after-text-after.html`: does it show "helloo" (the `o` was typed) or did the pane open? |
| 8 | Band width and rows when docked | `size-wide-160x45-open.html` against `size-wide-160x45-none.html` | The numbers are in FINAL-RUN.md (where the pane starts, where the band fill ends). Look: does the band shrink to the left 60 percent like `/home/jsagi/Downloads/mindrian-terminal-concepts/wide.png`, or does it run under the pane? |
| 9 | Engine's own pane title | `size-wide-160x45-open.html` | The first line of the pane. Is there a title line above the tab strip (Room, Think, Sources, Review), or does the pane start with the tabs? |
| 10 | Triangle and middle dot draw | your own terminal (Step 3), and `live-roundtrip-opened.html` | The `▶` before "Mindrian suggests:" and the `·` in the bar's empty cells. The harness only proves the right bytes arrived; only your font shows whether they draw. |
| 11 | NO_COLOR and TERM=dumb | `color-no-color.html`, `color-term-dumb.html` | The blocks should still read as labeled words (separators like ` | `), no stray color. FINAL-RUN.md says whether the host kept or stripped the fills. |
| 12 | Long names cut cleanly | `live-long-folder-72x30.html`, `size-wide-72x30-none.html` | The place block with the very long folder name ends in an ellipsis; nothing wraps or overflows into the next row. |

3. The live round trip (the one-press save) is in `FINAL-RUN.md` under "Live gate round trip": steps a to f, then decide later (g) and double press (h). Pictures: `live-roundtrip-band.html`, `-opened`, `-direct`, `-mirrored`, `-saving`, `-saved`. What each should show:
   - band: your purpose line and "A decision is waiting". If it says "You're not in a data room yet" or "Last data room used", the nested session did not read the room as bound: write that down; it is a finding, not your mistake.
   - opened: tabs, Review selected, the card "A decision is waiting for you".
   - direct (pressing `1` for a card another window raised): a plain-words refusal ("This decision card is not one this window drew. Ask for it again.") and the card still there, nothing saved.
   - mirrored (after `i`, "Ask it here"): the card is drawn, the refusal is gone.
   - saving / saved: "Saving your decision" first, then "Saved to your data room: Yes, go with it." The room read-back in FINAL-RUN.md must show exactly one decision and the route (`answered_via`, expected `mcp_relayed`).

## Step 3: look at it in your own terminal (2 minutes)

```
MOS_WORKSPACE_SAMPLE=wide claude --plugin-dir ui/mindrian-workspace-mod
```

Press `o`. Look at: is the dim text readable, do the `▶` and the `·` draw, do the buttons look like boxes. Quit with `/exit`.

## Step 4 (optional, one short model turn on your account)

In a real data room session with the mod loaded, ask Larry to put one yes or no decision on a card, press `o`, press `1`. Tell me whether the press saved it or what the pane said. This is the card a model raises itself, which the throwaway room cannot reproduce.

## Step 5: answer

Reply in a word to each, and the follow-up session records your words verbatim in `RESULTS.md`, fills the table from `FINAL-RUN.md`, sets the verdict by the stated rule, and fixes `src/runtime/ids.ts` if `/mcp` shows other names:

1. Do you accept the verdict that `RESULTS.md` proposes, and every fallback it lists? (`approved` or what to change)
2. The open questions at the bottom of `RESULTS.md` (a word each): `framework_techniques` through the Brain shim; the suggestion line for cards the model does not flag; `o` and `h` as keys.

## If something goes wrong

- `ENV GAP (exit 77)`: no login, no tmux or no package. The sentence says which; fix it and re-run the same command. Nothing is written.
- A run says `band_not_drawn`: open its `.txt` in `final/`. It holds the last screen and shows which dialog the harness did not recognize.
- Leftovers: the harness uses its own private tmux server (`mos-ws-*`) and its own temp folders (`mos-ws-scratch-*`, `mos-ws-live-*`); `tmux -L <name> kill-server` for a stray server, and delete stray folders under the OS temp directory. It never touches your own tmux sessions.
