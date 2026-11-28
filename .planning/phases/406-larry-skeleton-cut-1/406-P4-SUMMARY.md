---
phase: 406-larry-skeleton-cut-1
plan: P4
slice: larry-voice-mark
status: built; live gate FAILED on the card leg (recorded failed gate, as the plan allows)
branch: work/406-voice
base: tip of P3 (f136d0a6b)
commits: [ebd83d90e, a4cecfb7a, e6976cb35]
protocol: "agent-interaction-protocol.md applies. Marks: PROVEN, UNVERIFIED, ASSUMED."
---

# 406-P4 SUMMARY: voice mark rule and log

## Result in 7 lines

- The detector and the log fields are built and pass 13 fixtures (a to m). PROVEN.
- The black-square rule is in the carve-out section of the loaded style: +204 bytes. Shared cap: 334 of 600 used, 266 left. PROVEN.
- Driven headless runs: 46 turns in 3 sessions, 46 log rows, 1 row per turn. PROVEN.
- Gate turns: 22 (11 card, 11 prose fork). Black: 17 of 22. Prose forks 11 of 11 black; card turns 6 of 11 black. PROVEN.
- Non-gate turns: 24, false black 0. Missing mark 0. Invalid mark 0. PROVEN.
- Replies after a card answer: 11, black 0 (each used a move glyph). PROVEN.
- Acceptance: FAILED on "20 of 20 gate turns black" (the card leg). The non-gate leg and the missing-mark leg PASS. Per the plan, the rule stays as a failed gate; a code-side glyph selector is cut 2 design work.

## OR-47 (answered before the first edit)

1. A top professional would also: read real transcripts record by record before the detector is coded; keep the old readers unchanged because card-fire depends on their window rule; log fields only; and test the detector on the record types a live host really writes, not only on hand-made fixtures.
2. The rawest material: real transcripts with a card turn, read as record shapes (type, message.role, content block types, tool names, uuid, isMeta, toolUseResult, origin.kind). 3 transcripts by the builder, 2 by the plan check, and the live driver transcripts. No transcript text is copied into any file.
3. Methods and tools: tests first with neutral fixtures; a new exported reader (`readGateTurn`) beside the old ones; a pure verdict function (`voiceMarkVerdict`); the Stop hook that already writes the `voice-turn-evaluated` row; a driver that runs headless hosts and reads the log rows.
4. Outside evidence: the log rows of 46 driven headless turns (field-only reports `406-P4-live-report-long.json` and `406-P4-live-report-forks.json`). The turns were driven by a delegated session (owner ruling OR-61 style). They are UNVERIFIED as a replacement for a person at the keyboard.

## Deviations from the plan

1. Task 3 (orchestrator decision 2): the 40 owner-driven interactive turns are replaced by driven headless runs. Driver: `406-P4-live-driver.cjs` in this folder (not shipped). It starts `claude -p --input-format stream-json --output-format stream-json --verbose --permission-prompt-tool stdio --tools AskUserQuestion --strict-mcp-config --plugin-dir <worktree> --setting-sources project --model opus` from an empty temp folder, with a temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME, the Brain at 127.0.0.1:9, and the real HOME for the login. It answers each AskUserQuestion with the first option label and denies every other tool.
2. Cost limit: only the AskUserQuestion tool is on and no MCP server loads. So a gate_render card cannot occur live; fixture (e) covers gate_render. A first trial with all tools on cost 0.72 USD for 1 cold turn, mostly tool context and denied tool loops.
3. The driver prompts ask for a card or a prose fork in 22 of 46 turns. This tests glyph fit given a gate, not whether a gate fires. The host did not fire a card on 2 of the 13 card requests; those turns count as non-gate.
4. The driver is a measurement tool written by the orchestrating session, not a Codex build step.

## Plan check (opus, read only): exact text changes applied

