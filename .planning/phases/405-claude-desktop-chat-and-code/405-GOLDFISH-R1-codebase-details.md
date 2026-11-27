---
phase: 405
round: 1
reviewer: egm-codebase-details (technical accuracy and reuse)
target: 405-DESIGN.md r1
counts: {blocker: 3, major: 13, nit: 13}
note: "The reviewer is read-only; the main session saved its report. Checked against main and the 367 branch (/home/jsagi/dev/MindrianOS-Plugin-367). Section 5 grep counts not re-run."
---

# 405 GOLDFISH R1: codebase details

## Blockers

- CD-B1 (3.3 Files): lib/mcp/tools/views.cjs:284 calls writeFileContained, then :287-292 injectArtifactId rewrites the frontmatter. Comparing sha256 with "the content sent" fails for every frontmatter artifact. Fix: hash after injectArtifactId; AC3 fixture with frontmatter.
- CD-B2 (3.2, G6): room_create (lib/mcp/tools/startup.cjs:11-20; approval via gate.cjs:1724-1727, then startup-operations.cjs:44-75 destination(), resolveRoomRuntime(), navigation.birthRoom) and room_bind (tool-router.cjs:2272+) never call resolveMcpWriteRoom. A refusal there does not stop room birth or binding in a cloud VM. Fix: one shared helper called from resolveMcpWriteRoom (or 367 classifyMcpWriteRoom), prepareRoomCreation, the resumeFn birth leg and room_bind; add room_create and room_bind to AC2.1.
- CD-B3 (3.3, 3.5, AC7.1): lib/mcp/runtime-instructions.cjs:10-27 (2000-byte budget, served length exactly 2000; BOUNDARIES frozen by lib/mcp/no-instructions.test.cjs; tests/test-359-prose-budget.cjs). About 230 new bytes, no trim named. Fix: name the bytes cut outside BOUNDARIES, or move the clauses into tool descriptions or receipt text; before and after byte count.

## Majors

