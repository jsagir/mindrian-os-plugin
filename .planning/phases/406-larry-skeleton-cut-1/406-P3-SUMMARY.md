---
phase: 406-larry-skeleton-cut-1
plan: P3
slice: larry-voice-loaded
status: done (gate on the proportional reading; see "Score")
branch: work/406-voice
base: 85f436089 (stage/400.5-405 with F1 and P1)
commits: [43008ac5a, 6cfdb582e, a9517dcf6, c67e3fe80, 1e48a79a2]
protocol: "agent-interaction-protocol.md applies. Marks: PROVEN, UNVERIFIED, ASSUMED."
---

# 406-P3 SUMMARY: loaded voice probe and bounded correction

## Result in 6 lines

- Marker probe: both tokens `MOS-STYLE-CORE-1 MOS-AGENT-PRESENT` on Claude Code 2.1.332 with `--plugin-dir` at the build tree. PROVEN.
- Skill probe: the reply does not quote "Sprouts, not bodies". Data for N1: the skill text did not reach the main thread. PROVEN (1 sample).
- Cell 2t (agent body, session capture, forced style, per-turn capture, no skill) scored by the claude judge (opus): 8 of 9 probes pass on the proportional reading; F fails at 20 of 30. PROVEN.
- Voice-core edit: NOT needed (Step 3 of Task 3). No edit was made.
- Identity rule added to the carve-out section (OR-67 O-B): +130 bytes. Bytes left for P4: 470. PROVEN.
- A new opt-in `--host-login` route of the eval runs generate and score with the host login (orchestrator deviation 1).

## OR-47 (answered before the first edit)

1. A top professional would also: measure the composition that the host really loads (not a twin cell), keep the raw replies and the raw judge items sealed beside the totals, change the style only after a failed measurement, and keep the opt-in credential route out of the default path.
2. The rawest material: the composed system prompt that `buildCellPrompt('2t', ...)` writes for each probe (scratch `system-<probe>-2t-1.txt`), the 9 raw replies in `evals/larry-voice/runs/406-p3-before/replies.json`, and the per-item judge results in `scores.json`.
3. Methods and tools: tests first (E2t, E2h, E2i, E2j, the cap leg), the existing composer and scratch runner of `scripts/eval-larry-voice.cjs`, `claude -p` with stream-json init events as the composition proof, the claude judge with the fixed rubric text, and a read of 3 replies.
4. Outside evidence: the marker reply of a fresh host, the judge scores per item, and a read of 3 replies (A, F, K) by the orchestrating session (not by the owner; UNVERIFIED as a person read).

## Deviations from the plan (orchestrator decisions, binding)

1. Credential. No CLAUDE_CODE_OAUTH_TOKEN and no ANTHROPIC_API_KEY exist. The probes, the generate leg and the judge use the logged-in host login with the real HOME, `--setting-sources project`, an empty temp working folder, a temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME, and the Brain address at 127.0.0.1:9. No CLAUDE_CONFIG_DIR isolation. The Task 2 credential gate was removed. The judge is `claude -p --model opus` with the fixed rubric prompt of `judgeSystemText`.
2. With the host login the init event lists 4 builtin plugins (`cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-privacy`, `cc-plugin-plugin-authoring`, path `builtin`), no MCP server, no tool, style default. PROVEN by a 1-turn check. So the host-login variant of `compositionProven` accepts plugins with path `builtin` only; the default check is unchanged.
3. Pass mark. Probe E has 5 items marked `not_applicable` by the rubric rule `na_report_mode` (R3, R4, R6, R9, R11), so its maximum is 20. The plan text "a total of at least 22 of 30" cannot hold for E by construction. This SUMMARY applies the proportional reading (22 of 30 = 73.3 percent; E has 17 of 20 = 85 percent). Strict reading: 7 of 9, which would call for the voice-core edit. The owner can overrule the reading.

## Plan check (opus, read only): exact text changes applied

