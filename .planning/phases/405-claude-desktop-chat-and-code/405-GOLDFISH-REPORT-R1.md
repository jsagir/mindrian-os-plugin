---
phase: 405
round: 1
target: 405-DESIGN-r1.md
reviewers:
  design_critic: completed (3 Blocker, 9 Major, 5 Nit) - 405-GOLDFISH-R1-design.md
  zoom_out: completed (0 Blocker, 6 Major, 5 Nit) - 405-GOLDFISH-R1-zoom-out.md
  implementation_readiness: completed (3 Blocker, 11 Major, 7 Nit) - 405-GOLDFISH-R1-implementation-readiness.md
  codebase_details: completed (3 Blocker, 13 Major, 13 Nit) - 405-GOLDFISH-R1-codebase-details.md
raw_counts: {blocker: 9, major: 39, nit: 30}
merged_counts: {blocker: 7, major: 15}
outcomes: {FIXED: 19, CUT: 2, CONTESTED: 1, OWNER: 0}
owner_items: 6 (O1 to O5 ruled as OR-4 to OR-7; O6 open)
extra_input: 405-BRIDGES.md (owner-requested bridge ideas; secondary sources marked S)
clean_round: false
next: 405-DESIGN.md (revision 2), then round 2
---

# 405 Goldfish round 1: resolution

Outcome rule: each merged Blocker and Major has one outcome: FIXED (in r2), CUT (with reason), CONTESTED (evidence), OWNER (only the owner can answer). Owner items that remain after a FIXED default are listed separately.

## Blockers

| Id | Source ids | Finding | Outcome | Where in r2 / evidence |
|---|---|---|---|---|
| GB1 | DC-B1, CD-M6 | On P4 the model can approve its own gate; r1 only recorded it | FIXED | 3.5: the elicitation path is already guarded (gate.cjs:1652-1675, `card_pending`); r2 refuses text-rung approves of room_create and claim cards with `human_confirmation_required` when no host can attest. Candidate replacement: B3.2, an MCP App gate card proved by the existing browser_nonce route (answer-route.cjs), built only if SP6 legs a-c pass. Fallback for ordinary cards: O1 |
| GB2 | DC-B2, CD-B2, CD-M3, ZO-M6, IR-M11 | The no-room refusal fails open (GUESS marker; cwd, reg.active, `./room` default; room_create and room_bind bypass resolveMcpWriteRoom) | FIXED | 3.2: positive rule `isRegisteredLocalRoom` in classifyMcpWriteRoom, room_bind and the birth leg; slice 2 AC2.1 covers all 13 callers plus room_bind and room_create |
| GB3 | DC-B3, IR-M4, CD-M4 | A model that lost the response has no cursor; retry writes twice | FIXED | 3.3: optional `client_write_id`; a repeat returns the first receipt (`replayed: true`); change range from readChangeLogMeta; AC3.3 |
| GB4 | IR-B1 | Spikes have no decision rule | FIXED | section 6: If A then / If B then per spike |
| GB5 | IR-B2, CD-B3, DC-M4 | Instructions already at 2000 bytes; new clauses had no trim; forwarding UNVERIFIED | FIXED | 3.3, section 4: instructions unchanged (measured 2000 bytes); clauses moved to tool descriptions (173 and 131 bytes, measured) |
| GB6 | IR-B3, CD-M7 | Skills guard line has no working mechanism | CUT | The fence moved into the server and the room scripts (3.2). The chat skill bridge is Phase 404 recipes (B1.2; O6). Reopened only if SP1 shows skill bash sees CLAUDE_PLUGIN_ROOT in the VM; then the mechanism is scripts/stamp-firing-block.cjs (named in SP1 "If B") |
| GB7 | CD-B1, IR-M3 | sha256 of the sent content fails after injectArtifactId | FIXED | 3.3: hash of the bytes read back after injectArtifactId (views.cjs:287-292); AC3.1 uses a frontmatter fixture |

## Majors

