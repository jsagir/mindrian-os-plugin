# Spike 008 render check: results (plan 369.26-17)

**Status: PENDING (human).** Written 2026-10-06 by an agent with no logged-in Claude Code (`claude auth status`: `loggedIn: false`). Every live row below is `PENDING-HUMAN` with the exact instruction for it. Nothing here is a measured live result and none was faked. The non-live facts in section 1 WERE measured, on this machine, against the repo's own local servers.

How this gets filled in: you run the commands in `RUNBOOK.md` (one command, `node ui/mindrian-workspace-mod/scripts/render-check.cjs --final`), read `final/FINAL-RUN.md` and the pictures, and answer in a word. A follow-up session then copies the machine words from `FINAL-RUN.md` into the tables below, writes your answers verbatim under "Navigator answer", sets the verdict in the spike README by the rule, and corrects `src/runtime/ids.ts` if `/mcp` shows other names.

The verdict rule (fixed before any live measuring, so it cannot bend): VALIDATED when every one of the 12 items either passes or its UI-SPEC fallback renders correctly and is recorded, and the live round trip saved exactly one decision and said so only after the runtime did; PARTIAL when any item has no working fallback, or the live round trip needs a design change (name which); INVALIDATED when item 1 fails AND plain mode also fails to carry the meaning.

## 1. Facts measured without a login (2026-10-06)

Source: `node ui/mindrian-workspace-mod/scripts/gate-probe.cjs` (JSON kept in `non-live/gate-probe.json`). It runs the repo's own stdio MCP servers in a hermetic temp room with a dead Brain address; no real room, no real Brain. Kept test: `tests/test-369.26-render-harness.cjs` ("17 gate probe").

