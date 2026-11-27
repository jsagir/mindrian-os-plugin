---
phase: 405
title: "MindrianOS first-class on the Desktop merged chat and the Desktop Code tab, beside the CLI"
status: DESIGN r4 (after Goldfish round 3 implementation-readiness; r3 kept as 405-DESIGN-r3.md, r2.2 as 405-DESIGN-r2.md, r1 as 405-DESIGN-r1.md; resolutions in 405-GOLDFISH-REPORT-R1.md, -R2.md, -R3.md). r4.1 is reserved for the round-3 codebase-details findings, still running.
date: 2026-11-27
canon_parts: [3, 7, 8, 9, 11, 12]
base: main as of branch work/405-desktop 704abc5a1. Build starts only after 367-11 and 367-12 reach origin/main (PA-1 condition 1); never branch from work/367-graph-writes-itself.
inputs: 405-CONTEXT.md (OR-1 to OR-10 LOCKED; PA-1, PA-2), 405-RESEARCH.md (R#), 405-HATS.md, 405-BRIDGES.md (B#; S = secondary source), Goldfish R1 and R2 reviews and reports, claude-surface-radar.md, docs/CLAUDE-SURFACE-MODEL.md, 367-DESIGN.md section 13 (branch)
rules: GUESS marks a guess. Ids in brackets point to the Goldfish reports (GB#, GM# round 1; R2B#, R2M# round 2; R3B#, R3M# round 3).
---

# 405 DESIGN r4

## 1. Goals

OR-2: first-class in the CLI, the Desktop Code tab and the Desktop merged chat. "First-class" means three testable things on each place:
1. Where the room is reachable, every room capability that can run there runs there. The chat needs two installs a person can finish without editing JSON: the Customize plugin (skills, Theo cards) and the `.mcpb` extension (the room server) [DC2-N9].
2. The named room writers (3.3) return a receipt read back from disk, or a typed failure, and a retry after a lost response never writes twice.
3. Where the room is not reachable, nothing is written, and the reply gives a typed reason, one step back to a place with the room, and full Theo method cards.

Goals:
- G1 Correct capability facts for the local Code tab with the smallest change, plus a read-only surface fingerprint (3.1).
- G2 Positive-evidence write rule: a room write, binding or birth happens only in a room this computer's registry knows (3.2) [GB2, R2M15]. `/mos:rooms adopt` exists to register a folder (3.2a, OR-5) [R2M11].
- G3 Receipts with read-back on six writers; one idempotency rule per writer, reusing existing keys (3.3) [R2M6].
- G4 Part 8 in chat: theo-context is the chat method route (OR-7, OR-8); no room content to any Theo server, stated in the instructions and in two tool texts (3.6) [R2M2, R2M3].
- G5 One-click chat install (OR-6): a `.mcpb` extension of the room server, built at release, with proof that Desktop loaded it and that the chat reached it (3.7) [R2M12].
- G6 A human proof for every material approval on hookless places (3.5, OR-4) [R2B1].
- G8 Ordered schema floor (OR-10): a copy older than the newest writer of a room refuses writes with `room_schema_newer` and one update line; reads stay allowed (3.11).
- G7 Theo framework cards are the default method experience in the merged chat and the Desktop Code tab, and in places with no room (3.10, OR-7, OR-8).

## 2. Non-goals

- A remote room server (Part 9).
- Any change to the 367 runner, its trigger or its tests. PA-1 allows a postCall list; 405 has no duty that needs it [GM12].
- A presence row, `next_move` in receipts, a new memory_event type [GM12].
- A 6-value place enum, a statusline detector change, or a drift test [GM9].
- A guard line in skills [GB6]. The fence is the server rule of 3.2; no slice changes the room scripts in r3 (correction, DC2-N3). Reopened only by SP1 (section 6).
- Rewriting skills for chat. The skill bridge is Phase 404 recipes (B1.2). OR-9 sets the order: 405 foundation (slices 0 to 9), then the overlapping parts of 401 and 402, then 404 with chat as a named target, then the 405 end slice 11 ("commands work in chat"). The server's existing MCP prompts (lib/mcp/prompts.cjs, 9 `server.registerPrompt` calls, :101 to :398) are an interim front door; whether the merged chat lists them as slash commands is UNVERIFIED (S only; SP6 leg) [IR2-N1, DC2-N10]. B1.3 (a local script runner) is rejected.
- `alwaysLoad` timing (Phase 402).
- Website edits (OR-3); the get-mindrian route B text (raised to the owner by jsagi-42).
- Signed egress B2.2 (OR-7).

## 3. The design

### 3.0 Places

| Place | Who spawns the room server | Hooks | Room |
|---|---|---|---|
| P1 CLI | Claude Code | yes | yes |
| P2 local Code tab | Claude Code inside Desktop | yes (R0) | yes |
| P3 cloud Code session, Projects cloud thread, cloud scheduled task | Claude Code in an Anthropic VM, only for a synced plugin | yes, in the VM | no |
| P4 merged chat with bridge (also web or mobile with a linked computer) | the Desktop app (the `.mcpb` extension; fallback a config server) | no | yes, while Desktop is open |
| P5 any chat with no bridge | nobody | no | no |

P2 uses the 367 CLI hook path on main (scripts/on-stop:56, scripts/session-start:135). The statement "Desktop and Cowork (MCP only, no hooks)" (367-CONTEXT:35) is wrong for P2; recorded in 405-RESEARCH section 0 only.

"Hookless place" in this design means: the server process has the launcher marker `MINDRIAN_LAUNCHER=mcpb` (or `bridge` for the fallback), or it has no `CLAUDE_CODE_SESSION_ID` and `readClientIdentity` is not a Claude Code name. The marker is the primary signal because it is set by our own manifest, not detected [R2B5].

### 3.1 Capability facts and fingerprint (G1)

- No production code reads `capabilities.hooks` (navigation-engine.cjs:1598 passes `ctx.arbitration_inputs`, set by nothing); the live consumer of the capability map is lib/mcp/capability-registry.cjs:50-56 (`apps`). No new enum.
- After SP5: if the local Code tab sets a non-empty `CLAUDE_CODE_ENTRYPOINT` other than `cli`, rule 4 of lib/mcp/surface-detect.cjs:65-69 treats it as Claude Code with `apps: true` kept. Else no change.
- `cloud_session` (boolean) in `status_read`, only from a marker SP3 proves.
- Fingerprint (B3.1) in `status_read.fingerprint`: `{surface, transport, host (readClientIdentity, surface-detect.cjs:250-270), protocol_version, client_capabilities, parent: {ppid, exe}, platform, node_version, sqlite_timeout_ok, session_id_present, plugin_root_present, launcher, cloud_session?, host_hash}`.
  - Parent executable method, computed once at server start and cached, never inside a status_read call [R2M18]: Linux `/proc/<ppid>/comm`; macOS `ps -o comm= -p <ppid>` (spawnSync, 500 ms); Windows `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=<ppid>').Name"` (spawnSync, 1500 ms). Timeout or error gives `unknown`. The start is not delayed: the probe runs after the transport connects.
  - `host_hash` = sha256 of hostname plus a salt in `~/.mindrian/desktop/host-salt` (32 random bytes, mode 0600, created on first use).
  - `sqlite_timeout_ok`: `node:sqlite` loads and a `timeout` option is honored on a temp database (a 2-connection lock test, 200 ms).
  - No room content, no path under the rooms home. It never leaves the computer.
- Expected value to confirm (S: coral#2734): Desktop local stdio sends clientInfo `claude-ai` 0.1.0 and declares no elicitation.

### 3.2 Positive-evidence write rule (G2) [GB2, R2M15, DC2-N1]

Helper `isRegisteredLocalRoom(dir)` in lib/mcp/session-room.cjs (post-367 file). Registry reader: `readRegistry(home)` (lib/core/resolve-active-room.cjs:83), exported in slice 2 (today it is not in the exports at :603-613), with `registryRoomPath(home, slug, reg)` (:123) for each entry's absolute path [IR3-N1]. Rule: true only when realpath(dir) equals realpath of a registered room path (a relative registry path resolves against the rooms home first) and `.mindrian/room.db` exists.
- Called inside `classifyMcpWriteRoom` (367 branch session-room.cjs:256-281). Every source passes through it: `session.primary`, `room-root`, session-less `reg.active`, `boot-fallback` (including the default `<cwd>/room`, mindrian-mcp-server.cjs:190), `cwd`, and operator pins (`isOperatorPinnedRoom`, session-room.cjs:264). A failure keeps the existing shape: `{ok: false, dir, slug, source, refusal: {ok: false, reason: 'no_local_room_here', message, route_back}}`. `message` = the fix text; `route_back` = the place text.
- Called in `room_bind` (tool-router.cjs:2272) before a binding file is written.
- Room birth (`prepareRoomCreation` and the approve leg, lib/mcp/startup-operations.cjs:44-86): the destination must be under the rooms home; allowed when the rooms home has a registry, or when none exists and `cloud_session` is not true. R2 stays for the no-marker case.
- Order: `writePathRefusal` first (views.cjs:559), then `no_local_room_here`.
- Texts (one place, session-room.cjs):
  - `route_back`: "This place has no MindrianOS room. Open the Code tab in Claude Desktop on the computer that holds your rooms (Local), or use Claude Code there. Framework cards from Theo still work here: ask Larry about any method."
  - `message` for an unregistered existing room (OR-5): "Register this folder as a room with /mos:rooms adopt, then retry."
  - On a hookless place, both texts add: "Creating or adopting a room needs the Code tab or Claude Code." [R2M11]
- Fixture migration [R2M15]: 104 test files set `MINDRIAN_ROOM` or `fallbackRoomDir` (162 occurrences, IR2-M2). Slice 2a adds `tests/helpers/register-temp-room.cjs` (makes a temp rooms home, registers the room with an absolute path, sets `MINDRIAN_ROOMS_HOME`) and migrates the files that write. No test-mode bypass in the rule. Suites that must stay green, named in slice 2a: tests/test-367-governed-census.cjs, tests/test-367-catchup-mcp.cjs (ac2, ac8mcp), tests/test-desktop-stdio-session-binding.cjs, tests/test-room-state-no-registry-regression.cjs, tests/run-all-369.1.sh (no run-all-367 or 400.3 run-all exists on this base, R3M8).

### 3.2a `/mos:rooms adopt <path>` (OR-5) [R2M11, R3B1]

The fix line names a command that does not exist today (commands/rooms.md:5). `scripts/resolve-room --adopt` is not usable: when a central registry exists it returns the active room and exits 0 (scripts/resolve-room:50-78), and its adopt branch (:122-178) needs a legacy `room/` or `rooms/` subfolder and writes a workspace registry `<path>/.rooms/registry.json`, never `<rooms home>/.rooms/registry.json`, which `isRegisteredLocalRoom` reads (IR3-B1).

Design: a new subcommand `scripts/room-registry register <slug> <absolute path>` that writes only the registry entry, with the same entry shape and absolute-path handling as `create` (scripts/room-registry:459-478: an absolute path is kept as given; a Windows drive path only on msys or cygwin), and no scaffold step. `/mos:rooms adopt <path>` calls it.
- Slug rule: the folder basename, lowercased; every run of characters outside `[a-z0-9-]` becomes `-`; leading and trailing `-` removed; at most 64 characters; `--slug <s>` overrides. No automatic suffix.
- Typed refusals (literal reasons, exit 3, nothing written): `path_not_absolute`; `not_a_room` (no `.mindrian/room.db`); `no_room_root` (no `.room-root`); `already_registered` (the realpath equals a registered path); `slug_taken`; `hookless_place` (from `/mos:rooms adopt` when `MINDRIAN_LAUNCHER` is set or no shell runs).
- The registry-leak guard of `create` (`_registry_leak_guard`, :458) runs before any write.
- HITL F.1 (one yes after a shown summary: slug, path, "registered in place, nothing moved"), declared in commands/rooms.md frontmatter; born wired.
- Files: scripts/room-registry (`register`), commands/rooms.md (argument-hint gains `adopt`, a subcommand section), skills/rooms mirror.

### 3.3 Receipts and idempotency (G3) [GB3, GB7, R2M6, R2M13]

Writers with a receipt: artifact_file (views.cjs:537), claim_write (claim.cjs:97), memory_event (graph.cjs:260), graph_write (graph.cjs:217), gate_answer approve (gate.cjs:1612), room_create approve (receipt extended, startup-operations.cjs:85-86). Others are DEGRADED in the doctor.

Receipt: `{room_id, room_slug, host_hash, cloud_session, read_back, file: {path, sha256, bytes} | null, rows: [{table, id}], change_observed: {epoch, from_seq, through_seq}, idempotency: {key_kind, key, replayed}, reason?}`.
- `file.sha256` hashes the bytes read back after `injectArtifactId` (views.cjs:287-292).
- `rows`: one generic `readBackRows(db, expect)` behind navigation.cjs, extracted from file-evidence-readback.cjs:118-148.
- `change_observed`: `readChangeLogMeta` (navigation.cjs:681) before and after; named "observed" because it can include 367 runner rows [DC2-N7].
- `host_hash` and `cloud_session` let a reader see which computer wrote it; a VM write is already refused by 3.2 when SP3 gives a marker, and GM4 stays conditional on SP3 [R2M13].

One idempotency rule per writer (reuse first, Part 7):

| Writer | Key | Existing or new |
|---|---|---|
| memory_event | `dedupe_key`, 60 s (graph.cjs:269-270) | existing; receipt reports it |
| claim_write | upsert on `source_segment` (claim.cjs:107) | existing; receipt reports it |
| gate_answer approve, room_create approve | `gate_id` replay (gate.cjs:1616) | existing; receipt reports `replayed` |
| artifact_file, graph_write | `client_write_id` (new optional string, 1 to 64 chars) | new |

New table `write_keys` (artifact_file and graph_write only), added by a new migration module in the room-db chain (lib/core/room-db.cjs requires; the schema stamp is the source hash, room-db.cjs:270-281, so the chain re-runs once per room):
`write_keys(client_write_id TEXT PRIMARY KEY, tool TEXT NOT NULL, payload_sha256 TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','done')), owner_pid INTEGER, owner_host_hash TEXT, receipt_json TEXT, created_at TEXT NOT NULL)`. Migration module: `lib/core/migrations/405-write-keys-and-meta.cjs`, required by lib/core/room-db.cjs and added to the `_schemaStamp` specs (room-db.cjs:285-294) [IR3-N2]; it also creates `mos_meta` (3.11).
Payload hash [R3M2]: `payload_sha256` = sha256 of the UTF-8 JSON of the tool arguments with `client_write_id`, `room` and `_meta` removed and object keys sorted at every level (arrays keep their order; strings as given).

Stale-versus-live rule for `pending` [R3B2]: the row also stores `owner_pid INTEGER`, `owner_host_hash TEXT` and `created_at`. A `pending` row is stale when `owner_host_hash` equals this computer's `host_hash` and `ownerProcessAlive(owner_pid)` is false (lib/core/resolve-active-room.cjs:220, the existing liveness check), or when `created_at` is older than 120 s. Otherwise it is live.

Sequence for artifact_file: (1) BEGIN IMMEDIATE; select the key: `done` with the same payload hash returns the stored receipt with `replayed: true`; `done` or `pending` with a different hash returns `client_write_id_conflict`; live `pending` with the same hash returns `write_in_progress`; stale `pending` with the same hash is taken over (UPDATE owner_pid, owner_host_hash, created_at WHERE the old owner values still match) and the call resumes at step 2; absent inserts `pending`; COMMIT. (2) Write the file (outside the transaction, as today, views.cjs:284). (3) Rows, index, receipt; set `done` with `receipt_json` in one transaction. A crash leaves a `pending` row that becomes stale by the rule above; the next call with the same id and payload takes it over and resumes at step 2 (the file write overwrites the same path, views.cjs:283-284). graph_write runs steps 1 and 3 in one transaction.

Tool text: the six descriptions gain "Returns a receipt read back from disk." (39 bytes); artifact_file and graph_write also gain "Pass client_write_id; if a call returns nothing, repeat it with the same id." (75 bytes). Measured byte deltas go into the tests/test-270-tool-schema-budget.cjs AFTER constant in slice 3 [R2M19]. Part 12: a receipt is shown to the person only on failure.

### 3.4 Hook duties on P4

| CLI hook duty | P4 in r3 |
|---|---|
| Graph catch-up | 367 wrapper as built (PA-1) |
| Context at start | room_bind result carries the context summary from the lib/mcp/tools/context.cjs builder, called as a function (one spawn) |
| Per-turn memory row, navigation block | CUT (no consumer) |
| Stop close-out | stop_gate_check, pull |
| card-before-answer | 3.5 |
| Part 8 | 3.6 |
| Voice, card-fire, admin, auto-explore, JTBD, derive drains | MISSING, listed by the doctor module (3.7) |

### 3.5 Human proof for material approvals (G6, OR-4) [R2B1]

Existing protection: an elicitation card refuses a relayed answer to a dismissed dialog (`card_pending`, gate.cjs:1652-1675); `answered_via` records `browser_nonce` or `mcp_relayed` (answer-route.cjs:39).

Rule in gate_answer approve, on a hookless place (3.0): an approve is "attested" only when `answeredVia === 'browser_nonce'`, or `live.renderer === 'elicitation'` and the relayed choice equals the accepted dialog choice (the existing check). Any other renderer (`text`, `none`, `askuserquestion`; gate-render.cjs:717-721 records `none` when elicitation is declared without `elicitInput`) is not attested. An unattested approve is refused `human_confirmation_required` when its effect is material. Material, by effect, computed before any write [DC2-M5, IR2-M3, R3M1]. Literal predicate: `isMaterialApproval(live, subjectRow) = live.kind === 'material_step' || isTruthClaimPromotion(live, subjectRow) || isGoalGateRatification(live)`, where `isTruthClaimPromotion` uses the eligibility of gate.cjs:238-255 (subject type claim or opportunity, review_status proposed or needs_evidence) [IR3-N7]. `material_step` minters (one AC4.1 row each): lib/mcp/approval-gate.cjs:102, lib/mcp/never-do-gate.cjs:186, lib/mcp/room-readiness-gate.cjs:103 and :143, lib/mcp/tools/chain.cjs:589, lib/mcp/tools/research.cjs:14 (grant, deep_plan, basket), lib/mcp/eureka-capability-jobs.cjs:288, lib/mcp/startup-operations.cjs:55 (room birth). The bullets below name the same set by purpose:
- room birth: `live.roomCreation === true` (startup-operations.cjs:55, :61; gate.cjs:1724);
- promotion of a TRUTH_CLAIM_TYPES subject other than the gate's own decision node (transitions.cjs:47: claim, CausalClaim, assumption, decision, opportunity, SyntheticExpert): the subject paths at gate.cjs:238 (claim or opportunity) and :250 (needs_evidence), and goal-gate ratification (lib/core/strategy/goal-gate.cjs:241);
- resume of a halted material step (`material_step`, gate.cjs:1098, :1710-1730);
- research egress approvals (research_run grant and search-string gates) and spawn-class approvals (the Eureka pair-screen approval card).
Everything else is "ordinary" and passes with `answered_via: mcp_relayed` (OR-4 interim). The predicate lives in one function `isMaterialApproval(live, subjectRow)` in lib/mcp/tools/gate.cjs, with a pinned test per path.

Target route (OR-4): an MCP App gate card with a click proof (B3.2). Carrier [R2M9]: the server mints a single-use nonce bound to `{gate_id, binding key}` with a 10 min TTL and returns it only in the gate_render result `_meta` under `mindrian/app_nonce`, the field addressed to the app view (MCP Apps tool-result notification). GUESS: the host does not show result `_meta` to the model; SP6 leg c tests exactly this. The app returns the nonce in its app-originated `tools/call` `_meta`. A new check `appRouteOf(gateId, meta)` in answer-route.cjs verifies it; `routeOf` (answer-route.cjs:88-105) is unchanged. A nonce lost to a restart answers `card_expired`; a nonce from another binding answers `card_binding_mismatch`. A pass records `answered_via: browser_nonce`. When this lands (SP6 = A), gate_render on a hookless place draws the app card for every material approval. Names [R3M10]: nonce store `lib/mcp/app-nonce-store.cjs` (in-memory Map `gate_id -> {tag_sha256, binding_key, expires_at, used}`); binding key = `resolveEffectiveSessionId(undefined, extra)` (session-binding.cjs:176-182); app view resource `ui://mindrian-os/gate-card`, registered in lib/mcp/app-views.cjs under the mindrian-mcp-app house rules.

### 3.6 Part 8 and Theo in chat (G4) [R2M2, R2M3, DC2-N8]

- OR-7 and OR-8: theo-context is the chat method route, shipped in the plugin key-free (3.10). Part 8 binds: no room content to any Theo server.
- Chat Brain route decided [R2M2]: option (c). In chat the method route is theo-context. The guarded mindrian-brain shim runs where it runs today (CLI, local Code tab) and in the config fallback only. The shim ACs (lexicon union, sanitize) move to slice 5b and are built only with the fallback. If SP7 shows one manifest can hold two servers, the shim may ride in the extension (SP7 two-server leg, If A).
- Instructions THEO line, final for r3 (lib/mcp/runtime-instructions.cjs:38): "THEO: method via Theo card tools, else guarded mindrian-brain brain_*, when available; no room content to any Theo server. Never invent a Theo result." (150 bytes; keeps "when available"). LOOP line: "After filing use stop_gate_check; status_read on request." becomes "After filing use stop_gate_check.". Served length with both applied in memory: 1999 bytes (measured on 704abc5a1; budget 2000, cap 2048). BOUNDARIES byte-identical (checked). New sha256 of the THEO line: 2a39766a01b70418df84f43517722da05809d444cfd56ff723cb492aabe04b8a.
- Pins that move with it [R2B3]: tests/test-359-prose-budget.cjs:88 `MCP_THEO` re-based with a dated comment citing OR-7 (check B5 :230-233); data/harness-policies/contract-parity-larry.json:46 phrase replaced; the header comment of runtime-instructions.cjs:25-27 ("exactly 2000 bytes") updated to 1999; harness manifest regenerated (data/harness-manifest.json). tests/test-3696-operation-doctrine.cjs:327 needs no change (the "Instructions returned are not execution" sentence stays).
- If the merged chat does not forward server instructions (SP6 canary leg = B) [R2M3]: the sentence "No room content to any Theo server." goes into the room_bind result text and the room_list description (36 bytes).
- Residual R4: Part 8 in chat holds by text (OR-7 accepted trade).

### 3.7 Chat install path (G5, OR-6)

#### 3.7a The `.mcpb` extension (primary)

- Entry point: `scripts/mcpb-entry.cjs` sets `MINDRIAN_LAUNCHER=mcpb` and requires `scripts/mindrian-mcp-server.cjs` [R2B5]. The collision guard and the heartbeat key on this marker only; the CLI plugin server (no marker) is unchanged.
- Payload [R2B2]: the full `mos-desktop` payload (the Step 6.8 copy), with nothing extra dropped, because the server reads `commands/*.md` (tool-router.cjs:749-767, :1918), `agents/` (review-contract.cjs:173-180), `skills/ui-system/...css` (app-views.cjs:46, lib/ui/design-system.cjs:10) and `references/` at run time, and a miss there is silent. Plus `node_modules` and `scripts/mcpb-entry.cjs`. A slice 5a test scans the server's require graph and its `path.join(<root>, '<folder>'...)` reads and fails if a read folder is missing from the payload.
- Bundled dependencies [R3B4, IR3-N6]: two separate `npm ci` runs. (a) The payload: in the staging directory of the extension, `npm ci --ignore-scripts --omit=dev --no-bin-links` from the root `npm-shrinkwrap.json`, then remove `next`, `react`, `react-dom` and every package reachable only from them, then the Step 6.7 reachability prune. These three serve only the UI shell that the Desktop copy already drops (`lib/ui-shell/dist`, build-desktop-artifact.cjs:94; scripts/build-ui-shell.cjs:89 lists them as the shell's runtime packages); the AC5a.3 scan proves no kept file requires them. A rough count from the shrinkwrap gives 121 of 146 packages left (flat approximation, GUESS on hoisting). (b) The pack tool: in `tools/mcpb/`, `npm ci` from its own lockfile.
- Native module [R2M14, R3M11]: `sqlite-vec` 0.1.9 loads its library through `getLoadablePath()` (lib/core/semantic-index/vector-store.cjs:122-127) from a per-OS optional package. The shrinkwrap pins `sqlite-vec-darwin-arm64`, `sqlite-vec-darwin-x64` and `sqlite-vec-windows-x64`, each 0.1.9 (npm-shrinkwrap.json `packages` entries with `os` and `cpu`). The build fetches each with `npm pack <name>@0.1.9` into a temp folder, checks the tarball against the shrinkwrap `integrity` value, and extracts it into `node_modules/<name>/` of the staging tree. The vector leg loads or degrades with `vector_native_missing`.
- Payload check [R2B4, R3B4]: a separate `checkMcpbPayload` in scripts/release-lib/build-mcpb.cjs. It allows `@scope` segments, refuses symlinks and `.bin`. Numeric gates until SP7 measures the real extension limits: at most 4,500 files, at most 180 MB unpacked, at most 60 MB packed, deflate ratio at most 50:1 per file (GUESS: the first two copy the plugin gates of build-desktop-artifact.cjs; the packed figure is a target). SP7 size leg: If B (a gate cannot be met, or the installer limit is lower) goes to the owner with the measured numbers; the bundling route of SP7 (single-file JS bundle) is the recommended answer.
- Manifest (mcpb spec, S): `name: mindrian-os`, `display_name: Larry | MindrianOS`, `version` = release version, `server.type: node`, `entry_point: scripts/mcpb-entry.cjs`, `mcp_config.env: {MINDRIAN_MCP_FIRST: "desktop", MINDRIAN_LAUNCHER: "mcpb", MINDRIAN_ROOMS_HOME: "${user_config.rooms_home}"}` [IR2-N9], `compatibility.runtimes.node: ">=22.18.0"`, `user_config.rooms_home` (default `${HOME}/MindrianRooms`). If `user_config.rooms_home` differs from the home the registry is in, the doctor shows `rooms_home_mismatch` [DC2-N6].
- Runtime: Desktop's built-in Node may be Electron-embedded [R2M1]. SP7 checks `require('node:sqlite')` with `timeout` honored, `process.execPath`, and the 367 detached runner (graph-catchup-spawn.cjs:140 spawns `process.execPath`) started from inside the extension. Any failure is SP7 = B, which returns to the owner (below).
- Code-tab collision: with the marker and `CLAUDE_CODE_ENTRYPOINT` set, the server serves the install responder's one status tool only.
- Proof: each marked start writes `~/.mindrian/desktop/heartbeat.json` `{time, ppid, parent_exe, version, launcher}` = `desktop_loaded`. The first `tools/call` on a marked process whose client is not Claude Code writes `chat_reached: {time, client}` into the same file [R2M12]. The doctor reports both.
- Drift reporting [R2M7]: `status_read` and the `room_list` result carry `install_versions: {this_server, plugin_active, extension}` and `version_drift: true|false`. The write refusal for an older copy is the ordered schema floor of 3.11 (OR-10).
- Signing [DC2-N4]: the artifact is signed with `mcpb sign` if the CLI supports it (S); else unsigned is a named residual (R16).
- Doctor: `lib/core/doctor/desktop-bridge-module.cjs`, reusing `buildInitializeTransaction` (lib/core/doctor/mcp-surface-module.cjs:98) and `listToolsOverStdio` (:130) [IR2-N2]. States: `extension_missing`, `extension_version_drift`, `config_present_never_loaded`, `loaded_never_reached_by_chat`, `server_start_timeout`, `rooms_home_mismatch`, `theo_context_unreachable` (3.10), plus the fallback states. Lists the P4 MISSING duties. Registered in data/doctor-modules.json; documented in commands/doctor.md.
- `/mos:setup` [IR2-N8]: the Desktop (stdio) branch (commands/setup.md:68-83, which writes a `mindrian-os` config entry with a `MINDRIAN_ROOM` pin) is replaced by "install the extension" text plus the extension link. The pin route is removed (it would be refused under OR-5).

SP7 = B (the extension is not reached, or its runtime fails the sqlite or spawn legs) [R2M8]: the build of 3.7a stops; the result goes to the owner as NEEDS_HUMAN with the evidence: "The one-click extension cannot run MindrianOS safely on Desktop's built-in runtime. Keep the extension with a system-Node requirement (not one click), or use the config route?" No design line changes the OR-6 artifact without that answer.

#### 3.7b The config route (fallback; built only after the SP7 = B owner answer chooses it)

Unchanged from r2 (405-DESIGN-r2.md 3.7b): `/mos:setup desktop`, entries `mindrian-os-bridge` and `mindrian-brain-bridge` with `MINDRIAN_LAUNCHER=bridge`, dispatch shims registered in data/deployment-surfaces.json, per-OS paths, WSL refusal, heartbeat, fallback doctor states `config_missing`, `entry_missing`, `launcher_unresolved`, `version_drift`. The shim changes of 3.6 ride with it.

### 3.8 Bridge threat model

Assets: room files, room.db, the rooms home and registry, `~/.mindrian/desktop/*`, the `.mcpb` artifact.
Actors: the cloud model; injected content in the cloud context; a linked web or mobile session; a local process in the user's home; a forged extension file [DC2-N4].

| Tool class on P4 | Examples | Default in r3 | Residual |
|---|---|---|---|
| Read | room_list, graph_query, context_assemble, room_artifact | registered rooms only (3.2) | injected text can pull room content into the cloud context |
| Governed write | the six of 3.3, others | registered room only; receipt; idempotency (3.3) | an injected call can write into a registered room; receipts disclose |
| Path-choosing | room_create | material approval needs a click proof (3.5); destination under the rooms home | first-room birth fence depends on SP3 (R2) |
| Process-spawning | Eureka engine, research_run deep, the 367 runner | Eureka engine starts on a hookless place are refused `local_session_required`, except through an attested pair-screen approval (3.5) [R2M10]; research_run deep refused off Claude Code (today); the runner takes no MCP path argument | none new |
| Network | research_run quick, theo-context, brain_* (fallback only) | research egress approvals are material (3.5); theo-context by text (3.6) | R4 |
| Install files | `mindrian-os.mcpb`, heartbeat, host-salt | signed if the CLI supports it; heartbeat and salt mode 0600 | R16 unsigned extension |

### 3.9 Per-conversation binding on a shared process [R2M17]

Decided by SP4, run on the extension, not on a config server [IR2-M4]:
- One process for all P4 conversations: each tool whose handler calls `resolveMcpWriteRoom` requires an optional `room` argument (slug) equal to the bound room on a marked process, else `room_mismatch`. The tools (12 call sites on main, IR2-N3; re-listed from post-367 main at plan time): chain_run (chain.cjs:983), claim_verify (claim-verify.cjs:102), claim_write (claim.cjs:132), gate_answer (gate.cjs:1172, :1747), memory_event and graph_write (graph.cjs:237, :279), question_set (question.cjs:138), research_run (research.cjs:120), room_startup (startup.cjs:28), artifact_file (views.cjs:564), the tool-router write sites (tool-router.cjs:115). Snapshot diff: one optional `room` property on each of those schemas. room_bind states "shared by every chat on this computer".
- One process per conversation: nothing is added.

### 3.10 Theo framework cards (G7; OR-7, OR-8)

Facts: theo-context is a remote Streamable HTTP MCP server; on this dev machine ~/.claude.json has `theo-context: {type: http, url: https://theo-context.onrender.com/mcp}` with no auth header (key names read only). This account's claude.ai connector Theo-Claude exposes the same tool names (UNVERIFIED same URL; not called). The Part 8 code already lists both as Theo routes (part8-egress-guard.cjs:845-867, brain-response-sanitize.cjs:134, :245).

Design (answers DC2-M4: install, entitlement, check, render):
1. Ship it (OR-8, key-free now): plugin `.mcp.json` gains `"theo-context": {"type": "http", "url": "https://theo-context.onrender.com/mcp"}`, no header, no `alwaysLoad`. The `mos-desktop` copy carries the same file. The install-time entitlement is unchanged (OR-8).
2. Where the plugin route does not reach (SP8 = B, or no plugin): a claude.ai custom connector with the same URL. The step text (room_list description, 173 bytes, measured) is: "If no Theo framework card tools are connected, tell the person once how to add them: Settings > Connectors > Add custom connector, URL https://theo-context.onrender.com/mcp." The same text is in `/mos:setup` and the extension onboarding [IR3-N3].
3. Routing rule: the THEO line of 3.6. A method question = which framework, its steps, a walkthrough, a lens or a play. Arguments are generic handles only.
4. Part 8 matchers [R3M5]: the plugin prefix `(?:plugin_[A-Za-z0-9_-]+_)?` today covers only mindrian-brain and pws-brain-mcp (hooks/hooks.json:208, :332), and the same string is mirrored as `BRAIN_SHAPED_TOOL_MATCHER` (lib/core/brain-response-sanitize.cjs:151). New literal for all three places: `mcp__(?:(?:plugin_[A-Za-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp|[Tt]heo-context)__.*|[Tt]heo__.*|[Tt]heo-context__.*|claude_ai_[Tt]heo[A-Za-z0-9_-]*__.*|claude_ai_PWS_[Bb]rain__.*|[A-Za-z0-9_-]+__brain_[a-z0-9_]+)`. Checked with node: it matches `mcp__theo-context__framework_walkthrough`, `mcp__plugin_mos_theo-context__framework_steps`, `mcp__plugin_mos-desktop_theo-context__x`, `mcp__plugin_mos_mindrian-brain__brain_ask`, `mcp__claude_ai_Theo-Claude__x`, and not `mcp__plugin_mos_mindrian-os__room_list`. Pinned files that move with it: tests/test-260906-gr1-brain-shaped-tool-gate.cjs, tests/test-396-theo-route-matrix.cjs, tests/test-396-bypass-5-theo-tool-arms.cjs, scripts/part8-egress-guard-hook.test.cjs, tests/test-brain-response-sanitize.cjs, tests/fixtures/392-part8-replay/route-matrix.json.
5. No-room places: the route_back text of 3.2 ends with the cards sentence.
6. Check [R3M6]: a new doctor module `lib/core/doctor/theo-context-module.cjs` (independent of slice 5a) prints `theo-context reachable: yes | no (<reason>)` from an initialize-only probe (5 s) and `configured: plugin | user | none`; `status_read.theo_cards.configured_in_plugin`. Render: SP8 records a card rendering in the merged chat and the Code tab.

### 3.11 Ordered schema floor (G8, OR-10) [R2M7]

Why: the room-db schema stamp is a source hash (room-db.cjs:270-281), not an ordered version, so two copies of different versions re-run each other's migrations and nothing stops an older copy writing a room a newer one shaped.
- Table `mos_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)`, created by the migration of 3.3. Key `writer_version_max` holds the highest plugin version that opened the room for write (plugin.json `version`, semver with prerelease order, compared with the `semver` package already in package.json).
- Check in one place: the write-open path of lib/core/room-db.cjs (`openRoomDb` when the caller opens for write; `navigation.openRoomDbForCaller` with `probeWrite` reaches it). If this copy's version is lower than `writer_version_max`, the open for write returns the typed reason `room_schema_newer` and no write happens; a read-only open is never refused. After a successful write open, `writer_version_max` is raised to this version when higher.
- Update line (one string): "This room was saved by a newer MindrianOS (<writer_version_max>). Update this copy (<this version>) to save here; reading still works."
- Hooks: a CLI hook that meets `room_schema_newer` skips its write and logs one stderr line; it never fails the hook.
- A room with no `mos_meta` row (older rooms) is not refused; the first write sets the row.

## 4. Answers to the three hats questions

1. On P4 the room server runs on the user's computer, spawned by Desktop from the `.mcpb` extension (SP7 confirms; the config route is field-observed, A1 and A2). A write proves itself with the receipt of 3.3 (fresh read of file and rows, host hash, observed change range) and a retry rule per writer.
2. The governed tool call triggers the 367 detached runner (PA-1, as built); 405 adds no wrapper duty. SP7 checks the runner spawn from inside the extension.
3. A no-room place refuses every write, bind and birth outside the registry with a route back that ends with "Framework cards from Theo still work here", and theo-context serves the method. OR-6 adds a third artifact, kept in the release lockstep (slice 9).

## 5. Alternatives

| Option | Verdict |
|---|---|
| A. claude_desktop_config.json entries via `/mos:setup desktop` | FALLBACK, only after the SP7 = B owner answer |
| B. `.mcpb` extension | CHOSEN (OR-6) |
| C. Remote room connector | REJECT (Part 9, infrastructure) |
| D. Remote Control | route-back text only |
| E. Customize plugin alone | carries skills and theo-context; no local server in chat (radar Q1) |
| F. Explicit room per write | only if SP4 shows a shared process (3.9) |
| G. Do nothing | REJECT (OR-2) |
| H. CI emulated host (MCPJam, S) | optional in slice 8 |

## 6. Spikes (slice 0)

Records go to 405-SPIKES.md (raw output, verdict, design line changed). FP = answered by the slice 1 fingerprint on tester installs.

| Id | Question | Cheapest test | If A then | If B then |
|---|---|---|---|---|
| SP1 | Is a Customize-installed plugin server bridged; do plugin hooks fire in the merged chat; is CLAUDE_PLUGIN_ROOT set in the sandbox; Desktop quit mid-call | spike 012 probe as a Customize plugin; one hook that touches a file; one skill that prints `$CLAUDE_PLUGIN_ROOT` and `hostname`; 20 s hold, quit at 5 s | A: plugin server bridged: doctor note only (3.7a stays, OR-6) [IR2-M4] | B: not bridged: no change. Either way: if skill bash sees CLAUDE_PLUGIN_ROOT in the VM, reopen GB6 with scripts/stamp-firing-block.cjs |
| SP2 | Bridged write: lands, lost response, kill between file and row | probe with seams (read-only dir, 30 s sleep after write, kill between file and row); quit Desktop in the sleep | A: write lands, model sees no result: 3.3 retry rule as designed | B: write does not land: slice 3 is blocked and the design returns to EGM for a journal design [IR2-M4] |
| SP3 | Cloud Code session marker and disk | one cloud session with the plugin synced; log env and homedir | A: marker: `cloud_session` from it; birth refused on it | B: no marker: R2 stays named |
| SP4 (FP) | One extension process per conversation or per app | two merged chats; fingerprint pid and parent | A: per app: build 3.9 | B: per conversation: drop 3.9 |
| SP5 (FP for env) | Code tab: CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, hooks.json, MCP Apps, does it load extensions | local Code tab: echo variables, server start line (mindrian-mcp-server.cjs:658), session-start context | A: entrypoint non-empty, not `cli`: 3.1 rule | B: `cli` or empty: no 3.1 change |
| SP6 | App card proof: (a) bridged `ui://` renders; (b) app-originated call carries `_meta` the model cannot set; (c) the model cannot read the gate_render result `_meta`; (d) instructions canary forwarded; (e) MCP prompts listed as slash commands | probe app with a nonce in result `_meta`; ask the model to quote it; click; compare; a canary token in the instructions; list slash commands | A (a to c pass): build the app card (slice 4b); (d) pass: no tool-text copy | B: any of a to c fails: the refusal stays (OR-4 interim) and the card proof is redesigned; (d) fails: copy the Part 8 sentence into room_bind and room_list |
| SP7 (required) | Extension: bridged (prefix, parent); runtime (`node:sqlite` with `timeout`, `process.execPath`, the 367 detached runner from inside); `@scope` paths accepted by the installer; size and file limits; two servers in one manifest; install channel; Code tab loads it; quit survival | pack the probe plus a node_modules payload as `.mcpb`; install on Windows and macOS; run the legs; read the fingerprint | A: all legs pass: 3.7a as written; 3.7b not built. Two-server leg A: the shim may ride in the extension | B: any runtime or bridge leg fails: NEEDS_HUMAN to the owner with the evidence (3.7a end) [R2M8]. `@scope` refused: single-file bundle of JS dependencies in tools/mcpb, native sqlite-vec kept as files, then re-test. Size leg B (a 3.7a gate cannot be met or the installer limit is lower): to the owner with the measured numbers [R3B4]. Two-server leg B: shim only in the fallback |
| SP8 | Plugin `.mcp.json` remote server in the merged chat, web, mobile, cloud Code; card renders | theo-context entry in the probe plugin; method question in each place; screenshot | A: plugin route is the default | B: the claude.ai connector step is the chat route |

## 7. Slices (build order, OR-9)

Order (OR-9): slices 0 to 10 are the 405 foundation (slice 10 builds before slice 9 so theo-context ships in the 405 release, OR-8) [R3M7]; then the overlapping parts of Phases 401 and 402; then Phase 404 with chat as a target; then slice 11. Slices 4b, 5a, 5b and 6 are built or dropped by their spike verdicts; slice 9 releases what was built [IR3-N5].

Common gates for every code slice: `bash tests/run-all-405.sh`; `node scripts/build-connector-registry.cjs --check`; `node scripts/check-shape-declaration.cjs`; `node scripts/build-orchestration-projection.cjs --check`; `node scripts/check-render-coverage.cjs`; `node scripts/build-harness-manifest.cjs --check`; `node scripts/run-harness.cjs --check`; `node scripts/doctor.cjs --acceptance`; `node lib/mcp/no-instructions.test.cjs`; `node tests/test-359-prose-budget.cjs`; `node tests/test-270-tool-schema-budget.cjs`; `node scripts/build-skill-mirrors.cjs --check` when a command source changes [R2M19]; `tests/test-367-governed-census.cjs` and `tests/test-367-catchup-mcp.cjs` (groups ac2, ac8mcp) unchanged and green.

| # | Slice | Depends on | Acceptance criteria | Extra gates |
|---|---|---|---|---|
| 0 | Spikes | none | each SP: raw output, verdict, If line applied. LIVE | none |
| 1 | Capability facts and fingerprint (3.1) | SP5 for the rule | AC1.0 fingerprint keys present on a stdio fixture; no rooms-home path, no room text. AC1.1 env table maps the SP5 Code-tab value. AC1.2 parent probe per OS from fixtures (Linux `/proc`, macOS `ps`, Windows command string) with timeout gives `unknown`; status_read makes no spawn. AC1.3 host-salt created 0600; host_hash stable across calls. AC1.4 `sqlite_timeout_ok` true on the test runtime | wire snapshots unchanged |
| 2a | Fixture migration | 367 on main | AC2a.1 `tests/helpers/register-temp-room.cjs` exists; tests/test-405-fixture-helper-scan.cjs fails when a test that sets `MINDRIAN_ROOM` or `fallbackRoomDir` and writes does not use the helper (allowlist for read-only tests). AC2a.2 the suites step of run-all-405.sh is green before the rule lands | none |
| 2 | Positive-evidence rule (3.2) and `/mos:rooms adopt` (3.2a) | 2a | AC2.1 per source (session.primary, room-root, reg.active, boot-fallback default, cwd, operator pin) and per caller (12 sites plus room_bind, room_create): an unregistered target is refused inside `refusal` with `no_local_room_here`, `message`, `route_back`; no file or room.db under the test HOME. AC2.2 a registered room writes on every source; relative registry paths resolve. AC2.3 `cloud_session` true refuses birth. AC2.4 write_path_disabled first. AC2.5 hookless fixture: both texts carry the Code-tab sentence. AC2.6 `room-registry register` writes only the central registry entry with the absolute path; `/mos:rooms adopt` uses it, never resolve-room; the slug rule and the six typed refusals of 3.2a each from a fixture; F.1 declared; a fixture with an existing central registry and an unregistered room ends registered (the IR3-B1 case) | mirror check; shape declaration; connector registry |
| 3 | Receipts and idempotency (3.3) | 2 | AC3.1 six writers return the receipt (frontmatter fixture hash, rows, observed range, host_hash). AC3.2 seam (`MINDRIAN_TEST_MODE=1`, gate.cjs:1638 convention) alters the file: `read_back_mismatch`, file kept [IR2-N4]. AC3.3 artifact_file and graph_write: same id twice gives one file and one node, `replayed: true`; same id with another payload gives `client_write_id_conflict`; a `pending` row gives `write_in_progress`; a crash fixture resumes. AC3.4 memory_event, claim_write, gate_answer, room_create report their existing key. AC3.5 the migration adds `write_keys` and `mos_meta` once per room and is in the `_schemaStamp` specs. AC3.7 payload hash: the same arguments in another key order give the same hash; `client_write_id`, `room` and `_meta` do not change it. AC3.8 stale rule: a `pending` row with a dead owner pid on this host, or older than 120 s, is taken over and the call completes; a live owner gives `write_in_progress`. AC3.9 (OR-10) a fixture room with `writer_version_max` above this version refuses artifact_file, claim_write and a hook write with `room_schema_newer` and the update line; room_list and graph_query on it still answer; an equal or higher version writes and raises the row. AC3.6 fileEvidenceWithReadback callers unchanged | wire snapshots: `client_write_id` on 2 schemas and description text on 6, nothing else; test-270 AFTER updated with the measured delta |
| 4 | Material-approval rule (3.5) and PA-2 leg | 3 | AC4.1 hookless fixture, one row per material path: each `material_step` minter of 3.5 (approval-gate :102, never-do-gate :186, room-readiness-gate :103 and :143, chain :589, research :14 grant, deep_plan and basket, eureka-capability-jobs :288, startup-operations :55), claim and opportunity promotion (gate.cjs:238-255, proposed and needs_evidence), goal-gate ratification (goal-gate.cjs:241) and per renderer (`text`, `none`, `askuserquestion`): refused `human_confirmation_required`. AC4.2 an ordinary card passes with `mcp_relayed`. AC4.3 CLI fixture unchanged. AC4.4 Eureka engine start on a marked process refused `local_session_required`. AC4.5 new tests/test-405-census-bridge.cjs: env `MINDRIAN_MCP_FIRST=desktop`, `MINDRIAN_LAUNCHER=mcpb`, no `CLAUDE_CODE_ENTRYPOINT`; tools added by 405 = 0, so GOVERNED 69 and PURE_READ 7 are unchanged (PA-2) [R2M16] | 367 files unchanged |
| 4b | App click-proof card (3.5) | 4, SP6 = A | AC4b.1 nonce single-use, bound to gate and binding, 10 min TTL; `card_expired` after a restart fixture; `card_binding_mismatch`. AC4b.2 a nonce copied into tool arguments records `mcp_relayed`. AC4b.3 `routeOf` byte-unchanged. AC4b.4 on a hookless fixture, gate_render of every material card returns the `ui://mindrian-os/gate-card` resource and a nonce in result `_meta` only; on the CLI it renders as today | mindrian-mcp-app house rules; render coverage |
| 5a | `.mcpb` extension (3.7a) | 1, SP7 = A | AC5a.1 build from a fixture pack; manifest validates (mcpb CLI) with version, entry, runtimes, env incl. `${user_config.rooms_home}`. AC5a.2 checkMcpbPayload passes; no `.bin`, no symlink. AC5a.3 run-time read scan: every folder the server reads is in the payload. AC5a.4 the unpacked extension answers initialize and tools/list offline, and one call per class gives the same result as the plugin copy: artifact_file, room_list, an app view resource, a router tool that reads commands/. AC5a.5 the three sqlite-vec packages are present with integrity matching the shrinkwrap; the vector leg loads on the build host or degrades `vector_native_missing`. AC5a.10 the staged payload has no `next`, `react` or `react-dom` folder, and the AC5a.3 scan finds no kept file that requires them. AC5a.11 checkMcpbPayload numeric gates of 3.7a, with the measured counts printed. AC5a.6 marker rules: CLI fixture without the marker serves the full list and writes no heartbeat; with marker and CLAUDE_CODE_ENTRYPOINT one status tool. AC5a.7 heartbeat and `chat_reached`; doctor states from fixtures. AC5a.8 `install_versions` and `version_drift` in status_read and room_list. AC5a.9 setup's Desktop branch no longer writes a pinned config entry. LIVE Windows and macOS: click install, restart, merged chat lists room tools, doctor `desktop_loaded` and `chat_reached` true | tools/mcpb walled (test-341-shrinkwrap-no-dev green); doctor doc parity; mirror check |
| 5b | Config fallback and shim (3.7b, 3.6) | SP7 = B and the owner's answer | r2 ACs 5b.1 to 5b.5 (405-DESIGN-r2.md) | r2 gates |
| 6 | Shared-binding rule (3.9) | SP4 = A | AC6.1 marked fixture: each listed tool without `room` or with another slug refused `room_mismatch`. AC6.2 room_bind states the shared scope | wire snapshots: optional `room` on the listed tools; test-270 AFTER |
| 7 | Instructions and room_bind context (3.4, 3.6) | 3 (tests in tests/test-405-instructions-bind.cjs) | AC7.0 the exact THEO and LOOP strings of 3.6; served length 1999 (or measured at plan time, at most 2000); BOUNDARIES identical; test-359 MCP_THEO re-based with a dated OR-7 comment; contract-parity-larry.json:46 updated; `node scripts/run-harness.cjs --policy contract-parity-larry` green; header comment updated. AC7.1 room_bind carries the context summary with one 367 spawn. AC7.2 docs/CLAUDE-SURFACE-MODEL.md matrix updated. AC7.3 405-WEBSITE-HANDOFF.md updated. AC7.4 (only if SP6 d = B) the Part 8 sentence in room_bind and room_list | harness manifest regenerated |
| 8 | Parity and live proof | 1-7 | AC8.1 one fixture room through CLI and marked fixtures; the matrix printed. LIVE Windows and macOS: bind, file, receipt on failure only, doctor shows the node; a cloud Code session refuses with the cards sentence | none |
| 9 | Release (3.7a) [R2B6, R3B3, R3M3, R3M4] | 1 to 10 as built or dropped | AC9.1 build-desktop-artifact --check green. AC9.2 CHANGELOG. AC9.3 Step 6.8b builds `dist/mindrian-os-<v>.mcpb` and `dist/mindrian-os.mcpb` before the tag (reversible: the shared rollback deletes both); then `scripts/verify-release --mcpb dist/mindrian-os-<v>.mcpb` (new mode: the file exists and its manifest version equals plugin.json, else exit 1). The default verify-release (Steps 2 and 6.5, and inside doctor --acceptance at 6.6 and 9.8, release.sh:82-90) does not check the extension. Step 9.8 also runs `verify-release --mcpb`. `dist/` is in .gitignore [IR3-N4]. AC9.4 Step 9.x, after the push: `gh release view v<v> >/dev/null 2>&1 || gh release create v<v> --notes-file <CHANGELOG section> $( [[ <v> == *-* ]] && echo --prerelease )`, then `gh release upload v<v> dist/mindrian-os-<v>.mcpb dist/mindrian-os.mcpb --clobber`. Step 9.x warns and never aborts (the Step 9.6c precedent); RULE 7 recovery is a re-run of the step. The setup link is the tag URL `https://github.com/jsagir/mindrian-os-plugin/releases/download/v<v>/mindrian-os.mcpb`, printed by the doctor for the installed version (a betas-safe link; `latest` skips prereleases). GUESS: the repository is public. AC9.5 RULE 5 gains a new place for the extension asset (post-push, like the UI-shell reasoning), and .claude/includes/release-process.md drops its "all FIVE" count in favour of "every place in RULE 5" (navigator sign-off at plan time). AC9.6 tests/fixtures/341-release-step-block-hashes.txt and 310-release-step-block-hashes.txt re-based with navigator authorization. AC9.7 `real-room-run.cjs --desktop-verified win|mac` receipt gains `mcpb_chat_leg`. AC9.8 if SP7 = B and the owner chose no extension, slices 9 and 5a ship nothing for the extension and AC9.3, AC9.4 are skipped with a logged reason. AC9.9 a beta first (RULE 6). tests/test-405-release-steps.cjs checks the release.sh step text, the `--mcpb` mode on fixtures and the gh command line in dry-run | release gates |
| 10 | Theo cards (3.10) | 7, SP8 (builds before 9) | AC10.1 `.mcp.json` theo-context entry, no header, no secret; the mos-desktop copy carries it. AC10.2 the new literal of 3.10 item 4 in hooks/hooks.json (both rows) and BRAIN_SHAPED_TOOL_MATCHER; the six pinned tests and the route-matrix fixture updated; egress and sanitize matchers match `mcp__theo-context__x`, `mcp__plugin_mos_theo-context__x`, `mcp__plugin_mos-desktop_theo-context__x` and every earlier name. AC10.3 doctor probe sends one `initialize` only (fixture server asserts bodies); states yes, no (timeout), no (http_<code>), no (dns); configured plugin, user, none. AC10.4 room_list connect line (173 bytes) and route_back cards sentence. AC10.5 status_read.theo_cards. LIVE: a card in the merged chat and the Code tab; phone or web with no linked computer: no-room refusal plus a card | wire snapshot: room_list description only; test-270 AFTER for the description delta; Part 8 review of the matchers |
| 11 | End slice: commands work in chat (OR-9) | Phase 404 with chat as target | AC11.1 the 404 pilot recipes (challenge-assumptions, root-cause) run from the merged chat through the extension and file a receipt. LIVE | 404 gates |

## 8. File table

| Slice | Create | Modify |
|---|---|---|
| 0 | 405-SPIKES.md; probe changes on work/367-spike-kits (coordinate) | none |
| 1 | tests/test-405-capability-facts.cjs, tests/fixtures/405/env.json, tests/run-all-405.sh | lib/mcp/surface-detect.cjs, lib/mcp/tools/status.cjs, scripts/mindrian-mcp-server.cjs (start-time parent probe) |
| 2a | tests/helpers/register-temp-room.cjs, tests/test-405-fixture-helper-scan.cjs | the writing test files that set MINDRIAN_ROOM or fallbackRoomDir |
| 2 | tests/test-405-registered-room.cjs, tests/test-405-rooms-adopt.cjs | lib/mcp/session-room.cjs, lib/core/resolve-active-room.cjs (export readRegistry), lib/mcp/tool-router.cjs (room_bind), lib/mcp/startup-operations.cjs, scripts/room-registry (`register`), commands/rooms.md, skills/rooms/SKILL.md (mirror), the connector registry source as the builder requires |
| 3 | lib/core/navigation/write-keys.cjs, lib/core/migrations/405-write-keys-and-meta.cjs, tests/test-405-receipt.cjs | lib/core/room-db.cjs (require the migration, `_schemaStamp` specs, the OR-10 write-open check), lib/core/navigation/file-evidence-readback.cjs, lib/core/navigation.cjs, lib/mcp/tools/views.cjs, claim.cjs, graph.cjs, gate.cjs, lib/mcp/startup-operations.cjs, tests/fixtures/267/wire-snapshot-zod3.json and zod4.json, tests/test-270-tool-schema-budget.cjs |
| 4 | tests/test-405-gate-human-check.cjs, tests/test-405-census-bridge.cjs | lib/mcp/tools/gate.cjs (isMaterialApproval), the Eureka start tools (local_session_required) |
| 4b | lib/mcp/app-nonce-store.cjs, the `ui://mindrian-os/gate-card` view (mindrian-mcp-app rules), tests/test-405-app-card.cjs | lib/mcp/answer-route.cjs (appRouteOf), lib/mcp/gate-render.cjs, lib/mcp/app-views.cjs |
| 5a | scripts/mcpb-entry.cjs, tools/mcpb/package.json, tools/mcpb/package-lock.json, tools/mcpb/manifest.template.json, scripts/release-lib/build-mcpb.cjs, lib/core/doctor/desktop-bridge-module.cjs, tests/test-405-mcpb.cjs, tests/test-405-mcpb-runtime-reads.cjs | scripts/mindrian-mcp-server.cjs (marker, heartbeat, chat_reached), lib/mcp/tools/status.cjs, lib/mcp/tools/room.cjs, data/doctor-modules.json, commands/doctor.md, commands/setup.md, skills/setup/SKILL.md |
| 5b | as r2 | as r2 |
| 6 | tests/test-405-shared-binding.cjs | the tool files of 3.9, lib/mcp/tool-router.cjs, tests/test-270-tool-schema-budget.cjs, wire snapshots |
| 7 | tests/test-405-instructions-bind.cjs | lib/mcp/runtime-instructions.cjs, tests/test-359-prose-budget.cjs, data/harness-policies/contract-parity-larry.json, data/harness-manifest.json, lib/mcp/tool-router.cjs, docs/CLAUDE-SURFACE-MODEL.md, 405-WEBSITE-HANDOFF.md |
| 8 | tests/test-405-parity.cjs | none |
| 9 | tests/test-405-release-steps.cjs | scripts/release.sh (Step 6.8b, Step 9.x, rollback, Step 9.8 `--mcpb`), scripts/verify-release (`--mcpb` mode), .gitignore (`dist/`), docs/RELEASE-CEREMONY-RULING-SYSTEM.md (RULE 5 new place), .claude/includes/release-process.md (count removed), tests/fixtures/341-release-step-block-hashes.txt, tests/fixtures/310-release-step-block-hashes.txt, scripts/real-room-run.cjs, CHANGELOG.md |
| 10 | tests/test-405-theo-cards.cjs, tests/fixtures/405/theo-probe-server.cjs, lib/core/doctor/theo-context-module.cjs | .mcp.json, hooks/hooks.json (rows :208 and :332), lib/core/brain-response-sanitize.cjs (BRAIN_SHAPED_TOOL_MATCHER), tests/test-260906-gr1-brain-shaped-tool-gate.cjs, tests/test-396-theo-route-matrix.cjs, tests/test-396-bypass-5-theo-tool-arms.cjs, scripts/part8-egress-guard-hook.test.cjs, tests/test-brain-response-sanitize.cjs, tests/fixtures/392-part8-replay/route-matrix.json, data/doctor-modules.json, lib/mcp/tools/room.cjs, lib/mcp/session-room.cjs, lib/mcp/tools/status.cjs, commands/setup.md, skills/setup/SKILL.md, tests/test-270-tool-schema-budget.cjs |
| 11 | per Phase 404 plan | per Phase 404 plan |

Part 11: no new tool name. New invocable surface: the `adopt` subcommand of `/mos:rooms` (F.1 declared, born wired).

## 9. AC-to-test map and tests/run-all-405.sh [IR2-N7]

| AC | Test file |
|---|---|
| AC1.0-AC1.4 | tests/test-405-capability-facts.cjs |
| AC2a.1 | tests/test-405-fixture-helper-scan.cjs |
| AC2a.2 | tests/run-all-405.sh step "suites" |
| AC2.1-AC2.5 | tests/test-405-registered-room.cjs |
| AC2.6 | tests/test-405-rooms-adopt.cjs |
| AC3.1-AC3.9 | tests/test-405-receipt.cjs |
| AC4.1-AC4.4 | tests/test-405-gate-human-check.cjs |
| AC4.5 | tests/test-405-census-bridge.cjs |
| AC4b.1-AC4b.4 | tests/test-405-app-card.cjs |
| AC5a.1-AC5a.2, AC5a.4-AC5a.11 | tests/test-405-mcpb.cjs |
| AC5a.3 | tests/test-405-mcpb-runtime-reads.cjs |
| AC6.1-AC6.2 | tests/test-405-shared-binding.cjs |
| AC7.0-AC7.4 | tests/test-405-instructions-bind.cjs (AC7.0 also runs lib/mcp/no-instructions.test.cjs, tests/test-359-prose-budget.cjs and `node scripts/run-harness.cjs --policy contract-parity-larry`; AC7.2 and AC7.3 check the two doc files for the named lines) |
| AC8.1 | tests/test-405-parity.cjs |
| AC9.1-AC9.8 | tests/test-405-release-steps.cjs, tests/run-all-341.sh |
| AC10.1-AC10.5 | tests/test-405-theo-cards.cjs |

tests/run-all-405.sh (contents; the 405 tests skip with a printed reason when their slice has not landed):

```bash
#!/usr/bin/env bash
# Phase 405 floor. Run from the repo root. A 405 test whose slice has not landed SKIPs;
# a pinned neighbour that is missing FAILs (PA-1 condition 4 cannot pass by skip).
set -u
PASS=0; FAIL=0; SKIP=0
own()  { local f="$1"; if [ ! -f "$f" ]; then echo "SKIP $f (slice not landed)"; SKIP=$((SKIP+1)); return; fi
  if node "$f"; then PASS=$((PASS+1)); else echo "FAIL $f"; FAIL=$((FAIL+1)); fi; }
pin()  { local f="$1"; shift; if [ ! -f "$f" ]; then echo "FAIL $f (pinned neighbour missing)"; FAIL=$((FAIL+1)); return; fi
  if node "$f" "$@"; then PASS=$((PASS+1)); else echo "FAIL $f $*"; FAIL=$((FAIL+1)); fi; }
suite(){ local f="$1"; if [ ! -f "$f" ]; then echo "FAIL $f (suite missing)"; FAIL=$((FAIL+1)); return; fi
  if bash "$f"; then PASS=$((PASS+1)); else echo "FAIL $f"; FAIL=$((FAIL+1)); fi; }
# 405 tests
for t in tests/test-405-capability-facts.cjs tests/test-405-fixture-helper-scan.cjs tests/test-405-registered-room.cjs \
         tests/test-405-rooms-adopt.cjs tests/test-405-receipt.cjs tests/test-405-gate-human-check.cjs \
         tests/test-405-census-bridge.cjs tests/test-405-app-card.cjs tests/test-405-mcpb.cjs \
         tests/test-405-mcpb-runtime-reads.cjs tests/test-405-shared-binding.cjs tests/test-405-instructions-bind.cjs \
         tests/test-405-parity.cjs tests/test-405-release-steps.cjs tests/test-405-theo-cards.cjs; do own "$t"; done
# Pinned neighbours (must exist; 367 files exist once 367-11/12 are on main, PA-1)
pin lib/mcp/no-instructions.test.cjs
pin tests/test-359-prose-budget.cjs
pin tests/test-270-tool-schema-budget.cjs
pin tests/test-367-governed-census.cjs
pin tests/test-367-catchup-mcp.cjs ac2
pin tests/test-367-catchup-mcp.cjs ac8mcp
pin tests/test-desktop-stdio-session-binding.cjs
pin tests/test-room-state-no-registry-regression.cjs
# Suites step (AC2a.2)
suite tests/run-all-369.1.sh
node scripts/run-harness.cjs --policy contract-parity-larry && PASS=$((PASS+1)) || { echo "FAIL harness contract-parity-larry"; FAIL=$((FAIL+1)); }
echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP"
[ "$FAIL" -eq 0 ]
```
```

The 367 catchup test takes the group as argv[2] (367 branch tests/test-367-catchup-mcp.cjs:15, :553). There is no tests/run-all-367*.sh and no 400.3 run-all on this base, so 3.2's suite list is corrected to the files above plus tests/run-all-369.1.sh [R3M8].

## 10. Interaction with other phases

- 367 (jsagi-42): build after 367-11 and 367-12 reach origin/main (PA-1). PA-2 leg in tests/test-405-census-bridge.cjs; the 367 census file is not edited.
- 401, 402: after slices 0 to 9 (OR-9). 402 owns alwaysLoad and deferral (R14 tool overlap).
- 404: after 401 and 402 overlap work, with chat as a named target; slice 11 depends on it (OR-9).
- Theo repo: B2.3 hand-off only.
- 400.3: slice 3 adds the receipt after the 400.3 index (views.cjs:592-597).
- SEED-039: slice 6 is its bridge face.

## 11. Risks (in order)

- R1 The bridge is observed on one Windows machine; slices 5a and 8 add macOS.
- R2 With no SP3 marker, a first-room birth can still happen in a cloud VM when no registry exists there.
- R3 Pins outside the registry stop writing (OR-5); `/mos:rooms adopt` is the fix.
- R4 Part 8 with theo-context and claude.ai Theo connectors holds by text (OR-7).
- R5 Until the app card exists, ordinary approvals on P4 are model-relayable (OR-4 interim, `mcp_relayed`).
- R6 The fixture migration of slice 2a touches about 104 test files.
- R7 Description bytes grow on six tools (measured in slice 3; test-270 AFTER).
- R8 An injected call can write into a registered room; receipts disclose.
- R9 The extension and the plugin copies can drift; drift is reported in chat (3.7a) and an older copy cannot write (3.11, OR-10). A person who rolls back on purpose must update again before saving.
- R10 The app card adds a bearer nonce path; it is void if the model can read the result `_meta` (SP6 c).
- R11 Several facts rest on secondary sources (S); the fingerprint or a spike confirms each before a slice depends on it.
- R12 Desktop's built-in runtime may lack `node:sqlite` `timeout` or a usable `process.execPath` (SP7; owner question on B).
- R13 sqlite-vec per-OS packages enlarge the artifact; the vector leg may degrade.
- R14 Tool overlap: plugin theo-context, user-scope theo-context and the claude.ai connector can all be present.
- R15 theo-context outage removes the cards everywhere; doctor shows it; Larry says so.
- R17 The `next`/`react` removal relies on the AC5a.3 scan; a missed dynamic require would fail at run time (AC5a.4 calls one tool per class).
- R16 An unsigned extension can be blocked by admin policy or impersonated, if `mcpb sign` is not available.

## 12. Workflow from here

1. EGM design is complete when one Goldfish round is clean (no Blocker, no Major left open). r4.1 resolves the round-3 codebase-details review when it arrives; then a narrow round 4 checks only the sections r4 and r4.1 changed.
2. Then a thin `/gsd-plan-phase 405`: the planner reads 405-CONTEXT.md, 405-RESEARCH.md and this design, not the conversation. One plan per slice. The plan checker runs. GSD research and discuss are replaced by the EGM record (no new RESEARCH or CONTEXT is written by GSD).
3. Plan and run slice 0 (the spikes) first. Record every verdict in 405-SPIKES.md and apply its If A or If B line to this design (a dated r4.x note per change).
4. Re-plan the build slices after the spike verdicts. A spike whose If B goes to the owner (SP7 runtime or size) stops the dependent slices until the owner answers.
5. Build only after 367-11 and 367-12 are on origin/main (PA-1 condition 1). Order per OR-9: slices 1 to 10 (10 before 9), then the overlapping parts of 401 and 402, then 404 with chat as a target, then slice 11.
6. Each slice ends with its gates (section 7) green and a SUMMARY that records agent runs, tokens and findings (project CLAUDE.md EGM note).