Verdict PASS WITH CHANGES. Changes, as applied:
1. Facts heading: "PROVEN on work/406-voice 85f436089".
2. The gate_render name `mcp__plugin_mos_mindrian-os__gate_render` is PROVEN from a real tool_use block.
3. Callers: 8 code callers including check-voice-style.cjs, and 1 document; the sensors files only name turn-text in comments.
4. Truth: "the 7 callers other than check-voice-style.cjs".
5. Record shapes added (see below).
6. Typed user record: role user, no toolUseResult key, no tool_result block, isMeta not true, origin.kind not task-notification or peer.
7. turn_id fallback: sha256 of the session id and the index of the record line in the tail.
8. The fields ride the existing `voice-turn-evaluated` row; no second row per turn; the denominator does not change.
9. A reader filters on policy_id `voice-turn-evaluated`.
10. Live source replaced by driven headless runs (deviation 1), with a 1-turn check first that a row appears.
11. Task 3 renamed "Live measurement (driven headless runs)".
12. "from driven headless runs" in the truths, the objective, OR-47 point 4 and the success criteria.
13. T-406-P4-04: a script drives the sessions; the main session counts from the log rows; the driver report is kept.
14. files_modified: the driver in the phase folder.
15. Task 1 Step 4: also tests/test-298-voice-log.cjs and every test of the `voice-turn-evaluated` row.

## Record shapes (PROVEN, read only)

- Card answer: type `user`, message.role `user`, content [tool_result], keys toolUseResult, sourceToolAssistantUUID, uuid; no isMeta.
- Typed prompt: type `user`, string content or [text], uuid, no toolUseResult. In a headless stream-json session the typed record has no origin key.
- Other user records: isMeta true; origin.kind `task-notification`; origin.kind `peer`.
- Type `attachment` and other non-message records: no message.role.
- Type `api-request-blob` (keys type, sessionId, hash, message): it replays the request with message.role `user`, `system` or `assistant`. Present in 1,720 transcript files on this machine. Found by the live run, not by the fixtures (see "Defects found").

## The detector (as built)

- span: the records after the last typed user record; only records of type `user` or `assistant` count.
- card: the first AskUserQuestion or gate_render tool_use in the span. opener: the first assistant text. final: the last assistant text. post: the assistant text after the tool_result that answers the card.
- gate_source: `ask_user_question`, `gate_render`, `your_call` (final holds "Your call:"), or `none`.
- glyph_color: of the opener for a card turn, else of the final text. post_glyph_color: of the post text, or null.
- glyph_correct: card turn: opener black, and post is null, or holds "Your call:", or has a valid non-black mark. Prose fork: final black. Non-gate: true for a valid non-black mark, false for black, null for none or invalid.
- The row holds turn_id, glyph_color, post_glyph_color, gate_turn, gate_source, glyph_correct. No text. The test searches every fixture string in the row JSON.

## Defects found and fixed during the build

1. Brief defect (orchestrating session): the first brief checked the last reply only. In a real session a card is answered inside the same turn, so the reply of the card turn is the opener. The run was stopped before any edit landed and restarted with the opener and post rule.
2. `afterAnswer` (commit ebd83d90e): before the card was found, any tool_result set `afterAnswer`, so text before the card became post text. Fixture (l) pins the fix. Red then green. PROVEN.
3. `api-request-blob` (commit e6976cb35): a replayed assistant blob after the card answer doubled the opener mark in the post text, so the post read `invalid`. Found in the first live session (6 turns, stopped). Fixture (m) pins the fix. Red then green. PROVEN.
4. Schema pin: leg B5 of tests/test-3696-voice-log-denominator.cjs allows the 6 new keys on `voice-turn-evaluated` rows only.

## Task 1 and Task 2 results (at e6976cb35, temp HOME)

