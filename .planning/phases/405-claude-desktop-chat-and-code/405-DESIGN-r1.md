---
phase: 405
title: "MindrianOS first-class on the Desktop merged chat and the Desktop Code tab, beside the CLI"
status: DESIGN r1 (elephant), for Goldfish review
date: 2026-11-27
canon_parts: [3, 7, 8, 9, 11, 12]
base: main 1331fdeca; assumes 367 plans 11 and 12 (branch work/367-graph-writes-itself, 8cb094add) land on main first
inputs: 405-CONTEXT.md (OR-1 to OR-3, LOCKED), 405-RESEARCH.md (facts, file:line), 405-HATS.md (3 questions, spikes S1-S3), claude-surface-radar.md, docs/CLAUDE-SURFACE-MODEL.md, 367-DESIGN.md section 13 (branch)
rules: GUESS marks a guess. Every fact cites 405-RESEARCH.md section numbers (R#) or a file:line.
---

# 405 DESIGN r1

## 1. Goals

Owner need: "optimize mindrian for usage in the claude desktop platform its chat\code" (405-CONTEXT). OR-2: first-class in the CLI, the Desktop Code tab, and the Desktop merged chat, not "degrades gracefully".

"First-class" in this design means three testable things on each place:
1. Where the room is reachable, every room capability that can run there runs there, through one install path that a person can finish without editing JSON by hand.
2. Every write from a hookless place returns a receipt that proves it reached room.db on the user's disk, or a typed failure.
3. Where the room is not reachable, MindrianOS says so with a typed reason and one step back to a place that has the room. It never writes a room somewhere the user cannot see.

Goals:
- G1 Surface truth: the server names its place (CLI, local Code tab, cloud Code session, Desktop bridge, unknown) and stops reporting the local Code tab as hookless (R2.1).
- G2 Chat install path: one command in the CLI or the local Code tab connects the merged chat to the room server and the guarded Brain shim, with backup and read-back, reusing `/mos:setup` (commands/setup.md:68-83) and the two existing install copies.
- G3 Write receipts: every governed write tool returns a read-back receipt; a lost response is checkable through `room_changes` (R6).
- G4 Hook duties in the server for hookless places: the 367 governed-call wrapper (R3, last paragraph) carries the duties that need no model call; the duties that need the model are pulled by the server instructions.
- G5 Part 8 by code in chat: the guarded `mindrian-brain` shim is reachable in the merged chat, and the chat is told not to use unguarded Theo connectors with room content (R4).
- G6 Honest refusal in cloud-only places, in the server and in the skills (R5).

## 2. Non-goals

- A third install copy. `mos` and `mos-desktop` stay the two copies (369.1 D-09/D-13). A `.mcpb` extension is an alternative behind a spike (section 6), not a goal.
- A remote (cloud-hosted) room server. The room stays on the user's disk (Part 9).
- Building or changing the 367 runner or its trigger module. 405 reuses `lib/mcp/graph-catchup-spawn.cjs` and `scripts/graph-catchup.cjs` (jsagi-42 agreement, coordinator message 2026-11-27).
- `alwaysLoad` and tool deferral. Phase 402 owns them; 405 supplies spike SP3 evidence only.
- Website edits. OR-3: the website repo runs its own quick from a hand-off brief.
- Hooks in the merged chat. The platform ignores plugin hooks there for consumer accounts (radar Q1). The design does not depend on the 3P exception.
- Rewriting 118 skills. Section 3.6 adds one generated guard line, not new skill bodies.

## 3. The design

### 3.0 The places (replaces the three-name list for 405)

| Place | Who spawns the room server | Hooks | Room |
|---|---|---|---|
| P1 CLI | Claude Code | yes | yes |
| P2 local Code tab | Claude Code inside Desktop | yes (R0, R3) | yes |
| P3 cloud Code session, Projects cloud thread, cloud scheduled task | Claude Code in an Anthropic VM, only for a synced plugin (radar 2026-10-19) | yes, in the VM | no |
| P4 merged chat with bridge (and web or mobile with a linked computer) | the Desktop app, from claude_desktop_config.json (field evidence A1, A2) | no | yes, while Desktop is open |
| P5 merged chat, web or mobile with no bridge | nobody | no | no |

P2 uses the CLI hook path that is already on main (on-stop:56, session-start:135; jsagi-42 agrees). 405 work for P2 is surface truth and a parity test, not new duties.

### 3.1 Surface truth (G1)

Add a `place` axis inside `lib/mcp/surface-detect.cjs` (Part 7: the file already holds both axes and forbids a second detector, its comment at :91-118). `detectPlace()` returns `cli | code_local | code_cloud | desktop_bridge | cowork_http | unknown` from:
- `CLAUDE_CODE_ENTRYPOINT` (exact values pinned by spike SP5; GUESS: the Code tab sets a Desktop value, not `cli`),
- a cloud-session marker (GUESS: `CLAUDE_CODE_REMOTE`; pinned by SP3),
- the existing Cowork markers (surface-detect.cjs:60-62),
- the parent process: a stdio server with no Claude Code env and a Desktop-app parent is `desktop_bridge`,
- `detectHostTier(clientInfo)` after initialize (surface-detect.cjs:135-200) as a cross-check only.

The capability map gains `code_local: {hooks: true, apps: <SP5/SP6>}` so lib/core/arbitration.cjs:152-160 stops returning `not_applicable` where hooks run. The legacy `surface` value stays (memory-ops.cjs:572 and sr-entry.cjs:60 store it); `place` is additive. `status_read` and `room_list` report `place`. lib/statusline/surface-detect.cjs keeps its own copy of the rule (it is on the hook path); a drift test pins both to one fixture table.

### 3.2 Honest refusal in no-room places (G6, hats question 3)

- Server, place `code_cloud`: `resolveMcpWriteRoom` (session-room.cjs:285) refuses every write with the new typed reason `no_local_room_here` and a `route_back` text: open the local Code tab or Desktop on the computer that holds the rooms, or use Remote Control. Reads that need a room return the same reason. `room_list` returns an empty list with the reason, never a VM path.
- Server, any place: refuse `boot-fallback` and `room-root` sources whose path is not under a registered rooms home when place is `code_cloud` (stops a VM folder becoming a room).
- Skills (P5, and P3 when a synced skill runs bash): one guard line in every skill that names a room script, generated by the existing mirror builder (scripts/build-skill-mirrors.cjs) or the Phase 401 shared include, whichever lands first: "Room work needs the MindrianOS room tools. If no `room_list` tool is connected here, do not run room scripts; say that this place has no room and give the route back." The `${CLAUDE_PLUGIN_ROOT:?...}` guard (skills/lean-canvas/SKILL.md:63) stays as the second fence.
- First-class here means: Larry still teaches through skills and guarded Theo where available; the reply names the place and the one step to the room.

### 3.3 Write receipts with read-back (G3, hats question 1)

Where the server runs on P4: on the user's computer, spawned by Desktop (field evidence A1, A2: the pids were on the Windows host). Spike SP1 confirms this for a config server and tests the plugin-bundled case (radar UNVERIFIED 2).

How each write proves it landed: a new module `lib/mcp/write-receipt.cjs` builds one receipt shape after the write, from a fresh read:
`receipt: {room_id, read_back: true|false, file: {path, sha256, bytes} | null, nodes: [{id, review_status}], change_seq, reason?}`.
- Files: read the file again after `writeFileContained`, compare sha256 with the content sent.
- Rows: re-select the node and edge rows by id in a new statement after commit (the `fileEvidenceWithReadback` pattern, lib/core/navigation/file-evidence-readback.cjs:1-40; reuse its assertions, do not copy its insert).
- `change_seq`: the room change-feed cursor after the write, so the model (or a later session) can call `room_changes` with `after: change_seq - 1` and see the write when the first response was lost.
- Tools: artifact_file (views.cjs:537-600), claim_write, memory_event (graph.cjs:260), graph_write, gate_answer approve (gate.cjs:1612), room_create approve. A failed read-back sets `ok: false`, `reason: 'read_back_mismatch'` and keeps the file (no delete; the 367 runner and the doctor see it).
- Instructions (runtime-instructions.cjs:37) gain one clause: "After a write, show the receipt in one line; if a write call returns no result, call room_changes before you write again."
- The receipt runs on every place, the CLI included (one code path, no surface-specific code).

### 3.4 Hook duties in the server (G4, hats question 2)

The trigger is the governed tool call; the work is the 367 detached runner. No second runner.

| CLI hook duty (R3) | P4 equivalent | Mechanism |
|---|---|---|
| Graph catch-up (on-stop, session-start) | after every governed call | 367 wrapper, as built (graph-catchup-spawn.cjs:175-235). No change |
| Context at start (session-start, coordinator) | first governed call of a binding | room_bind result carries the context_assemble summary (existing tool, called in-process); instructions keep room_startup |
| Per-turn memory_event (intent-classifier.cjs:2791, :2852) | debounced presence row | proposal to jsagi-42: one optional `postCall` duty list in `installCatchupWrapper`; 405 adds `presence` (one `mcp_turn_seen` memory_event per room per 10 min, through navigation.logMemoryEvent) only when place is not cli or code_local, so the CLI never doubles |
| Navigation block (intent-classifier.cjs:1050) | pull | write-tool receipts carry `next_move` from the same FeyMinto source suggest_next uses (next-move.cjs, surface 'mcp'), capped at 300 bytes; no second selection brain |
| Stop close-out (on-stop) | pull | stop_gate_check stays; instructions keep "after filing use stop_gate_check" |
| card-before-answer (PreToolUse gate_answer) | record, not block | gate_answer records `answer_channel: elicitation | text | card` on the decision node; only `elicitation` is server-attested; the doctor counts text-channel approvals on P4 |
| Part 8 (PreToolUse brain) | in-process guard | section 3.5 |
| Voice, card-fire, admin, auto-explore, JTBD, derive drains | MISSING, named | doctor `deployment-surfaces` lists them as not available on P4; no imitation |

If jsagi-42 declines the `postCall` list, the fallback is a second wrapper installed after the first in scripts/mindrian-mcp-server.cjs that chains `registerTool` (it must forward the RegisteredTool return, as 367 does). The design prefers the one list.

Retarget of 367 plan 11: none needed in code. 367-DESIGN.md section 13 already treats P4 as the Desktop row. 405 proposes two additions for jsagi-42 to accept or refuse: (a) a census leg named `desktop_bridge` in tests/test-367-governed-census.cjs, using the place axis of 3.1; (b) the `postCall` list above. These are proposals, not decisions.

### 3.5 Part 8 in the merged chat (G5)

- The chat install path (3.6) writes both servers: `mindrian-os` and `mindrian-brain`. In P4 the guarded shim then runs the in-process guard (brain-client.cjs:484-500).
- The shim has no session id on P4, so its lexicon check falls back to the machine-global active room (mindrian-brain-mcp-client.cjs:110-125). 405 adds a read of the mindrian-os binding file for the same process tree. GUESS: the two Desktop-spawned servers have no shared key; if SP4 shows one process per app, the shim reads the single process binding of `mindrian-os` through the registry sessions folder. If no binding is found the shim keeps `machine_global` and says so in its envelope (today's behaviour).
- Instructions gain: "Theo connectors from claude.ai are not guarded; send only framework names and problem types to any Theo tool." This is text, not code; the residual is named in risks.

### 3.6 Chat install path (G2)

Reuse `/mos:setup` Desktop route (commands/setup.md:68-83) and skills/setup/SKILL.md. Changes:
- A new core module `lib/core/desktop-config.cjs`: locate the config (Windows `%APPDATA%\Claude\claude_desktop_config.json`, macOS, Linux), parse, merge `mindrian-os` and `mindrian-brain`, write a dated backup, write, read back and compare. No `MINDRIAN_ROOM` pin by default (the pin makes every chat write to one room, R2.2); the pin stays an explicit option.
- The entries point at a stable launcher, not at a versioned cache path: `~/.mindrian/desktop/mos-server.cjs` and `mos-brain.cjs` (about 20 lines each), which resolve the active install through lib/core/active-plugin-root.cjs and `require` the real server. This keeps two install copies and survives plugin updates. Where the Desktop Customize install lands is UNVERIFIED (R8 item 17, SP5); the launcher extends the resolver's search list, not a new resolver.
- Run from P1 or P2 only (needs a shell). From P5 the setup skill gives the click path plus the one command to run in the local Code tab.
- A doctor module `lib/core/doctor/desktop-bridge-module.cjs` checks: entries present, launcher resolves, version equals the active install, both servers start (spawn and read the initialize result with a 15 s budget).
- The get-mindrian route B text and the website copy change through the OR-3 hand-off, not here.

### 3.7 Per-conversation binding on a shared bridge process (conditional)

If SP4 shows one server process for all P4 conversations, the process key (session-binding.cjs:194-203) makes every chat share one binding. Then: `room_bind` on `desktop_bridge` says in its result "this binding is shared by every chat on this computer" (describeRoomBinding, session-room.cjs:415), and every write receipt names the room. A real per-chat key needs a host signal that does not exist today (no session id from Desktop, R2.2); 405 does not invent one. If SP4 shows one process per conversation, this slice is dropped.

## 4. Answers to the three hats questions

1. Where the room server runs on the merged chat, and how a write proves itself: it runs on the user's computer, spawned by the Desktop app from claude_desktop_config.json (field evidence A1, A2; SP1 confirms for the shipped server and tests the plugin-bundled case). Each write returns the 3.3 receipt built from a fresh read of the file and the rows, with a change-feed cursor so a lost response is checked with `room_changes`.
2. What triggers the graph write with no hooks: both, in one chain. The governed tool call is the trigger (367 wrapper), the detached 367 runner does the work. 367 plan 11 needs no retarget in code; 405 proposes a `desktop_bridge` census leg and an optional `postCall` list to jsagi-42.
3. What a no-room cloud place does: the server refuses with `no_local_room_here` plus a route back (3.2); skills carry one generated guard line; nothing is written in the VM; Larry still teaches. This stays within the two install copies: the chat reaches the existing copy through a launcher, not a third package.

## 5. Alternatives

| Option | What it is | For | Against | Verdict |
|---|---|---|---|---|
| A. claude_desktop_config.json server via `/mos:setup` + launcher | Desktop spawns the installed server | Field-proven on Windows (A1, A2); reuses setup.md and the installed copy; two copies kept | Config edit needs a shell step from P1/P2; admin policy can deny config servers (radar 2026-11-17, reverted 11-19) | CHOSEN |
| B. `.mcpb` desktop extension | A packaged local server installed by click | No JSON edit; best first-run UX (hats Red) | A third artifact to build, sign and release (5,000-file and size limits unknown for extensions, GUESS); bridge behaviour UNVERIFIED (SP7); dependency self-install inside an extension UNVERIFIED | DEFER: run SP7; owner ruling needed for a third copy |
| C. Remote connector (hosted MCP) | A cloud server the chat reaches directly | Works in P5, web and mobile without Desktop | The room would leave the user's disk or need a tunnel; Part 9 and Part 8 risk; server infrastructure, against the "no server infrastructure" constraint | REJECT for room data |
| D. Remote Control | claude.ai/code or mobile drives a local Claude Code session | Full runtime (hooks, room) from the cloud (https://code.claude.com/docs/en/remote-control) | Not the merged chat; needs Claude Code running and awake | KEEP as the route back in 3.2 text; no build |
| E. Account plugin upload to claude.ai | Customize > Plugins | Already works for skills (369.1) | Chat ignores plugin local servers (radar Q1) | Already in place; not enough alone |
| F. Do nothing | Chat gets skills only | No work | Fails OR-2; Part 8 holds only by text in chat; phantom-room risk (R5) | REJECT |

## 6. Spikes (before build)

| Id | Question | Cheapest test | Blocks |
|---|---|---|---|
| SP1 (hats S1) | Where does a plugin-bundled stdio server run in a merged-chat cloud task? What happens on a Desktop quit mid-tool-call? Which column (Chat or Cowork) does the merged chat follow: do plugin hooks or agents fire? Is CLAUDE_PLUGIN_ROOT set in the sandbox? | Reuse the spike 012 probe (branch work/367-spike-kits): add `s1_where` (hostname, pid, homedir, platform, env keys) and a 20 s `s1_hold`; install once as a Customize plugin and once as a config server; call each in a merged chat; quit Desktop at 5 s of `s1_hold`; add one plugin hook that touches a file and one skill that runs `echo $CLAUDE_PLUGIN_ROOT; hostname` | 3.2, 3.3, 3.5 |
| SP2 (hats S2) | Does a bridged write land and read back? What does the model see when the response is lost or the write fails? | Probe tool writes a file and one SQLite row, returns sha256; arm a seam that fails the write (read-only dir) and a seam that sleeps 30 s after the write; quit Desktop during the sleep; check disk and the next call's view | 3.3 |
| SP3 (hats S3, with Phase 402) | Does a synced plugin's `alwaysLoad` server delay the first turn of a cloud Code session? What env marks a cloud session? What disk does the server see? | One cloud Code session on a test repo with the plugin synced: time the first turn with `alwaysLoad` true and false; log `env` and `os.homedir()` from the server | 3.1, 3.2; Phase 402 |
| SP4 | One config server process per merged-chat conversation, or one per app? | Two merged chats, call `s1_where` in each, compare pid | 3.7 |
| SP5 | Local Code tab: `CLAUDE_CODE_ENTRYPOINT` value, `CLAUDE_CODE_SESSION_ID` export, hooks.json firing, MCP Apps rendering, where the Customize install lands on disk | In a local Code tab: `echo $CLAUDE_CODE_ENTRYPOINT $CLAUDE_CODE_SESSION_ID`; read the server stderr start line (mindrian-mcp-server.cjs:409); check session-start context in the first reply; `ls` the plugin cache folders | 3.1, 3.6 |
| SP6 | Does the merged chat forward a bridged server's `instructions` and render its `ui://` MCP App? | Probe server with a unique instructions sentence and one ui:// resource; ask the chat to quote its server instructions; call the app tool | 3.3 instructions clause, dashboards row |
| SP7 (only if option B is pursued) | Does a `.mcpb` extension appear through the bridge, run its own Node dependencies, and survive a Desktop quit? | Pack the spike 012 probe as `.mcpb`; repeat SP1 legs | option B |

## 7. Slices (build order)

Each acceptance criterion runs from the repo with `bash tests/run-all-405.sh` unless marked LIVE (a human leg on Desktop).

| # | Slice | Depends on | Acceptance criteria |
|---|---|---|---|
| 0 | Spikes SP1-SP6, results file 405-SPIKES.md | none | Each spike has a verdict, the raw output, and the design line it changes. LIVE |
| 1 | Place axis (3.1) | SP3, SP5 | AC1.1 table test: 8 env fixtures map to the 6 places. AC1.2 `code_local` has `hooks: true`; arbitration returns its normal value under that fixture. AC1.3 `status_read` and `room_list` show `place`. AC1.4 drift test: statusline and server detectors agree on the fixture table. AC1.5 wire snapshots (tests/fixtures/267/wire-snapshot-zod3.json, zod4.json) unchanged in tool configs |
| 2 | Honest refusal (3.2) | 1 | AC2.1 under `code_cloud`, each GOVERNED write tool returns `no_local_room_here` with `route_back`, and no file or room.db is created under the test HOME. AC2.2 `room_list` returns no VM path. AC2.3 the generated guard line exists in every skill that names a room script (count from disk equals the grep count); the builder `--check` passes |
| 3 | Write receipts (3.3) | none (SP2 tunes) | AC3.1 each of the six tools returns `receipt.read_back: true` with matching sha256 and node ids on a fixture room. AC3.2 a seam that alters the file after write gives `read_back_mismatch` and the file stays. AC3.3 `room_changes` after `change_seq - 1` lists the write. AC3.4 the CLI path returns the same receipt (one code path) |
| 4 | Server duties (3.4) | 367 plans 11-12 on main; jsagi-42 answer on `postCall` | AC4.1 under `desktop_bridge`, two governed calls 1 min apart write one `mcp_turn_seen` row; under `cli` none. AC4.2 write receipts carry `next_move` of at most 300 bytes from next-move.cjs. AC4.3 gate_answer writes `answer_channel` on the decision node. AC4.4 the 367 census still passes unchanged |
| 5 | Chat install path (3.6) and Part 8 shim entry (3.5) | 1, SP5 | AC5.1 desktop-config merge on fixtures for Windows, macOS and Linux paths: backup written, other servers untouched, read-back equal. AC5.2 the launcher starts the server from a fixture install tree and from a moved version dir. AC5.3 doctor module reports each of 4 broken states with a typed reason. AC5.4 the brain entry is written and the shim starts. LIVE: a merged chat lists `mindrian-os` and `mindrian-brain` tools after the command |
| 6 | Shared-binding disclosure (3.7) | SP4 says shared | AC6.1 `room_bind` on `desktop_bridge` states the shared scope. AC6.2 every receipt names the room slug. Dropped if SP4 says one process per chat |
| 7 | Instructions and docs | 3, 4, 5 | AC7.1 runtime-instructions gains the receipt clause and the Theo-connector clause; byte budget test of the instructions passes. AC7.2 docs/CLAUDE-SURFACE-MODEL.md matrix updated from 405-RESEARCH.md section 7. AC7.3 hand-off brief for the website and for get-mindrian route B written (405-WEBSITE-HANDOFF.md exists; updated) |
| 8 | Parity and live proof | all | AC8.1 the 405 matrix test runs the same fixture room through P1 and `desktop_bridge` fixtures and lists each capability state. LIVE: one merged-chat session binds, files one artifact, shows the receipt, and the doctor shows the artifact node; one cloud Code session refuses with `no_local_room_here` |

Count: 8 build slices (1 to 8) plus slice 0 for the spikes.

## 8. File table

| Slice | Create | Modify |
|---|---|---|
| 0 | .planning/phases/405-.../405-SPIKES.md; probe changes on branch work/367-spike-kits (coordinate) | none |
| 1 | tests/test-405-place.cjs, tests/fixtures/405/place-env.json, tests/run-all-405.sh | lib/mcp/surface-detect.cjs, lib/statusline/surface-detect.cjs, lib/mcp/tools/status.cjs, lib/mcp/tools/room.cjs |
| 2 | tests/test-405-no-room-refusal.cjs | lib/mcp/session-room.cjs, scripts/build-skill-mirrors.cjs (or the 401 include), skills/*/SKILL.md (generated line only), commands/*.md (same) |
| 3 | lib/mcp/write-receipt.cjs, tests/test-405-write-receipt.cjs | lib/mcp/tools/views.cjs, lib/mcp/tools/claim.cjs, lib/mcp/tools/graph.cjs, lib/mcp/tools/gate.cjs, lib/mcp/tool-router.cjs (room_create, graph_write sites) |
| 4 | tests/test-405-server-duties.cjs | lib/mcp/graph-catchup-spawn.cjs (only if jsagi-42 accepts `postCall`), else scripts/mindrian-mcp-server.cjs; lib/mcp/tools/gate.cjs |
| 5 | lib/core/desktop-config.cjs, templates/desktop/mos-server.cjs, templates/desktop/mos-brain.cjs, lib/core/doctor/desktop-bridge-module.cjs, tests/test-405-desktop-config.cjs | commands/setup.md, skills/setup/SKILL.md, data/doctor-modules.json, lib/core/active-plugin-root.cjs (search list), scripts/mindrian-brain-mcp-client.cjs (binding read) |
| 6 | tests/test-405-shared-binding.cjs | lib/mcp/session-room.cjs (describeRoomBinding) |
| 7 | none | lib/mcp/runtime-instructions.cjs, docs/CLAUDE-SURFACE-MODEL.md, 405-WEBSITE-HANDOFF.md |
| 8 | tests/test-405-parity.cjs | none |

Part 11: no new tool name. New core modules are not invocable surfaces. `/mos:setup` keeps its declared HITL shape; the config write is shown, confirmed and read back (the get-mindrian rule 9 pattern).

## 9. Interaction with other phases

- 367 (jsagi-42): 405 reuses the runner and the wrapper as built. Proposals only: `desktop_bridge` census leg, optional `postCall` list. The 367-CONTEXT:35 correction lives in 405-RESEARCH.md section 0.
- 402: owns `alwaysLoad`, deferral and hook consolidation. 405 hands it SP3. If 402 removes `alwaysLoad`, the 405 instructions clause about first activation still holds.
- 401: owns shared includes; slice 2 uses its include if it lands first.
- 400.3: owns artifact_file indexing (views.cjs:592-597); slice 3 adds the receipt after that index and does not change it.
- SEED-039: slice 6 is the bridge face of it; the per-chat key stays open in the seed.

## 10. Risks

- R1 The bridge is proven on one Windows machine; the prefix has no primary source (radar UNVERIFIED 3). A macOS leg is needed in slice 8.
- R2 A Desktop quit mid-write: the server writes locally, so the write likely lands, but the model may not see the receipt (GUESS). Mitigation: change_seq plus the instructions clause.
- R3 Shared binding across chats (SP4) can file one chat's content into another chat's room. Slice 6 discloses; it does not fix.
- R4 Unguarded claude.ai Theo connectors in chat: Part 8 holds there only by instruction text.
- R5 The config route needs a shell step; a person with only the merged chat must open the local Code tab once.
- R6 An admin policy can block config servers (radar 2026-11-17 to 11-19 change and revert).
- R7 Text-channel gate approvals on P4 are not server-attested; recorded as `answer_channel: text`, counted by the doctor.
- R8 The launcher depends on where Desktop installs the plugin (UNVERIFIED 17).
- R9 The 367 branch is not on main; slice 4 waits for it.
- R10 A generated line in about 118 skills touches the mirror and harness manifests (367-13 recorded a stale harness manifest blocking a prose commit, branch commit 8cb094add).
