---
phase: 402
kind: design (EGM elephant, r1)
date: 2026-11-27
status: DESIGN r1. Not reviewed. Goldfish round next. No code is written.
inputs: 402-CONTEXT.md (locked rulings), 402-RESEARCH.md (facts), 401-405-PROGRAM.md (C1, C3, C4, C16, C17, C22, C29), 405-DESIGN.md r5 (3.0, 3.7, 3.8, 3.12, 3.13, section 6)
marks: "PROVEN, CITED, GUESS, UNVERIFIED as in 402-RESEARCH.md. A section number such as R2 points to 402-RESEARCH.md section 2."
---

# Phase 402 DESIGN r1: lighter runtime

## 0. Plain picture

Today every session carries the full manual of all 76 tools. Most tools are not used in most sessions. The host can keep a tool as a name only and fetch its manual when the model asks for it. Phase 402 marks the few tools that Larry needs in every session as "always on the desk" and lets the rest stay "on the shelf". Nothing is removed. The shelf is one search away.

The second half is about hooks. A hook is a small program that the host starts at a fixed moment. Phase 402 makes each hook answer in one clean form, stops one hook from ending a turn by mistake, puts a hard limit on the start-of-session text, and starts fewer programs for each moment.

## 1. Goals

| Id | Goal | Measure |
|---|---|---|
| G1 | In local Claude Code (CLI and local Desktop Code tab) only the hot tools of mindrian-os load up front. | A host transcript shows the hot tools up front and the other mindrian-os names in the deferred list. Size: about 31.4 KB up front in place of 86.3 KB (R2). |
| G2 | The hot list is made by a written rule, lives in one data file and is checked by a test. | tests/test-402-hot-list.cjs |
| G3 | The tool list does not change: same names, same count on every machine (76 on a desktop surface, 73 on the CLI surface). | test-270, test-384-s7, the wire snapshot and the 367 census stay green and unchanged. |
| G4 | The Desktop chat gets the same marks on the wire. What the chat does with them is recorded by spike SP9, and each SP9 verdict has a written branch. | section 5 |
| G5 | The card-fire block no longer ends the turn (K4). The Stop wait fits its budget (400.3-09). | tests/test-402-card-fire-envelope.cjs |
| G6 | The session-start context cannot pass 10,000 characters (F2). | tests/test-402-session-start-cap.cjs |
| G7 | Every hook prints one JSON object or plain text only (K3). | tests/test-402-hook-stdout-shape.cjs |
| G8 | Fewer processes per Write, per turn end and per session start, with the same outputs. | a base and an after census; parity tests |
| G9 | The doctor shows the eager size and the deferred size, and warns below the host floor. | doctor row; tests/test-402-doctor-eager.cjs |
| G10 | Process skills that no navigator asks for by name stop taking listing space. | a list in the plan; a test |

## 2. Non-goals

1. No tool is added, removed, renamed or merged. No description or schema text changes (Phase 401 owns `$schema` and description trims).
2. No conditional registration of Eureka tools (reason: section 6; owner item 2 asks the owner to confirm).
3. No change to the served instructions (405 contract 1).
4. No change to the mindrian-brain entry of `.mcp.json`. It keeps `alwaysLoad: true` (R3; tests/test-127-00-shim-handshake.sh:102-106).
5. No UserPromptSubmit hook work. Phase 400.5 owns the 6 prompt hooks and the K3 defect site (OR-15; 400.5-CONTEXT 5e).
6. No `mcp_tool` hook and no new MCP tool for hooks. The 400.5 server tier is parked.
7. No trim of the "preloaded skills" (saves 0; 400.1 K1).
8. No change to the 367 runner, its wrapper or its census lists.
9. No move of the post-write cascade off the foreground (400.3-08, outside this phase).
10. No Jev voice run (unowned item of the program; not a 402 lever).

## 3. The hot list

### 3.1 The rule

A tool is hot when at least one of H1 to H4 is true. A tool that fails L1 or L2 is never hot.

| Id | Rule | Why | Source of truth |
|---|---|---|---|
| H1 | The served instructions name the tool. | A hookless place has only the instructions. A named tool that needs a search first breaks the first step of the loop. | lib/mcp/runtime-instructions.cjs:35-39 |
| H2 | The tool is a 405 receipt writer, or the read-back route of a receipt. | A write and its proof must not wait for a search (405 contract 2). | 405-DESIGN-r4.1.md:100; 405-RESEARCH.md section 6 |
| H3 | The tool carries a 405 chat component (decision card, framework player, next-move card). | The card is the answer to "what now"; it must be there from turn 1. | 405-DESIGN.md:203-216 |
| H4 | The tool is in the R3 list of 18. | Locked ruling R3. | 400.1-CONTEXT.md; 03-mos-runtime-cost.md:56 |
| L1 | The description is at most 4,096 characters. | Above it the host cuts an up-front description (R5 item 8). | measured; largest today 2,028 |
| L2 | The tool is not in the Eureka and RS family (`eureka_*`, `rs_*`). | 28 KB, 2 calls in 60 days (R3, R7). | name prefix |

Budget: the hot set is at most 36,000 B of description plus schema (measured 31,383 B plus 15 percent). A new hot tool that passes the budget needs a plan line with the measured bytes, the same way test-270 AFTER moves.

### 3.2 The list (PROVEN bytes, R2)