- CD-M1 (3.1, RESEARCH 2.1): no production caller passes capabilities to arbitration (navigation-engine.cjs:1598 reads ctx.arbitration_inputs; nothing sets it). The real CAPABILITY_MAP readers are lib/mcp/capability-registry.cjs:22-24, :50-56 (apps: true registers registerAppViews incl. room-dashboard) via scripts/mindrian-mcp-server.cjs:288. If code_local gets apps: false, room-dashboard, room-graph, room-wiki vanish from the Code tab. docs/ARBITRATION-CONTRACT.md:100-107 tables drift. Fix: name capability-registry as the consumer; keep apps: true for code_local until SP5; list the docs tables as Modify.
- CD-M2 (3.1, 3.6, SP1, SP4, SP6): writes call writePathRefusal then isWritePathEnabled (lib/mcp/mcp-first-flag.cjs:131-145): unknown host = false, only 'claude-ai' maps to claude-desktop (surface-detect.cjs:154); HINT_SURFACES (mcp-first-flag.cjs:148). Unknown bridge client name means every P4 write returns write_path_disabled. Fix: log the client name with logClientIdentityOnce (mindrian-mcp-server.cjs:246-247, lib/mcp/client-identity-log.cjs) in SP1 and SP4; decide whether the desktop-config entry sets MINDRIAN_MCP_FIRST; feed place into isMcpFirst and the hint text.
- CD-M3 (3.2): on the 367 branch resolveMcpWriteRoom delegates to classifyMcpWriteRoom (367 session-room.cjs:256-281), also called by graph-catchup-spawn.cjs:181; the main :285 cite is stale after the merge. 'cwd' and session-less 'reg.active' (main session-room.cjs:292-301) are not refused; fallbackRoomDir is always path.resolve(MINDRIAN_ROOM || './room') (server :190), so boot-fallback becomes "<cwd>/room" with no pin. Fix: the place rule in classifyMcpWriteRoom; cover cwd, reg.active and the default ./room; cite post-367 lines.
- CD-M4 (3.3 change_seq): room_changes answers only a bound or operator-pinned room (feed.cjs:63-70); resolveMcpWriteRoom accepts boot-fallback (session-room.cjs:295-298); epoch and reset contract (feed.cjs:35-38, :133), collection required (:157). A boot-fallback write cannot be checked; "after: change_seq - 1" shows only the last row of a multi-row write; the 367 runner moves the sequence. Fix: read the head with navigation.readChangeLogMeta before the write; return {epoch, from_seq, through_seq, collections}; make room_changes accept the same sources as write authority, or refuse boot-fallback writes on desktop_bridge.
- CD-M5 (3.3 rows): file-evidence-readback.cjs:118-148 assertions are inline, not exported (:246), and EvidenceClaim-specific (LOCKED_PROVENANCE_FIELDS; review_status 'proposed'); gate_answer approve confirms (gate.cjs:842). Fix: extract a generic readBackRows(db, ids, expect) behind the navigation.cjs door; fileEvidenceWithReadback calls it; reuse surfaceFileEvidenceResult; build from fields artifact_file already returns (views.cjs:434-444, :594-597).
- CD-M6 (3.4 card-before-answer; RESEARCH 3): gate_answer already refuses a relayed answer to a dismissed elicitation card with card_pending (gate.cjs:1652-1675) and records answered_via (answer-route.cjs:39: browser_nonce or mcp_relayed; gate.cjs:1719, :760, :1020) plus live.renderer. The guard is not hook-only. Fix: drop answer_channel; the doctor counts mcp_relayed answers on desktop_bridge by renderer; correct the research row.
- CD-M7 (3.2 skills guard line): scripts/build-skill-mirrors.cjs:5-23 never edits commands/; hand-authored skills are skip-listed (:35-37). scripts/stamp-firing-block.cjs already stamps a marker block into commands (mos:firing-block v2, commands/setup.md:30-42). Fix: reuse the stamp-firing-block pattern (marker block stamped into commands, then mirrored); a separate pass for skip-listed skills; name its --check mode.
- CD-M8 (3.6): commands/setup.md:54-95 routes on detectSurface(); in a Claude Code shell CLAUDE_CODE_ENTRYPOINT=cli selects the CLI branch ("No MCP server configuration needed", :92-95); the detect snippet's $(dirname "$(realpath "$0")") resolves bash, not the plugin root (:58); argument-hint is [brain|velma|graph] (:11). Fix: an explicit /mos:setup desktop subcommand calling lib/core/desktop-config.cjs regardless of surface; fix the path snippet; update the skills/setup mirror.
- CD-M9 (3.6 doctor, 3.4 MISSING row): lib/core/doctor/mcp-surface-module.cjs:5-22 already spawns both servers with spawnSync (doctor checks are synchronous); deployment-surfaces-module.cjs:8-13 checks owned disk surfaces and skips on DESKTOP and COWORK. Fix: reuse the mcp-surface spawn helper with the launcher paths and a 15 s budget; put the P4 capability list in the new module or status_read, not deployment-surfaces.
- CD-M10 (3.6 entry names, P2, GUESS): plugin .mcp.json:3-12 declares mindrian-os and mindrian-brain; the local Code tab also loads claude_desktop_config.json, so same-named entries can start a second server pair (two stdio keys, two wrappers, split bindings). Fix: SP5 leg; distinct config names, or the launcher exits when CLAUDE_CODE_ENTRYPOINT is set.
- CD-M11 (3.5, Part 8): the stdio key is module state, deliberately not inherited (session-binding.cjs:184-187); the shim resolves a lexicon room only from CLAUDE_CODE_SESSION_ID (mindrian-brain-mcp-client.cjs:127-149); resolveLexiconRoom (part8-room-lexicon.cjs:276). Reading "the registry sessions folder" must pick among stale stdio files. Fix: reuse resolveLexiconRoom; pid-liveness filter; for 0 or 2+ live bindings keep machine_global; test with a stale file.
- CD-M12 (3.3 tool list, slice 3): resolveMcpWriteRoom has 13 call sites (chain.cjs:983, claim-verify.cjs:102, question.cjs:138, research.cjs:120, startup.cjs:28, tool-router.cjs:115, gate.cjs:1172 and :1747, graph.cjs:237 and :279, claim.cjs:132, views.cjs:564); graph_write is graph.cjs:217, room_create is startup.cjs:11 plus startup-operations.cjs:69. Fix: narrow G3 to six tools or list every writer; correct slice 3 Modify (add startup.cjs and startup-operations.cjs; drop tool-router for these two).
- CD-M13 (3.4 presence duty): logMemoryEvent accepts only the frozen EVENT_TYPES (memory-events.cjs:10), no presence type; installCatchupWrapper gets only {roomDir, surface} (367 server :247) and its finally never sees the result (graph-catchup-spawn.cjs:222-226); an in-process write competes with the runner for the lock. Fix: memory-events.cjs as Modify; pass place into the wrapper; consider the runner (--trigger mcp_call) writing presence.

## Nits

- CD-N1: detectHostTier is surface-detect.cjs:186-207; :135-164 is HOST_TIER_MAP; the no-second-detector text is :102-106.
- CD-N2: mindrian-mcp-server.cjs:409 is the express-missing fallback; the normal stdio start is :658.
- CD-N3: artifact_file write room :564; probeWrite :576; claim block :335-415; file-evidence header :1-44, function :72-166.
- CD-N4: fileEvidenceWithReadback also has callers lib/core/recovery/controller.cjs:417 and scripts/dominant-design-research.cjs:305.
- CD-N5: brain-client requires the guard at :3217 too; shim cite :110-125 is the doc comment, the function is :127-149.
- CD-N6: the host cross-check must use readClientIdentity (surface-detect.cjs:250-270); getClientVersion is null on 2026-era connections.
- CD-N7: the statusline detector has a CLAUDE_DESKTOP=1 signal and uppercase values (lib/statusline/surface-detect.cjs:57-59); map both.
- CD-N8: describeRoomBinding adds a note only when not bound (session-room.cjs:454-457); the room_bind result is built in tool-router.cjs:2272+, add it to slice 6.
- CD-N9: "118 skills" conflicts with RESEARCH 5 (125 on disk, 120 match).
- CD-N10: detectPlace returns 6 values incl. cowork_http, but the place table has P1 to P5 and no Cowork row.
- CD-N11: boot-fallback defaults to ./room (server :190), not only MINDRIAN_ROOM.
- CD-N12: call the context.cjs builder from room_bind, not the context_assemble handler (a governed handler fires a second catch-up spawn).
- CD-N13: room_create already returns a receipt (startup.cjs:13; startup-operations.cjs:85-86 with answered_via and room_creation); extend it.
