---
phase: 405
title: "MindrianOS first-class on the Desktop merged chat and the Desktop Code tab, beside the CLI"
status: DESIGN r5 (after Goldfish round 4 and the 401-405 program review; applies OR-11 to OR-22; r4.1 kept as 405-DESIGN-r4.1.md; earlier versions -r4, -r3, -r2, -r1; resolutions in 405-GOLDFISH-REPORT-R1.md to -R4.md). r5.1 is reserved for 405-GENUI-RESEARCH.md (OR-19), not yet written when r5 was written.
date: 2026-11-27
canon_parts: [3, 7, 8, 9, 11, 12]
base: branch work/405-desktop at fb7c0dfd8, 7 commits behind origin/main on 2026-11-27. Rebase onto origin/main before slice 0 is planned. Build starts only after 367-11 and 367-12 (not 13 or 14) reach origin/main (PA-1 condition 1; program C23).
inputs: 405-CONTEXT.md (OR-1 to OR-22 LOCKED; PA-1, PA-2), 405-RESEARCH.md, 405-HATS.md, 405-BRIDGES.md, 401-405-PROGRAM.md (sections 2c, 2d, 3), Goldfish reports R1 to R4, docs/CLAUDE-SURFACE-MODEL.md, .claude/skills/mindrian-mcp-app/SKILL.md
read-with: a section or row marked "as r4.1" carries the text of 405-DESIGN-r4.1.md, which is part of this design; the planner reads both.
rules: GUESS marks a guess. S marks a secondary source. Ids in brackets point to the Goldfish reports (R4B#, R4M# for round 4) and to the program review (C#).
---

# 405 DESIGN r5

## 1. Goals

OR-2: first-class in the CLI, the Desktop Code tab and the Desktop merged chat. "First-class" means:
1. Where the room is reachable, every room capability that can run there runs there. The chat needs two installs a person can finish without editing JSON: the Customize plugin (skills, theo-context) and the `.mcpb` extension (the room server).
2. The named room writers (3.3) return a receipt read back from disk, or a typed failure, and a retry after a lost response never writes twice.
3. Where the room is not reachable, nothing is written, and the reply gives a typed reason, one step back to a place with the room, and full Theo method cards.
4. In the chat, decisions, method steps and next moves appear as small cards that a newcomer understands without the chat above them (3.12, OR-13, OR-17, OR-18).

Goals:
- G1 Correct capability facts for the local Code tab, plus a read-only surface fingerprint (3.1).
- G2 Registered rooms only, everywhere (OR-11): every room write, bind or birth on every place and every room source lands only in a room this computer's registry knows; a doctor step finds unregistered rooms and offers to register them (3.2, 3.2a, 3.2b).
- G3 Receipts with read-back on six writers; one idempotency rule per writer (3.3).
- G4 Part 8 in chat: theo-context is the chat method route (OR-7, OR-8, OR-13); no room content to any Theo server (3.6).
- G5 One-click chat install: a `.mcpb` extension, a checked release artifact (OR-6, OR-12) (3.7).
- G6 A human click proof for every material approval on a hookless place (OR-4) (3.5).
- G7 Theo framework cards as the default method experience in the chat and the Code tab, and where there is no room (3.10).
- G8 Ordered schema floor (OR-10) (3.11).
- G9 Three chat components built once as MCP Apps on the one MindrianOS server: the MCP App renderer of the existing Shape F contract (OR-21), each led by its job statement (OR-20) and passing the Feynman card rule (OR-13, OR-18), host-neutral (OR-22) (3.12).

## 2. Non-goals

- A remote room server (Part 9).
- Any change to the 367 runner, its trigger or its tests. PA-1's postCall list is not used.
- A presence row, `next_move` in receipts, a new memory_event type.
- A 6-value place enum, a statusline detector change.
- A guard line in skills. The fence is the server rule (3.2). Reopened only by SP1.
- Helper agents in the chat (OR-13). The chat runs one step per card in the main thread (program C9).
- A CopilotKit dependency in the plugin (OR-18). ~/dev/theo-context-copilotkit is a style reference only.
- `alwaysLoad` and deferral changes (Phase 402); 405 supplies the deferral leg SP9 (OR-16).
- A Cowork test (OR-16: L-CW1 dropped; the owner account has the merged chat).
- Signed egress B2.2 (OR-7). Signing the extension (3.7a: unsigned in 405).
- Website edits (OR-3).
- A ChatGPT product (OR-22). The package stays host-neutral (3.12.1) so the owner can try it; SP10 records what loads.

## 3. The design

### 3.0 Places

| Place | Who spawns the room server | Hooks | Room |
|---|---|---|---|
| P1 CLI | Claude Code | yes | yes |
| P2 local Code tab | Claude Code inside Desktop | yes | yes |
| P3 cloud Code session, Projects cloud thread, cloud scheduled task | Claude Code in an Anthropic VM, only for a synced plugin | yes, in the VM | no |
| P4 merged chat with bridge (also web or mobile with a linked computer) | the Desktop app (the `.mcpb` extension; fallback a config server) | no | yes, while Desktop is open |
| P5 any chat with no bridge | nobody | no | no |

P2 uses the 367 CLI hook path on main (scripts/on-stop:56, scripts/session-start:135). "Desktop and Cowork (MCP only, no hooks)" (367-CONTEXT:35) is wrong for P2; recorded in 405-RESEARCH section 0 only.

"Hookless place" [R4M5, CD4-M1]: a server process with the launcher marker `MINDRIAN_LAUNCHER=mcpb` (or `bridge` for the fallback). Every enforcement in this design keys on the marker only. The second signal (no `CLAUDE_CODE_SESSION_ID` and a non-Claude-Code client name from `readClientIdentity`) is for reporting in the fingerprint only, because the wire-test helper tests/helpers/mcp-wire-267.cjs deletes the session id (:64) and sends clientInfo `mcp-wire-267` (:191), and an in-process test has no server object (surface-detect.cjs:250). The marker is read per call from `process.env` (no process cache), so the HTTP daemon is not affected.

### 3.1 Capability facts and fingerprint (G1)

Unchanged from r4.1: no production reader of `capabilities.hooks` (navigation-engine.cjs:1598); the live consumer of the capability map is lib/mcp/capability-registry.cjs:50-56 (`apps`). After SP5: if the local Code tab sets a non-empty `CLAUDE_CODE_ENTRYPOINT` other than `cli`, rule 4 of surface-detect.cjs:65-69 treats it as Claude Code with `apps: true`. `cloud_session` only from a marker SP3 proves. Fingerprint fields `{surface, transport, host, protocol_version, client_capabilities, parent: {ppid, exe}, platform, node_version, sqlite_timeout_ok, session_id_present, plugin_root_present, launcher, cloud_session?, host_hash}`; parent probe once at start per OS (Linux `/proc/<ppid>/comm`; macOS `ps -o comm= -p <ppid>`, 500 ms; Windows PowerShell `Get-CimInstance Win32_Process`, 1500 ms; else `unknown`); host salt `~/.mindrian/desktop/host-salt` (0600). On P4 the result reaches the cloud model, so it holds only hashes, names and versions.

### 3.2 Registered rooms only, everywhere (G2, OR-11) [R4B1, CD4-B1]

Helper `isRegisteredLocalRoom(dir)` in lib/mcp/session-room.cjs: true when realpath(dir) equals the realpath of one of `listRegisteredRoomPaths(home)` (new export in lib/core/resolve-active-room.cjs; it maps every slug of the private `readRegistry` (:83-92) through the exported `registryRoomPath` (:123-160)). Archived and parked rooms count. No room.db term (readiness owns a missing room.db, HEAL-02, session-room.cjs:347-386).

Where it runs [CD4-B1]: a new wrapper `authorizeMcpWriteRoom(opts)` in lib/mcp/session-room.cjs. It calls `resolveMcpWriteRoom(opts)` unchanged, then applies, in order: (1) the registry check, (2) the schema floor of 3.11. The 12 write call sites and room_bind call the wrapper instead of `resolveMcpWriteRoom`: chain.cjs:983, claim-verify.cjs:102, claim.cjs:132, gate.cjs:1172 and :1747, graph.cjs:237 and :279, question.cjs:138, research.cjs:120, startup.cjs:28, views.cjs:564, tool-router.cjs:115, and room_bind (tool-router.cjs:2272) [CD4-M1]. `resolveMcpWriteRoom`, `classifyMcpWriteRoom`, the 367 spawn rule and the 367 census (rows C4 and C5 call `resolveMcpWriteRoom` directly, tests/test-367-governed-census.cjs:112-139) stay unchanged.

Scope (OR-11): every source (`session.primary`, `room-root`, `reg.active`, `boot-fallback` including the default `<cwd>/room`, `cwd`, operator pins at session-room.cjs:231) on every place. A refusal: `{ok: false, dir, slug, source, refusal: {ok: false, reason: 'no_local_room_here', message, route_back}}`.

Room birth, one rule [R4M7] (room_create, startup-operations.cjs:44-86; `destination()` already keeps the path under the rooms home, :18-28):

| Condition | Result |
|---|---|
| `cloud_session` true | refused `no_local_room_here` |
| P1, P2 (no marker) | allowed after the existing F.0 approval; the birth writes the registry entry (navigation.birthRoom), so the new room is registered |
| P4 (marker), before slice 4b | refused `human_confirmation_required`, message "Creating a room needs a click on the room card. Until that card ships, create the room in the Code tab or Claude Code." |
| P4 (marker), after slice 4b | allowed only with `answered_via: app_nonce` from the Shape F card (3.5, 3.12) |

A missing registry does not block a birth; the birth creates it.

Texts (one place, session-room.cjs) [R4M8]:
- Folder with room.db and `.room-root`, not registered (`message`): "This room is not in your room list yet. Register it with /mos:rooms adopt <path>, then retry."
- Folder without room.db (`message`): "This folder is not a room yet. Create a room with /mos:rooms new, or point to an existing room."
- `route_back` (no registered room reachable here): "This place has no MindrianOS room. Open the Code tab in Claude Desktop on the computer that holds your rooms (Local), or use Claude Code there. Framework cards from Theo still work here: ask Larry about any method."
- On a hookless place both texts add: "Adopting or creating a room needs the Code tab or Claude Code."

### 3.2a `room-registry register` and `/mos:rooms adopt` (OR-5, OR-11)

New subcommand `scripts/room-registry register <slug> <absolute path>`: writes only the central registry entry (same shape and absolute-path handling as `create`, :459-478), status `active-registered` is not used; the entry gets the registry's normal `status: "parked"` value so the active room does not change (GUESS on the status name: the planner reads the registry schema at :502-511 and uses the existing non-active value) [CD4-N10]. No scaffold, no activation. The leak guard `_registry_leak_guard` (:235-274, :458) runs first; it refuses temp roots, so fixtures set `MINDRIAN_ALLOW_TMP_ROOM=1` [CD4-N10].
- Slug: folder basename, lowercased, runs outside `[a-z0-9-]` become `-`, trimmed, at most 64 characters; `--slug` overrides.
- Typed refusals (exit 3, nothing written): `path_not_absolute`; `not_a_room` (no `.mindrian/room.db`; message: the "not a room yet" text of 3.2); `no_room_root`; `already_registered`; `slug_taken`. `hookless_place` is not an adopt refusal: adopt runs in a shell; the hookless text lives in the server refusal of 3.2 [R4M8].
- `/mos:rooms adopt <path>`: shows slug, path and "registered in place, nothing moved", one yes (F.1 declared), then calls `register`. Born wired.

### 3.2b Unregistered-room finder (OR-11)

OR-11 makes existing unregistered CLI rooms refuse writes. The fix path:
- Doctor module `lib/core/doctor/unregistered-rooms-module.cjs`. check(): lists candidate rooms that are not in the central registry: (a) the cwd room (`.room-root` walk-up), (b) rooms in workspace registries `<path>/.rooms/registry.json` reachable from the session binding files under `<rooms home>/.rooms/sessions/`, (c) folders with `.room-root` and `.mindrian/room.db` directly under the rooms home, (d) the `MINDRIAN_ROOM` pin. Each row: path, why found, suggested slug. fix(): an F.8 basket (choose several) of `register` calls; nothing runs without the person's choice.
- SessionStart notice (CLI and Code tab): when the cwd room is unregistered, one line in the session-start context: "This room is not registered, so MindrianOS will not save here. Run /mos:rooms adopt <path>." (inside the coordinator's 2000-char budget, sessionstart-coordinator.cjs).
- `/mos:doctor` lists the count; `/mos:rooms adopt` handles one.

Fixture migration grows (OR-11) [R4M6, CD4-M6]:
- Slice 2a adds the rule behind a temporary switch `MINDRIAN_REGISTRY_RULE=enforce` (default off), and a discovery runner `scripts/dev/405-find-unregistered-writers.cjs` that runs every test file named by `grep -l -E 'MINDRIAN_ROOM|fallbackRoomDir|room-root|room_bind'` under tests/ with the switch on, and prints each failing file. The six shared helpers are migrated first (mcp-wire-267, harness-383, b1-358-child, b2-358-child, one-week-365-child, eureka-installed-layout-387). The shared helper is `birthFixtureRoom`, extracted from tests/helpers/isolated-home-36925.cjs:73-98 into tests/helpers/registered-room.cjs.
- Slice 2 removes the switch: the rule is always on. No test-mode bypass remains.
- One suite list (3.2 and section 9 agree): bash tests/run-all-267.sh, run-all-358.sh, run-all-365.sh, run-all-369.1.sh, run-all-383.sh, run-all-387.sh; every tests/test-400-3-*.cjs (14 files); tests/test-367-*.cjs; tests/test-desktop-stdio-session-binding.cjs; tests/test-room-state-no-registry-regression.cjs.
- Other phases (program C18): a new test that writes must use tests/helpers/registered-room.cjs; the slice 2a scan test fails a writing test that does not.

### 3.3 Receipts and idempotency (G3)

Unchanged from r4.1 (receipt shape, `readBackRows`, `change_observed`, the per-writer key table, `write_keys` for artifact_file only with owner_pid, owner_host_hash, artifact_id, the canonical payload hash, the 120 s stale rule, the four-step sequence, the migration module `lib/core/migrations/405-write-keys-and-meta.cjs` in the `_schemaStamp` specs), with these r5 changes:
- Liveness check [CD4-N2]: `ownerProcessAlive` (resolve-active-room.cjs:220) is not exported; use `isAlive(pid)` of lib/core/session-presence.cjs:68 (exported, the same check).
- Failure in the same live process [CD4-M5]: every validation that can refuse (the checks at views.cjs:255-275, `assertRealpathContained`, the section and filename guards) runs before step 1. A typed failure in step 2 or 3 (for example `writeFileContained` throws, views.cjs:282-284) deletes the `pending` row in the same handler before it returns. So a retry in the same process proceeds.
- Receipt and the 400.3 status words [program C19]: top-level `ok` and `partial` keep their 400.3 meaning (the file landed; an index or claim leg failed). `receipt.read_back` is a boolean about the file and the rows only. On failure the receipt carries `reason` (`read_back_mismatch`). The read-back runs after COMMIT of step 3. A replay returns the stored receipt and the stored `graph_index` with `replayed: true` [IR4-N10].
- `client_write_id` sits on one schema (artifact_file) [CD4-N3].

### 3.4 Hook duties on P4

As r4.1: graph catch-up by the 367 wrapper; context summary in the room_bind result; per-turn memory row CUT; Stop close-out by stop_gate_check. Program C17: after Phase 400.5 the per-turn navigation block is one server tool; the next-move card (3.12 C3) shows what that tool returns once it exists, else suggest_next.

### 3.5 Human click proof for material approvals (G6, OR-4)

Kept from r4.1: attested = `browser_nonce` or `app_nonce`, or the existing elicitation equality; one predicate in two places, `isMaterialLive(live, gateId)` before gate.cjs:1724 (it needs the gate id: the Eureka opt-in is found by `EUREKA_OPTIN_GATE_PREFIX`, gate.cjs:1736) [CD4-N7] and `isMaterialSubject(live, subjectRow)` after the room.db open at gate.cjs:1795 and before `withRoomTx` [CD4-N6]; the OR-4 interim exception for ordinary approvals. Refusal text [IR4-N8]: `human_confirmation_required`, message "This choice changes your room, so it needs your click on the card. Nothing was saved; the card is still open."

r5 changes:
- Enforcement keys on the marker only (3.0) [R4M5].
- Minters (one AC4.1 row each) [CD4-N4, CD4-N5]: approval-gate.cjs:44 `mintApprovalGate` (called by research.cjs:229, :402, :436), never-do-gate.cjs:183, room-readiness-gate.cjs:103 and :140/:143, the recovery card (session-room.cjs:333-357), chain.cjs:589, tools/eureka-capability-jobs.cjs:321, startup-operations.cjs:55, tool-router.cjs:1882, sensors.cjs:737, canon-release.cjs:286.
- One render path [CD4-M4]: on a hookless place a material card is always shown by gate_render. gate_render is extended to show an already minted gate by id without a bound room (needed for first-room birth). Every minting tool above returns, on a hookless place, `next: "call gate_render with gate_id <id>"` and the gate id, not the card view. Only the gate_render result carries the nonce, in `_meta` under `mindrian/app_nonce`. gate_render already declares the decision view (gate.cjs:1415), so no other tool's registration or wire snapshot changes.
- `app_nonce` consumers [CD4-M3]: room-birth.cjs:1363 (store `app_nonce`, not `mcp_relayed`), answer-route.cjs:110-113 `confirmReason` (used at gate.cjs:257, :842, :903), cause-effect.cjs:33-37; plus ANSWERED_VIA_VALUES and room-projection.cjs.
- Store `lib/mcp/app-nonce-store.cjs`; request key: the app returns the nonce in `tools/call` `_meta` under `mindrian/app_nonce`; `extra` reaches the check because gate_answer reads `extra._meta` (as `routeOf` does today) [IR4-N9]. `appRouteOf(gateId, meta)` beside `routeOf` (unchanged). Order at gate.cjs:1630: `browser_nonce`, `app_nonce`, `mcp_relayed`.
- If SP6 = B (no app render, or the model can read result `_meta`): the refusal stays; slice 11 and any recipe halt in chat return to the owner (program C10, E8).

### 3.6 Part 8 and Theo in chat (G4)

As r4.1 (THEO line 150 bytes, served 1999 bytes; pins re-based; shim only in the fallback), plus:
- OR-13 and program C8: a recipe in the chat takes its steps from theo-context (`framework_steps`, `framework_walkthrough`) with generic handles only; the guarded mindrian-brain route stays for the CLI and the Code tab. The step tool home for 404 in the chat is the mindrian-os server (the framework player of 3.12), which shows Theo's steps and files through artifact_file; it does not call theo-mcp, so a one-click extension gets no route to the guarded Brain (program C7, decision 1 kept).
- Instructions budget [program C14]: 1 byte remains after slice 7. No other phase may add to the instructions; component rules live in tool descriptions and the view.

### 3.7 Chat install path (G5, OR-6, OR-12)

3.7a as r4.1 with these r5 changes:
- Output folder [program C15]: the build writes to `$HOME/.mindrian/release-out/<v>/mindrian-os-<v>.mcpb` and `mindrian-os.mcpb`, outside the repo. `dist/` stays a tracked generated tree; no `.gitignore` change.
- Pack tool [R4M3]: the official `@anthropic-ai/mcpb` CLI (S: modelcontextprotocol/mcpb README), version pinned on the day slice 0 is planned (`npm view @anthropic-ai/mcpb version`, recorded in 405-SPIKES.md), installed in `.planning/spikes/405-desktop/pack/` for slice 0 and in `tools/mcpb/` (own lockfile) for slice 5a. Manifest fields: `manifest_version` as the pinned CLI's `init` writes it; `user_config.rooms_home: {type: directory, title: "Rooms folder", default: "${HOME}/MindrianRooms"}` [IR4-N11]. Field names UNVERIFIED until the pinned CLI's `validate` runs in slice 0.
- Payload [CD4-N9]: `ajv` stays (build-ui-shell.cjs:89 lists it, but the server uses it too; the AC5a.3 scan decides); the shrinkwrap holds six sqlite-vec entries (darwin-arm64, darwin-x64, linux-arm64, linux-x64, windows-x64, plus the root); the extension bundles darwin-arm64, darwin-x64 and windows-x64; the degrade path is `cjs-fallback` (class-s-eureka-smoke.cjs:196).
- Numeric gates [R4M4]: set from the slice 0 offline measurement (6, task 0.1): gate = measured value plus 25 percent, capped at 4,500 files and 180 MB unpacked; the packed size is recorded, not gated, until SP7 finds the installer limit.
- Signing [IR4-M10]: unsigned in 405. R16 stands. No signing step, no certificate.
- Download host [IR4-M11]: the plugin repository is public (gh repo view, 2026-11-27, coordinator fact), so the release-asset tag URL of AC9.4 works for users; the r4.1 GUESS is closed.
- Dependency heal path: lib/core/mcp-dep-heal.cjs [CD4-N8].
- 3.7b (config fallback) unchanged: built only after an SP7 = B owner answer.

### 3.8 Bridge threat model

As r4.1, with: Path-choosing row: room_create on P4 follows the birth table of 3.2. Process-spawning row, one Eureka rule [program C4]: Eureka engine start and `/mos:eureka enable` need a local Claude Code session; on a marked process both refuse `local_session_required`; a chat-only user sees the reason and the Code-tab route. Install files row: unsigned extension (R16).

### 3.9 Per-conversation binding on a shared process

As r4.1, decided by SP4 (now run in slice 0 on the probe extension). If SP4 = A, the `room` argument rule applies on the wrapper's 13 callers; 404 recipe writes must carry `room` (program 2d item 4).

### 3.10 Theo framework cards (G7; OR-7, OR-8)

As r4.1, with: the mos-desktop copy's plugin.json name is `mos` (program C6), so its tool prefix is expected to be `mcp__plugin_mos_theo-context__`; AC10.2 keeps the `mos-desktop` row only as a harmless extra; SP8 records the real prefix. In the chat the observed prefix of a bridged local server is `mcp__remote-devices__<server>__<tool>` (field evidence; S-level until SP7); the egress hooks do not run in the chat anyway (R4). The literal `pws-brain-mcp` stays in all three matchers (program C5; owner ruling 2026-11-18). Slice 10 Part 8 review [IR4-N14]: the reviewer is the slice executor plus one egm-codebase-details pass; pass rule: every theo-context tool name in data/theo-tool-classes.json is class `content` or `refused`, none `operational` by bare name.

### 3.11 Ordered schema floor (G8, OR-10) [R4M9, CD4-M2]

- Table `mos_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)`, key `writer_version_max` (semver with prerelease order, `semver` package).
- MCP writers: the floor is checked in `authorizeMcpWriteRoom` (3.2) through the read-only door (`navigation.openRoomDbReadOnlyForCaller`), before any writer opens room.db. Refusal `room_schema_newer` with the update line. A successful authorize raises `writer_version_max` when this version is higher (one UPSERT through navigation.cjs).
- Hook and script writers: the floor is checked by a helper `assertWriteFloor(roomDir)` in lib/core/room-db.cjs, called at the named hook write sites: scripts/graph-catchup.cjs (367 runner), scripts/post-write, scripts/on-stop (STATE persist), scripts/gsd-graph-derive-drain.cjs, scripts/memory-artifact-graph-hook.cjs, scripts/gsd-artifact-graph-hook.cjs. A hook that meets the floor skips its write and logs one stderr line; it never fails. The other direct `openRoomDb` callers (about 155 sites in 77 files) are a named residual (R20), listed by the slice 3 plan from a grep.
- Migration chain [R4M9]: `openRoomDb` (room-db.cjs:311) reads `mos_meta.writer_version_max` before the chain (:371-381) when the table exists; if it is higher than this version, the open skips the chain and the stamp (no ping-pong of `user_version`). Opening is still allowed (reads work). The folder creation at :330 is unchanged.
- Error type: `RoomSchemaNewerError` with `code: 'room_schema_newer'`, thrown by `assertWriteFloor`, mapped to the typed refusal in the MCP layer.

### 3.12 Chat components (G9; OR-13, OR-17 to OR-22)

#### 3.12.1 Technology and host neutrality (OR-18, OR-22)

MCP Apps (SEP-1865, `ui://` resources, `_meta.ui.resourceUri`) on the one MindrianOS server, built once, in the repo pattern of .claude/skills/mindrian-mcp-app/SKILL.md (plain HTML in lib/mcp/app-html/, `loadTemplate`, two-function registration, CSP inside the resource `_meta`, bundled fonts, Larry identity header). The host list (Claude web and Desktop, ChatGPT, VS Code Copilot, CopilotKit through MCPAppsMiddleware) is S only; the Desktop chat render is checked by SP6. No CopilotKit dependency in the plugin.

Host-neutral rules (OR-22), checked by tests/test-405-card-text.cjs and a grep test:
- H1 A view calls only the ext-apps client API; a host-specific call (for example a Claude-only bridge call) is allowed only behind a feature check with a working fallback.
- H2 A card makes sense without any Claude plugin skill: every word the card needs is in the tool result or the view.
- H3 Every component has a plain-text fallback: the tool result `content[0].text` is a complete answer on its own (the repo's `textResponse` pattern), so a host without MCP Apps still gets a useful reply.

#### 3.12.2 One interaction contract: the Shape F family (OR-21; owner answer "the mindrian f-shapes can help": yes)

The contract module already exists. Each renderer in lib/hmi returns one object `{zones: {header, body, signals, footer}, contract: {shape, keyboard, verbs, mode, recommended, ...}}`: F.0 lib/hmi/shape-f0-renderer.cjs:38 (return :56; exactly 3 verbs Approve, Reject with reason, Defer), F.1 shape-f1-renderer.cjs:134 (return :187-205; open vocabulary next move, `standingOptions`), F.2 shape-f2-renderer.cjs:78 (return :111; path control), F.3 shape-f3-renderer.cjs:35 (return :45; closed depth list Shallow, Medium, Deep, Extreme, Back), F.4 shape-f4-renderer.cjs:41 (return :51; insight extraction: Key insights, +contradictions, +actions, Create artifact draft, Back), F.5 shape-f5-renderer.cjs:98 (return :133; branch resolution), F.8 shape-f8-renderer.cjs:69 (return :117; multi-select with `multiSelect`), F.9 shape-f9-renderer.cjs:107 (ordered cascade). The dispatcher picks the renderer by shape: lib/hmi/selector-dispatcher.cjs:771-893. Capture files exist for F.1, F.3, F.4, F.8, F.9 (lib/hmi/f1-pick-capture-cli.cjs and the others); parity tests exist for F.3 and F.4 (lib/hmi/shape-f3-parity.test.cjs, shape-f4-parity.test.cjs).

Declared shapes (coordinator count from disk, 2026-11-27): F.0 36, F.1 77, F.2 2, F.3 4, F.5 4, F.8 69, F.9 18 invocable surfaces.

One data contract, three renderers: (1) terminal text (`zones`), (2) the AskUserQuestion card (`contract.verbs`, `recommended`), (3) the MCP App view (new in 405). The chat components are not new card designs; they are the MCP App renderer of these objects.

What the declared `hitl_shape` gives the chat for free: which renderer to use, the closed vocabularies (F.0, F.3, F.4), the verb list and the recommended verb, select mode (F.8 multi, F.9 ordered), and the HITL reason (`hitl_why`). What is missing for the chat: (a) a step-progress model (step n of N, done and current) for the framework player; (b) a stable option id per verb for click answers (verbs are labels today, GUESS; the decision card uses option ids from gate-render.cjs); (c) a definition field for F3 of the Feynman rules. 405 adds these as optional contract fields: `contract.progress: {step, of, title}`, `contract.verb_ids`, `zones.defs: [{term, plain}]`. They are additive, so the terminal and AskUserQuestion renderers ignore them.

Ownership (OR-21): 405 owns the MCP App renderer of the contract and the three optional fields. Phase 404 owns recipes emitting shapes, and any CLI rendering change that follows from recipes (CLI changes are 404 scope; 405 does not redesign the CLI rendering). The hats and persona phases (399, 400, 400.2) own their own shape emitters, on the same contract.

Gate cards and the contract: gate_render builds its card in lib/mcp/gate-render.cjs (options with ids, ranks, previews) and decision.html reads `card.selectMode` and `card.options` (decision.html:101-127). Whether gate cards are built from the lib/hmi renderer objects is UNVERIFIED; slice 12 reads both and adds one adapter `shapeToAppCard(rendered)` in lib/mcp/shape-app-adapter.cjs if they differ, so the view reads one shape.

Parity AC (OR-21): tests/test-405-shape-parity.cjs renders one fixture object per shape (F.0, F.1, F.3, F.4, F.8, F.9) through the terminal renderer, the AskUserQuestion contract and the MCP App adapter, and asserts the same options in the same order, the same labels and the same recommended choice (the model of shape-f3-parity.test.cjs).

#### 3.12.3 The three components (OR-20 order: job, then Feynman, then research rules)

| | C1 Decision card | C2 Framework player | C3 Next-move card |
|---|---|---|---|
| Shapes | F.0, F.8, F.9 and the gate kinds | a step view; controls F.2 (path), F.3 (depth), F.5 (branch); end F.4 (insight extraction) | F.1 |
| Job statement (person's words) | "When my work reaches a real choice between options, I want to see the options with their descriptions, ranks and previews on one card, so I can choose with the trade-offs in view." (data/mcp-tool-job-sentences.json:233-238, gate_render, status provisional) | "When I have chosen a thinking method or a sequence of them, I want to get the step plan and halt at any step that would change my work, so I can approve each material step before it runs." (data/mcp-tool-job-sentences.json:215-220, framework_run, provisional) | "When I finish a piece of work and am not sure what comes next, I want to get one suggested next move for my room, so I can keep momentum without guessing." (data/mcp-tool-job-sentences.json:365-370, suggest_next, provisional) |
| The one question the card answers for a person who does not know the method | "What am I choosing between, and what happens if I pick each one?" | "What do I do in this step, and why does it matter?" | "What is the one useful thing to do now?" |
| Left out on purpose | the method name as a heading, scores and grades (Part 12), ranks shown as numbers, more than 3 options on F.1-style choices (MAX_K 3) | the full method, later steps' detail, Theo source metadata, other frameworks | the reasoning trail, the candidate list beyond 2 alternates, any room data the move does not need |
| Tool and view | gate_render, gate_answer, chain_run; `decision/v2.html` (extends decision.html, gate-app.cjs) | new render-only tool `framework_play`; `framework-player/v1.html` | suggest_next (sensors.cjs:466) gains `_meta`; `next-move/v1.html` |
| Foundation or end slice | foundation (slices 4b, 12) | foundation slice 13 plays one framework from theo-context steps; end slice 11 runs 404 recipes through it | foundation slice 14 |

C2 contract (`framework_play`): input `{framework, steps: [{n, title, prompt}] (copied from a theo-context result by the model), step, plain_line}`; renders `contract.progress`; no room write; filing is a separate artifact_file call with a receipt. Born wired, `hitl_shape: none` ("render-only; no write, no fork"). Census (PA-2): PURE_READ 7 becomes 8 ("framework_play is render-only"); test-270 tool count 76 becomes 77, measured. It is the chat step surface for 404 (program 2d item 1).

C3: a click sends the move text into the chat as the person's message (ext-apps message API, SP6f); no write.

Conflicts recorded (OR-20: job and Feynman win over research rules): none yet; r5.1 lists any conflict between a GENUI rule and the job or Feynman rules here.

#### 3.12.4 Feynman card rule (OR-13, OR-18)

Theo canon chapter "feynman" (canon_search of 2026-11-27, recorded in OR-13): SYNTHESIS "Simplicity isn't the coat of paint you put on an idea once the real work is done. Simplicity is a test"; CONCEPT names the failure mode, the Curse of Knowledge. Each rule is checked by lib/mcp/card-text-rules.cjs through tests/test-405-card-text.cjs over every template string and every fixture card of C1, C2 and C3:

| Rule | Testable form |
|---|---|
| F1 One idea per card | exactly one heading and one primary action element |
| F2 Plain words | no term from data/card-plain-words.json `banned` (for example ICM, DIKW, LazyGraph, epistemic, ontology, node, edge) in visible text |
| F3 A term is defined at first use | every word in `defined_terms` (for example Data Room, gate, framework) has a one-line plain definition (`zones.defs`) the first time it appears |
| F4 Stands alone | no text refers to the chat above it ("as above", "as I said", "earlier"); the heading names the decision, framework or move |
| F5 Short | a sentence at most 20 words; the card body at most 60 words; an option label at most 6 words |
| F6 Say it back | a "In one sentence:" line of at most 20 words (`plain_line`) |
| F7 No bare acronym | every all-capital token of 2 or more letters is in the glossary and expanded on the card |
| F8 House style | hyphens only, no em dash; De Stijl tokens; Larry identity header |

Theo's own step text in C2 is shown as Theo gave it, folded after 60 words ("Show the full step"); F1 to F8 apply to MindrianOS chrome and to `plain_line`. Authored Feynman steps in Theo are a Theo-side follow-up.

#### 3.12.5 GENUI rules (to fold in from 405-GENUI-RESEARCH.md, OR-19)

The file did not exist when r5 was written. r5.1 adds each rule with its source, marks every rule with only a secondary source UNVERIFIED until SP6, and records any conflict with 3.12.3 or 3.12.4 (OR-20).

| GENUI rule id | Rule | Applies to | Source | Status |
|---|---|---|---|---|
| G-1 to G-15 | placeholder | C1, C2, C3 | 405-GENUI-RESEARCH.md | to fold in (r5.1) |

### 3.13 Contracts to other phases (program 2d)

What 405 gives 404: (1) step surface in chat = `framework_play` on the mindrian-os server (3.12 C2); (2) the receipt shape of 3.3 with the 400.3 `ok` and `partial` rule; (3) `isMaterialLive`/`isMaterialSubject` with a `material_step` row for a recipe halt, and SP6 = B returns the chat recipe gate to the owner; (4) the `room` rule of 3.9 if SP4 = A; (5) typed refusals passed through unchanged: `no_local_room_here`, `human_confirmation_required`, `local_session_required`, `room_schema_newer`, `write_in_progress`; (6) `fingerprint.launcher` for the no-agent path; (7) the Theo route rule of 3.6.
What 405 needs from 402: the served instructions (1,999 bytes) and the six receipt writers, the three component tools and the instruction-named tools stay loaded up front (program C3); the marked extension's tool list is the same on every machine (C4); hook rows :208 and :332 stay in place.
What 405 needs from 400.5: the name and class of its new tool (census, count pin, hot set, extension payload); its hook targets the plugin server, never a marked process.

## 4. Answers to the three hats questions

1. On P4 the room server runs on the user's computer from the `.mcpb` extension (SP7 confirms). A write proves itself with the receipt of 3.3 and a retry rule per writer.
2. The governed tool call triggers the 367 detached runner (PA-1); SP7 checks the spawn from inside the extension.
3. A no-room place refuses every write, bind and birth outside the registry with a route back that ends with the Theo cards sentence; theo-context serves the method as cards.

## 5. Alternatives

As r4.1. Added row: I. CopilotKit React components in the plugin: REJECT (OR-18; they render only inside an app that embeds CopilotKit).

## 6. Spikes (slice 0, plannable now) [R4M1 to R4M4; OR-16]

Location: `.planning/spikes/405-desktop/` on work/405-desktop (after the rebase). The spike 012 probe is copied in, read-only, with `git show work/367-spike-kits:.planning/spikes/012-detached-runner-survival/<file>`; the copy is extended, not edited in place. Probe: `probe-server.cjs`, a stdio MCP server using the repo's pinned `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps` (installed in the spike folder by `npm ci` from a small lockfile), with tools `s1_where` (hostname hash, pid, ppid, parent exe, homedir hash, platform, clientInfo, declared capabilities, env key names, `require('node:sqlite')` with `timeout` test, `process.execPath`), `s1_hold` (20 s), `s1_write` (file plus one SQLite row, sha256; seams: read-only dir, 30 s sleep after write, exit between file and row), `s1_spawn` (the 367 detached-child test), `s1_card` (a `ui://` card with a nonce in result `_meta` and an app-originated `tools/call`), and 40 dummy tools for the deferral leg (half with a deferral `_meta` mark, GUESS on the mark name, taken from 400.1-RESEARCH.md:263).

Machines: the owner's Windows Desktop runs every LIVE leg now. macOS rule: Windows verdicts decide slice 0; every macOS leg stays "open until slice 5a LIVE"; no design line depends on a macOS-only result. LIVE legs are owner checkpoints: the spike executor returns NEEDS_HUMAN with exact click steps and waits. Estimate: about 2 to 3 hours of owner time in one session (OR-16), GUESS [IR4-N15, N16].

Tasks in order: 0.0 rebase; 0.1 offline payload measurement (no Desktop: stage the Step 6.8 copy from `npm pack`, `npm ci --omit=dev --ignore-scripts --no-bin-links`, remove next, react, react-dom, add the three sqlite-vec packages; print files, MB unpacked, MB packed with the pinned mcpb CLI); 0.2 pin the mcpb CLI and run `mcpb init`/`validate` on the probe; 0.3 SP7; 0.4 SP4 and SP5 (on the SP7 probe extension, then the Code tab); 0.5 SP6; 0.6 SP9 (deferral); 0.7 SP1; 0.8 SP2; 0.9 SP8; 0.10 SP3 (one cloud Code session); 0.11 SP10 (optional, owner).

| Id | Leg | If A | If B |
|---|---|---|---|
| SP7a | extension reached through the bridge (tool prefix, parent exe) | 3.7a as written | NEEDS_HUMAN: owner chooses extension with system Node, or config fallback (3.7b) |
| SP7b | runtime: node:sqlite with timeout, process.execPath, detached spawn survives | 3.7a as written | NEEDS_HUMAN (as SP7a) |
| SP7c | installer accepts @scope paths | as written | single-file JS bundle in tools/mcpb, sqlite-vec kept as files; re-test |
| SP7d | size: the 0.1 payload installs | gates set from 0.1 | NEEDS_HUMAN with the numbers |
| SP7e | two servers in one manifest | the shim may ride in the extension | shim only in 3.7b |
| SP7f | install channel (drag, double-click, Settings) | record only, no design change | record only |
| SP7g | local Code tab loads the extension | collision guard needed (as designed) | collision guard kept, harmless |
| SP7h | extension child survives a Desktop quit | record only (367 recovers on the next call) | record only |
| SP4 | one process per conversation or per app | per app: build 3.9 | per conversation: drop 3.9 |
| SP5a | Code tab CLAUDE_CODE_ENTRYPOINT and CLAUDE_CODE_SESSION_ID | non-empty, not `cli`: 3.1 rule | `cli` or empty: no 3.1 change |
| SP5b | hooks.json fires in the Code tab | as designed (P2 has hooks) | NEEDS_HUMAN: P2 row of 3.0 is wrong |
| SP5c | MCP Apps render in the Code tab | record only | record only |
| SP6a | bridged `ui://` card renders in the merged chat | slices 4b, 12 to 14 as designed | NEEDS_HUMAN: components and click proof need another route; slice 11 returns to the owner |
| SP6b | app-originated `tools/call` carries `_meta` | as designed | NEEDS_HUMAN (as SP6a) |
| SP6c | the model cannot read result `_meta` | as designed | NEEDS_HUMAN (as SP6a) |
| SP6d | instructions forwarded (canary) | no tool-text copy | AC7.4 copies the Part 8 sentence |
| SP6e | MCP prompts listed as slash commands | record only | record only |
| SP6f | ext-apps message API from a view into the chat | C3 click sends the move | C3 shows a copyable line instead |
| SP9 | deferral (OR-16): which tools the chat and the Code tab call without a search; does a deferral mark change it | record only for 405; feeds Phase 402 | record only |
| SP1a | Customize plugin server bridged | doctor note | no change |
| SP1b | plugin hooks fire in the merged chat | record only | record only |
| SP1c | skill bash sees CLAUDE_PLUGIN_ROOT in the sandbox | reopen the skills guard (stamp-firing-block mechanism) | no change |
| SP1d | Desktop quit mid-call | record only | record only |
| SP2a | write lands after a lost response | 3.3 as designed | slice 3 returns to EGM (journal design) |
| SP2b | exit between file and row | 3.3 resume as designed | slice 3 returns to EGM |
| SP2c | claim_write retry after a Desktop restart | record only (R18) | record only |
| SP8 | plugin remote server in chat, web, mobile; card renders; real prefix | plugin route is the default | connector step is the chat route |
| SP3 | cloud Code session marker and disk | `cloud_session` from it | R2 stays |
| SP10 (OR-22, owner-run, optional for the 405 verdict) | connect the server or the extension to the ChatGPT desktop chat by the route the GENUI research section 7 names; record which tools and views load | record only | record only. If ChatGPT reaches only remote servers, no remote room route is designed (Part 9, 3.8); owner item O11 for a later phase |

## 7. Slices (build order, OR-9, OR-14)

Order: OR-14 runs Phase 401 F1 right after the beta.95 cut, before the 405 build. 405 foundation = slices 0 to 10 and 12 to 14 (10 before 9; 12 to 14 before 9); then the overlapping parts of 401 and 402; then 404 with chat as a target; then end slice 11. Slices 4b, 5a, 5b, 6, 12 to 14 are built or dropped by spike verdicts; slice 9 releases what was built.

Common gates (every code slice): as r4.1 (run-all-405.sh, connector registry, shape declaration, orchestration projection, render coverage, harness manifest and runner, doctor acceptance, instructions tests, test-270, mirror check when a command source changes, 367 census and catchup groups unchanged).

| # | Slice | Depends on | Acceptance criteria (r5 changes; unchanged ACs as r4.1) | Extra gates |
|---|---|---|---|---|
| 0 | Spikes (6) | rebase | each task and leg: raw output in 405-SPIKES.md, verdict, If line applied as a dated r5.x note; 0.1 prints files, MB unpacked, MB packed | none |
| 1 | Capability facts and fingerprint | SP5 | AC1.0 to AC1.4 as r4.1; AC1.5 the reporting arm never changes enforcement (a wire-267 fixture is not hookless) | wire snapshots unchanged |
| 2a | Rule behind a switch and fixture migration | 367 on main | AC2a.1 the discovery runner lists failing files with the switch on; AC2a.2 after migration the runner lists none; AC2a.3 the suites of 3.2b are green with the switch on; AC2a.4 tests/test-405-fixture-helper-scan.cjs | none |
| 2 | Rule on everywhere, wrapper, adopt, finder | 2a | AC2.1 every source on a CLI fixture and a marked fixture, per caller (13): unregistered refused with the right text of 3.2; AC2.2 registered writes on every source; AC2.3 the birth table of 3.2, one row per condition; AC2.4 write_path_disabled first; AC2.5 census C4 and C5 unchanged (they call resolveMcpWriteRoom); AC2.6 register and adopt with the five typed refusals and `MINDRIAN_ALLOW_TMP_ROOM=1` fixtures; AC2.7 the finder lists (a) to (d) candidates from fixtures and its fix basket registers only the chosen rows; AC2.8 the SessionStart line for an unregistered cwd room, within the coordinator budget; AC2.9 the switch is gone | mirror check; shape declaration; doctor doc parity |
| 3 | Receipts and idempotency | 2 | as r4.1, plus AC3.10 a write that fails in step 2 in the same process removes `pending` and a retry succeeds; AC3.11 `ok`, `partial`, `read_back` and `replayed` combine as 3.3 states; AC3.9 (OR-10) through the wrapper and through `assertWriteFloor` at each named hook site; AC3.12 `openRoomDb` skips the chain and the stamp when `writer_version_max` is higher | wire snapshot: `client_write_id` on 1 schema |
| 4 | Material-approval rule and PA-2 leg | 3 | as r4.1 with one AC4.1 row per minter of 3.5 (incl. canon-release :286, tool-router :1882, sensors :737) and the marker-only rule | 367 files unchanged |
| 4b | Click proof on the decision card | 4, SP6a-c = A | as r4.1 plus: AC4b.4 on a marked fixture every minter returns `next: call gate_render` and no card view; gate_render shows a minted gate without a bound room; only its result carries the nonce. AC4b.5 room-birth.cjs, confirmReason and cause-effect store or read `app_nonce` (one row each) | house rules; render coverage |
| 5a | `.mcpb` extension | 1, SP7 = A | as r4.1 with the output folder outside the repo, gates from task 0.1, unsigned | test-341-shrinkwrap-no-dev; doctor doc parity |
| 5b | Config fallback | SP7 = B and the owner | as r2 | as r2 |
| 6 | Shared binding | SP4 = A | as r4.1 on the wrapper's callers | wire snapshots |
| 7 | Instructions and room_bind context | 3 | as r4.1 | harness manifest |
| 8 | Parity and live proof | 1-7, 12-14 | as r4.1 plus the three components on the CLI fixture (text fallback) and a marked fixture (view) | none |
| 9 | Release | 1 to 10, 12 to 14 as built or dropped | as r4.1 with: AC9.3 output to `$HOME/.mindrian/release-out/<v>/`, no dist/ change; AC9.5 (OR-12) RULE 5 gains one paragraph after the UI shell paragraph ("a release artifact checked by verify-release --mcpb, not a numbered place"), the numbered list unchanged; release-process.md stops restating a count; AC9.7 [R4M13] `node scripts/real-room-run.cjs --mcpb-chat-verified win|mac` writes `mcpb_chat_leg: {os, extension_version, chat_reached, read_at}` into the receipt; scripts/release-lib/real-room-gate.sh prints a WARN when it is missing (the `desktop_verified` pattern, :146-150), never a refusal; AC9.10 Step 6.8b has a `--dry-run` print and an audited opt-out `--no-mcpb` (RULE 4) [IR4-N12]; AC9.11 Step 9.8 `verify-release --mcpb` failing after publish prints a WARN with the recovery line (re-run Step 9.x), never aborts [CD4-N12]; AC9.8 skip mechanism: `MOS_405_NO_EXTENSION=1` set by the slice 5a outcome note skips AC9.3 and AC9.4 with a logged reason [IR4-N13] | release gates |
| 10 | Theo cards | 7, SP8 | as r4.1 with the 3.10 r5 notes | Part 8 review per 3.10 |
| 12 | Shape F renderer and decision card (C1; 3.12.2) | 4b | AC12.0 tests/test-405-shape-parity.cjs: one fixture object per shape (F.0, F.1, F.3, F.4, F.8, F.9) renders through the terminal renderer, the AskUserQuestion contract and the MCP App adapter with the same options in the same order, the same labels and the same recommended choice; the optional fields `progress`, `verb_ids`, `defs` are ignored by the two existing renderers. AC12.1 decision/v2.html renders F.0, F.8, F.9 and the gate kinds from fixture shape objects; AC12.2 the text fallback of each is a complete answer; AC12.3 tests/test-405-card-text.cjs passes F1 to F8 on every fixture card; AC12.5 host-neutral rules H1 to H3 (a grep test for host-specific calls without a guard; each fixture's text fallback stands alone). AC12.4 the house-rule tests (test-gpt-plugin-ui.cjs, test-larry-theo-face-apps.cjs at widths 390 and 960); LIVE: one F.1 and one F.8 card answered by click in the merged chat | URI bump; render coverage; house rules |
| 13 | Framework player (C2) | 12, SP6a = A | AC13.1 `framework_play` registered with the view, render-only, born wired, `hitl_shape: none`; AC13.2 one step per card with `contract.progress`; controls are the F.2 (path), F.3 (depth) and F.5 (branch) renderer objects; the last card is an F.4 insight-extraction card; Theo step text folded after 60 words; AC13.3 the text fallback names the framework, the step and the plain line; AC13.4 card-text test passes; AC13.5 PURE_READ 7 to 8 and test-270 76 to 77 with the measured bytes and a dated doc block; LIVE: a theo-context framework played step by step in the merged chat and the Code tab | wire snapshots; test-270; census leg (PA-2) |
| 14 | Next-move card (C3) | 12, SP6a = A | AC14.1 suggest_next declares the next-move view, fed by the F.1 renderer object (shape-f1-renderer.cjs:134); AC14.2 one move plus at most two alternates (MAX_K 3); AC14.3 a click sends the move text (SP6f = A) or shows a copyable line (SP6f = B); no write; AC14.4 card-text test passes; LIVE: one next move chosen by click | wire snapshot: suggest_next `_meta` only; test-270 |
| 11 | End slice: commands work in chat | 404 with chat as target; SP6 = A | AC11.1 the 404 pilots run in the merged chat as framework-player cards, one step per card, no helper agents, steps from theo-context, results filed with receipts; every card passes the card-text test; a recipe halt uses the Shape F card. LIVE | 404 gates |

## 8. File table (r5 rows; unchanged rows as r4.1)

| Slice | Create | Modify |
|---|---|---|
| 0 | .planning/spikes/405-desktop/ (probe-server.cjs, package.json, lockfile, card.html, README), 405-SPIKES.md | none |
| 2a | scripts/dev/405-find-unregistered-writers.cjs, tests/helpers/registered-room.cjs, tests/test-405-fixture-helper-scan.cjs | lib/mcp/session-room.cjs (rule behind the switch), the six shared helpers, the writing tests the runner lists |
| 2 | lib/core/doctor/unregistered-rooms-module.cjs, tests/test-405-registered-room.cjs, tests/test-405-rooms-adopt.cjs, tests/test-405-unregistered-finder.cjs | lib/mcp/session-room.cjs (`authorizeMcpWriteRoom`), lib/core/resolve-active-room.cjs (export), the 13 callers: lib/mcp/tools/chain.cjs, claim-verify.cjs, claim.cjs, gate.cjs, graph.cjs, question.cjs, research.cjs, startup.cjs, views.cjs, lib/mcp/tool-router.cjs; lib/mcp/startup-operations.cjs; scripts/room-registry (`register`); scripts/sessionstart-coordinator.cjs (notice); commands/rooms.md, commands/doctor.md and mirrors; data/doctor-modules.json |
| 3 | as r4.1 | as r4.1 plus lib/core/room-db.cjs (`assertWriteFloor`, chain skip), the six named hook write sites, lib/core/session-presence.cjs (use of isAlive) |
| 4b | lib/mcp/app-nonce-store.cjs, tests/test-405-app-card.cjs | lib/mcp/gate-app.cjs, lib/mcp/app-html/decision.html, lib/mcp/tools/gate.cjs (gate_render by id without a room; :1630), lib/mcp/answer-route.cjs, lib/core/navigation/room-birth.cjs, lib/core/navigation/cause-effect.cjs, lib/core/navigation/room-projection.cjs, the minters of 3.5 (`next` reply) |
| 5a | as r4.1 (no dist/ entry) | as r4.1 minus .gitignore |
| 9 | tests/test-405-release-steps.cjs | scripts/release.sh, scripts/verify-release, scripts/release-lib/desktop-copy-gate.sh, docs/RELEASE-CEREMONY-RULING-SYSTEM.md (one paragraph), .claude/includes/release-process.md, scripts/real-room-run.cjs, scripts/release-lib/real-room-gate.sh, both step-hash fixtures, CHANGELOG.md |
| 12 | lib/mcp/app-html/decision-v2.html (or decision.html edited in place with the URI bump), lib/mcp/shape-app-adapter.cjs, lib/mcp/card-text-rules.cjs, data/card-plain-words.json, tests/test-405-card-text.cjs, tests/test-405-shape-parity.cjs | lib/mcp/gate-app.cjs, lib/mcp/app-views.cjs, the lib/hmi renderers of F.0, F.1, F.3, F.4, F.8, F.9 (optional fields only), tests/test-gpt-plugin-ui.cjs, tests/test-larry-theo-face-apps.cjs |
| 13 | lib/mcp/app-html/framework-player.html, lib/mcp/tools/framework-play.cjs, tests/test-405-framework-player.cjs | lib/mcp/app-views.cjs, tests/test-270-tool-schema-budget.cjs, wire snapshots, tests/test-405-census-bridge.cjs |
| 14 | lib/mcp/app-html/next-move.html, tests/test-405-next-move.cjs | lib/mcp/tools/sensors.cjs (suggest_next `_meta`), lib/mcp/app-views.cjs, tests/test-270-tool-schema-budget.cjs, wire snapshots |

Part 11: one new tool (`framework_play`, render-only, born wired); no new shape (the Shape F family is reused, OR-21); one new subcommand (`/mos:rooms adopt`, F.1); one new doctor fix basket (F.8).

## 9. AC-to-test map and tests/run-all-405.sh

Map: as r4.1, plus AC2.7 tests/test-405-unregistered-finder.cjs; AC4b.5 tests/test-405-app-card.cjs; AC9.9 to AC9.11 tests/test-405-release-steps.cjs; AC12.0 tests/test-405-shape-parity.cjs; AC12.x tests/test-405-card-text.cjs and the house-rule tests; AC13.x tests/test-405-framework-player.cjs; AC14.x tests/test-405-next-move.cjs [IR4-N1].

tests/run-all-405.sh, r5: as r4.1 (one code fence only) [IR4-N3], with: the own() list gains test-405-unregistered-finder, test-405-shape-parity, test-405-card-text, test-405-framework-player, test-405-next-move; a missing 405 test SKIPs only when the file `.planning/phases/405-claude-desktop-chat-and-code/405-DROPPED-SLICES.txt` names its slice, else it FAILs once the slice is marked built in that file [IR4-N4]; the suites step runs `bash tests/run-all-267.sh`, `run-all-358.sh`, `run-all-365.sh`, `run-all-369.1.sh`, `run-all-383.sh`, `run-all-387.sh` and a loop over `tests/test-400-3-*.cjs` [CD4-M6].

## 10. Interaction with other phases

- 367 (jsagi-42): build after 367-11 and 367-12 only (C23). The census is not edited; the wrapper keeps C4 and C5 green (CD4-B1).
- 401: F1 runs right after the cut (OR-14). F1's frontmatter split rule applies to commands/rooms.md, setup.md and doctor.md before 405 adds keys (program 2d). 401's sweep keeps `pws-brain-mcp` in the three matchers (C5) and does not rewrite the 12 unscoped-name tests (C6).
- 402: K4 and F2 start now as small plans (OR-15); 400.3-09 folds into 402. 402 gets SP9 (deferral) from slice 0 and the contracts of 3.13.
- 400.5: owns prompt hooks after 367-11/12 (OR-15); its new tool must be named for the census, test-270 and the extension (3.13).
- 404: after 401 and 402 overlap; chat target per 3.6 and 3.12 C2; no-agent path (C9).
- Theo repo: authored Feynman steps (OR-13) and B2.3 hand-offs.

## 11. Risks (in order)

R1 to R19 as r4.1, with R6 replaced and R19 removed (OR-11 closes it). New:
- R6 The fixture migration now touches every test that writes a room (OR-11); the discovery runner sizes it before slice 2.
- R20 Direct `openRoomDb` callers outside the named hook sites can still write past the schema floor (3.11).
- R21 OR-11 refuses writes in existing unregistered CLI rooms until the person adopts them; the finder, the SessionStart line and the refusal text are the mitigation.
- R22 The Feynman rules are lint rules; a card can pass them and still be unclear. LIVE legs of slices 12 to 14 are the check.
- R23 The GENUI research may change component rules after r5 (r5.1).
- R24 The gate card (gate-render.cjs) and the lib/hmi renderer objects may be two shapes today; the adapter and the parity test close it in slice 12.
- R25 The job sentences of the three tools are `status: provisional` in data/mcp-tool-job-sentences.json; a ruling on them would change the card question.

## 12. Workflow from here

1. EGM design is complete when one Goldfish round is clean. r5 resolves round 4; r5.1 folds in 405-GENUI-RESEARCH.md.
2. Slice 0 can be planned after r5.1 without another full round (section 6 is self-contained); a narrow round 5 covers 3.2, 3.2b, 3.5, 3.11, 3.12 before the build slices are planned.
3. Thin `/gsd-plan-phase 405`: the planner reads 405-CONTEXT.md, 405-RESEARCH.md and this design; one plan per slice; the plan checker runs; GSD research and discuss are replaced by the EGM record.
4. Plan and run slice 0 first (rebase, then tasks 0.0 to 0.10). Record verdicts in 405-SPIKES.md; apply each If line as a dated r5.x note. A NEEDS_HUMAN leg stops its dependent slices until the owner answers.
5. Re-plan the build slices after the verdicts. Build only after 367-11 and 367-12 are on origin/main and Phase 401 F1 has run (OR-14). Order per OR-9 and section 7.
6. Each slice ends with its gates green and a SUMMARY with agent runs, tokens and findings.
