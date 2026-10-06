# Mindrian Workspace mod

Two jobs, one mod. It draws a thin band above the prompt that tells you where you are in your data room, what the folder is for, what to do next and whether anything is waiting on you. It also opens a docked pane with four tabs (Room, Think, Sources, Review) where you can look closer and, on the Review tab, save a recorded decision with one key press.

It is a Claude Code mod: function hooks written in TypeScript (`.tsx`, no DOM, no Node) that the terminal draws natively. The design contract is `.planning/phases/369.26-mindrian-workspace-mod-an-orientation-band-and-docked-review/369.26-UI-SPEC.md`. It is a walled package (Phase 369 D-17 precedent): it declares no dependency of any kind and nothing from it enters the root `package.json`, the root `files` array or the npm tarball. `tests/test-369.26-wall.cjs` guards that.

## Status: the phase ends human_needed, not complete

Everything that can be proven without a logged-in terminal is built, tested and green. One requirement is not closed and is not claimed closed:

- **WS-16 (the spike 008 render check) is PENDING-HUMAN.** The agent that built the check had no Claude login, so nothing was rendered in a real session and no live result exists. Every live row in `.planning/spikes/008-mods-types-and-surfaces/render-check/RESULTS.md` says PENDING-HUMAN and the spike 008 verdict says PENDING (human). The way to close it is `.planning/spikes/008-mods-types-and-surfaces/render-check/RUNBOOK.md`: one command, `node ui/mindrian-workspace-mod/scripts/render-check.cjs --final`, about 30 to 40 minutes, no model prompt, a throwaway room. Until the navigator runs it and a follow-up session records the answer, treat every "looks right" claim about paint (colors, the 60/40 split, hotkeys with the prompt focused, dim text, the glyphs) as unverified. [RESULTS.md](../../.planning/spikes/008-mods-types-and-surfaces/render-check/RESULTS.md) is the template that run fills in.

## Load it

```
claude --plugin-dir ui/mindrian-workspace-mod
```

Check it without a session:

```
claude plugin validate ui/mindrian-workspace-mod
claude plugin test ui/mindrian-workspace-mod
node ui/mindrian-workspace-mod/scripts/typecheck.cjs
bash tests/run-all-369.26.sh
```

## The command

`workspace` is the guaranteed way to open the pane, and the only thing the band tells you to type. The first real render (2026-10-06) answered R-03: a letter hotkey does NOT fire while the prompt box has focus, it is typed into the prompt box and sent as a message (C-28). It only opens the pane and flips two switches; it never sends a prompt and never runs work.

| You type | What happens |
|---|---|
| `/workspace` | opens the pane on Review when a decision is waiting, else on Room |
| `/workspace think` (or `room`, `sources`, `review`) | opens that tab |
| `/workspace plain` | turns plain mode on (words and outlines, no colors), or off if it is on |
| `/workspace sample <name>` | draws a named sample data room (clearly marked as sample) and opens its tab. Names: wide, narrow, missing, empty, noroom, limit, drift, broken, several, nofile, unreadable |
| `/workspace live` | stops drawing the sample and goes back to the real room |

The dev switch `MOS_WORKSPACE_SAMPLE=<name>` starts a session already showing a sample (the render check uses it).

## Keys

Letters and digits only (an engine rule: one digit or one lowercase letter). Enter submits the prompt, so it is never a key here.

**When each key fires (C-28).** A hotkey fires only while the site that drew it holds the keys: the band after ctrl+x then tab or a click, the pane after `/workspace`, a click, or the pane opening with focus. While the prompt box holds the keys (the normal case, you are typing) a letter is TYPED, not pressed, and a digit in an empty prompt box answers a band survey only. So the band never names a bare letter: its one hint is `/workspace: Open workspace` (`/workspace: Help` at narrower widths), black on the cream row. `o` and `h` stay armed behind it and are drawn as nothing. When the pane is open without the keys the pane says so (N06, "Type /workspace to use the workspace keys.").