| # | Tool | Rules | Desc + schema B |
|---|---|---|---|
| 1 | gate_render | H1, H3, H4 | 4,020 |
| 2 | chain_run | H1, H3 | 3,101 |
| 3 | gate_answer | H1, H2, H3, H4 | 2,344 |
| 4 | context_assemble | H1, H4 | 2,327 |
| 5 | claim_write | H2, H4 | 2,265 |
| 6 | artifact_file | H2, H4 | 1,868 |
| 7 | orchestration | H4 | 1,766 |
| 8 | room_changes | H2 | 1,314 |
| 9 | room_search | H4 | 1,227 |
| 10 | room_graph | H4 | 1,164 |
| 11 | status_read | H1, H4 | 1,140 |
| 12 | graph_write | H2 | 1,027 |
| 13 | room_list | H1, H4 | 1,026 |
| 14 | claim_read | H4 | 885 |
| 15 | suggest_next | H1, H3, H4 | 833 |
| 16 | room_state | H4 | 829 |
| 17 | stop_gate_check | H1, H4 | 745 |
| 18 | room_create | H1, H2, H4 | 722 |
| 19 | memory_event | H2 | 681 |
| 20 | room_bind | H1, H4 | 584 |
| 21 | room_startup | H1, H4 | 575 |
| 22 | chain_resolve | H1, H4 | 513 |
| 23 | room-dashboard | H1 | 427 |

23 tools, 31,383 B (about 7.8k tokens). On the CLI surface the list is 22 tools and 30,956 B, because room-dashboard is not registered there (R2). Deferred: 53 tools, 54,867 B (about 13.7k tokens). The 2026-11-24 figure of 15.5k tokens was for 18 hot tools; the 5 tools of program C3 cost 1.6k tokens.

This resolves program C3: chain_run, memory_event, graph_write, room_changes and room-dashboard are hot. It needs owner item 1, because R3 says 18.

Tools that will join when they exist: `framework_play` (405 slice 13, H3). A 400.5 server-tier tool would not join: a hook calls it, not the model.

### 3.3 Where the list lives

- `data/mcp-hot-tools.json` (new): `{schema_version: 1, rules: {H1..H4, L1, L2 as text}, budget_bytes: 36000, tools: [{name, rules: ["H1", ...]}]}`. One place. No second copy in code.
- `lib/mcp/load-marks.cjs` (new, about 40 lines): `installLoadMarks(server)` replaces `server.registerTool` once per server object. For a name in the data file it forwards `config` with `_meta` set to `Object.assign({}, config._meta, {"anthropic/alwaysLoad": true})`. For every other name it forwards the call unchanged. It never touches the handler. A missing or unreadable data file gives 0 marks and one stderr line; the server still starts (the discipline of lib/mcp/register-core-tools.cjs:54-60).
- One call in `createServer`, before `registerRouterTools` (scripts/mindrian-mcp-server.cjs:256). The 367 wrapper (`installCatchupWrapper`, on the 367 branch at :247) wraps the handler only. The two wrappers compose in either order (R6).
- The mark is `true` or absent. No tool gets `false`: with the server key left out, an unmarked tool is deferred by default (R5 items 1 and 4).

### 3.4 The test of the rule (tests/test-402-hot-list.cjs)

1. Each name in the data file is a live tool on at least one surface (CLI-surface list and desktop-surface list).
2. H1: each name in the file's H1 set appears in the served instructions as a whole word, and no live tool name that holds `_` or `-` appears in the instructions without being in the H1 set. The 6 plain-word tool names (analysis, export, intelligence, meeting, methodology, orchestration) are skipped by the second half and listed in the test with the reason.
3. H2 and H3: the fixed sets of section 3.1 are subsets of the file. `framework_play` is checked only when it is live.
4. H4: the 18 names of R3 are in the file.
5. L1, L2 and the budget hold on the measured wire.
6. On the wire: the set of tools with `_meta["anthropic/alwaysLoad"] === true` equals the file's set that is live on that surface. No tool carries the key with another value. Every tool that had a `_meta.ui` before still has it, unchanged.

## 4. The deferral mechanism in local Claude Code (P1 CLI, P2 local Code tab)

Two changes. Both are needed. The order matters.

1. The marks (slice 3). With `.mcp.json` unchanged the server-level `alwaysLoad: true` overrides the marks, so this step changes nothing a user sees (400.1 Pitfall 2). It can land early.
2. The flip (slice 5). Remove the line `"alwaysLoad": true` from the mindrian-os entry of `.mcp.json` (line 6). Leave the key out. Do not write `false`: `false` defers the marked tools too (R5 item 4). The mindrian-brain entry stays.

After the flip, in a host with tool search on: the 22 or 23 hot tools load up front, the other mindrian-os tools are names in the deferred list, and the model loads one through tool search when it needs it.

Hosts where nothing changes (R5 item 7): `ENABLE_TOOL_SEARCH=false`, a model before Claude Opus 4 / Sonnet 4 / Haiku 4.5, or a denied `ToolSearch` tool. All tools load up front there, as today.

### 4.1 The declared floor