| Id | Source ids | Finding | Outcome | Where in r2 / evidence |
|---|---|---|---|---|
| GM1 | DC-M1 | No bridge threat model | FIXED | 3.8 |
| GM2 | DC-M2, CD-N8, IR-N4 | Shared process: chat B writes into chat A's room | FIXED | 3.9 with SP4 If A/If B; receipt carries `room_id` and `room_slug` |
| GM3 | DC-M3, IR-M10, CD-M11, ZO-N3 | Shim lexicon runs against the wrong room; sanitize missing | FIXED | 3.6: union of registered-room lexicons when no session id (no sibling discovery, session-binding.cjs:184-187); sanitize through lib/core/brain-response-sanitize.cjs; AC5.6, AC5.7. Connector residual: O4 |
| GM4 | DC-M5 | Receipt cannot tell which disk | FIXED | 3.3 receipt carries room id and slug of a registered room; 3.2 refuses any unregistered target, so a VM path cannot produce `read_back: true` |
| GM5 | DC-M6 | Desktop quit mid-call leaves a partial write | CONTESTED | artifact_file writes the file first (views.cjs:284) and the rows after (:319, :335-415); the 367 runner indexes any content file without a node at the next trigger (367-DESIGN 5.2 step 7), and `client_write_id` makes the retry safe. SP2 kills the server between file and row; "If B" adds a pending-write journal |
| GM6 | DC-M7 | Elicitation, parent process and two-server legs have no spike | FIXED | slice 1 ships a read-only surface fingerprint (B3.1) that answers the value legs (clientInfo, capabilities, parent) on every tester install; SP6 tests the app-card and elicitation legs; sibling discovery dropped (GM3) |
| GM7 | DC-M8 | Install read-back does not prove Desktop loads it | FIXED | 3.7: heartbeat with parent exe; doctor `desktop_loaded` and `config_present_never_loaded`; restart step |
| GM8 | DC-M9, CD-M12, IR-M5 | Receipt covers 6 tools while G3 says every write; wrong file paths | FIXED | G3 narrowed to six named writers with corrected paths (room_create startup.cjs:11 and startup-operations.cjs:44-86; graph_write graph.cjs:217); others DEGRADED in the doctor |
| GM9 | ZO-M1, CD-M1, CD-N7, CD-N10, IR-N2 | 6-value place enum without a consumer; arbitration is not a live consumer | FIXED | 3.1: zoom-out minimal path chosen; no enum, no statusline change; `apps` kept for the Code tab (capability-registry.cjs:50-56) |
| GM10 | ZO-M2, ZO-M3, IR-M7, IR-M8, CD-M8, CD-M9, CD-M10 | Install path repeats existing parts; setup routing bug; Code-tab collision; node, OS, WSL unspecified; SP1 dependency | FIXED | 3.7: dropped if SP1 = A; `/mos:setup desktop`; dispatch shims like statusline-mos-dispatch registered in data/deployment-surfaces.json; doctor reuses mcp-surface spawn helper; distinct entry names plus responder on Code tab; literal entry shape, node rule, OS paths, WSL refusal |
| GM11 | ZO-M4, CD-M5 | Build the receipt from existing parts; drop sha256 | FIXED | 3.3: rows via one extracted readBackRows (file-evidence-readback.cjs:118-148), change range via readChangeLogMeta. sha256 KEPT, decided with evidence: the server transforms the content (CD-B1), so only a hash of the final file names the landed bytes |
| GM12 | ZO-M5, CD-M13, IR-M9, ZO-N1, DC-N3 | Presence duty, postCall list, next_move: no consumer, frozen EVENT_TYPES | CUT | No consumer in the room for a presence row; memory-events.cjs:10 is frozen; suggest_next already in the instructions (runtime-instructions.cjs:37). PA-1 stays available, not exercised |
| GM13 | IR-M1 | No gates per slice; wire snapshots claimed unchanged | FIXED | section 7: common gates plus an extra-gates column; slice 3 and 6 state the expected snapshot diff |
| GM14 | IR-M2 | No release slice | FIXED | slice 9 |
| GM15 | IR-M6, CD-M2 | Unknown bridge client name disables every write | FIXED | 3.7: bridge entries set `MINDRIAN_MCP_FIRST=desktop` (mcp-first-flag.cjs:131-136); SP1 records the client name; AC2.4 keeps the refusal order |