| Where | Key | Fires when | Does |
|---|---|---|---|
| Prompt box | `/workspace` | always (a command, not a key) | Opens the workspace and gives it the keys |
| Band (armed, not drawn) | `o` | the band or the pane holds the keys | Open workspace (gives the pane focus if it is already open) |
| Band (armed, not drawn) | `h` | the band or the pane holds the keys | Opens or shuts the all-keys list |
| Band (button, no letter shown) | `r` | click, Tab then Enter, or the band holds the keys | Run a checkup (only shown when the room needs one; fills the prompt, does not send it) |
| Band (button, no letter shown) | `k` | click, Tab then Enter, or the band holds the keys | Save my thinking (only shown at 80 percent context or more; fills the prompt, does not send it) |
| Pane, everywhere | `h`, `e`, `s`, Esc | the pane holds the keys | Help (all keys), Explain this, Show details (where a tab has details), Esc closes |
| Room | `n`, `v`, `m` | the pane holds the keys | Do this step (fills the prompt), Look at the decision (jumps to Review), More things to do |
| Think | `g`, `c`, `a`, `w`, `x` | the pane holds the keys | Dig in, Connect, Another way, Why, Example |
| Think | `l`, `t`, `v` | the pane holds the keys | Look up guidance and Talk it through (only after a help kind is picked), Look at the evidence (only when there is evidence) |
| Sources | `b` | the pane holds the keys | Back to the list (only while a source is open) |
| Review | `1` to `3` | the pane holds the keys | Choose the recorded answer of that rank |
| Review | `d`, `i` | the pane holds the keys | Decide later (writes nothing), Ask it here (draws a card another window raised) |

The band's hint words are `Text`, not a button: a Button's label color is the host's (it rendered pale on the cream row), only `Text` can be black. `o` and `h` are therefore kept as buttons inside a Box with no width. Unverified without a live session: whether a zero-width Button still takes a Tab stop (an invisible focus) and whether the pane's all-keys panel `o` label ("Open workspace", B84) reads right. The all-keys panel also lists the fix keys at T1.

There are no letter or digit hotkeys for the tabs (digits stay free for the decision card). The tab strip is four buttons: Tab moves to the next button, Enter presses it, Esc closes the workspace (copy line H22). Under 30 columns it becomes a Select.

## What is real today, and what is recorded as missing

The model reads only what a canonical source holds. A source that is not there yet is shown as its own plain "not recorded yet" words, never as a made-up value.

Real now (read live, refreshed at session start and after every turn):