- Floor: Claude Code 2.1.287. Reason: it is the highest version the host doc names for the alwaysLoad family (2.1.285 for the per-tool `false` value, 2.1.287 for the server-level `false`). The doc gives no version for per-tool `true` (R5 item 6, UNVERIFIED). The floor is re-read from the host doc on the day slice 5 is planned (the 400.1 research is valid until 2026-12-08).
- Where it is declared: one new entry in data/capability-ledger.json (`mcp-per-tool-alwaysload-hot-list`, version 2.1.287, status active), and the existing entry `mcp-alwaysload-per-server-eager-token-trade` (:225-232) is updated to say that it now holds for mindrian-brain only. The doctor capability-ledger organ already reads `claude --version` (lib/core/doctor/capability-ledger-module.cjs:20, :44).
- What a host below the floor gets: all mindrian-os tools deferred, the hot ones too (GUESS, from R5 items 1 and 6). Larry still works; the first tool call costs one search. The doctor row says so with the update line. Owner item 3 asks if a line at session start is wanted too.
- The Desktop Code tab bundles 2.1.330 (CITED, 400.1-RESEARCH.md:104), above the floor.

### 4.2 The cold-start window

A per-tool mark does not make startup wait for the server (R5 item 3). The server-level key did (up to 5 s). So after the flip the first prompt can, in principle, reach the model before the mindrian-os tools exist (the Phase 114 window; program island 1.3 risk 3).

- Facts: cold `tools/list` 362 ms (PROVEN, R2). The SessionStart hooks run before the first prompt; the bash hook alone takes 1.86 s (CITED). GUESS: the server is connected before a person can send the first prompt.
- The design does not rest on the GUESS. Slice 5 has a LIVE acceptance leg: 5 cold CLI starts with a prompt sent at once (`claude -p`), and the transcript of each must show the hot tools in the first request.
- If 1 of 5 fails: rollback R-A (section 5.3), and the finding goes to the owner with the numbers.
- Gain in the same change: a cloud Code session with a synced plugin no longer waits for mindrian-os on the first turn (SEED-173 item d; Claude Code 2.1.304). The Brain entry still waits.

### 4.3 What stays true for hooks and views

- The PreToolUse matcher on gate_answer (hooks/hooks.json:219) matches a tool call by name. gate_answer is hot, so the question "does a matcher fire for a deferred tool" does not arise for it.
- The 9 tools with an MCP App view: 7 are hot. room-wiki and room-graph are deferred. GUESS: a deferred tool shows its view after tool search loads it. Slice 5 LIVE leg checks room-graph once in the Code tab.
- No command, skill or agent pre-approves a mindrian-os tool by prefixed name (R2, 0 hits). Deferral breaks no `allowed-tools` line.

## 5. The Desktop chat (P4) and the spike leg (OR-16)

### 5.1 What reaches the chat

The chat reaches the room server through the `.mcpb` extension (405 3.7). There is no `.mcp.json` there. The wire marks of section 3.3 are in `tools/list` on every surface, so the chat receives the same 23 marks. Whether the chat reads them is not written on any page (R5 item 11). The chat also has a "Tool access" mode per conversation.

Correction for 405-DESIGN.md section 6 (probe text, marked GUESS there): the probe must not use a "deferral mark". The mark is `_meta["anthropic/alwaysLoad"]: true` on the tools that must load up front; an unmarked tool is the deferred case. This is a note for the 405 elephant. Phase 402 edits no 405 file.

### 5.2 Spike leg SP9 (the owner runs it in the 405 Desktop session; one probe, two places)

Probe: the 405 probe server with 40 dummy tools. 20 are named `hot_01` to `hot_20` and carry `_meta: {"anthropic/alwaysLoad": true}`. 20 are named `cold_01` to `cold_20` with no mark. Each tool returns its own name. Each description is one sentence with a unique word.

Leg SP9-a, merged chat (the probe installed as the extension):
1. Open a new chat. Open the tools menu. Record the Tool access mode shown for the conversation (Auto, Always available, or On demand) and how the probe's tools are listed.
2. Type: "Without searching for tools, list the exact names of every probe tool you can call right now." Record the reply.
3. Type: "Call cold_07." Record whether a tool search step shows before the call, and the result.
4. Type: "Call hot_07." Record the same two things.
5. Change the Tool access mode to each other value, open a new chat each time, and repeat steps 2 to 4.

Leg SP9-b, Desktop Code tab, local session (the probe loaded with `claude --plugin-dir <probe plugin>` shape, its `.mcp.json` entry WITHOUT an `alwaysLoad` key):
1. Start a new local session. Type the sentence of step 2 above. Record the reply.
2. Type: "Call cold_07." Then: "Call hot_07." Record whether a search step shows.
3. Close the session. The executor reads the session transcript (`api-request-shape`): count the probe tools sent up front and the probe names in `deferred_tools_delta`.
4. Repeat steps 1 to 3 with `"alwaysLoad": true` on the entry (control: expect 40 up front).

Leg SP9-c, the same as SP9-b in the terminal CLI. No owner needed; the executor runs it.

Leg SP9-d (only if 405 slice 0 reads the chat skill listing): record whether a skill with `disable-model-invocation: true` shows in the chat's skill list and whether the chat runs it from a natural request. This feeds slice 11.

Expected in SP9-b and SP9-c (the host doc): 20 `hot_*` up front, 20 `cold_*` deferred. SP9-a has no expected value.

### 5.3 Verdict branches