Verdict PASS WITH CHANGES. Changes, as applied:
1. Credential fact replaced: `credentialPresent` and `liveGate` refuse with `no_isolated_credential`; `generateRun` exits 77; `defaultClaudeJudge` refuses; `isolatedEnv` sets HOME and CLAUDE_CONFIG_DIR to the scratch; `spawnIsolated` refuses other env through `breachOf`. So a code change is needed for the host login.
2. The cell list is in 2 places (buildCellPrompt, generateRun); `rubric.ladder.cells[cell].method` is read at generate time, so `2t` needs a ladder entry; `na_operation_on_voice_cell.cells` needs `2t`.
3. `evals/larry-voice/rubric.json` added to files_modified.
4. Task 1 Step 2: `2t` in both accepted lists, not in the default list (E5 pins it); 2s branch without the skill loop; `manifest.skills = []`; per-turn capture for 2t; ladder entry; not in `required_matrix`.
5. Task 1 Step 2b: the opt-in `--host-login` flag (also `LARRY_VOICE_HOST_LOGIN=1`), `liveGate(env, opts)` with `skip_live_claude` first, a separate `spawnHostLogin`, `--setting-sources project` in generate and judge args, `credential_route: host_login` in the manifest and the score record, `breachOf` unchanged, leg E2h.
6. Limits: host login, real HOME, empty temp folder, temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME, no CLAUDE_CONFIG_DIR; temp HOME for the offline tests only.
7. Task 2: credential gate deleted; probe command with `--setting-sources project`; type `auto`.
8. must_haves truth 1: "the host login and --setting-sources project".
9. Threats T-406-P3-01 and -02 reworded (init event plugin list recorded; no token used).
10. Task 3 Step 2 commands: `generate --host-login ... --model opus`, `score --host-login --judge claude --model opus`.
11. `compositionProven` must pass under the host login; else BLOCKED. Resolved by deviation 2.

## Task 1: cell 2t, the host-login route and the cap leg

- Commit 43008ac5a. Files: scripts/eval-larry-voice.cjs, scripts/isolate-larry-voice.cjs, evals/larry-voice/rubric.json, evals/larry-voice/README.md, tests/test-3696-rubric-eval.cjs, tests/test-261125-runtime-core-forced-style.cjs.
- Red: E2t fails with `cell_unknown` on the base (the base cell lists hold 1, 2, 3, 2s, 3s only). PROVEN by code read at 85f436089; the red run inside the Codex sandbox did not reach E2 (git spawn refused).
- Follow-up commit a9517dcf6: the host-login splice put `--setting-sources project` between `--system-prompt-file` and its value, so every generate call exited 1 ("System prompt file not found: .../--setting-sources"). PROVEN by a wrapped spawn. Fixed; legs E2h and E2i pin the order. Red on the old function, green on the new. PROVEN.
- `node tests/test-3696-rubric-eval.cjs`: PASS 131 FAIL 0 (base 127). PROVEN.
- `node tests/test-261125-runtime-core-forced-style.cjs`: PASS 8 FAIL 0, with the new cap leg. PROVEN.

## Task 2: marker probe and skill probe (live)

Command (from an empty temp folder, temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME, Brain at a closed port): `claude -p --plugin-dir <worktree> --setting-sources project --tools "" --strict-mcp-config --no-session-persistence --model opus --output-format stream-json --verbose "<prompt>"`. Host version: 2.1.332 (Claude Code).

- Init event: plugins `mos` plus the 4 builtin plugins; style default; 23 agents. PROVEN.
- Marker reply: `MOS-STYLE-CORE-1 MOS-AGENT-PRESENT`. PASS. PROVEN. Cost 0.09 USD.
- Skill probe reply (prompt "Where does the guidance for composing a Brain call live? Quote the line."): the reply opens with the blue glyph and the label, says the identity sentence, quotes the agent line "Reach Theo only through the guarded brain_ask and brain_query tools, never with room content (Part 8)." and points to the larry-personality skill and references/personality/reach-and-dial.md without quoting them. "Sprouts, not bodies" is absent. Cost 0.08 USD. PROVEN.
- Stray writes under the real HOME. The probes left `~/.mindrian/next-move/<session>.json` and `~/.claude/session-env/<session>`; both were deleted for both sessions. PROVEN. The real active room changed during the probe window, but 0 rows of its 17 tables and 0 files of its `.mindrian` folder hold either probe session id, and the same room changed again with no probe running (other sessions write it). So the probes did not write it. PROVEN by read-only query.

