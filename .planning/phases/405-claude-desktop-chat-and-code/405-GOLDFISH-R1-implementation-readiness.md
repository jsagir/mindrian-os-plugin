---
phase: 405
round: 1
reviewer: egm-implementation-readiness
target: 405-DESIGN.md r1
counts: {blocker: 3, major: 11, nit: 7}
verdict: "Not ready for /gsd-plan-phase: a planner would have to make design decisions in slices 0, 2, 3, 5 and 7, and add a release slice."
note: "The reviewer is read-only; the main session saved its report."
---

# 405 GOLDFISH R1: implementation readiness

## Blockers

IR-B1 | Section 6 Spikes, slice 0
- Evidence: the spike table has Question, Cheapest test, Blocks; no decision rule per outcome (only SP4 has one, in 3.7). Examples: SP5 shows `CLAUDE_CODE_ENTRYPOINT=cli` in the Code tab, so how is `code_local` told apart? SP3 finds no cloud marker, so the `code_cloud` refusal has no trigger. SP1 shows the plugin server runs in the VM: which place is that? SP6 shows instructions dropped: no fallback. SP2 shows a lost response leaves no write: what replaces the plan?
- Fix: add columns "If A then" and "If B then", each naming the design line that changes. Suggested: SP5 entrypoint `cli` -> merge `code_local` into `cli` (both hooks true; record in AC1.1). SP3 no marker -> named fallback (no registered rooms home plus a VM homedir pattern) or drop it and rely on the `none` source refusal. SP6 dropped -> receipt clause in write-tool descriptions and the `room_list` result. SP2 no write -> an idempotency key per write. Each spike gets a pass/fail line recorded in 405-SPIKES.md.

IR-B2 | 3.3 instructions clause, 3.5 Theo clause, AC7.1
- Evidence: lib/mcp/runtime-instructions.cjs:25-27 ("Served length is now exactly 2000 bytes, so the next edit must trim before it adds"; tests/test-359-prose-budget.cjs guards it); :20-23 (lib/mcp/no-instructions.test.cjs freezes BOUNDARIES byte for byte). The design adds about 230 bytes and names no trim. scripts/build-harness-manifest.cjs:172, :186-189 digest runtime-instructions.cjs as the `desktop_cowork_wire` Larry surface, so `--check` fails after any edit.
- Fix: write the final instructions text in the design with its measured byte count (measure command at runtime-instructions.cjs:24); name the words removed; show BOUNDARIES unchanged. AC7.1 adds `node lib/mcp/no-instructions.test.cjs`, `node tests/test-359-prose-budget.cjs`, `node scripts/build-harness-manifest.cjs` then `--check`.