| Verdict | Meaning | What 402 does |
|---|---|---|
| CC-A (SP9-b and SP9-c) | Claude Code honours the mark: 20 up front, 20 deferred. | Slice 5 as designed. |
| CC-B | Claude Code ignores the mark: 40 deferred with the key left out. | No flip. `.mcp.json` keeps the server-level `true`. Slices 3 and 4 still ship (harmless marks, honest doctor row). The saving is 0 until a host version honours the mark. NEEDS_HUMAN with the transcript counts. |
| CC-C | The mark works in the CLI and not in the Code tab (or the reverse). | No flip. NEEDS_HUMAN. One `.mcp.json` serves both places; the design has no per-place switch on purpose. |
| CH-A (SP9-a) | The chat honours the mark: hot up front, cold on demand. | Nothing more. G4 is met in full. |
| CH-B | The chat defers every extension tool, marked or not. | Accept and record. The instructions name the loop tools, so the model can search by exact name. Slice 6 adds one LIVE check: "bind my room" reaches room_bind in one search step. |
| CH-C | The chat loads every extension tool up front, marked or not. | No saving in the chat. No harm. Record it in docs/CLAUDE-SURFACE-MODEL.md through the 405 phase. The Eureka family then costs the chat about 7k tokens; owner item 2 holds the only lever (a smaller tool list on a marked process). |
| CH-D | The Tool access mode decides, not the mark. | Record the mode that gives the best result. The install text of the extension (405 slice 5a, doctor doc) names that mode in one line. No code. |

Rollback R-A (one line, any time after the flip): put `"alwaysLoad": true` back on the mindrian-os entry. The marks stay and do nothing. tests/test-114-mcp-alwaysload.sh has one constant that names the expected state, so the rollback is a 2-line commit with its reason.

## 6. Eureka tools on enable (program C4)

The ROADMAP words are "Eureka tools on enable". The study's reading was "register only when Eureka is enabled" (00-SYNTHESIS Phase B). That reading breaks three pins on a machine with no engine: the exact count 76 (test-270:535), the count 73 (test-384-s7:175) and the third census check, "no listed name is missing from the live union" (R4). It also makes the tool list differ from machine to machine, which the 405 contract forbids for a marked process (405 3.13).

Design: the family is always registered and never hot (rule L2). In a host that defers, a family tool costs its name only: 742 B for 27 names (R7). The 27,890 B of manuals leave the up-front context without a single list change. A tool that needs the engine already refuses with the fix line when the engine is absent (R7). So "on enable" is met in effect: a person who has not enabled Eureka pays about 186 tokens, not 7k.

- Pins: test-270 stays 76, test-384-s7 stays 73, the census stays GOVERNED 69 and PURE_READ 7. PA-2 is met with a move of 0.
- One Eureka rule with 405 (program C4, last bullet): 402 adds no enable check of its own. On a marked extension process the 405 refusal `local_session_required` (405 3.8) is the rule. 402 only keeps the family out of the hot list everywhere.
- Discovery: commands/eureka.md already names the family tools (R2 table, last column). Slice 6 checks that each family tool is reachable through tool search by its exact name in a LIVE CLI leg (one tool, eureka_graph_backtest).
- Where the host does not defer (verdict CH-C, or `ENABLE_TOOL_SEARCH=false`): no change from today. The lever that is left is a smaller list, which needs the owner (item 2).

## 7. Hook work and its owners (program C16, C17)

One owner per file and per defect:

| Defect or work | File | Owner | Phase 402 part |
|---|---|---|---|
| K3: JSON line plus plain line on UserPromptSubmit | scripts/intent-classifier.cjs:3812-3833 | 400.5 (Path H dispatcher prints one envelope) | none in the file. Slice 7 adds the shape test for every event; its UserPromptSubmit leg turns on when the 400.5 dispatcher is on main. |
| The 6 UserPromptSubmit rows | hooks/hooks.json:342-392 | 400.5 | none |
| K4: `continue: false` in the block | scripts/check-card-fire.cjs:867-877 | 402 (OR-15) | slice 1 |
| Stop gate wait above its budget (400.3-09) | scripts/check-card-fire.cjs:958-977; hooks/hooks.json:160-162 | 402 (folded in by OR-15) | slice 1 |
| F2: session-start cap | scripts/session-start | 402 (OR-15) | slice 2 |
| Consolidation of SessionStart, Stop, PostToolUse | hooks/hooks.json, scripts | 402 (400.5-CONTEXT section 6) | slices 8 to 10 |
| The post-write cascade off the foreground (400.3-08) | scripts/post-write | nobody in this program (outside 400.3) | none; slice 8 must not move the cascade |
| The Part 8 guard hook shape (parent plus `--inner`) | scripts/part8-egress-guard-hook.cjs | 400.3-05a (done) | never merged into a dispatcher |

Rule for the consolidation (slices 8 to 10): reuse the dispatcher core that 400.5 plan 02 builds (fixed order, one JSON envelope, the first `continue: false` wins, per-check deadline, parity test). Phase 402 does not write a second dispatcher (Part 7). So slices 8 to 10 start after 400.5 plan 02 is on main. If 400.5 has not landed when slice 8 is due, slice 8 waits; slices 1 to 7 and 11 do not depend on it.

### 7.1 K4 design (slice 1)