## Task 3: identity rule, score, bounded correction

- Step 1 (commit 6cfdb582e). Sentence added to the carve-out paragraph: "The first active reply puts MindrianOS first, a product with its own method and memory, and names Claude as the model underneath." Bytes 8,119 to 8,249 (+130). The exact first-reply sentence of lib/hmi/larry-identity.cjs is unchanged. Tests: forced-style 8 of 8, identity parity 28 of 28, operation doctrine 25 pass and RT1 (KNOWN). PROVEN.
- Step 2 (commits c67e3fe80, 1e48a79a2). `generate --host-login --label 406-p3-before --cells 2t --model opus`: complete, 9 replies, every composition proven under the host-login rule. `score --host-login --label 406-p3-before --judge claude --model opus`: 9 scored, 0 abstained items. PROVEN.

| Probe | Total | Max | Pass (proportional) | Items below 2 |
|---|---|---|---|---|
| A | 27 | 30 | yes | R13=1, R15=0 |
| C | 24 | 30 | yes | R5=1, R10=0, R12=1, R15=0 |
| D | 25 | 30 | yes | R3=1, R13=1, R12=1, R15=0 |
| E | 17 | 20 | yes (85 percent) | R13=1, R15=0; R3, R4, R6, R9, R11 not applicable |
| F | 20 | 30 | no | R2=0, R3=1, R8=0, R12=1, R14=0, R15=0 |
| G | 23 | 30 | yes | R5=1, R13=1, R10=0, R11=1, R15=0 |
| H | 27 | 30 | yes | R12=1, R15=0 |
| I | 25 | 30 | yes | R2=0, R13=1, R15=0 |
| K | 22 | 30 | yes | R2=0, R3=1, R8=0, R12=1, R15=0 |

- R15 is 0 on all 9 probes and R2 is 0 on F, I and K: a pattern for owner review, not a gate of this plan.
- Step 3: 8 of 9 at the mark: no voice-core edit. Step 4 did not run.
- Step 5: P3 bytes +130; left for P4: 470.
- The read of 3 replies (A, F, K). Each opens with the red glyph and the label, says the identity sentence once, gives one reframe and one question, and lists no framework. F (a two-market decision fork) names a command and "the engine's suggested step" in the reply: the judge items R2, R8 and R14 catch it. Each reply also says the room is not reachable in this session, which is true for a voice cell with no tool. All 3 replies open with the red glyph, also F, a decision fork: a signal for the P4 rule.
- Run record fix: the generated manifest held the absolute paths of the node and claude executables (a home path). Commit 1e48a79a2 rewrites them to start with `~` and re-seals the manifest through `sealRun`; `verifySeal` passes before and after. Commit c67e3fe80 still holds the old path in history (no rebase is allowed).

## Gate (P3 part; the full lane gate is in the P4 SUMMARY)

- `bash tests/run-all-402.sh` at a9517dcf6: Phase 402 PASS=26 FAIL=0 SKIP=0. PROVEN.
- Byte cap leg: 8,249 minus 8,119 = 130, at most 600. PROVEN.

## Cost of host runs (P3)

Marker and skill probes 0.17 USD (reported by the host). The 1-turn composition check 0.02 USD. The debug generate of probe A and the 9-probe generate and 9 judge calls: not reported by the runner (no session persistence); ASSUMED under 2 USD on the token sizes of the plan check.

## Risks

- `lib/statusline/next-move-cache.cjs:37` and `scripts/session-start:1867` write under `$HOME/.mindrian` and ignore MINDRIAN_HOME. A plugin session with a temp MINDRIAN_HOME still writes there. Out of scope; a candidate quick task.
- The seal key of the eval lives at `~/.mindrian/eval-seal/larry-voice.key` by design (created by this run). It is needed to verify the seal of the committed run.
- The host-login route bypasses `breachOf`. It is opt-in, recorded in the manifest, and never the default.
- One sample per probe. The score of a single sample can move between runs.
