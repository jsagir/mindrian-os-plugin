---
phase: 405
title: "MindrianOS first-class on the Desktop merged chat and the Desktop Code tab, beside the CLI"
status: DESIGN r2.2 theo-context cards (r2.2 adds G7, section 3.10, SP8, slice 10 after the owner follow-up on OR-7, 2026-11-27; earlier: r2.1 owner rulings (r2 after Goldfish round 1; r2.1 applies OR-4 to OR-7 of 405-CONTEXT.md, 2026-11-27; r1 kept as 405-DESIGN-r1.md; resolution in 405-GOLDFISH-REPORT-R1.md))
date: 2026-11-27
canon_parts: [3, 7, 8, 9, 11, 12]
base: main 1331fdeca. Build starts only after 367-11 and 367-12 reach origin/main (PA-1 condition 1); never branch from work/367-graph-writes-itself.
inputs: 405-CONTEXT.md (OR-1 to OR-3 LOCKED; PA-1, PA-2), 405-RESEARCH.md (R#), 405-HATS.md, 405-BRIDGES.md (B#; S = secondary source), the four 405-GOLDFISH-R1-*.md reviews, claude-surface-radar.md, docs/CLAUDE-SURFACE-MODEL.md, 367-DESIGN.md section 13 (branch)
rules: GUESS marks a guess. Finding ids in brackets (GB#, GM#) point to 405-GOLDFISH-REPORT-R1.md.
---

# 405 DESIGN r2

## 1. Goals

OR-2: first-class in the CLI, the Desktop Code tab and the Desktop merged chat. "First-class" means three testable things on each place:
1. Where the room is reachable, every room capability that can run there runs there, through one install path a person can finish without editing JSON.
2. Each of the six named room writers (3.3) returns a receipt read back from disk, or a typed failure, and a retry after a lost response never writes twice.
3. Where the room is not reachable, nothing is written, and the reply gives a typed reason and one step back to a place with the room.

Goals:
- G1 Correct capability facts in the server for the local Code tab, with the smallest change (3.1) [GM9].
- G2 Positive-evidence write rule: a room write or a room birth happens only in a room this computer's registry knows, on every place [GB2].
- G3 Receipts with read-back and an idempotency key on six writers [GB3, GB7, GM8, GM11].
- G4 Part 8 in the merged chat (OR-7): Larry may use theo-context openly for generic method there (framework cards, generative UI); no room content goes to any Theo server; the instructions say so in one line (3.6). The guarded shim stays the route where it is installed.
- G5 One-click chat install (OR-6): a `.mcpb` desktop extension of the room server, built at release beside `mos-desktop`, with proof that Desktop loaded it [GM7]. The config route of r2 becomes a fallback, built only if SP7 fails (3.7).
- G7 (r2.2, OR-7 follow-up) Theo framework cards are the default method experience for Desktop users, in the merged chat and in the Desktop Code tab, and the first-class experience in places with no room (3.10).
- G6 A human check for gate approvals on hookless places [GB1].

## 2. Non-goals

- (r2.1) The third install artifact is no longer a non-goal: OR-6 rules that the `.mcpb` extension is built in 405.
- A remote room server (Part 9).
- Any change to the 367 runner, its trigger or its tests. PA-1 allows a postCall list; r2 has no duty that needs it, so 405 does not use it [GM12].
- A presence row, `next_move` in receipts, a new memory_event type [GM12].
- A 6-value place enum, a statusline detector change, or a drift test [GM9].
- A guard line in skills, in this phase [GB6]. Reopened only by spike SP1 (section 6).
- Rewriting skills for chat. The skill bridge is Phase 404 (methodology commands as thin Theo recipes that run as server steps, ROADMAP.md:4478; B1.2): a recipe step runs inside the local server through the bridge, so one command works in the terminal and in chat. 405 states the dependency and does not build a second runner. Interim, no build: the server's existing MCP prompts (lib/mcp/prompts.cjs:95-222, 11 registerPrompt calls) are the chat front door where Desktop lists them as slash commands (B1.1, S: secondary sources only). B1.3 (an allowlisted local script runner) is rejected in 405: it is a process-spawning tool class (3.8) with no attested human gate yet.
- `alwaysLoad` timing (Phase 402). SP3 keeps only the cloud env and disk legs [ZO-N4].
- Website edits (OR-3) and the get-mindrian route B text (jsagi-42 raises it to the owner, 405-CONTEXT PA notes).

## 3. The design

### 3.0 Places

| Place | Who spawns the room server | Hooks | Room |
|---|---|---|---|
| P1 CLI | Claude Code | yes | yes |
| P2 local Code tab | Claude Code inside Desktop | yes (R0) | yes |
| P3 cloud Code session, Projects cloud thread, cloud scheduled task | Claude Code in an Anthropic VM, only for a synced plugin (radar 2026-10-19) | yes, in the VM | no |
| P4 merged chat with bridge (also web or mobile with a linked computer) | the Desktop app, from claude_desktop_config.json (field evidence A1, A2) | no | yes, while Desktop is open |
| P5 any chat with no bridge | nobody | no | no |

P2 uses the 367 CLI hook path on main (scripts/on-stop:56, scripts/session-start:135). The r1 statement "Desktop and Cowork (MCP only, no hooks)" (367-CONTEXT:35) is wrong for P2; recorded in 405-RESEARCH section 0 only.

### 3.1 Capability facts (G1) [GM9: zoom-out minimal path chosen]

Decision with evidence: no production code reads `capabilities.hooks` (arbitration is fed `ctx.arbitration_inputs`, which nothing sets, lib/core/navigation-engine.cjs:1598). The one live consumer of the capability map is lib/mcp/capability-registry.cjs:50-56 (`apps`). A 6-value enum has no consumer; so r2 does not add one.
- After SP5: if the local Code tab sets a non-empty `CLAUDE_CODE_ENTRYPOINT` other than `cli`, rule 4 in lib/mcp/surface-detect.cjs:65-69 accepts any non-empty value as Claude Code and returns `cli` with `apps: true` kept for that case (so room-dashboard stays registered; CD-M1). If it sets nothing, no change.
- One boolean `cloud_session` in `status_read`, set only from a marker SP3 proves. No marker found: the field is absent, and G2 still protects the room.
- Surface fingerprint (B3.1): `status_read` gains a read-only `fingerprint` object: `{surface, transport, host (readClientIdentity, surface-detect.cjs:250-270: clientInfo name and version), protocol_version, client_capabilities (elicitation, apps/ui), parent (ppid, parent executable basename), platform, node_version, session_id_present, plugin_root_present, cloud_session?, launcher (bridge entry or plugin)}`. No room content, no paths under the rooms home, hostname as a salted local hash only. It never leaves the computer: the doctor prints it, and a tester pastes it only by choice. This ships in slice 1 and replaces the value-only spike legs (section 6): every tester install answers them.
- Known value to check (S: withcoral/coral#2734 survey, secondary): Claude Desktop local stdio sends clientInfo `claude-ai` 0.1.0 and declares no elicitation capability. If the fingerprint confirms it, `detectHostTier` already maps it to `claude-desktop` tier0 (surface-detect.cjs:135-164) and `isWritePathEnabled` returns true (mcp-first-flag.cjs:131-145), so the `MINDRIAN_MCP_FIRST=desktop` entry of 3.7 is belt and braces, not a requirement.

### 3.2 Positive-evidence write rule (G2) [GB2]

One helper `isRegisteredLocalRoom(dir)` in lib/mcp/session-room.cjs (post-367 file): true only when the realpath of `dir` equals the realpath of a room in `<MINDRIAN_ROOMS_HOME or ~/MindrianRooms>/.rooms/registry.json` and holds `.mindrian/room.db`.
- Called from `classifyMcpWriteRoom` (367 branch session-room.cjs:256-281), so `resolveMcpWriteRoom` and the 367 spawn rule both follow it. Sources `cwd`, session-less `reg.active`, `boot-fallback` (including the default `<cwd>/room`, mindrian-mcp-server.cjs:190) and `room-root` all pass only through it. A failure returns `{ok: false, reason: 'no_local_room_here', route_back}`.
- Called from `room_bind` (tool-router.cjs:2272) before a binding file is written.
- Room birth (`prepareRoomCreation` and the approve leg in lib/mcp/startup-operations.cjs:44-86): allowed when the rooms home already has a registry, or when no registry exists and `cloud_session` is not true and the destination is under the user's home directory. GUESS: a cloud VM has its own home, so the last clause alone does not stop a VM birth; the SP3 marker is the real fence for a first room. If SP3 finds no marker, a first-room birth on P3 stays possible; recorded as risk R2 and the route-back text tells the person where rooms live.
- Order: `writePathRefusal` (write_path_disabled) first, as today (views.cjs:559), then `no_local_room_here`.
- `route_back` text (one string, in session-room.cjs): "This place has no MindrianOS room. Open the Code tab in Claude Desktop on the computer that holds your rooms (Local), or use Claude Code there."
- Existing pins outside the registry are refused (OR-5, LOCKED): the refusal carries one fix line: "Register this folder as a room with /mos:rooms adopt, then retry."

### 3.3 Receipts (G3) [GB3, GB7, GM4, GM8, GM11]

Writers in scope (named, not "every governed write"; others are listed DEGRADED by the doctor):
artifact_file (lib/mcp/tools/views.cjs:537), claim_write (lib/mcp/tools/claim.cjs:97), memory_event (lib/mcp/tools/graph.cjs:260), graph_write (graph.cjs:217), gate_answer approve (lib/mcp/tools/gate.cjs:1612), room_create approve (extends the existing receipt, lib/mcp/startup-operations.cjs:85-86).

Receipt shape, added to the existing result:
`receipt: {room_id, room_slug, read_back: true|false, file: {path, sha256, bytes} | null, rows: [{table, id}], change: {epoch, from_seq, through_seq}, client_write_id | null, replayed: false, reason?}`
- `file.sha256` hashes the bytes read back from disk after `injectArtifactId` (views.cjs:287-292), not the bytes sent. Decision on the zoom-out conflict (ZO-M4): kept, because the server transforms the content (CD-B1), so only a hash of the final file tells a later reader which bytes landed; the cost is one hash of one file.
- `rows`: a new generic `readBackRows(db, expect)` behind the navigation.cjs door, extracted from the inline checks in lib/core/navigation/file-evidence-readback.cjs:118-148; `fileEvidenceWithReadback` calls it, so there is one read-back.
- `change`: `navigation.readChangeLogMeta` (navigation.cjs:681) before and after the write transaction.
- `client_write_id`: a new optional string parameter (max 64 chars) on the six tools. The first write stores it on the written memory_event or node properties; a later call in the same room with the same id writes nothing and returns the first receipt with `replayed: true`. Lookup is one indexed read through navigation.cjs. This is the lost-response recovery: retry with the same id. `room_changes` is not needed for it (CD-M4: it answers bound rooms only, feed.cjs:60-70).
- Failed read-back: `ok: false, reason: 'read_back_mismatch'`; the file stays (the 367 runner and the doctor see it).
- Where the receipt text reaches the model [GB5]: the instructions stay byte-identical (served length measured 2000 bytes, runtime-instructions.cjs:25-27; BOUNDARIES frozen). The clause goes into each of the six tool descriptions instead (173 bytes, measured): "Returns a receipt read back from disk. Pass client_write_id; if a call returns nothing, repeat it with the same id: a stored id returns the first receipt and writes nothing."
- Part 12 [DC-N1, ZO-N5]: the model names the room in its normal reply; it shows a receipt only when `ok` or `read_back` is false.

### 3.4 Hook duties on P4 [GM12, GB1]

| CLI hook duty | P4 in r2 | Why |
|---|---|---|
| Graph catch-up | 367 wrapper as built | PA-1; no 405 change |
| Context at start | room_bind result carries the context summary from the lib/mcp/tools/context.cjs builder (called as a function, not the tool handler, so no second spawn; CD-N12) | removes one model step |
| Per-turn memory row, navigation block | CUT | no consumer in the room for a presence row; suggest_next is already in the instructions (runtime-instructions.cjs:37) |
| Stop close-out | stop_gate_check, pull | unchanged |
| card-before-answer | see 3.5 | GB1 |
| Part 8 | see 3.6 | GM3 |
| Voice, card-fire, admin, auto-explore, JTBD, derive drains | MISSING, listed by the doctor module of 3.7 | no imitation |

### 3.5 Human check for gate approvals on hookless places (G6) [GB1]

Fact: an elicitation card is already protected: a relayed answer to a dismissed dialog is refused `card_pending` (gate.cjs:1652-1675), and the answer channel is recorded as `answered_via` (`browser_nonce` or `mcp_relayed`, answer-route.cjs:39). The gap is the text rung: on P4 the model can call gate_answer approve for a text card with no human proof.
Rule in gate_answer approve: when no host hook can attest (the server has no `CLAUDE_CODE_SESSION_ID` and the host is not Claude Code by `readClientIdentity`), an approve with `answered_via: mcp_relayed` on a card whose renderer is `text` is refused with `human_confirmation_required` for two kinds: room_create and any card whose subject is a proposed claim. Other kinds pass and keep `answered_via: mcp_relayed` (today's behaviour). Preferred human-attested route on P4 (B3.2, candidate): render the gate card as an MCP App (`ui://`, the room-app pattern already used by room_create, startup.cjs `_meta: roomApp.TOOL_META`) and prove the click with the existing human-only route of lib/mcp/answer-route.cjs: the server mints a render nonce that the model never sees, the app returns its tag in request `_meta` under `mindrian/answer_route`, and a match records `answered_via: browser_nonce` (answer-route.cjs header :6-25). Today the proof is minted by the standalone shell from its 0600 control token (ui/shell/server/control.ts); an app iframe does not hold that token, so a second minting path is needed: the server keeps the nonce per gate in memory and the app returns it on an app-originated tool call. This is GUESS on three points, each tested in SP6: (a) the merged chat renders a bridged server's `ui://` card; (b) an app-originated tool call reaches the server with `_meta` the model cannot set; (c) the model cannot read the app resource body that carries the nonce. OR-4 (LOCKED) makes the app card the target route for every decision on P4. If all three points hold, gate_render on P4 draws the app card, and room_create and claim approves are accepted only with `browser_nonce`. Until the card exists, or if a point fails, the refusal above stays for room_create and claim cards, and a typed choice counts only for ordinary cards, recorded `mcp_relayed` (OR-4). If a point fails, the next step is a redesign of the card proof, not a relaxation. Elicitation is not relied on: the secondary survey says Desktop stdio declares none (S: coral#2734; S: anthropics/claude-ai-mcp#153).

### 3.6 Part 8 and Theo in the merged chat (G4) [GM3; OR-7]

- OR-7 (LOCKED): in the Desktop chat Larry may use the theo-context server openly for generic method (framework cards, Theo's generative UI). Part 8 still binds: no room content to any Theo server. theo-context's own tool text already says not to send private case text (405-CONTEXT OR-7). B2.2 signed egress is dropped.
- Instructions (r2.1 text, SUPERSEDED by 3.10 in r2.2): the THEO line of lib/mcp/runtime-instructions.cjs:38 changes from "THEO: ask for generic methodology through guarded mindrian-brain brain_* tools only when available. Never invent a Theo result." (127 bytes) to "THEO: generic method via guarded mindrian-brain brain_* or theo-context cards; no room content. Never invent a Theo result." (123 bytes). Served length measured with the change applied in memory: 1996 bytes (budget 2000, cap 2048). BOUNDARIES is not touched (its frozen copy in lib/mcp/no-instructions.test.cjs stays green). The harness manifest digest of the file (scripts/build-harness-manifest.cjs:172, :186-189) is regenerated in the same slice.
- Where the guarded shim runs (CLI, local Code tab, and the config fallback of 3.7 if built): response sanitize through lib/core/brain-response-sanitize.cjs (the module scripts/brain-response-sanitize-hook.cjs requires at :36); with no `CLAUDE_CODE_SESSION_ID`, the lexicon check uses the union of registered rooms (`lexicon_scope: all_registered_rooms`, budget measured in AC5b.3, fallback `machine_global` with disclosure). The `.mcpb` of 3.7 carries the room server only; GUESS: one extension holds one server entry (SP7 records whether a manifest can hold two). If it can, the shim rides in the same extension.
- B2.3 (closed shapes on every chat-reachable room-adjacent Theo tool) stays a hand-off to the Theo repo, not a 405 slice.
- Residual: Part 8 with theo-context and claude.ai Theo connectors holds by instruction text and Theo's own tool text, not by MindrianOS code (R4). This is the owner's accepted trade (OR-7).

### 3.7 Chat install path (G5) [GM7, GM10, GM15; OR-6]

Decision with evidence (one install path preferred): the `.mcpb` extension is the primary chat install (OR-6: one click, bundled `node_modules`, the Node that ships with Desktop). The config route is the only route with field evidence (A1, A2), and the `.mcpb` route has none yet (SP7). So the config route is not cut outright: it is a fallback whose build is conditional on SP7 = B (the extension is not reached through the bridge, or its Node cannot run the server). If SP7 = A, the config route is cut and `/mos:setup desktop` only points to the extension. If SP1 = A (a Customize plugin server is bridged), both are still built only as far as OR-6 requires the extension; the doctor notes the plugin route.

#### 3.7a The `.mcpb` extension (primary)

- Build: a new release step builds `mindrian-os.mcpb` from the same `npm pack` payload the Desktop copy uses (scripts/release.sh Step 6.8 source), minus `bin/`, `lib/ui-shell/dist`, `hooks/`, `agents/`, `skills/`, `commands/` (the extension serves the MCP server only; skills reach chat through the Customize plugin). The pack tool (`@anthropic-ai/mcpb` CLI, S: mcpb README) lives in a walled-off package `tools/mcpb/` with its own lockfile (CLAUDE.md conventions: no build packages in the root package.json).
- Bundled dependencies: only the runtime closure of `scripts/mindrian-mcp-server.cjs`, installed from `npm-shrinkwrap.json` with `npm ci --ignore-scripts --omit=dev`, then pruned by reachability (the Step 6.7 sharp-prune precedent, 369.1 D-16). The 369.1 full install was about 15,000 files and 511 MB (369.1 close-out); the extension must be far smaller. Limits are UNVERIFIED for extensions; AC5a.2 sets the gate at the claude.ai plugin limits already enforced by the builder (4,500 files, 180 MB, 50:1, build-desktop-artifact.cjs:156-221) until SP7 finds the extension limits.
- Manifest (`manifest.json`, mcpb spec, S): `name: mindrian-os`, `display_name: Larry | MindrianOS`, `version` = the release version, `server.type: node`, `entry_point: scripts/mindrian-mcp-server.cjs`, `mcp_config.env: {MINDRIAN_MCP_FIRST: desktop}`, `compatibility.runtimes.node: ">=22.18.0"` (the node:sqlite `timeout` floor, CLAUDE.md stack table), `user_config` for the rooms home (default `~/MindrianRooms`). The Node that Desktop ships is UNVERIFIED; if SP7 shows it below 22.18.0, the manifest points `server.type` at the system Node and the AC changes (If B column).
- Self-install: not needed in the extension (dependencies are bundled). The install responder (lib/core/mcp-install-responder.cjs) stays for the plugin copies.
- Code-tab collision: if the local Code tab also loads extensions (UNVERIFIED, SP5), the extension's server, started with `CLAUDE_CODE_ENTRYPOINT` set, serves the install responder's single status tool ("this extension is for the Desktop chat; this session uses the plugin's own servers").
- Proof that Desktop loaded it: each start writes `~/.mindrian/desktop/heartbeat.json` (time, ppid, parent executable name, `launcher: mcpb`). The doctor reports `desktop_loaded: true` only for a heartbeat whose parent is not Claude Code and whose version equals the active install.
- Release lockstep: the `.mcpb` version equals plugin.json, package.json, the tag and the marketplace entries (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5 gains one place). The artifact is attached to the GitHub release and linked from the marketplace README and `/mos:setup desktop` (distribution channel beyond that: UNVERIFIED, SP7 records how a person installs it, for example drag onto Settings > Extensions).
- Doctor: one new module `lib/core/doctor/desktop-bridge-module.cjs`, reusing the spawn helper of lib/core/doctor/mcp-surface-module.cjs:14-22. Typed states: `extension_missing`, `extension_version_drift`, `config_present_never_loaded`, `server_start_timeout`, plus the fallback states below when built. It lists the P4 MISSING duties of 3.4. Registered in data/doctor-modules.json; flags documented in commands/doctor.md (tests/test-doctor-doc-parity.cjs:32, :134).

#### 3.7b The config route (fallback, only if SP7 = B)

- `/mos:setup desktop`, an explicit subcommand (commands/setup.md argument-hint gains `desktop`; the current surface routing at :54-95 sends a Claude Code shell to the CLI branch and its path snippet at :58 resolves bash, CD-M8). It runs only where a shell runs (P1, P2), shows the change, gets a yes, writes a dated backup, merges, reads back.
- Config entries, distinct names so the local Code tab (which also reads this file, radar Q3) does not start a second pair under the plugin names: `mindrian-os-bridge` and `mindrian-brain-bridge`. Literal shape per OS:
  `{"command": "<node path>", "args": ["<home>/.mindrian/desktop/mos-bridge"], "env": {"MINDRIAN_MCP_FIRST": "desktop"}}` (brain entry: `mos-brain-bridge`). `<node path>` = `process.execPath` of the setup run, refused below 22.18.0. Config paths: Windows `%APPDATA%\Claude\claude_desktop_config.json` plus the packaged-app path as a second candidate (GUESS, SP5 records the A1 machine's path); macOS `~/Library/Application Support/Claude/`; Linux `~/.config/Claude/`. WSL: refused with `wsl_desktop_mismatch` and the manual snippet (GUESS: no /mnt/c mapping in this phase).
- `MINDRIAN_MCP_FIRST=desktop` opens the write path whatever client name the bridge sends (mcp-first-flag.cjs:131-136) [GM15]. SP1 records the client name; if it is `claude-ai`, the env entry is still harmless.
- Launchers: dumb dispatch shims copied like scripts/statusline-mos-dispatch (marker line, zero logic, resolve the newest installed copy at run time through lib/core/active-plugin-root.cjs, which gains `mos-desktop` after `mos` in its search list). Registered as owned surfaces in data/deployment-surfaces.json, so the existing deployment-surfaces doctor re-stamps them.
- Code-tab collision: when a launcher starts with `CLAUDE_CODE_ENTRYPOINT` set, it serves the dependency-free install responder (lib/core/mcp-install-responder.cjs) with one status tool that says "this entry is for the Desktop chat; this session uses the plugin's own servers", and nothing else.
- Proof that Desktop loaded it: each launcher start writes `~/.mindrian/desktop/heartbeat.json` (time, ppid, parent executable name). The doctor reports `desktop_loaded: true` only for a heartbeat newer than the config write whose parent is not Claude Code. The setup step ends with "Quit Claude Desktop fully and open it again".
- Doctor (same module as 3.7a): fallback states `config_missing`, `entry_missing`, `launcher_unresolved`, `version_drift`.

### 3.8 Bridge threat model [GM1]

Assets: room files, room.db, the rooms home and registry, `~/.mindrian/desktop/*`, claude_desktop_config.json.
Actors: the cloud model; content injected into the cloud context (web pages, uploads, other connectors); a linked web or mobile session that drives the same computer (support 17444462); a local process that edits files in the user's home.

| Tool class on P4 | Examples | Default in r2 | Residual |
|---|---|---|---|
| Read | room_list, graph_query, context_assemble, room_artifact | allowed, registered rooms only (3.2) | injected text can read room content into the cloud context; the cloud context already sees what the user shares; Part 8 still applies to Brain calls |
| Governed write | the six of 3.3, others | registered room only (3.2); receipt; idempotency key | an injected call can write into a registered room; mitigated by receipts naming the room, not prevented |
| Path-choosing | room_create | human check (3.5); destination under the rooms home | first-room birth fence depends on SP3 (R2) |
| Process-spawning | research_run deep (refused off Claude Code today), Eureka engine, the 367 runner | unchanged; the runner takes no MCP argument for paths (367-DESIGN 6) | Eureka engine spawn on an injected call: UNVERIFIED, listed for slice 2 review |
| Network | research_run quick, brain_* via the shim, theo-context (OR-7) | guarded shim where installed; theo-context by instruction text only (3.6); research search strings need a gate_answer approval (research_run description) | claude.ai connectors outside our code (O4) |
| Launcher files | `~/.mindrian/desktop/mos-bridge`, `mos-brain-bridge` | zero-logic shims; resolve only paths under the plugin install roots that active-plugin-root.cjs knows | a local attacker who can write the home directory can already edit shell profiles; no new privilege |

### 3.9 Per-conversation binding on a shared bridge process [GM2]

Decided by SP4:
- If one process serves all P4 conversations: on that process each governed write requires a `room` argument (slug) equal to the bound room, else `room_mismatch`; room_bind states "shared by every chat on this computer". The `room` parameter is optional in the schema and required only by the server rule on this process (the rule keys on `MINDRIAN_MCP_FIRST=desktop` set by the bridge entry, not on detection).
- If one process per conversation: nothing is added.

### 3.10 Theo framework cards as the default method experience (G7, r2.2)

Owner follow-up (2026-11-27, OR-7): "what about what i told you for desktop users using theo-context?" Permission is not enough; the cards must show.

Facts:
- theo-context is a remote Streamable HTTP MCP server. On this dev machine it is a user-scope entry `theo-context: {type: http, url: https://theo-context.onrender.com/mcp}` in ~/.claude.json, with no auth header (read of the key names only, 2026-11-27).
- This account also has a claude.ai connector named Theo-Claude whose tool names match theo-context (framework_walkthrough, framework_steps, show_theo_face, problem_lenses, play_method, larry_move and others; from the tool list of this session). Whether it points at the same URL is UNVERIFIED; it was not called.
- The repo already treats both as Theo routes for Part 8: lib/core/part8-egress-guard.cjs:845-867, lib/core/brain-response-sanitize.cjs:134, :245, scripts/part8-egress-guard-hook.cjs:49, :91. lib/core/feyminto/theo-ask.cjs:24 notes that framework_route exists only in theo-context.
- Radar Q1: the account plugin loads in the merged chat with skills, commands and remote MCP connectors. Claude.ai account connectors also load in local Code sessions (Desktop v1.40609.0) and in cloud Code sessions and Projects threads (radar Q4).

Design:
1. Ship theo-context with the plugin. The plugin `.mcp.json` (and so the `mos-desktop` copy, which is the same file, R1) gains `"theo-context": {"type": "http", "url": "<THEO_CONTEXT_URL>"}` (no `alwaysLoad`; Phase 402 owns deferral). Effect: the CLI and the local Code tab get the cards with the plugin and no extra step. GUESS: the merged chat, web and mobile load it as a plugin remote connector (radar Q1 wording); spike SP8 decides.
2. One-step connect where the plugin route does not reach (SP8 = B, or a person without the plugin): a claude.ai custom connector with the same URL. It is account-level, so one step covers the merged chat, web, phone, the Code tab and cloud Code sessions. The step text appears in three places: the `room_list` tool description (173 bytes, measured: "If no Theo framework card tools are connected, tell the person once how to add them: Settings > Connectors > Add custom connector, URL https://theo-context.onrender.com/mcp."), `/mos:setup desktop`, and the `.mcpb` onboarding page (the extension cannot add a claude.ai connector, GUESS). The URL waits for owner item O7.
3. Routing rule, in the instructions THEO line (replaces the r2.1 text of 3.6): "THEO: method questions go to Theo card tools if present, else guarded mindrian-brain brain_*; generic handles only. Never invent a Theo result." (143 bytes). To fit, the LOOP line drops "; status_read on request" ("After filing use stop_gate_check; status_read on request." becomes "After filing use stop_gate_check."); the model still sees status_read in its tool list. Served length with both changes applied in memory: 1992 bytes (measured on base a7c8951d7; budget 2000, cap 2048). BOUNDARIES byte-identical (checked). A method question means: which framework, its steps, a walkthrough, a lens or a play. Arguments are generic handles only: framework names, problem types, step numbers; never room text (Part 8 unchanged).
4. Part 8 code fences for the new route: the CLI hook matchers do not match a plugin-prefixed theo-context tool today. The matcher group for theo-context is `[Tt]heo-context__.*` with no plugin prefix (hooks/hooks.json PreToolUse and PostToolUse brain rows), so `mcp__plugin_mos_theo-context__framework_walkthrough` passes unchecked. Slice 10 extends both matchers (egress guard and response sanitize) with the optional `plugin_<name>_` prefix for theo-context. In the merged chat no hook runs; Part 8 holds there by the instruction line and theo-context's own tool text (OR-7 accepted trade, R4).
5. No-room places become first-class with cards: the `route_back` text of 3.2 gains "Framework cards from Theo still work here: ask Larry about any method." (70 bytes). So a web, phone, cloud Code or Projects user gets an honest "no room here", the one step back, and full method cards.
6. Doctor and status: a new check in lib/core/doctor/desktop-bridge-module.cjs prints `theo-context reachable: yes | no (<reason>)` from a probe that sends only an MCP `initialize` request to the URL (no tool call, no room data, 5 s budget), and `theo-context configured: plugin | user | none` from the key names in the plugin `.mcp.json` and ~/.claude.json. `status_read` reports `theo_cards: {configured_in_plugin: true|false}` (static, no network). Whether the chat itself has the cards is known only to the model (its tool list); the room_list description clause covers that case.

## 4. Answers to the three hats questions

1. Where the room server runs on P4 and how a write proves itself: on the user's computer, spawned by the Desktop app (A1, A2; SP1 re-checks with ppid and client name). Each of the six writers returns a receipt built from a fresh read of the file and rows, with a change-log range, and a retry with the same `client_write_id` returns the first receipt instead of writing again.
2. What triggers the graph write with no hooks: the governed tool call triggers the 367 detached runner, as built. 405 adds no duty to the wrapper. The `desktop_bridge` census leg (PA-2) is a fixture leg in slice 4.
3. What a no-room place does: the server refuses every room write and binding outside the registry (`no_local_room_here` plus route back); a room tool failure tells the model not to fall back to shell scripts (room_list description clause, 131 bytes measured: "If a room tool fails or is not connected, do not run room scripts in a shell; say that this place has no room and how to reach one."). r2.1: the hats question asked for two install copies; OR-6 (LOCKED) adds the `.mcpb` as a third artifact, kept in the release lockstep (slice 9).

## 5. Alternatives

| Option | For | Against | Verdict |
|---|---|---|---|
| A. claude_desktop_config.json bridge entries via `/mos:setup desktop` | field-observed once on Windows (A1, A2); reuses setup, dispatch shims, doctor helper | one shell step; admin policy can deny (radar 2026-11-17, reverted 11-19); only one OS observed | FALLBACK (r2.1): built only if SP7 = B |
| B. `.mcpb` extension (B3.3) | one click; bundles node_modules and uses the Node that ships with Desktop, removing the 11-26 s self-install (S: mcpb README, secondary); widens the tester fleet for the fingerprint | third artifact in the release lockstep; bridge and Node version UNVERIFIED (SP7) | CHOSEN (OR-6, LOCKED) |
| C. Remote connector | works without Desktop | room leaves the disk; server infrastructure | REJECT |
| D. Remote Control | full runtime from the cloud | not the merged chat | route-back text only |
| E. Customize plugin alone | already installed by users (369.1) | chat ignores plugin local servers per docs (radar Q1) | if SP1 shows it bridged, it replaces A |
| F. Explicit room per write | removes shared-binding risk | schema and model burden | used only if SP4 shows a shared process (3.9) |
| G. Do nothing | none | fails OR-2 | REJECT |
| H. CI emulated host (B3.4, MCPJam inspector, S) | proves the server side on Windows and macOS runners | does not prove Desktop | optional addition to slice 8, no dependency |

## 6. Spikes (slice 0)

All legs record into 405-SPIKES.md: raw output, verdict, design line changed. Probe: spike 012 kit (branch work/367-spike-kits), extended. Value-only legs (marked FP) are answered by the slice 1 fingerprint on tester installs instead of a separate probe; legs that need an action (a quit, a forced failure, a hook firing, a cloud session) stay as probes. Where a secondary source gives an expected value, the spike confirms it and does not assume it.

| Id | Question | Cheapest test | If A then | If B then |
|---|---|---|---|---|
| SP1 | Where does a Customize-installed plugin server run for a merged-chat task; what client name and parent process does a bridged server see; do plugin hooks fire; is CLAUDE_PLUGIN_ROOT set in the sandbox; what happens on a Desktop quit mid-call | `s1_where` (hostname, pid, ppid, parent exe, homedir, clientInfo, env keys) and a 20 s `s1_hold`; install as Customize plugin and as config server; Windows and macOS; quit at 5 s; one plugin hook that touches a file; one skill that prints `$CLAUDE_PLUGIN_ROOT` and `hostname` | A: plugin server is on the user's host through the bridge: drop 3.7, keep a doctor note | B: not reached or runs in the VM: build 3.7. Separately: if skill bash sees CLAUDE_PLUGIN_ROOT in the VM, reopen the skills guard (GB6) with the stamp-firing-block mechanism (scripts/stamp-firing-block.cjs) |
| SP2 | Does a bridged write land and what does the model see on a lost response or a mid-write kill | probe writes a file and one SQLite row and returns the hash; seams: read-only dir, 30 s sleep after write, kill between file and row; quit Desktop during the sleep | A: write lands, model sees no result: client_write_id retry as designed | B: write does not land: receipt stays, add a pending-write journal row before the file (DC-M6 fix a) |
| SP3 | Which env marks a cloud Code session; what disk does a synced server see | one cloud Code session with the plugin synced; log env and homedir from the server | A: a stable marker: set `cloud_session` from it; birth refused on it | B: no marker: no `cloud_session`; first-room birth on P3 stays a named risk (R2) |
| SP4 (FP) | One config server process per conversation or per app | two merged chats; compare the fingerprint `parent` and pid | A: per app: build 3.9 room argument rule | B: per conversation: drop 3.9 |
| SP5 (FP for the env values) | Code tab: CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, hooks.json firing, MCP Apps rendering, Desktop install path, Windows config path | in a local Code tab: echo the two variables; read the server start line (mindrian-mcp-server.cjs:658); check session-start context; list plugin cache folders; locate claude_desktop_config.json on the A1 machine | A: entrypoint non-empty and not `cli`: apply the 3.1 rule | B: `cli` or empty: no 3.1 change; launcher collision check uses CLAUDE_CODE_SESSION_ID instead |
| SP6 | Does the merged chat render a bridged `ui://` app, can an app-originated call carry `_meta` the model cannot set, can the model read the app resource body; does it declare elicitation (FP; expected none, S: coral#2734) | probe app card with a server nonce: ask the model to quote the resource; click in the app; compare the returned tag; read fingerprint `client_capabilities` | A: all three app points hold: app gate card with browser_nonce replaces the 3.5 refusal (B3.2) | B: any point fails: the 3.5 refusal stays; typed choices count for ordinary cards only (OR-4); the card proof is redesigned |
| SP7 (required, OR-6) | Is a `.mcpb` extension reached through the bridge (prefix, parent), which Node runs it, can one manifest hold two servers, what size and file limits apply, how is it installed, does the local Code tab load it, does it survive a Desktop quit | pack the spike 012 probe as `.mcpb` with a node_modules payload; install on Windows and macOS; repeat the SP1 legs; read the fingerprint | A: reached, Node >=22.18.0: 3.7a as written; cut 3.7b | B: not reached, or Node too old: build 3.7b as the chat route; keep 3.7a only if the system-Node manifest variant passes |
| SP8 (r2.2) | Does a plugin `.mcp.json` remote (http) server load in the merged chat, web and mobile as a remote connector, and in a cloud Code session; do the theo-context cards (generative UI) render in the merged chat and in the local Code tab | add the theo-context http entry to the probe plugin; install through Customize; ask a method question in the merged chat, the Code tab (local) and the phone; record the tool prefix and a screenshot | A: loads and renders: the plugin route is the default; the connect line is for people without the plugin | B: does not load in chat: the claude.ai custom connector step is the chat route; the plugin entry stays for the CLI and the Code tab |

## 7. Slices (build order)

Common gates for every slice that touches code (Gates row): `bash tests/run-all-405.sh`; `node scripts/build-connector-registry.cjs --check`; `node scripts/check-shape-declaration.cjs`; `node scripts/build-orchestration-projection.cjs --check`; `node scripts/check-render-coverage.cjs`; `node scripts/build-harness-manifest.cjs --check`; `node scripts/doctor.cjs --acceptance`; `node lib/mcp/no-instructions.test.cjs`; `node tests/test-359-prose-budget.cjs`; 367 tests `tests/test-367-governed-census.cjs` and `tests/test-367-catchup-mcp.cjs` (groups ac2, ac8mcp) unchanged and green (PA-1 condition 4).

| # | Slice | Depends on | Acceptance criteria | Extra gates |
|---|---|---|---|---|
| 0 | Spikes | none | each SP has raw output, a verdict, and its If A/If B line applied to this design. LIVE | none |
| 1 | Capability facts and fingerprint (3.1) | none for the fingerprint; SP3, SP5 for the rule | AC1.0 `status_read.fingerprint` has every listed key on a stdio fixture and contains no path under the test rooms home and no room text. AC1.1 env-fixture table test (IR-N2 table in the plan) maps the SP5 Code-tab value to `cli` with `apps: true`. AC1.2 `status_read` shows `host` and, when proven, `cloud_session`. | tool configs unchanged: wire snapshots tests/fixtures/267/wire-snapshot-zod3.json and zod4.json byte-identical |
| 2 | Positive-evidence write rule (3.2) | 367 on main | AC2.1 for each of the 13 resolveMcpWriteRoom callers, plus room_bind and room_create: a target outside the registry (cwd with `.room-root`, default `./room`, session-less reg.active, an unregistered pin) is refused `no_local_room_here` and no file or room.db is created under the test HOME. AC2.2 a registered room still writes on every source. AC2.3 with `cloud_session` true, room_create refuses birth. AC2.4 order: write_path_disabled before no_local_room_here. | 367 census unchanged |
| 3 | Receipts (3.3) | 2 | AC3.1 each of the six tools returns `receipt.read_back: true`, sha256 of the final file (fixture with frontmatter), rows found, change range. AC3.2 a test-only seam (refused unless `NODE_ENV=test`) alters the file after write: `read_back_mismatch`, file kept. AC3.3 the same `client_write_id` twice: one file, one node, second result `replayed: true`. AC3.4 the six descriptions carry the 173-byte clause; `room_list` carries the 131-byte clause. AC3.5 fileEvidenceWithReadback callers pass unchanged. | wire snapshots regenerated: expected diff = one optional `client_write_id` in six schemas and two description clauses, nothing else |
| 4 | Gate human check, app card candidate and PA-2 leg (3.5) | 3; SP6 for the app card | AC4.1 with no session id and a non-Claude-Code client, a text-rung approve on room_create or a claim card is refused `human_confirmation_required`; other cards pass with `answered_via: mcp_relayed`. AC4.2 a CLI fixture passes as today. AC4.2b (only if SP6 = A) an app-originated answer with the server nonce records `browser_nonce`; a relayed answer with a copied tag from tool arguments records `mcp_relayed`. AC4.3 the 367 census gains a separate `desktop_bridge` fixture leg; GOVERNED 69 and PURE_READ 7 move only by the count the plan states, with the reason (PA-2). | 367 arms unchanged |
| 5a | `.mcpb` extension (3.7a) | 1, SP7 | AC5a.1 `tools/mcpb` builds `mindrian-os.mcpb` from a fixture pack; `manifest.json` validates against the mcpb schema (the CLI's validate command) and carries the release version, `server.type`, `entry_point`, `compatibility.runtimes.node >=22.18.0` and the env entry. AC5a.2 the payload check (the build-desktop-artifact.cjs checkPayload rules: files, bytes, ratio, no `bin/`, no runtime bin reference) passes on the unpacked extension. AC5a.3 the unpacked extension starts the server with `node` and answers initialize and tools/list with no network and no install step. AC5a.4 with `CLAUDE_CODE_ENTRYPOINT` set it serves one status tool only. AC5a.5 doctor states `extension_missing`, `extension_version_drift`, `config_present_never_loaded`, `server_start_timeout`, each from a fixture; the heartbeat rule of 3.7a. LIVE Windows and macOS: install by click, restart, a merged chat lists the room tools, the doctor shows `desktop_loaded: true`. | `tools/mcpb` lockfile walled (tests/test-341-shrinkwrap-no-dev.cjs green); doctor doc parity |
| 5b | Config fallback (3.7b) and shim changes (3.6) | 5a, SP7 = B for the config half | AC5b.1 config merge fixtures per OS: backup, other servers untouched, read-back equal, distinct entry names. AC5b.2 launcher fixtures: resolves from a moved version dir and from `mos-desktop`; serves the status tool when CLAUDE_CODE_ENTRYPOINT is set. AC5b.3 shim with no session id: lexicon union of registered rooms, `lexicon_scope: all_registered_rooms`, budget measured on a 50-room fixture, over budget falls back with disclosure. AC5b.4 shim sanitizes a fixture response with a planted room term. AC5b.5 WSL refusal. The shim ACs (5b.3, 5b.4) are built in every case; the config ACs only if SP7 = B. | data/deployment-surfaces.json check; launcher files do not match RUNTIME_BIN_PATTERNS (build-desktop-artifact.cjs:66-80) |
| 6 | Shared-binding rule (3.9) | SP4 = A | AC6.1 on a `MINDRIAN_MCP_FIRST=desktop` stdio fixture, a write without `room` or with another slug is refused `room_mismatch`. AC6.2 room_bind states the shared scope. Dropped if SP4 = B. | wire snapshots: optional `room` parameter on the governed writers |
| 7 | Context in room_bind (3.4) and docs | 3 | AC7.0 the THEO line change of 3.6: served length 1996 bytes (measured), `node lib/mcp/no-instructions.test.cjs` and `node tests/test-359-prose-budget.cjs` green, harness manifest regenerated and `--check` green. AC7.1 room_bind result carries the context summary, and exactly one 367 spawn happens for the bind. AC7.2 docs/CLAUDE-SURFACE-MODEL.md matrix updated from 405-RESEARCH section 7. AC7.3 405-WEBSITE-HANDOFF.md updated: install sentence, the Code tab as the full place, the chat bridge step. | instructions 1996 bytes; BOUNDARIES byte-identical |
| 8 | Parity and live proof | 1-7 | AC8.1 one fixture room runs through a CLI fixture and a bridge fixture; the test prints each capability state of the matrix. LIVE Windows and macOS: bind, file one artifact, receipt shown on failure only, doctor shows the node; one cloud Code session refuses. | none |
| 9 | Release | 1-8 | AC9.1 `node scripts/release-lib/build-desktop-artifact.cjs --check` passes with the new files. AC9.2 CHANGELOG entry. AC9.3 `scripts/verify-release` clear. AC9.4 `node scripts/real-room-run.cjs --desktop-verified win` (and mac when run) receipt. AC9.6 release.sh builds `mindrian-os.mcpb` at the Desktop-copy step, checks its manifest version against plugin.json, attaches it to the release, and rolls back with the shared rollback on abort; RULE 5 lists the extension as a lockstep place; `scripts/verify-release` refuses a version mismatch. AC9.5 the cut runs through `scripts/release.sh <version>` in a beta first (RULE 6). | release gates of docs/RELEASE-CEREMONY-RULING-SYSTEM.md |
| 10 (r2.2) | Theo cards default (3.10) | 7 (instructions), SP8; O7 for the URL | AC10.1 the THEO line and the LOOP trim are the exact strings of 3.10; served length 1992 bytes (or the measured value at plan time, at most 2000); BOUNDARIES byte-identical; `node lib/mcp/no-instructions.test.cjs`, `node tests/test-359-prose-budget.cjs`, harness manifest regenerated and `--check` green. AC10.2 `.mcp.json` has the theo-context http entry with no header and no secret, and the built `mos-desktop` copy carries it (builder fixture). AC10.3 the Part 8 egress and sanitize hook matchers match `mcp__theo-context__x`, `mcp__plugin_mos_theo-context__x` and `mcp__plugin_mos-desktop_theo-context__x`, and still match every name they matched before (fixture list). AC10.4 the doctor probe sends one `initialize` and nothing else to a local fixture HTTP server (the fixture asserts the request bodies); states `yes`, `no (timeout)`, `no (http_<code>)`, `no (dns)`; `configured` reads plugin, user or none from fixture files. AC10.5 the room_list description carries the 173-byte connect line; the route_back text carries the 70-byte cards sentence. AC10.6 `status_read.theo_cards.configured_in_plugin` is true on the repo tree. LIVE (Windows and macOS Desktop): in the merged chat and in a local Code-tab session, a method question shows a Theo framework card; on the phone or the web with no linked computer, a room request gets the no-room refusal and a method question still shows a card. | wire snapshots: two description or text changes only (room_list description); hook matcher change reviewed against Part 8 (Canon) |

## 8. File table

| Slice | Create | Modify |
|---|---|---|
| 0 | 405-SPIKES.md; probe changes on work/367-spike-kits (coordinate with jsagi-42) | none |
| 1 | tests/test-405-capability-facts.cjs, tests/fixtures/405/env.json, tests/run-all-405.sh | lib/mcp/surface-detect.cjs, lib/mcp/tools/status.cjs |
| 2 | tests/test-405-registered-room.cjs | lib/mcp/session-room.cjs (post-367), lib/mcp/tool-router.cjs (room_bind), lib/mcp/startup-operations.cjs |
| 3 | tests/test-405-receipt.cjs | lib/core/navigation/file-evidence-readback.cjs (extract), lib/core/navigation.cjs (export readBackRows and the id lookup), lib/mcp/tools/views.cjs, lib/mcp/tools/claim.cjs, lib/mcp/tools/graph.cjs, lib/mcp/tools/gate.cjs, lib/mcp/startup-operations.cjs, lib/mcp/tools/room.cjs (description), tests/fixtures/267/wire-snapshot-zod3.json, wire-snapshot-zod4.json |
| 4 | tests/test-405-gate-human-check.cjs; the app card view (only if SP6 = A) under the mindrian-mcp-app house rules | lib/mcp/tools/gate.cjs, lib/mcp/answer-route.cjs (server-held nonce path, only if SP6 = A), lib/mcp/app-views.cjs, tests/test-367-governed-census.cjs (new leg only, PA-2) |
| 5a | tools/mcpb/package.json, tools/mcpb/package-lock.json, tools/mcpb/manifest.template.json, scripts/release-lib/build-mcpb.cjs, lib/core/doctor/desktop-bridge-module.cjs, tests/test-405-mcpb.cjs | scripts/mindrian-mcp-server.cjs (heartbeat, collision check), data/doctor-modules.json, commands/doctor.md, commands/setup.md and skills/setup/SKILL.md (point to the extension) |
| 5b | lib/core/desktop-config.cjs, scripts/mos-bridge-dispatch, scripts/mos-brain-bridge-dispatch, tests/test-405-desktop-config.cjs, tests/test-405-shim-lexicon.cjs (config files only if SP7 = B) | commands/setup.md, skills/setup/SKILL.md, lib/core/active-plugin-root.cjs, data/deployment-surfaces.json, scripts/mindrian-brain-mcp-client.cjs (calls lib/core/brain-response-sanitize.cjs) |
| 6 | tests/test-405-shared-binding.cjs | lib/mcp/session-room.cjs, lib/mcp/tool-router.cjs, the governed writer tool files |
| 7 | none | lib/mcp/runtime-instructions.cjs (THEO line), data/harness-manifest (regenerated by scripts/build-harness-manifest.cjs), lib/mcp/tool-router.cjs (room_bind), docs/CLAUDE-SURFACE-MODEL.md, 405-WEBSITE-HANDOFF.md |
| 8 | tests/test-405-parity.cjs | none |
| 10 | tests/test-405-theo-cards.cjs, tests/fixtures/405/theo-probe-server.cjs | .mcp.json, hooks/hooks.json (two matchers), lib/mcp/runtime-instructions.cjs, lib/mcp/tools/room.cjs (description), lib/mcp/session-room.cjs (route_back text), lib/mcp/tools/status.cjs, lib/core/doctor/desktop-bridge-module.cjs, commands/setup.md, skills/setup/SKILL.md, data/harness-manifest (regenerated) |
| 9 | none | CHANGELOG.md, scripts/release.sh (mcpb step, rollback), scripts/verify-release, docs/RELEASE-CEREMONY-RULING-SYSTEM.md (RULE 5 place) |

Part 11: no new tool name; the new `/mos:setup desktop` subcommand keeps setup's declared HITL shape (shown change, yes, backup, read-back).

## 9. Interaction with other phases

- 367 (jsagi-42): build after 367-11 and 367-12 reach origin/main (PA-1). 405 does not use the postCall list in r2 (PA-1 not exercised). PA-2 leg in slice 4. 405 cites post-367 session-room.cjs lines at plan time.
- 402: SP3 env legs only; alwaysLoad timing is 402's.
- 401: no dependency in r2 (the skills line is cut).
- 404: the skill bridge for chat (B1.2). 405 does not pull it forward; the owner may (O6).
- Theo repo: B2.3 hand-off (closed shapes on every chat-reachable room-adjacent tool). B2.2 is dropped (OR-7).
- 400.3: slice 3 adds the receipt after the 400.3 index (views.cjs:592-597) and does not change it.
- SEED-039: slice 6 is its bridge face.

## 10. Risks

- R1 The bridge is observed on one Windows machine; slice 8 adds macOS.
- R2 With no SP3 marker, a first-room birth can still happen in a cloud VM when no registry exists there.
- R3 Existing configs with a `MINDRIAN_ROOM` pin outside the registry stop writing (OR-5; the refusal carries the /mos:rooms adopt fix line).
- R4 theo-context and claude.ai Theo connectors stay outside MindrianOS code control; Part 8 there holds by instruction text and Theo's tool text (OR-7 accepted trade).
- R5 Until the app card exists, a typed approval of an ordinary card on P4 is not human-attested (OR-4 allows it, recorded `mcp_relayed`).
- R6 The lexicon union can be slow on a large rooms home (AC5b.3).
- R12 The `.mcpb` adds a third artifact to the release lockstep; a drift between the extension and the plugin copies would serve old code in chat (AC9.6 and the doctor version check).
- R14 (r2.2) Tool overlap: a person with the plugin entry, a user-scope theo-context and the claude.ai Theo connector sees three copies of the same tools; the model may pick any. All three are Theo routes in the Part 8 lists (3.10 facts). Phase 402 deferral reduces the context cost.
- R15 (r2.2) theo-context is a remote service on Render; an outage removes the cards everywhere. The doctor line shows it; Larry says so and does not invent a card (THEO line).
- R13 The Node that ships with Desktop may be older than 22.18.0 (SP7); then node:sqlite's `timeout` is ignored and room.db write safety is lost, so the manifest must not run on it.
- R7 Description clauses add 173 bytes to six tools and 131 to one; the per-tool description cap test, if Phase 401 adds one, must allow it (UNVERIFIED which test will own the cap).
- R8 An injected call can write into a registered room; receipts disclose, they do not prevent.
- R9 The launcher depends on where Desktop installs the plugin (SP5).
- R10 The app gate card (B3.2) adds a second nonce-minting path; if the model can read the app resource, the proof is void. SP6 leg (c) must pass before AC4.2b is built.
- R11 Several facts in 3.1, 3.5 and section 5 rest on secondary sources (marked S); each is confirmed by the fingerprint or a spike before a slice depends on it.