- The intercept envelope becomes `{decision: 'block', reason}` with no `continue` key. `reason` is the instruction the model receives: render the pending choice as a card now. The fixed `systemMessage` "Re-rendering your choices as a selectable card..." is removed from the block route, because it is a promise on screen that the hook cannot keep by itself (Part 12; 88 of 99 blocks ended with that line and no card, 400.1 K4).
- The hook reads `stop_hook_active` from stdin. When it is true the hook never blocks again in that turn: it prints `{continue: true, suppressOutput: true}` and writes one line to the local intercept log. This removes the loop risk that `continue: false` was hiding.
- Signal order (OR-21, program 2f row 402): the side-file entries `reached_gate_entries` decide first. An entry with an empty gate signature, or older than the current turn, is stale and does not block (5 of 7 log records had an empty signature, 400.1 K4). The text backstop stays as the second signal and blocks only on a literal fork line ("Your call:").
- 400.3-09: `RETRY_LOCK_MAX_ATTEMPTS` goes from 300 to 75 (75 x 20 ms = 1.5 s), below the 5 s row. The comment that names a 600 s budget is corrected. On exhaustion the existing unfenced path runs (D-12 in the file).
- Measure after: the Jev profile `card_fire_replay` (scripts/jev-devtime-client.cjs:481), default off, exit 77 with no key. The 30-day transcript count is taken again one cut later and after the 404 pilots (program C29).

### 7.2 F2 design (slice 2)

- A hard cap constant `SESSION_START_MAX_CHARS = 9000` (1,000 characters of headroom under the host cap; the measured brief is 8,825). The cap is applied to the final `additionalContext` string in one place, after the token budget logic.
- Over the cap: drop whole blocks in a fixed order (lowest value first: menu, nudges, room table rows from the end), then add one line: "Brief shortened: N blocks left out. Run /mos:status for the full view." No cut inside a block. The doctrine block, the binding block and a PENDING TENSION block are never dropped.
- The sessionstart-coordinator output (984 B) is a separate hook output with its own 10,000 cap; the test checks it too.
- F2 and the 405 slice 2 line for an unregistered cwd room (AC2.8) both add to session start. The cap test is the shared guard; 405 must fit under it.

## 8. Slices in build order

Group A starts now on branch work/402-cardfire-startcap (OR-15). It merges after the beta.95 cut (Cut 1). Group B starts after the 405 foundation is merged, the SP9 verdict exists and the floors are re-read (OR-9; ROADMAP.md:4460). Group C also needs 400.5 plan 02 on main.

Common gates for every code slice: the slice's own test; `bash tests/run-all-402.sh` (new runner, grows per slice); `node tests/test-270-tool-schema-budget.cjs`; `node scripts/build-connector-registry.cjs --check`; `node scripts/check-shape-declaration.cjs`; `node scripts/run-harness.cjs --check`; `node scripts/doctor.cjs --acceptance`. A new test that writes to a room uses the 405 register helper once 405 slice 2 is on main (program C18).