- where you are (the bound data room and the folder), through `status_read`
- what the folder is for (the folder's own description file)
- this install's last health check (a global cache, so it says "this install", not "this room")
- how much of the context window is used
- how many decisions wait, and the recorded decision cards themselves (`gate_list`)
- the Think tab's points with no evidence yet (`whitespace_scan`) and the Sources tab's readable files (`room_artifact`)

Recorded as missing until Phase 369.25 lands its readers (shown as "not recorded yet", or not drawn):

- the next step, its reason and its method (so the band says "Next: not recorded yet", and the Think tab's lookup button is never drawn on a real room)
- what a folder reads and writes
- the installed Mindrian version (not drawn at all)
- the Think tab's "best supported conclusion" beyond a recorded governing thought, and the "one gap that could change your decision" line (P79, held back on purpose, see below)
- "searching" states (sample data only)

## Tri-polar stance

- **CLI:** the build target. Built and tested through the engine's own mount and press harness. The real terminal render is the pending WS-16 check.
- **Desktop:** covered only by the kit's `mount` loops over the `terminal` and `desktop` surfaces. A real Desktop render is deferred (phase CONTEXT, Deferred). A stated deferral, not an oversight.
- **Cowork:** a mod has no Cowork surface. A stated skip.

## Canon positions

- **Part 8, graph boundary.** The mod reads the room locally. The one outbound call is the Think tab's "Look up general guidance" button, and it sends exactly `{ framework: <a method name from the framework-name canon> }`, never a word from your room. `tests/test-369.26-part8.cjs` proves that three ways, each with a mutation arm.
- **Part 9, memory locality.** The only write the mod makes is `gate_answer` for a recorded decision card, through `src/pane/review/gate-client.ts`. It is recorded as relayed, it is never optimistic (the screen says "saved" only after the runtime says so), and nothing the mod shows confirms a truth-claim.
- **Part 11, invocation.** The `workspace` command opens a pane and fills the prompt box, nothing more. It adds no command, skill or agent that reaches a decision fork on its own.
- **Part 12, pedagogy.** No grades, no praise, no scores in any string. Larry's color marks appear only on the Think help results.
- **Part 3, decision gate.** The review card draws the recorded card (at most three choices, ranked) and invents none.

## The band's reading order, measured

A screen reader reads the band in this order (UI-SPEC 12.4 sets the target). Measured 2026-10-06 by mounting the band at four sizes in the engine's test harness (text and button labels in tree order):

| Size | Measured order |
|---|---|
| Wide (100 columns) | place, waiting, context (then four empty bar dots), purpose, next, then Open and Help |
| Wide, room needs a checkup or is broken | place, waiting, context, purpose, **the health words and the Run a checkup key**, next, Open, Help |
| Wide, context 80 percent or more | **context and Save my thinking first**, then place, waiting, purpose, next, Open, Help |
| 80 columns | as wide, with no bar and Help only |
| 55 columns | the folder name alone, the one alert, Help |

Differences from UI-SPEC 12.4, stated plainly:

1. Health sits between purpose and next, not after next. Nothing is lost; the order just differs from the table.
2. At the context limit the promoted block leads, on purpose (the spec's cliff rule promotes it to the front of row 1). 12.4 has no row for this.
3. The four empty-cell dots of the context bar are real text in the tree (`·`), so a screen reader would read them. 12.4 says the bar cells are hidden. No hide switch was used; the bar is decoration and can be dropped without losing meaning (R-14).
4. The pane's reading order was not measured here.

## Known limits

- **It does not replace the old status line.** A mod cannot (spike 008). Both draw until the navigator removes `statusLine` from settings after the band is proven (OQ-11).
- **Dev-only load.** It loads with `--plugin-dir`. Shipping it inside the install is deferred (OQ-12).
- **Seen once on a real screen (2026-10-06, claude 2.1.290 and 291, truecolor, sample `wide`):** blocks, logo and bar paint correctly; a band key does NOT fire from the prompt box (fixed in the words, C-28); the Button-label hints were unreadable (fixed, now `Text`). Still not eyeballed after C-28: the `▶` and `·` glyphs in the WSL terminal, the 60/40 split, the pane title chrome.
- **The Think tab's lookup does not work through the installed Brain shim yet.** The shim exposes six tools and `framework_techniques` is not one of them, so a lookup would show "Couldn't look that up right now. Nothing was sent from your data room." (Q-17-1). On a real room the button is not drawn anyway until `next.method` is recorded.
- **A card the model raises without flagging an option** shows no "Mindrian suggests" line (Q-17-2).
- **The Think tab is the heaviest view:** 8 buttons in 4 groups on the default view, exactly the budget with no spare.

## Decisions the navigator still owes

Each has a default the mod already follows, so nothing is blocked. Answer in a word.

| ID | Question | The mod does now | Recommendation |
|---|---|---|---|
| WS-16 | Run the render check (RUNBOOK.md), then accept or change the spike 008 verdict and its fallbacks | every live result PENDING-HUMAN, verdict PENDING (human) | run it; this is what closes the phase |
| OQ-11 | Remove the old `statusLine` once the band is proven? | both draw | yes, after WS-16 |
| OQ-12 | Where does the mod ship (inside the install, a built asset)? | dev-only load | decide in the roadmap phase that ships it |
| OQ-13 | The `workspace` command's description and its result lines have no copy-deck words | the description and the "opened" line use the pane title (P00), plain-on uses N01, sample uses N04; no words invented | add one short description entry to the deck |
| OQ-14 | After Decide later or Not now the runtime ends the card, so "This decision stays open" (D13) is almost never true, and the line shown before the press (D11, "leaves this open") has the same problem. The deck has no sentence for "your wait was saved and the card goes away" | says D13 only while the card is still listed, else "Saved to your data room: {label}" (D24) | write one sentence for the wait case and retire D13 and D11 for wait-type choices |
| OQ-15 | An approve on a card that runs work (research gates, canon release, ambient, never-do) would run the step on the server side. D10 to D12 say "saves your decision", not "runs the step". Cards with options the mod cannot classify have no honest "answer in the conversation" sentence either (D30 is about pick-many cards) | saves none of those approvals; reject and defer on them are savable; D30 stands in | rule either that D12 may say it runs the work, or that those cards stay in the conversation, and add the sentence |
| Q-17-1 | Should the guarded Brain shim proxy `framework_techniques`? | the lookup refuses or fails honestly | yes: one small quick, a seventh shim tool with strict input `{ framework }` that calls the Brain client so the Part 8 guard stays in the shim. Never point the mod at the raw Theo server. Low urgency; or retire the lookup button |
| Q-17-2 | Keep "no flag, no suggestion line" for cards the model does not flag? | keeps it | keep, and have the raiser pass `recommended: true` |
| Q-17-3 | The nested test session reads as bound only through a binding file plus a session id, not through `CLAUDE_ACTIVE_ROOM` | the harness does it itself | no change (informational; `--repo-plugin` is the fallback) |
| Q-17-4 | Is E01 ("This decision card is not one this window drew. Ask for it again.") the right words for a card another window raised? | E01, and the Ask it here key follows | keep |

Smaller notes, no ruling needed unless you want one:

- **Held-back copy.** Five deck entries are not drawn on purpose and are allow-listed in the source guard with their UI-SPEC reason: B02, B67, B83 (only if you rule red is for the logo only), L04, L05, and P79 ("This is the one gap that could change your decision", held back until the planned reasoning brief can support the claim).
- **A card that changed under you** can read E03 and then D32 ("Still current") because the check cannot see the changed subject. Plan 10 fixed this on purpose; it is a candidate for a ruling.

## What keeps it honest (the permanent guards)

`bash tests/run-all-369.26.sh` runs them all. The two that matter most for later edits:

- `tests/test-369.26-source-guards.cjs`: no long dash in any mod file, no hex color in `src/`, no `require`, `process`, Node built-in or `fetch`, every visible string a copy-deck id (checked on the syntax tree), every deck id used or allow-listed with a reason, only the audited MCP tools, the only write `gate_answer` in the gate client, no italic, underline, strikethrough, timer or `gray_meta`, `logoGreen` only in the logo and the theme, all four tab bodies defined, every hotkey one character. Each guard has a mutation arm that plants a violation in a scratch copy and must see it.
- `tests/test-369.26-part8.cjs`: the Brain boundary (referenced here, not repeated).

## Engine facts

The full rules are in `.planning/phases/369.26-mindrian-workspace-mod-an-orientation-band-and-docked-review/369.26-ENGINE-RULES.md`: read it before writing any hook file. In short:

- `$` never crosses an import: a helper that takes `$` lives in the same file as the hook, or the hook is registered by a registrar that receives `on`.
- `read($, x)`, `update($, x, fn)` and `atom(x, initial)` need `x` as a literal `{ plugin, key } as const` or an atom declared in the same file; atoms imported from `src/state/atoms.ts` are refused (the file holds references and starting values only).
- `plugin.json` carries `"types": "./types/state.d.ts"` and that d.ts has no `import`.
- A render hook cannot write state; the engine's test `$` has no env, fs, state, store or plugin noun.
- `tests/test-369.26-engine-rules.cjs` proves a state-reading hook validates and that each mistake is still refused.

### Measured in plan 01

Measured on Claude Code 2.1.290 (declaration file written by 2.1.289), 2026-10-06. Every later plan reads this section.

1. Import form. A relative import between plugin files loads with NO extension (`import { x } from './ids'`), with a directory index (`from './sub'`), and also with `.js` or `.ts` spelled out; `tsc` under our tsconfig accepts the extensionless and the `.js` spelling and rejects the `.ts` spelling (TS5097, `allowImportingTsExtensions` is off). Use the extensionless form everywhere. A missing module fails loudly in the engine ("cannot import ... no such file"). Proved by a throwaway sibling module drawn from a `ui.render` hook and found by a mounted test, under `claude plugin validate ui/mindrian-workspace-mod`, `claude plugin test ui/mindrian-workspace-mod` and `node ui/mindrian-workspace-mod/scripts/typecheck.cjs`, with a deliberate missing import failing all three.
2. hooks.json shape. `modules` is an ARRAY holding exactly one path, resolved relative to `hooks/hooks.json` itself: `{ "modules": ["../src/register.tsx"] }`. A bare string is refused ("expected array, received string"), and a second entry is refused ("one hooks module per plugin"). Proved by `claude plugin validate ui/mindrian-workspace-mod` failing on the string and passing on the array.
3. Test discovery. `claude plugin test <dir>` runs every `*.test.ts` and `*.test.tsx` anywhere under the folder (it found a test in `src/`, in `tests/` and in `tests/deep/`), each file in its own child. A test imports from `claude-code/testing`, and may import plugin source with a relative path (`../src/...`). The plan puts tests in `tests/`. Proved by `claude plugin test ui/mindrian-workspace-mod` counting all four throwaway tests in its own output ("Ran 4 tests across 4 files").
4. Types layout. The engine lays `.claude-plugin/types/` (`claude-code/`, `claude-code-tools/`, `claude-code-mcp/`, a `tsconfig.json`) when a session loads the mod from a folder (`claude --plugin-dir`); `claude plugin validate` and `claude plugin test` do NOT lay it. `scripts/lay-types.cjs` is the fallback that copies the plugin-authoring skill's declaration file when the folder has none, and `scripts/typecheck.cjs` runs it first. The folder is gitignored and is never committed. Proved by deleting `.claude-plugin/types`, running validate and test (still absent), then `claude --plugin-dir ui/mindrian-workspace-mod -p ...` (laid, even though the session then stopped at authentication).

Other facts worth knowing:

- The manifest wants an `author`; without one `claude plugin validate` passes with a warning, so plugin.json carries one.
- `hooks: nothing` in the validate output is the honest report of an empty `register`; once a hook exists the output lists it (`ui.render{component=AbovePrompt}`).
- Props the engine hands `AbovePrompt` (read from the declaration file): `hasSurvey`, `isWorking`, `maxRows`, `bodyColumns`, `scroll` (`{ offset, bodyRows }`) and `view` (`{ agentId? }`). A test mount must pass all six. `Pane` carries `title`, `isFocused`, `bodyColumns`, `placement`, `scroll` and `view`.
- TypeScript is the compiler of tools/ts-check (or ui/shell as a fallback); this package installs nothing.

## Layout

- `src/register.tsx` the hooks module; calls the three registrars in order.
- `src/registrars/` model (live refresh), band, pane (the body kit and the one Brain-facing closure). Each owns its file because `$` cannot cross an import.
- `src/band/` the tiers, tiles, logo and one-row band. `src/pane/` the shell, the four bodies (`bodies/`) and their parts (`room/`, `think/`, `sources/`, `review/`).
- `src/copy/deck.ts` the copy deck, the only place a user-visible word lives. `src/copy/text.ts` is the only way a string reaches the screen.
- `src/model/` the view model, its sample fixtures and the live readers. `src/theme/` the theme and the plain-mode switch.
- `src/runtime/ids.ts`, `src/runtime/open-workspace.ts`, `src/state/atoms.ts`, `types/state.d.ts`, `src/pane/types.ts` the shared contracts.
- `scripts/` `typecheck.cjs`, `lay-types.cjs`, `sync-assets.cjs` and the render check (`render-check.cjs`, `gate-probe.cjs`).
- `tests/` the `*.test.ts` and `*.test.tsx` files for `claude plugin test`; the repo-level guards are `tests/test-369.26-*.cjs` at the repo root.