- tests/test-406-voice-mark-log.cjs: passed (13 fixtures). PROVEN.
- tests/test-3696-voice-log-denominator.cjs: PASS 47 FAIL 0. tests/test-298-voice-log.cjs: 10 passed. tests/test-larry-voice-mark-182.cjs: 0 failed. tests/test-gate-native-fire-w1.cjs: 12 assertions pass. tests/test-3696-measure-voice.cjs: PASS 36 FAIL 0. PROVEN.
- tests/test-card-fire-relevance-gate.cjs (6 pass, 5 fail, the expected red legs) and tests/test-mux-card-before-answer.cjs (18 pass, 1 fail, S3 in lib/mcp/startup-operations.cjs): the same counts on an export of HEAD before P4. Pre-existing. PROVEN.
- tests/test-261125-runtime-core-forced-style.cjs: PASS 8 FAIL 0 with the cap leg. Style 8,453 bytes. PROVEN.

## Task 3: live counts (driven headless runs, 2026-11-28)

| Session | Turns | Card turns (black opener) | Prose forks (black) | Non-gate (false black) | Post-answer (black) | Cost USD (host) |
|---|---|---|---|---|---|---|
| long1 | 20 | 4 (0) | 4 (4) | 12 (0) | 4 (0) | 0.48 |
| long2 | 20 | 4 (3) | 4 (4) | 12 (0) | 4 (0) | 0.48 |
| forks | 6 | 3 (3) | 3 (3) | 0 (0) | 3 (0) | 0.19 |
| Total | 46 | 11 (6) | 11 (11) | 24 (0) | 11 (0) | 1.15 |

- The 5 card openers that are not black: blue, blue, red, red (long1) and red (long2). In each, the post-answer reply used the same color as the opener.
- Acceptance: gate turns black 17 of 22 (required: all). Non-gate false black 0 of 24 (required: 0). Missing marks 0 (required: 0). Result: FAILED gate on the card leg.
- Every session: init plugins `mos` plus 4 builtin; 0 tools denied; the session-scoped files under the real HOME (next-move cache, session-env) were deleted after each session.
- A first live session (6 turns, before fix 3) and an accidental start of the driver (killed in its first session) are not counted. Their files under the real HOME were deleted.

## Lane gate (see the final report for the run at the lane tip)

At e6976cb35 or earlier, temp HOME, run while the machine was loaded:
- G-402: PASS=27 FAIL=0 SKIP=0 (with the new P4 line). G-359: PASS=27 FAIL=0. G-401: exit 0. G-BND: PASS=79 FAIL=0. check-frontmatter-split OK (255 files). check-tool-grants OK. build-connector-registry OK. run-harness: 12 pass, 0 fail. PROVEN.
- G-3696: FAILED=5. RT1 (allowed). The other 4 fail the same way on an export of the base 85f436089: tests/test-3696-isolation.cjs B5b (an evidence line of scripts/check-pending-ambiguous.cjs, a file this lane did not change), tests/test-260917-rooms-home-precedence.cjs, tests/test-36925-injection.cjs J6, tests/test-115-surfaces-grep.sh assertion 5. Pre-existing on the base. PROVEN.

## Host cost of the lane (P3 and P4)

Reported by the host: 0.17 (P3 probes) + 0.02 + 0.72 (1-turn trial) + 0.96 + 0.19 = 2.06 USD. Estimated from transcript tokens (ASSUMED prices): accidental start about 0.9 USD, stopped first session about 0.36 USD. Not reported: the P3 generate and judge runs (ASSUMED under 2 USD). Total ASSUMED under 6 USD, inside the 10 USD limit.

## Risks

- The old readers `readTurnText` and `readTranscriptTurn` do not skip `api-request-blob` records. A blob with message.role `user` can reset their window. Not changed here (card-fire depends on them); a candidate debug task.
- The rule fails on cards: 5 of 11 card openers were not black. A prose rule in the style did not hold for cards in this sample.
- gate_render was not measured live (no MCP server in the cost-limited runs).
- The driver answers each card with its first option and states the fork kind in the prompt. A person at the keyboard can give other turns.