| # | Slice | Group | Depends on | Acceptance criteria | Extra gates |
|---|---|---|---|---|---|
| 1 | K4 card-fire envelope, `stop_hook_active`, stale-entry rule, 400.3-09 wait | A | none | AC1.1 the intercept envelope has `decision: 'block'` and a `reason`, and no `continue` key and no `systemMessage`. AC1.2 with `stop_hook_active: true` on stdin the output is `{continue: true, suppressOutput: true}` and exit 0 for every fixture. AC1.3 a side-file entry with an empty gate signature, or from an earlier turn, gives no block. AC1.4 a transcript fixture with a literal "Your call:" line and no card gives one block. AC1.5 with the retry-store lock held by another process the hook exits in under 2,500 ms (20 runs) and its comment names the 5 s row. AC1.6 the 7 records of the local intercept log, replayed as fixtures, give 1 block (the real fork) and 6 passes. | existing check-card-fire tests; tests/test-261029-qef-hook-timeouts.cjs unchanged |
| 2 | F2 session-start hard cap | A | none | AC2.1 on the large-room fixture (tests/fixtures/large-room/build-fixture.cjs) the `additionalContext` of session-start is at most 9,000 characters. AC2.2 the doctrine, binding and pending-tension blocks are present after a cut. AC2.3 the "Brief shortened" line is present exactly when a block was dropped. AC2.4 on the small fixture the output is byte-equal to the output before the slice. AC2.5 the coordinator output is under 10,000 characters on the same fixture. | 367 spawn line at scripts/session-start:135 unchanged (grep check in the test) |
| 3 | Hot list data, load marks on the wire, rule test | B | 367-12 on main (same server file); 400.5 not in the middle of an edit of scripts/mindrian-mcp-server.cjs | AC3.1 to AC3.6 = the 6 checks of section 3.4. AC3.7 with `.mcp.json` unchanged, tests/test-114-mcp-alwaysload.sh passes unchanged. AC3.8 test-270, test-384-s7 (golden not rewritten), the wire snapshot test and the 367 census pass with no edit. AC3.9 a missing data file gives 0 marks, 1 stderr line and a full tools/list. | tests/test-gpt-plugin-ui.cjs, tests/test-larry-theo-face-apps.cjs |
| 4 | Doctor eager row, host floor, ledger | B | 3 | AC4.1 the mcp-surface organ reports three numbers for mindrian-os: eager tokens (marked tools), deferred tokens, total; the WARN compares the eager number with `TOTAL_SURFACE_TOKEN_BUDGET` when the `.mcp.json` entry has no server-level key, and the total when it has. AC4.2 with a fixture `claude --version` below the floor the row is WARN with the update line; at or above the floor it is silent. AC4.3 data/capability-ledger.json holds the new entry and the corrected old entry; the ledger freshness check passes. AC4.4 the organ never returns `ok` for a server that lists 0 tools (existing rule kept). | tests/test-265-mcp-surface-organ.cjs |
| 5 | The flip: `.mcp.json` without the server key; test-114 rewritten; live proof | B | 3, 4; SP9 verdict CC-A; floors re-read; owner item 1 answered | AC5.1 `.mcp.json` mindrian-os entry has no `alwaysLoad` key; mindrian-brain keeps `true`. AC5.2 tests/test-114-mcp-alwaysload.sh asserts: no key on mindrian-os, `command: node` kept, and the wire carries the hot marks (it calls the slice 3 measure); the sub-test name AC-114-03 is kept and its text says "hot tools from turn 1". AC5.3 tests/test-127-00-shim-handshake.sh test 5 passes unchanged. AC5.4 LIVE CLI: one session transcript (`api-request-shape`) shows exactly the 22 hot mindrian-os tools up front and 51 mindrian-os names deferred. AC5.5 LIVE cold start: 5 fresh `claude -p` starts each show the hot tools in the first request (section 4.2). AC5.6 LIVE Code tab (owner, one session): the same count with 23 and 53; room-graph renders its view after a search. AC5.7 the mos-desktop copy and the foreign bundles: tests/test-234-dist-bundle.cjs passes; the Desktop copy `.mcp.json` equals the source. AC5.8 CHANGELOG line and the capability-radar note state the trade in plain words. | rollback R-A written in the plan |
| 6 | Eureka family rule and the chat branch | B | 5; SP9-a verdict | AC6.1 no `eureka_*` or `rs_*` tool is in the data file (part of AC3.5, restated as the family rule). AC6.2 test-270 count 76, test-384-s7 count 73 and the census 69 and 7 are unchanged at the end of the phase (one assert block in the runner). AC6.3 LIVE CLI: "run eureka_graph_backtest" reaches the tool through one search step and gets the engine refusal with its fix line on a machine with no engine. AC6.4 the SP9-a verdict row of section 5.3 is applied and recorded as a dated note in this file; for CH-B the LIVE check "bind my room" passes. | none |
| 7 | K3 hook stdout shape test | B | 1, 2 | AC7.1 tests/test-402-hook-stdout-shape.cjs runs every command of hooks/hooks.json except the UserPromptSubmit group on its fixtures (bound room, unbound, no room) and asserts: stdout is empty, or one JSON object with only whitespace around it, or text that does not start with `{`. AC7.2 the test reads the hook list from hooks.json at run time, so a new hook is covered with no edit. AC7.3 the UserPromptSubmit leg runs when the 400.5 dispatcher file exists and is the only UserPromptSubmit node hook besides the invariant tier; before that it prints SKIP with the reason "owned by 400.5". AC7.4 any defect the test finds in a non-prompt hook is fixed in this slice by moving the text into `additionalContext` of the one object. | none |
| 8 | Consolidation base census and PostToolUse Write | C | 7; 400.5 plan 02 on main | AC8.1 a census script prints host-started hooks and node starts per event on a fixture room (base file committed in the phase folder). AC8.2 the 6 node hooks of PostToolUse Write run through one dispatcher entry; the bash post-write row stays its own row. Rows for Write: 7 to 2. AC8.3 parity: for each of 12 fixtures the merged output equals the merge of the 6 solo outputs (context joined in the old order, first block wins). AC8.4 each check keeps its own deadline; a check that throws or times out is logged once and does not stop the others. AC8.5 the census pins of tests/test-389-hook-unwire.cjs and tests/test-385-hook-unwire.cjs and the budget table of tests/test-261029-qef-hook-timeouts.cjs move by the stated counts, with the reason in the test header. AC8.6 node starts per Write fall by at least 4 against the base census. | tests/test-369-hook-require-graph.cjs; tests/test-198-adapter-budget.test.cjs |
| 9 | Stop consolidation and on-stop batch | C | 8; 1 | AC9.1 gsd-graph-derive-sweep, check-card-fire and check-voice-style run through one dispatcher entry in today's order; ambient-stop stays async and separate; on-stop stays its own row. Stop rows: 5 to 3. AC9.2 parity as AC8.3, with the K4 envelope of slice 1 as the block form. AC9.3 inside scripts/on-stop the recompile calls for N sections become one node process that takes the N section paths; the two memory-lifecycle calls become one. AC9.4 the 367 spawn at scripts/on-stop:56 is unchanged. AC9.5 node starts per turn end fall by at least 5 against the base census and on-stop wall time does not rise. AC9.6 tests/test-3551-tri-polar.cjs passes unchanged. | 400.3 hook budget tests |
| 10 | SessionStart consolidation | C | 9; 2 | AC10.1 sessionstart-coordinator, sessionstart-reference-now-seed, check-pending-breakthrough, check-pending-ambiguous, gsd-graph-derive-drain and agentshield-sessionstart-scan run through one dispatcher entry. npm-reconcile (150 s), post-update-preflight and the bash session-start keep their own rows. SessionStart rows: 9 to 4. AC10.2 parity as AC8.3. AC10.3 each merged output stays under 10,000 characters (the slice 2 test covers the new entry). AC10.4 the 367 spawn at scripts/session-start:135 is unchanged. AC10.5 node starts per session start fall by at least 5 against the base census. | lib/memory/sessionstart-coordinator.test.cjs |
| 11 | Opt-in process skills | B (last) | 401 F1 on main; SP9-d or a statement that it was not run; owner item 4 | AC11.1 the plan lists each skill it flags, with its job sentence and the reason "no navigator asks for it by name". No skill with `kind: methodology` and no command mirror is in the list. AC11.2 `disable-model-invocation: true` sits before any comment line in each flagged file (the F1 test passes). AC11.3 the 8 skills that set `false` on purpose are not changed without a line of reason each. AC11.4 the mirror builder check passes. AC11.5 if SP9-d was not run, the slice flags only skills that are not user-facing in the chat (maintenance skills), and says so. | scripts/build-skill-mirrors.cjs check; data/harness-manifest.json if a digested file changes |

