# Phase 386 outcomes

One row per finding ID. Each row starts with the ID, a colon, one space and one status word. Source: the 386-NN-SUMMARY.md files and the git log of 2026-11-06. No room content in this file.

Status words: FIXED, PARTIAL, DROPPED, SKIPPED, HANDED-OFF, PENDING-DECISION, NOT-MEASURED.

B1: FIXED plan 01, fix 89fac7b2b (RED 794c02fa7). The shadowed BYOAPI chat proxy of the wiki server is deleted; the pdf route is reachable.
B2: FIXED plans 02 and 04, fix 4cb862239 (RED 38df8b772). Owner decision option A: every brain_write is blocked at the guard (class write_blocked); whitespace-to-brain sends no hypothesis text and reports a blocked write as blocked.
S2: FIXED plans 03 and 05, fix 8d793693b (RED 66d2d3a14). Semantic Scholar: list first, approval token, credential check, audit record, no content scan (owner decision option A).
S3: NOT-MEASURED BEGIN IMMEDIATE on the database open path is a source observation. No lock contention was measured, so the finding is not closed from average open times. No work item in this phase.
B3: FIXED plan 06, fix 33af7ee46 (RED 73997c440). The three registry readers (hmi-status-command, across-session-memory, memory-completion-detector) use the one resolver.
B3-OP: HANDED-OFF plans 07 and 08. Owner decision unwire (2026-11-06): the operator state feature stays off. Plan 386-08 is a recorded skip (the repair did not run). Plan 385-12 item R2 holds the ruling for the PostToolUse and UserPromptSubmit entries. No product change in this phase.
B4: FIXED plan 09, fix 5551afcec (RED a9c756075). The environment assignment moved before node -e in scripts/session-start.
B5: FIXED plan 10, fix f5dfe4645 (RED e05745b94). One compaction opens one session row; scripts/post-compact prints only valid keys.
B6: FIXED plan 11, fix 83dfc010b (RED f1d26593c). One strike per distinct session id; the breakthrough hook creates no room.db.
B7: FIXED plan 15, fix 84151d83e (RED 280cc9562). The cascade status tells the truth (skipped, failed, complete); a cascade record counts once.
B8: FIXED plan 12, fix 3d1f47fed (RED 85e3cee25). Reproduced on a fixture room; FEYNMAN.md no longer counts as a newer artifact in the stale walk.
B9: FIXED plan 10, fix f5dfe4645 (RED e05745b94). The post-compact restore resolves the room, reads its side channel and validates the stamp.
B10: FIXED plan 13, fix cf1914cd1 (RED 696b9ce3a). Reproduced; rs-fetch falls back to the SQLite tier when NEO4J_URI is set but no driver exists.
B11: FIXED plan 19, fix 46ba22f2c (RED 72f73eb73). The framework_run halt card is minted in the gate ledger.
B12: SKIPPED plan 20. Owner decision option-a (2026-11-06): keep lib/core/temporal/supersession-gate.cjs as a documented, tested planned contract. No wire, no removal, no code change. Plan 385-12 item R9 records the same ruling. Phase 350 has no owner and no date.
B13: FIXED plan 14, fix a722aae9c (RED 569bcc137). The last-session baseline moves only when the Stop session id changes.
B14: FIXED plan 16, fix b0dad7549 (RED 5f6dfb6a6). The memory hook reconciles the active room only for a file inside it.
B15: HANDED-OFF plan 17 to Phase 385 plan 385-11. The plan 386-17 RCA verdict is NO SIGNAL (the host sets no CLAUDE_TOOL_COMMAND and lists no SlashCommand tool). Owner decision 2026-11-06: the command-invocation telemetry is not rebuilt on UserPromptExpansion. Plan 385-11 removed the dead SlashCommand hook (commit 33c004d2a). No product change in this phase.
B16: FIXED plan 18, fix 0b100bb0e (RED 30a79afd7). The doctor passes roomDir in the context of every always-cadence module.
B17: FIXED plan 44, fix 2e37f4068 (RED c6c364eb3). A Windows drive path is mapped or refused at openRoomDb, and path-like folder names are skipped in the section list.
B18: FIXED plan 45, fixes 575616b8b and 4b1f33a20 (RED 2d4c3947b). Typed cause for room_db_unreadable (busy, io, cannot_open, not_a_database, other) with a plain line. Owner decision not-needed: WAL works on the Windows drive, so no open mode change.
B19: FIXED plan 47, fix 545d5fe83 (RED 0744227d9). room.db moves aside only for cause not_a_database on a file without the SQLite header; busy, io, cannot_open and other give a person action and no recovery card. The card options for a real not-a-database file are unchanged, so no owner decision was needed.
E-GATE: FIXED plan 22, fix d6dbe9abe (RED 265bc2475). One shared web-path gate module (lib/core/web-path-gate.cjs).
E-GG: FIXED plan 23, fix 0e5fc4523 (RED ce05bffaf). The grants.gov funding search needs the approval token of its exact keyword, a credential check and an audit record; the scheduled scan skips with a typed reason.
E-RS: FIXED plan 24, fix a0ad2fb19 (RED 87dafaa3f). research-speaker sends nothing until a run carries the approval token of its three searches.
E-TYPED: FIXED plan 25, fix 529ebdbbe (RED a4c934e67). Allow arms for typed Theo read tools; the PENDING pws-brain-mcp root cause is written and the debug file is resolved.
E-AMB: FIXED plans 26 and 27, fix 5992a1f65 (RED 10536cca0). Owner decision option-e (2026-11-06): a body, an edge that fails a prose rule or an ambiguous call that carries an edge or body string gets the typed outcome sprouts_required with the split guide; sprouts proceed. Plan 26 is the RCA and the decision; plan 27 changed the code.
E-JOB: FIXED plan 28, fix d4e295b38 (RED c5342b1b9). A job key no longer changes the verdict of a free-form string; the packet keys are checked against the schema.
E-FAIL: FIXED plans 29 and 30, fix aeb2935e2 (RED c19a5ba36). Owner decision option A plus a count-only outage line: the hook, callTool and query fail closed with a typed reason when the guard cannot run. Plan 29 is the RCA and the decision; plan 30 changed the code.
E-KEY: FIXED plan 31, fix 796e69566 (RED b7fd80ea7). Credential shapes block on the Brain line and in the web credential check from one shared list. The spelled money part (GAP2) is decided as not blocked: under the owner principle money words are ordinary keywords and get no pattern.
E-OVER: FIXED plans 32 and 33, fix 93b785273 (RED 28c44303c). Owner decision option-e and owner_ack: yes recorded in the plan 386-32 RCA. The guard separates a sprout from a body by shape. The acknowledged residual exposure is pinned in the tests.
E-TEST: FIXED plan 34, commits 2ea06d90d and c91aa1798. Four test files assert the exact verdict and a mutation proof fails them when the verdict is remapped.
E-LAZY: FIXED plan 35, fix b7323cdc1 (RED b0f365410). The timeline runner is required inside extractFeynmanBody in both folder-memory twins. Part 8 hardening, no speed claim.
E-WEBHOOK: FIXED plan 36, fix 5445710e6 (RED 77e722ab9). A credential-only PreToolUse hook for WebSearch, WebFetch and Tavily; fail closed with web_credential_check_unavailable.
E-SHAPE: FIXED plan 37, fix f16751402 (RED e62c99d82). A pure sprout and body shape helper with measured thresholds; it changes no verdict by itself.
E-PINE: HANDED-OFF plan 38 to Phase 385 plan 385-12. Owner decision option B (2026-11-06): lib/core/pinecone-inference.cjs is DEAD (0 runtime callers); the owner states the build does not use Pinecone, so it is a removal candidate. No product change in this phase.
E-PROBE: FIXED plans 39 and 40, commits e07255de5, 36e96903a, d0e8b68e7 and c4b21b798. 694 recorded audit probe cases replay against the live guard; the live run printed RESULT - PASS with no SKIP arm; the replay control of the baseline fails the arms that must fail.
E-MODULATE: FIXED plan 41, commit 11966721f (RED 64f7f6260). Owner decision: leave scripts/transcribe-audio as it is and document it. One disclosure line in 5 files; the script is byte-identical.
E-SPROUT-DESIGN: FIXED plan 42, fix e7dc09253 (RED 8716bfa2f). The context-based split route (lib/core/part8-split-route.cjs) is proven end to end on fixtures.
E-SPROUT-GUIDE: FIXED plan 43, commits 1597fefae and 0ed2f6d41 (RED 58df961b1). The sprout rule and the sprouts_required handling are taught in the Brain query patterns, the Brain query agent, the Brain connector skill, a persona pointer and references/brain/sprout-split-route.md.
E-IDENT: FIXED plan 46, fix 80f7a29e6 (RED 893828652). Obfuscated email and international phone-like forms join the always-block rules; the corpus gate showed no new induced block (ordinary_blocked_max 0). suffix_money stays outside it by the owner decision.
