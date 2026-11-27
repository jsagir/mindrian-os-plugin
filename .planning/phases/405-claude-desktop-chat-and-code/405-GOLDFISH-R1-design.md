---
phase: 405
round: 1
reviewer: egm-design (design critic, architecture and failure modes)
target: 405-DESIGN.md r1
counts: {blocker: 3, major: 9, nit: 5}
note: "The reviewer is read-only; the main session saved its report verbatim (findings section)."
---

# 405 GOLDFISH R1: design critic (architecture and failure modes)

Target: 405-DESIGN.md r1. Mode: REVIEW. The owner rulings OR-1 to OR-3 are treated as locked.

## Blockers

### DC-B1 (Blocker): Part 9. On P4 the cloud model can approve its own gate, and the design only records that it did
- Section: 3.4 row "card-before-answer", R7, slice 4 AC4.3.
- Evidence: RESEARCH section 3 says the "model answered for the human" check exists only as a hook (card-before-answer-hook.cjs). Hooks do not run in the merged chat (CONTEXT fact 4). The design changes this to "record, not block": `answer_channel: text` goes on the decision node and the doctor counts it later. gate_answer approve writes a decision node (gate.cjs:1612). room_create approve and recovery cards use the same path. On P4 the model can therefore call gate_answer approve with no human in the loop, and the result is a recorded decision. Part 9 says only a human confirms, and 367 OR-1 treats an answered card as a confirmed decision. A count after the fact does not enforce Part 9.
- Fix: On `desktop_bridge` and `unknown`, a gate_answer approve that is not server-attested must not produce a confirmed decision. Option (a): refuse it with a typed reason (`human_confirmation_required`) and send the card through elicitation. Option (b): write the decision node as `review_status: proposed` and keep the gate open until an attested channel or a local session confirms it. For room_create approve on P4, require (a). Add a spike for elicitation through the bridge (see DC-M7). If elicitation does not pass through the bridge, state that P4 cannot confirm decisions, and give the route back to P2.

### DC-B2 (Blocker): The honest refusal fails open. A VM clone or an `unknown` place can still write a room
- Section: 3.2, 3.1, slice 2.
- Evidence: 3.2 refuses writes only when `place === code_cloud`. It also limits `boot-fallback` and `room-root` only under `code_cloud`. The `code_cloud` marker is a GUESS (`CLAUDE_CODE_REMOTE`, pinned by SP3). The Desktop-parent rule for `desktop_bridge` is also unspiked. If detection returns `unknown`, every current write path stays open, including `room-root`, the cwd walk-up through a `.room-root` file in a cloned repo (session-room.cjs:247-248), and `boot-fallback` (:258-261), which accepts any directory that exists. A synced plugin's stdio server does start in cloud sessions (radar 2026-10-19, Claude Code 2.1.304). Goal 3 says MindrianOS "never writes a room somewhere the user cannot see". The design meets that goal only when the GUESS markers are correct.
- Fix: Allow writes on positive local evidence only, never on the absence of a cloud marker. Allow governed writes only when place is `cli`, `code_local` or `desktop_bridge` and the target realpath is under a registered rooms home. Refuse `unknown` with `no_local_room_here` or a new `place_unknown`. Add AC2.4: under the `unknown` fixture with a `.room-root` in cwd, every governed write is refused and no file is created.

### DC-B3 (Blocker): A model that lost the response cannot use the lost-response recovery
- Section: 3.3 (`change_seq` bullet and the instructions clause), R2, hats answer 1, AC3.3.
- Evidence: The receipt carries `change_seq`. The model is told to call `room_changes` with `after: change_seq - 1`. When the response is lost, the model never receives `change_seq`, so it has no cursor. When a shared process serves other chats (3.7), or a CLI session writes the same room, `change_seq - 1` is not tied to this write. The design has no idempotency key, so a retry after a lost response creates a second artifact and a second claim node. AC3.3 tests only the case where the response arrived.
- Fix: Add an optional `client_write_id` (a model-generated id) to each governed write tool (a parameter, not a new tool, so Part 11 is not affected). Store the id on the change-feed row. A repeated id returns the first receipt and does not write again. Let `room_changes` filter by `client_write_id`. Instructions clause: "Send a client_write_id with each write. If a write returns no result, call room_changes with that id before you retry." Add an AC that drops the response, retries with the same id, and checks for exactly one artifact and one node.

## Majors