| Fact | Measured |
|---|---|
| A card raised by another process is listed | `gate_list` from a second session bound to the same room lists it: id, kind, header, select_mode, options (id, label, description, rank, preview, recommended), top-level `recommended`, approving, minted_at, expires_at. |
| A direct press for that card | refused `unknown_gate` (the mod maps it to E01, "This decision card is not one this window drew. Ask for it again."), the room's records are byte-identical afterwards (hash equal), the card stays open. |
| `session_mismatch` (E04) | reached only by two sessions inside ONE server process (the ledger rule); measured in-process: the second session is refused `session_mismatch`. Across two processes the code is `unknown_gate`. The mod treats both as "foreign" and offers the mirror button, so both lead to the same screen. |
| The mirror (`gate_render` with `mirror_of`) | `ok`, a NEW gate id, renderer `askuserquestion`, the room's records unchanged after it (a mirror leaves no record of its own), the source still listed once. The mod's call (labels sent as the ids) is accepted. |
| One press saves | `gate_answer` on the mirror id: `ok`, `ratified`, `answered_via: mcp_relayed`, a decision node `decision:gate:<mirror id>`. |
| Two presses at once | exactly ONE decision node. One call writes (`replayed: false`), the other replays (`replayed: true`, `already_answered: true`) with the same answer. A later press replays too. |
| The owner afterwards | the raising session answering later gets `ok`, `replayed`, `answered_elsewhere: true`, the recorded verdict and chosen, `via_gate_id` = the mirror id. Nothing is written twice. |
| The recorded route | read from the room: `answered_via = mcp_relayed` (the anchor row names the mirror id as `viaGateId`). `browser_nonce` is only a proven browser click through the shell. |
| Decide later writes nothing | the mod makes no call on Decide later; reads (`gate_list`, `status_read`) leave the records hash identical. |
| `card_pending` (E07) | on Claude Code (CLI, Desktop, Cowork) a card is the AskUserQuestion card even if the host declares elicitation, so a mirrored card there is never an elicitation card and E07 `card_pending` is reachable only on a non-Claude host. |
| How a nested session becomes bound | `CLAUDE_ACTIVE_ROOM` alone does NOT bind a session: `status_read` says `bound: false` with a registry fallback and `gate_list` refuses `room_unbound`. A binding file for the session's id DOES (`bound: true`, source `session.primary`). The live harness therefore starts the nested session with a fresh `--session-id` and the same id in `CLAUDE_CODE_SESSION_ID`, with that binding file pre-written. Whether the plugin's MCP server inherits that id from Claude Code is the live check (the band frame `a` says it). |
| MCP server names | the plugin is named `mos`; `.mcp.json` keys are `mindrian-os` and `mindrian-brain`; a plugin server is listed `plugin:<plugin>:<key>`, so `plugin:mos:mindrian-os` and `plugin:mos:mindrian-brain`, exactly the two in `src/runtime/ids.ts`. Corroboration from this machine's own real Claude Code transcripts: tool names `mcp__plugin_mos_mindrian-os__*` (gate_answer, gate_render, room_bind) and `mcp__plugin_mos_mindrian-brain__*` (brain_ask, brain_query, brain_search) appear thousands of times, and the server instructions of this very session are headed `plugin:mos:mindrian-os`. The live `/mcp` screen is still the confirming check (it also settles what name `$.mcp.call` takes). |
| Tools the mod calls exist | the Mindrian OS server registers 45 tools including `gate_list`, `gate_render`, `gate_answer`, `status_read`, `room_artifact`, `whitespace_scan`, `room_bind`. |
| The Brain shim and `framework_techniques` | `scripts/mindrian-brain-mcp-client.cjs` (and its `bin/` forwarder) registers exactly six tools: `brain_ask`, `brain_query`, `brain_schema`, `brain_search`, `brain_stats`, `brain_write`. A `framework_techniques` call through it returns "Tool framework_techniques not found". Plan 16's report is confirmed. The tool is reached today only through `lib/core/brain-client.cjs` `callTool` (the Dominant Design code), never through the shim. |
| Where the "Mindrian suggests" fact lives | a card lists a top-level `recommended` id AND a per-option `recommended` flag. A card raised with the option flagged shows both. A card raised with NO flag still lists `recommended: "yes"` at the top (the runtime derives it from rank 1) but every per-option flag is false. The mod reads only the per-option flag, so an unflagged card draws no suggestion line. That is the honest reading of OQ-06 ("only when the recorded card marks one"); it means the model must pass `recommended: true` for the line to appear. |
| Installed plugin versus checkout | the installed `mos` plugin is 2.0.0-beta.59 (user scope; it has `mirror_of`, `answered_via` and `gate_list`); the checkout is 2.0.0-beta.62. The live run uses the installed one unless `--repo-plugin` is given. |