## Nits

| Id | Outcome |
|---|---|
| DC-N1, ZO-N5 (Part 12 receipt display) | FIXED (3.3: receipt shown only on failure) |
| DC-N2 (hash the final buffer) | FIXED (GB7) |
| DC-N3 (double presence) | CUT with GM12 |
| DC-N4 (option E, explicit room row) | FIXED (section 5 rows E, F) |
| DC-N5 (slice 3 CLI half first) | FIXED (slice 3 depends only on slice 2) |
| ZO-N1 (next_move) | CUT with GM12 |
| ZO-N2 (census leg) | CONTESTED: PA-2 (405-CONTEXT) accepted the leg with jsagi-42; kept as a fixture leg |
| ZO-N3 (shim binding read) | FIXED with GM3 (no binding read) |
| ZO-N4 (SP3 timing) | FIXED (SP3 env and disk only) |
| IR-N1 (run-all and AC map) | FIXED in part (run-all-405.sh in slice 1; the AC-to-test map is the planner's file table, section 8) |
| IR-N2 (env fixture table) | FIXED by reference (slice 1 AC1.1; table written at plan time from SP5 values) |
| IR-N3 (test seam guard) | FIXED (AC3.2 `NODE_ENV=test`) |
| IR-N4 (slug vs id) | FIXED (receipt carries both) |
| IR-N5 (macOS LIVE, hand-off sections) | FIXED (slice 8, AC7.3) |
| IR-N6 (300-byte measure) | CUT with GM12 |
| IR-N7 (doctor doc parity) | FIXED (slice 5 extra gates) |
| CD-N1 to CD-N5, CD-N11 (line corrections) | FIXED in 405-RESEARCH.md (marked CORRECTED) and r2 cites |
| CD-N6 (readClientIdentity) | FIXED (3.1, 3.5) |
| CD-N7 (CLAUDE_DESKTOP, uppercase) | FIXED (noted in RESEARCH 2.1; no statusline change in r2) |
| CD-N8 (room_bind result site) | FIXED (slice 6 modifies tool-router.cjs) |
| CD-N9 (118 vs 125/120) | CUT with GB6 |
| CD-N10 (cowork_http) | CUT with GM9 |
| CD-N12 (context builder, no second spawn) | FIXED (3.4, AC7.1) |
| CD-N13 (room_create receipt exists) | FIXED (3.3 extends it) |

## Owner items (answered 2026-11-27; rulings LOCKED in 405-CONTEXT.md)

| Id | Question | Recommended | Owner ruling | Effect in 405-DESIGN.md r2.1 |
|---|---|---|---|---|
| O1 | If the chat cannot show a real dialog, may a typed choice confirm an ordinary decision? | Yes for ordinary choices; no for room creation or claim confirmation | OR-4: the MCP App click-proof card (B3.2, browser_nonce) is the target route for decisions; meanwhile typed counts for ordinary choices only | 3.5: app card is the target; refusal stays for room_create and claim cards until it exists; SP6 If B means redesign, not relaxation |
| O2 | A MINDRIAN_ROOM pin outside the registry stops accepting writes. Acceptable? | Yes, with a fix line | OR-5: as recommended | 3.2: refusal carries "Register this folder as a room with /mos:rooms adopt, then retry." |
| O3 | Build a third artifact, a `.mcpb` extension? | Not now | OR-6: build it now in 405 | 3.7a primary install; 3.7b config route is a fallback built only if SP7 = B; slice 5a; SP7 required; release slice 9 gains the extension lockstep (AC9.6) |
| O4 | Use only the guarded mindrian-brain route for Theo in chat? | Yes | OR-7: Theo can be more open; Larry may use theo-context (generic method, generative UI cards) in chat; Part 8 still binds | 3.6: THEO instruction line changed (123 bytes; served 1996 bytes, measured); shim changes kept where the shim runs; residual R4 accepted |
| O5 | Signed egress (B2.2)? | Not in 405 | OR-7: not pursued | B2.2 dropped |
| O6 | Move Phase 404 ahead of later 405 slices? | No; start 404 after 405 slice 5 | not asked; recommendation stands | section 9 unchanged |