### DC-M1 (Major): No threat model for a cloud model that drives a local server with the user's privileges
- Section: missing; closest to 3.3, 3.6 and 10.
- Evidence: On P4 a model in the Anthropic cloud sandbox calls a stdio process on the user's computer that runs as the user and writes files and room.db (radar Q2; field evidence A1, A2). The cloud context can hold untrusted text (web pages, uploads, other connectors' output) that can inject tool calls. Web and mobile sessions on a linked computer can drive the same server (radar 17444462). The design does not list which tools the bridge exposes or which can choose a path (room_create), run a process (research_run, the Eureka engine, the 367 runner spawn) or reach the network, nor what `writeFileContained` contains against. `~/.mindrian/desktop/mos-server.cjs` (3.6) is a user-writable file that Desktop runs at each start and that `require`s whatever the resolver finds: a persistence and code-load point.
- Fix: Add "3.8 Bridge threat model": assets (room.db, room files, rooms home, registry); actors (cloud model, injected content, a linked phone or web session); the tool inventory on `desktop_bridge` classed read / governed write / path-choosing / process-spawning / network, with a default per class. Suggested defaults: path-choosing and spawn tools need an attested human gate (DC-B1); writes stay under the registered rooms home; the launcher resolves only to a signed or version-matched install path. State the residual risk per item.

### DC-M2 (Major): On one shared bridge process, chat B writes into the room that chat A bound
- Section: 3.7, R3, slice 6.
- Evidence: Desktop exports no session id; the server mints one process key `stdio-<pid>-<hex>` (session-binding.cjs:194-203, RESEARCH 2.2). `session.primary` is shared by every chat that uses the process. Chat B can file into chat A's room without a bind; a `room_bind` from chat B moves chat A's target mid-sequence. Disclosure comes after the write. The model can carry the room itself.
- Fix: On `desktop_bridge`, require an explicit `room` (slug or room_id) argument on each governed write; refuse with `room_mismatch` when missing or different from the process binding, regardless of SP4. Add "explicit room per write" to the alternatives table.

### DC-M3 (Major): Part 8 in chat: the shim's lexicon check can run against the wrong room, and the response sanitizer is missing
- Section: 3.5, R4.
- Evidence: Without `CLAUDE_CODE_SESSION_ID`, the shim checks the lexicon against the machine-global active room (mindrian-brain-mcp-client.cjs:110-131), which can differ from the chat's room, so egress can pass undetected. "Read the mindrian-os binding for the same process tree" is a GUESS; the two servers are siblings with no shared key, and SP4 does not test discovery. The PostToolUse brain-response-sanitize hook has no shim equivalent (RESEARCH 3, UNVERIFIED 20). Account Theo connectors stay guarded by text only.
- Fix: (a) On P4 check the lexicon against the union of rooms under the rooms home, or the room named in the call (DC-M2), never the active pointer alone. (b) Move sanitize into the shim's in-process response path; add to slice 5 with an AC. (c) Spike leg: start both servers from one Desktop and record how the shim can find the mindrian-os binding. (d) Doctor warns when a claude.ai Theo connector is enabled, if detectable; else say so in R4.

### DC-M4 (Major): The pulled duties and the Part 8 text guard depend on instructions forwarding (UNVERIFIED, SP6)
- Section: 3.3, 3.4, 3.5, 6 SP6 "Blocks".
- Evidence: RESEARCH 2.3: UNVERIFIED whether the merged chat forwards the server `instructions`. SP6 "Blocks" lists only the 3.3 clause and dashboards; the 3.5 Theo clause (the only Part 8 control for account connectors in chat) and the 3.4 rows (context at start, Stop close-out, navigation) also need it. No fallback.
- Fix: Add 3.4 and 3.5 to SP6 "Blocks". Fallback: repeat the Part 8 clause and the receipt clause in the descriptions of the tools that need them; keep within the instructions byte budget test (AC7.1).

### DC-M5 (Major): The receipt says "the user's disk" but cannot tell which disk
- Section: 1 (item 2), 3.3 receipt shape.
- Evidence: The receipt `{room_id, read_back, file{path, sha256, bytes}, nodes, change_seq}` has no host. If the server runs in the VM (UNVERIFIED 2), the read-back passes against the VM disk: the 2.1.300 failure again.
- Fix: Add `host: {place, hostname_hash, rooms_home_realpath}`. When `place` is not local, `read_back: false`, `reason: 'not_user_disk'`. SP1 records the same fields.