Also now proven without a login: the harness itself (live room, key scripts with `wait`, `type`, `key`, `burst`, `capture`, `inspect`, `open`, the half-block probe mod which passes `claude plugin validate`, the `/mcp` name parser, the round trip judging rules with a missing frame always `PENDING-HUMAN`, the one-command `--final` report). `bash tests/run-all-369.26.sh`: 17 passed, 0 failed, 1 skipped (plan 18's guard file, not yet written).

## 2. The 12 items of UI-SPEC 17.2

Result words: PASS, FAIL (with its fallback applied or recorded), OPEN (with the reason), PENDING-HUMAN (not yet run live). Machine columns come from `final/FINAL-RUN.md`; the last column is the instruction that closes the row.

| # | Check | Result | Evidence file (under `final/`) | Measured | Fallback applied or recorded | Instruction to close it |
|---|---|---|---|---|---|---|
| 1 | `Box backgroundColor` paints a solid block (hex) | PENDING-HUMAN | `size-wide-160x45-open.html` | not run live | plain mode (UI-SPEC section 12); the words still read | Run `--final --group size`. Open the picture: the place, waiting, purpose, next and context blocks are solid, no stripes or gaps. |
| 2 | 10x3 and 9x1 logos line up, no seams | PENDING-HUMAN | `size-wide-160x45-none.html`, `size-narrow-55x40-none.html` | not run live | the text mark B01 | Same run. Look top-left: blue, frame, red over yellow, cream, green; compact is one row. |
| 3 | Ten 1-column cells, contiguous run, the dot draws, 62 percent gives 6 | PENDING-HUMAN | `size-wide-160x45-none.html` | not run live | drop the bar; the number remains | Same run. Count: six yellow cells then four dots. |
| 4 | Half-block `▀` stacks red over yellow in one cell | PENDING-HUMAN | `probe-halfblock.html` | not run live | side by side (already the default) | Run `--final --group probes`. First cell of the band row: red above, yellow below. |
| 5 | `Text dimColor` readable on black and cream | PENDING-HUMAN | `size-wide-160x45-none.html`, `live-roundtrip-opened.html` | not run live | bold or plain weight; no grey | Read the hint and consequence lines. Say readable or not. |
| 6 | A `Button` in a bordered `Box` keeps hotkey, focus, wrapped label | PENDING-HUMAN | `live-roundtrip-opened.html`, `live-roundtrip-direct.html` | not run live | the engine's plain `1: label` (`CHOICE_FORM = 'plain'`) | Run `--final --group live`. The choices are outlined boxes with wrapped labels; the digit press reached the button (the refusal sentence shows). |
| 7 | Hotkeys with the prompt focused; Enter and `?` cannot be bound | PENDING-HUMAN | `key-o-empty-after.html`, `key-o-after-text-after.html`, `key-h-empty-after.html`, `key-digit-in-pane-after.html` | not run live | `o` and `h` only after focus moves; the `workspace` command | Run `--final --group keys`. Read the word per run in FINAL-RUN.md (fired, or typed into the prompt). |
| 8 | Band width when docked, what `maxRows` includes | PENDING-HUMAN | `size-wide-*-open.html` against `-none.html` | not run live | tiers already follow the props | The numbers are in FINAL-RUN.md. Compare the shape with `wide.png`. |
| 9 | The engine's own pane title or chrome | PENDING-HUMAN | `size-wide-160x45-open.html` | not run live | keep P00 short | Look at the first line of the pane. |
| 10 | `▶` and `·` render in the WSL terminal | PENDING-HUMAN | your own terminal; `live-roundtrip-opened.html` | not run live | `>` and `.` | Run Step 3 of the runbook and look. |
| 11 | What `NO_COLOR` does to `backgroundColor` | PENDING-HUMAN | `color-no-color.html`, `color-term-dumb.html` | not run live | blocks still read as labeled text | Run `--final --group keys`. FINAL-RUN.md says if the host kept or stripped the fills; look at the pictures. |
| 12 | Truncation with `wrap="truncate-end"` in a growing block | PENDING-HUMAN | `live-long-folder-72x30.html`, `size-wide-72x30-none.html` | not run live | a shorter label | Run `--final --group live` and `--group size`. The long folder name ends in an ellipsis; no overflow. |

## 3. Numbers for the UNVERIFIED risks

| Risk | What it asks | Result | Instruction |
|---|---|---|---|
| R-02 | what `maxRows` counts; the band's `bodyColumns` when docked | PENDING-HUMAN | FINAL-RUN.md, "Numbers", row R-02 (band fill edge and rows between band top and prompt, per docked run). |
| R-03 | hotkeys with the prompt focused | PENDING-HUMAN | FINAL-RUN.md row R-03, four key runs. |
| R-15 | `NO_COLOR` behavior | PENDING-HUMAN | FINAL-RUN.md row R-15, two runs, host behavior and the mod's own plain mode. |
| R-18 | dim text | PENDING-HUMAN | your reading of the dim lines (item 5). |
| R-20 | the 60/40 split | PENDING-HUMAN | item 8 numbers. |
| R-21 | the engine's pane title | PENDING-HUMAN | item 9. |
| R-26 | glyph bytes (`▶`, `·`, `▀`) | PENDING-HUMAN | items 4 and 10. |

## 4. Live gate round trip log

Hermetic room, one card raised by another process (three ranked options, the first recommended with a description, `approving` naming it). Machine verdicts come from `final/FINAL-RUN.md`.

| Step | What must happen | Result | Instruction |
|---|---|---|---|
| a | the band shows the real purpose and "A decision is waiting" | PENDING-HUMAN | run `--final --group live`; read frame `live-roundtrip-band`. If it says the room is not bound, record it: the binding route did not carry. |
| b | the open step shows Review with the waiting card | PENDING-HUMAN | frame `-opened`. |
| c | a direct press is refused in plain words, the card stays, nothing is saved | PENDING-HUMAN | frame `-direct`. Expected from the non-live measure: `unknown_gate` shown as E01. |
| d | the mirror button (`i`, "Ask it here") draws the card here | PENDING-HUMAN | frame `-mirrored`. |
| saving | "Saving your decision" shows before "Saved to your data room" | PENDING-HUMAN | frame `-saving` (may be too quick to catch; INCONCLUSIVE then is not a failure). |
| e | the screen says saved only after the room holds the decision | PENDING-HUMAN | frame `-saved` against the read-back. |
| f | the room holds exactly one decision, and its recorded route | PENDING-HUMAN | read-back in FINAL-RUN.md. Expected: one decision node, `answered_via mcp_relayed`. |
| g | decide later writes nothing (records hash identical) | PENDING-HUMAN | run `live-decide-later`; FINAL-RUN.md compares the hashes and checks the band still waits. |
| h | two quick presses leave one decision | PENDING-HUMAN | run `live-double-press`. Expected from the non-live measure: exactly one. |

Recorded answer route (`mcp_relayed` or `browser_nonce`) read from the room on the live run: PENDING-HUMAN. Non-live measure: `mcp_relayed`.

## 5. MCP server names

| Name the mod calls | Source | Confirmed by the live `/mcp`? |
|---|---|---|
| `MINDRIAN_SERVER = plugin:mos:mindrian-os` | derived from the manifest and `.mcp.json`, corroborated by real transcripts (section 1) | PENDING-HUMAN: `--final --group probes`, FINAL-RUN.md "MCP server names" says match, differs or not_seen. If it differs, the follow-up session edits `src/runtime/ids.ts` and the test arms. |
| `BRAIN_SERVER = plugin:mos:mindrian-brain` | same | PENDING-HUMAN, same step. Whether the shim should proxy `framework_techniques` is a separate decision (section 6). |

## 6. Questions for the navigator (found without a login)

Each has a recommendation you can approve in a word.

| ID | Question | Recommendation |
|---|---|---|
| Q-17-1 | Should the guarded Brain shim proxy `framework_techniques`, so the Think tab's lookup button can work? Today the shim exposes six tools and the mod's call returns "Tool framework_techniques not found", which the pane shows as P96 (honest: nothing was sent). | **Yes, as one small GSD quick**: add `framework_techniques` as a seventh shim tool with strict input `{ framework }`, calling `brainClient.callTool` (so the Part 8 egress guard stays inside the shim, the single audited path). Do NOT point the mod at the raw `theo` server (THEO-04). Urgency is low: the lookup button is never drawn on a real room yet, because `ViewModel.next.method` has no live source until 369.25's reader exists. Alternative: retire the lookup button. |
| Q-17-2 | A card the model raises WITHOUT flagging an option draws no "Mindrian suggests" line, although the runtime lists a top-level `recommended` (derived from rank 1). Keep it that way? | **Keep** (honest: the line shows only when the author marked a recommendation; OQ-06). Make the card raiser pass `recommended: true` when Larry really recommends. |
| Q-17-3 | The nested session reads as bound only through a binding file plus a session id, not through `CLAUDE_ACTIVE_ROOM`. The harness does this itself. Is any change wanted in the mod or the server? | **No change**; informational. If the live run shows the band unbound, report it and the follow-up decides (the likely fix is `--repo-plugin`). |
| Q-17-4 | `E01` (not `E04`) is what a person normally sees for a card another window raised (different server process). Is the E01 sentence the right plain words for that case? | **Keep**: "This decision card is not one this window drew. Ask for it again." fits, and the mirror button follows. |

## 7. Navigator answer

(not yet given: the navigator runs the runbook and replies; the follow-up session records the reply here verbatim, with a word for each open question and the verdict they accept, or notes that a step was skipped)