Slice count: 11 (2 in group A, 6 in group B, 3 in group C).

## 9. File table

| File | Slice | Change |
|---|---|---|
| scripts/check-card-fire.cjs | 1 | envelope, `stop_hook_active`, stale-entry rule, wait constants, comment |
| tests/test-402-card-fire-envelope.cjs (new) | 1 | AC1.1 to AC1.6 |
| scripts/session-start | 2 | hard cap, drop order, the one line |
| tests/test-402-session-start-cap.cjs (new) | 2 | AC2.1 to AC2.5 |
| data/mcp-hot-tools.json (new) | 3 | the list and the rule text |
| lib/mcp/load-marks.cjs (new) | 3 | `installLoadMarks` |
| scripts/mindrian-mcp-server.cjs | 3 | one call in `createServer` before :256 |
| tests/test-402-hot-list.cjs (new) | 3 | section 3.4 |
| lib/core/doctor/mcp-surface-module.cjs | 4 | eager, deferred, total; floor line |
| data/capability-ledger.json | 4 | 1 new entry, 1 corrected entry |
| tests/test-402-doctor-eager.cjs (new) | 4 | AC4.1 to AC4.4 |
| .mcp.json | 5 | remove line 6 |
| tests/test-114-mcp-alwaysload.sh | 5 | rewritten assert |
| CHANGELOG.md, references/capability-radar/capabilities-index.md | 5 | the trade in plain words |
| tests/test-402-hook-stdout-shape.cjs (new) | 7 | AC7.1 to AC7.3 |
| hooks/hooks.json | 8, 9, 10 | rows merged per event; rows 208 and 332 untouched |
| scripts/ (one dispatcher entry per event, on the 400.5 core) | 8, 9, 10 | new thin entries |
| scripts/on-stop | 9 | batch recompile, one memory-lifecycle call |
| tests/test-389-hook-unwire.cjs, tests/test-385-hook-unwire.cjs, tests/test-261029-qef-hook-timeouts.cjs | 8, 9, 10 | census and budget rows moved with reason |
| tests/census-402.sh (new), .planning/phases/402-lighter-runtime/402-08-base-census.txt | 8 | base and after census |
| skills/*/SKILL.md (the listed process skills), their mirrors | 11 | one key each |
| tests/run-all-402.sh (new) | all | the runner |

Files that Phase 402 does not edit: lib/mcp/runtime-instructions.cjs; any file under lib/mcp/tools/; lib/mcp/tool-router.cjs; tests/test-270-tool-schema-budget.cjs; tests/fixtures/384-s7-tools-list-golden.json; tests/fixtures/267/; lib/mcp/graph-catchup-spawn.cjs and the 367 tests; scripts/intent-classifier.cjs; the UserPromptSubmit rows; scripts/release.sh; any 405 planning file.

## 10. Interaction with other phases

### 405 (Desktop chat and Code tab)

- 405 gives 402: the SP9 verdict (slice 0), the place model (3.0), the marker `MINDRIAN_LAUNCHER`, the refusal `local_session_required`.
- 402 gives 405: the 5 contracts of 402-CONTEXT are met as follows. (1) Instructions untouched. (2) All named tools, the 6 writers, room_changes and the component tools are hot (section 3.2). (3) The tool list is constant (section 6). (4) Rows 208 and 332 untouched (section 9). (5) Only line 6 of `.mcp.json` changes; the theo-context entry that 405 slice 10 adds is not touched.
- Shared file scripts/mindrian-mcp-server.cjs: 405 slices 1 and 5a, 367-12, 400.5 and 402 slice 3 edit it. 402 adds one call line. Order: after 367-12; never in the same lane at the same time as 405 slice 13 (E2E plan lane L7).
- New tools of 405: `framework_play` joins the hot list in 405 slice 13 by adding one row to data/mcp-hot-tools.json (H3). The slice 3 test then passes without a 402 edit. 405 slice 14 adds `_meta.ui` to suggest_next; `installLoadMarks` merges, so both keys stay.
- Session-start budget: 405 AC2.8 adds one line; the slice 2 cap test is the guard.
- The `.mcpb` payload must hold data/mcp-hot-tools.json (405 AC5a.3 scan: "every folder the server reads"). Note for the 405 planner.

### 400.5 (prompt hooks)

- 400.5 owns UserPromptSubmit and K3's site. 402 slice 7 tests the shape for all events and turns its prompt leg on when the dispatcher exists.
- 402 slices 8 to 10 reuse the 400.5 dispatcher core. They do not start before it is on main.
- If the 400.5 server tier returns later (one `mcp_tool` hook, one new tool): the tool count moves 76 to 77 in that phase, the tool is not hot, and UNVERIFIED item 6 of the program (can an `mcp_tool` hook call a deferred tool) must be answered there. 402 states only that such a tool must work when deferred or be marked hot with a reason.

### 367 (graph writes itself)

- No 367 file changes. The census passes unchanged (G3). The two wrappers on `registerTool` compose (R6).
- The spawn lines at scripts/session-start:135 and scripts/on-stop:56 are fixed points of slices 2, 9 and 10, each with a grep assert.
- No 402 build on the server file before 367-11 and 367-12 are on origin/main (PA-1).

### 401 (hygiene)

- 401 owns `$schema` and description trims. They lower the eager bytes further; the slice 3 budget test reads live bytes, so a 401 trim needs no 402 edit.
- 401 F1 must be on main before slice 11 (a key after a comment line is not parsed).
- 401 "param rules once in the server instructions" has no room (program C14). 402 does not add to the instructions either.
- The 401 description cap and 402 slice 11 both touch chat discovery (program C22). Slice 11 is last and narrow for that reason.

### 400.3 and 404

- 400.3-09 is slice 1. 400.3-08 is not in 402.
- 404 rewrites command prose; the card-fire text backstop is measured again after the 404 pilots (program C29). 404 adds no tool to the hot list unless it meets H1 to H3.

## 11. Risks (in order)

1. The host does not honour the mark as the doc says (CC-B, CC-C). Cost: no saving. Guard: slice 3 is harmless alone; the flip waits for SP9; rollback R-A.
2. The cold-start window reopens (section 4.2). Guard: AC5.5; rollback R-A.
3. A deferred router tool (methodology, analysis, meeting) is not found from a natural request, so a chat user's "run a lean canvas" stalls. Guard: AC6.4 for the loop tools; UNVERIFIED for the routers. If SP9-a shows poor search, the fix is a plan line that adds `methodology` (732 B) to the hot list under a new rule; that is an owner item at that time, not now.
4. The hot list grows without control. Guard: the 36,000 B budget in the test and one data file.
5. The consolidation changes hook order or loses a block. Guard: parity tests per event; the two `onFailure: block` guards and both Part 8 rows are never merged.
6. Slices 8 to 10 wait on 400.5, which is deferred to the next beta. Guard: they are group C; the phase can cut slices 1 to 7 and 11 in Cut 3 and carry group C to the next cut. The planner must state this split in the plan.
7. The 30-day card-fire count cannot be compared at once (it needs a cut and use). Guard: the replay fixtures of AC1.6 now; the transcript count one cut later.
8. The floor is a GUESS for per-tool `true` (R5 item 6). Guard: re-read on the plan day; SP9-c on the oldest Claude Code the executor can install.
9. The research is valid until 2026-12-08. Group B is built after that date. Guard: slice 5 depends on "floors re-read".
10. The CITED process counts are older than the tree. Guard: AC8.1 base census before any consolidation edit.

## 12. Owner items (one plain question each, recommendation first)

1. The hot list has 23 tools, not 18. Recommendation: accept 23.
   - Picture: you ruled that 18 tools stay on the desk. The Desktop chat has no hooks, so Larry must pick up 5 more tools by hand there: the tool that runs a chain, the two small writers, the read-back, and the dashboard. If they are on the shelf, the first write in a chat needs a search first.
   - Question: may the hot list be the 18 plus these 5 (cost about 1.6k tokens of the 15.5k saving, so about 13.7k is saved)?
   - Why it matters: R3 names the number 18, and 405 needs these 5 up front.

2. "Eureka tools on enable": keep all 76 tools listed and let the 27 Eureka tools stay on the shelf, or remove them from the list until Eureka is enabled. Recommendation: keep them listed and on the shelf.
   - Picture: on the shelf, the 27 tools cost a name each (about 186 tokens in total) and three test pins stay as they are. Removed from the list, the tool list differs from machine to machine, three pins must be rebuilt, and a chat-only user can never turn them on.
   - Question: is "on the shelf, never on the desk" enough for "on enable"?
   - Why it matters: it decides if the tool count 76 stays a fixed fact for 405 and 367. One case is not covered by the shelf: a chat that loads every tool up front (spike verdict CH-C) would still carry about 7k tokens of Eureka manuals.

3. A person on a Claude Code older than 2.1.287. Recommendation: the doctor warns with the update line; no line at session start.
   - Picture: on an old host all MindrianOS tools go to the shelf, the desk ones too. Larry still works, one search slower on the first step.
   - Question: is a doctor warning enough, or do you want one line at session start for these users?
   - Why it matters: the session-start text is near its hard limit (8,825 of 10,000 characters), so each added line has a cost.

4. Opt-in process skills. Recommendation: flag only maintenance skills that no navigator asks for by name; leave every methodology skill and every command as it is.
   - Picture: a flagged skill is hidden from Claude's own choice and runs only when asked by name. In your own host the listing already shows names only, so the saving there is about 0. In the Desktop chat a hidden command may not be found from plain words.
   - Question: do you accept the narrow form (a short list of maintenance skills), with the wide form (all process skills) left out?
   - Why it matters: the chat is the place where plain-word discovery matters most, and no test has read the chat's skill list yet.

## 13. For the Goldfish round

Reading list: this file; 402-CONTEXT.md; 402-RESEARCH.md; 400.1-RESEARCH.md sections K2, K3, K4, F2 and "Common Pitfalls"; 401-405-PROGRAM.md sections 1.3, 2a, 2b, 2c (C1, C3, C4, C16, C17, C22), 2d and 2f (C29); 405-DESIGN.md 3.0, 3.7, 3.8, 3.13 and section 6; docs/CLAUDE-SURFACE-MODEL.md; the files of section 9.

Questions the elephant could not close: R11 items 1 to 8.

Record for the phase SUMMARY (EGM cost check): elephant step = 1 agent run plus 1 fetch agent run; no test suite run; 3 files written.