### DC-M6 (Major): Desktop closed mid-call: no behaviour for a partial write or a P4 chat that turns into P5
- Section: 3.3, 3.2, R2, hats answer 3.
- Evidence: artifact_file runs file write, event log, claim node, index (views.cjs:537-600). A kill between steps leaves a file with no claim or index and no receipt. R2 is a GUESS. A2 shows a detached child survives a quit, not that the server does. When the bridge drops mid-conversation the guard line ("if no room_list tool is connected") does not cover listed-but-failing tools; the model may fall back to skill bash in the cloud sandbox (UNVERIFIED 16).
- Fix: (a) Order each governed write so a kill leaves a state the 367 runner or doctor can detect and finish (a pending-write journal row before the file, cleared at the end). (b) The shutdown handler (registerShutdownHandler, mindrian-mcp-server.cjs:146) finishes the current write when stdin closes. (c) Guard line: "If a room tool call fails or no room tool is connected, do not run room scripts." (d) SP2 leg kills the server process between file write and claim.

### DC-M7 (Major): UNVERIFIED items with no spike
- Section: 3.1, 3.4, 3.5, 6.
- Evidence: (1) `answer_channel: elicitation` is the only attested channel; no spike tests elicitation through the bridge. (2) `desktop_bridge` comes from "a Desktop-app parent"; no spike records parent process name on Windows or macOS (SP1 logs no ppid). (3) 3.5 needs a shared key between the two Desktop-spawned servers (GUESS); SP4 checks one server only.
- Fix: Extend SP1, SP4, SP6: record ppid, parent executable and command line on Windows and macOS; a probe tool that uses `elicitInput` in a merged chat; two servers from one config, can either see the other. Add each to "Blocks".

### DC-M8 (Major): Install read-back proves the file was written, not that Desktop loads it
- Section: 3.6, slice 5 (AC5.1 to AC5.4).
- Evidence: desktop-config.cjs writes, reads back and compares; the doctor spawns the launcher itself. Neither shows Desktop reads the file. ASSUMED: a packaged (MSIX-style) Windows install reads config from a virtualized folder. No restart step; admin policy denial (R6) undetected.
- Fix: Launcher writes a heartbeat (timestamp, ppid, parent exe) at each start; doctor reports `desktop_loaded: true` only on a Desktop-parent heartbeat after the config write. Take the Windows path from the A1/A2 machine; add the packaged path as a second candidate. HITL step tells the person to restart Desktop. Typed doctor state "config present, never loaded".

### DC-M9 (Major): The receipt covers 6 tools, but G3 says "every governed write"
- Section: 1 (item 2), G3, 3.3, AC3.1.
- Evidence: The 367 wrapper has its own GOVERNED set (graph-catchup-spawn.cjs:40, branch). Not reconciled; other governed writes on P4 return no receipt while the instructions say to expect one.
- Fix: Derive the receipt list from the same GOVERNED set; add a census test that fails when a GOVERNED write returns no `receipt`. Or narrow G3 and list the rest as DEGRADED in the doctor.

## Nits

- DC-N1 (Nit, 3.3): Part 12. "Show the receipt in one line" after every write pulls attention to the machine. Fix: show it only when `read_back` is false or the room differs; otherwise name the room in the normal reply.
- DC-N2 (Nit, 3.3): Hash the exact buffer passed to `writeFileContained`, not the input content (artifact_file adds frontmatter, views.cjs:248-251).
- DC-N3 (Nit, 3.4, AC4.1): A `code_local` session mis-detected as `desktop_bridge` writes presence rows twice; many chats on one bridge each start a 367 runner. Fix: AC with the `code_local` fixture expecting 0 presence rows; record the 367 runner's per-room lock or debounce in section 9 as a dependency.
- DC-N4 (Nit, 5): Option E pending SP1, may replace A; A is "field-observed once on Windows"; add the explicit-room row.
- DC-N5 (Nit, 7): Slice 3 depends on SP1 and SP2 for its P4 fields and ACs; the CLI half can be built first.

## Reviewer notes

VERIFIED by the reviewer: mindrian-brain-mcp-client.cjs:127-131 returns `machine_global` when there is no session id; session-room.cjs:290-301 refuses `reg.active` only with a session identity and accepts any existing `boot-fallback` directory; gate.cjs:1517 uses elicitation only when the client declares it.
UNVERIFIED: the Windows packaged-install config path (DC-M8), the GOVERNED list on the 367 branch (DC-M9), whether Desktop kills the config server on quit (DC-M6).