IR-B3 | 3.2 skills guard line, AC2.3, file table row 2
- Evidence: scripts/build-skill-mirrors.cjs:19-23 (commands/ is the source of truth, read-only to the builder; transforms :25-128; SKIP_LIST :175). (a) the builder cannot write commands/; (b) hand-authored skills and skip-listed trending-to-absurd never get the line; (c) "names a room script" has no pattern, so AC2.3 is circular; (d) "the Phase 401 shared include, whichever lands first" leaves the mechanism open; (e) skills/larry-personality/SKILL.md is digested by the harness manifest (build-harness-manifest.cjs:181-183).
- Fix: choose one mechanism: a mirror EXCEPTION CLASS 4 plus a one-time codemod (like scripts/migrate-plugin-root-refs.cjs) for hand-authored skills, with a pinning test; or edit commands/*.md as source. Give the regex (for example `scripts/(room-registry|resolve-room|update-icm-index|compute-state)` or `lib/core/room-`), the exact line and its position. Rule: "if 401 is on main at plan time, use it; else the mirror class". AC2.3 adds `node scripts/build-skill-mirrors.cjs --check`, `build-connector-registry.cjs --check`, `check-shape-declaration.cjs`, `build-harness-manifest.cjs --check`.

## Majors

- IR-M1 (section 7): no AC names the born-wired or shape gates (`build-connector-registry.cjs --check`, `check-shape-declaration.cjs`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs`, `build-harness-manifest.cjs --check`, `doctor.cjs --acceptance`). AC1.5 says wire snapshots "unchanged" while slices 1, 3, 4 change tool results and maybe descriptions (room.cjs:104-109). Fix: a Gates row per slice; for each tool touched state whether description or schema changes, and if so the zod3/zod4 snapshot regeneration and the expected diff.
- IR-M2 (no section): no release slice. package.json:36 ships `templates/`; build-desktop-artifact.cjs:94 drops only `bin` and `lib/ui-shell/dist`, so templates/desktop/*.cjs and lib/core/desktop-config.cjs go into mos-desktop at Step 6.8; launchers must not match RUNTIME_BIN_PATTERNS (:66-80). No AC runs the payload check (:418-436), CHANGELOG, release.sh, or `real-room-run.cjs --desktop-verified win|mac`. Fix: slice 9 "Release" with those ACs and a launcher bin-pattern test.
- IR-M3 (3.3, AC3.1): artifact_file injects an artifact_id into frontmatter (views.cjs:208, :289), so hashing the sent content gives `read_back_mismatch`. Fix: hash the final buffer passed to `writeFileContained`; AC with frontmatter content.
- IR-M4 (3.3, AC3.3): `room_changes` requires `collection` (feed.cjs:157), takes an `epoch` guard (:133, :159), refuses an unbound session (:63-70); an artifact reaches the feed only when an indexer writes its nodes (:27-33). Fix: receipt `change: {collection, change_seq, epoch}` per row; name the reader (navigation.readChangeLogMeta or latest_seq post-commit) and whether it is in the write transaction; AC3.3 asserts the exact call.
- IR-M5 (file table): room_create is in lib/mcp/tools/startup.cjs:11 and graph_write in lib/mcp/tools/graph.cjs:217, not tool-router.cjs; room_bind (tool-router.cjs:2272) carrying the context summary is not in the table; the deployment-surfaces doctor module and the text-channel approval count are missing; `next_move` needs write-receipt.cjs and next-move.cjs callers; mcp-first-flag.cjs:148 HINT_SURFACES knows only cli, desktop, cowork. Fix: correct paths, add each file with an AC.
- IR-M6 (3.1, 3.3): `isWritePathEnabled` (mcp-first-flag.cjs:131-145) returns false for an unknown client unless MINDRIAN_MCP_FIRST names the surface; the bridged server's clientInfo is unknown; every governed write could return `write_path_disabled`. Fix: SP1 `s1_where` records clientInfo name and version; state the `desktop_bridge` rule (setup sets `MINDRIAN_MCP_FIRST=desktop`, or map clientInfo in detectHostTier); state the refusal order vs `no_local_room_here`; add an AC.
- IR-M7 (3.6, AC5.1, AC5.2): config entry shape, node binary resolution (Windows PATH, Node >=22.18.0), per-OS paths, launcher install and refresh owner, resolver precedence between mos and mos-desktop (active-plugin-root.cjs:14-28 resolves only `mos@mindrian-marketplace`), and the WSL case (setup in WSL, Desktop on Windows, config under /mnt/c) are unspecified. Fix: literal JSON per OS; node rule (process.execPath of the setup run or `where node` with a version floor); owner (desktop-config writes launchers, doctor reports and fixes stale ones); precedence; WSL typed refusal or the /mnt/c mapping; fixtures.
- IR-M8 (3.6, AC5.3, Part 7): data/doctor-modules.json:31-32 `mcp-surface` already spawns both servers over stdio. Fix: reuse its helper or justify; give the registry entry; list the broken states and typed reasons (`config_missing`, `entry_missing`, `launcher_unresolved`, `version_drift`, maybe `server_start_timeout`).
- IR-M9 (3.4, AC4.1): debounce store, place rule (`unknown`, `cowork_http`), memory_event vocabulary registration of `mcp_turn_seen`, clock seam and a time-box for the jsagi-42 answer are missing. Fix: name each.
- IR-M10 (3.5): two GUESS mechanisms for the shim binding read, no AC; changes Part 8 lexicon scope (mindrian-brain-mcp-client.cjs:110-125). Fix: choose from SP4 with an if/then; AC5.5 (binding present gives a new `lexicon_scope`; none gives `machine_global` and the envelope says so).
- IR-M11 (3.2, AC2.1, AC2.2): "registered rooms home" has no named function; reads that refuse are not listed; AC2.1 uses the 367 GOVERNED set (graph-catchup-spawn.cjs:40) that is not on main; the insert point in `resolveMcpWriteRoom` (session-room.cjs:285-377) is not given. Fix: name each.

## Nits

- IR-N1: tests/run-all-405.sh contents and an AC-to-test-file map.
- IR-N2: the 8 env fixtures for AC1.1 as a table (env keys, parent hint, expected place), marking SP3/SP5 rows.
- IR-N3: name the test-only seam of AC3.2 and its guard (refused unless NODE_ENV=test).
- IR-N4: AC6.2 says "room slug", the receipt has `room_id`: define one or both.
- IR-N5: slice 8 needs the macOS LIVE leg (R1); AC7.3 lists the hand-off sections to change.
- IR-N6: AC4.2 "at most 300 bytes": define the measurement.
- IR-N7: if the doctor module adds a flag, tests/test-doctor-doc-parity.cjs:32, :134 require it in commands/doctor.md and the mirror rebuild.

## Reviewer notes

VERIFIED: every evidence line was read in the file it cites. UNVERIFIED: the exact byte length of the two new clauses (about 230, estimated); whether the skills/setup mirror is byte-equal to commands/setup.md today.
