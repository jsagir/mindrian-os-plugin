---
phase: 405
round: 1
reviewer: egm-zoom-out (simplicity and scope)
target: 405-DESIGN.md r1
counts: {blocker: 0, major: 6, nit: 5}
note: "The reviewer is read-only; the main session saved its report. The 367 branch was checked through 367-11-PLAN.md only."
---

# 405 GOLDFISH R1: zoom-out (simplicity and scope)

Verdict: the design meets OR-2 in direction, but builds more than OR-2 needs and repeats parts the repo already has. Smaller design: (1) spikes first, SP1 decides if the config route is needed; (2) fix the Code-tab misdetection with 1 rule, not a 6-value axis; (3) one no-room refusal at the write chokepoint, with no place detection; (4) the receipt from the existing change log; (5) install with a dispatch shim registered as a deployment surface. Drop or defer the presence rows, next_move in receipts, the extra census leg and the shim binding read.

## Majors

ZO-M1 | 3.1 Surface truth, slice 1
- Evidence: lib/mcp/surface-detect.cjs:65-69 detects Claude Code by `CLAUDE_CODE_ENTRYPOINT` with an exact match on `cli` only; :135-140 and :186-207 (`detectHostTier`) already return `claude-code` as tier1 (hook-capable); lib/core/arbitration.cjs:158 reads only `capabilities.hooks`; lib/statusline/surface-detect.cjs:37-83 runs only on the hook and doctor path. 405-RESEARCH.md:41 marks the misdetection GUESS (SP5).
- Rationale: OR-2 needs 2 facts in the server ("do hooks run here", "is a room reachable here"). A 6-value `place` enum detected by parent process, a `cowork_http` value for a gone surface, a copy in the statusline detector and a drift test make a third axis beside `surface` and `hostTier` (surface-detect.cjs:102-106 warns against this).
- Fix: wait for SP5; if the Code tab sets any `CLAUDE_CODE_ENTRYPOINT`, accept any non-empty value, or set `hooks: true` when `hostTier === 'tier1'`. Do not change lib/statusline/surface-detect.cjs; no drift test. Add `desktop_bridge` or `code_cloud` only when a consumer needs it and SP1/SP3 prove detection.

ZO-M2 | 3.6 Chat install path, slice 5
- Evidence: scripts/statusline-mos-dispatch:1-24 and :106-122 (stable-path dispatch shim with a marker, copied by session-start, finds the newest version at run time); data/deployment-surfaces.json:8-34 (owned surfaces: shim with marker, JSON-path exact value, `<active_version>`); lib/core/doctor/deployment-surfaces-module.cjs:8-33 (check and re-stamp in fix()); lib/core/doctor/mcp-surface-module.cjs:14-22 (starts both servers, initialize and tools/list); lib/core/doctor/class-m-brain-smoke.cjs:353 `_spawnAndHandshake`.
- Rationale: launcher templates, a resolver change, lib/core/desktop-config.cjs and a new desktop-bridge doctor module repeat existing parts (Part 7).
- Fix: copy the 2 launchers like statusline-mos-dispatch; add 3 rows to data/deployment-surfaces.json (the 2 launchers and the `mcpServers` entries as a JSON-path value); run the start check through mcp-surface-module or `_spawnAndHandshake`; keep only the config merge with backup and read-back as new code, with the setup code.

ZO-M3 | 3.6, slice 5 dependencies, SP1
- Evidence: 405-RESEARCH.md:151 and radar UNVERIFIED 2 leave open whether a Customize-installed plugin stdio server runs on the user's computer through the bridge; article 15520349 says local MCP plugins "work through the desktop app only". Slice 5 lists "1, SP5", not SP1.
- Fix: slice 5 depends on SP1. "If SP1 shows a bridged plugin server, drop 3.6 and keep only a doctor note."

ZO-M4 | 3.3 Write receipts, slice 3
- Evidence: 405-RESEARCH.md:124 (on the bridge the server writes with its own fs calls; the risk is a lost or late response, not a false success; 2.1.300 was in host file tools); lib/core/navigation/room-change-log.cjs:18-22 (change-log rows in the same transaction), :221 `withRoomTx`; lib/mcp/tools/gate.cjs:321, :358 read `navigation.readEntityRevision`.
- Fix: build the receipt from the change log (the change_seq values of the write transaction, node ids, file path and size from one `fs.statSync`); a change-log read is a read-back from room.db; drop sha256 unless SP2 shows a bridged write can differ from its input; put the helper in lib/core/navigation.

ZO-M5 | 3.4 per-turn memory_event row, slice 4
- Evidence: 405-DESIGN.md:94 (an `mcp_turn_seen` row every 10 min and a postCall list in the 367 wrapper); :101 (fallback second wrapper); 405-CONTEXT.md:44 ("405 must not duplicate it"); 405-RESEARCH.md:120 (artifact_file already logs `mcp_client_event_logged`).
- Fix: remove the presence duty, the postCall proposal and the fallback; mark per-turn memory_event MISSING in the doctor list; bring it back only when a consumer needs it.

ZO-M6 | 3.2 Honest refusal, slice 2
- Evidence: 405-DESIGN.md:68-69 (refusal depends on `code_cloud`, a GUESS marker); :70 (a guard line in about 120 skills and 111 commands, 405-RESEARCH.md:105; R10 manifest churn); lib/mcp/session-room.cjs:285 `resolveMcpWriteRoom`; 367-11-PLAN.md:21,49 `classifyMcpWriteRoom`.
- Fix: put "refuse a write whose room is not under a registered rooms home" in `classifyMcpWriteRoom` or `resolveMcpWriteRoom` on every place (typed reason `no_local_room_here`, `route_back` text); add the same check to the room-creating scripts (`scripts/room-registry create`, `resolve-room`); the skill line only if SP1 shows skill bash runs in the VM with CLAUDE_PLUGIN_ROOT set, and even then prefer the script guard.

## Nits

- ZO-N1 (3.4, AC4.2): drop `next_move` from receipts; runtime-instructions.cjs:37 already tells the model to call suggest_next.
- ZO-N2 (3.4, section 9): drop the desktop_bridge census leg; the 367 census already has a Desktop stdio leg (367-11-PLAN.md:23, :132) with the same tool list.
- ZO-N3 (3.5): make the shim binding read conditional on SP4; today the shim reports `machine_global` honestly (405-RESEARCH.md:89).
- ZO-N4 (SP3): the alwaysLoad timing leg is Phase 402 scope; keep only the cloud env and disk legs.
- ZO-N5 (3.3, AC7.1): show the receipt only on `ok: false` or `read_back: false`; on success name the room once per binding (Part 12).
