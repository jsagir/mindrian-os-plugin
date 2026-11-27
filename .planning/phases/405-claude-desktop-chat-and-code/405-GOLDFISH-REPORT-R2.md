---
phase: 405
round: 2
target: 405-DESIGN.md r2.1 (reviewers did not see r2.2: 3.10, SP8, slice 10)
reviewers:
  design_critic: completed (2 Blocker, 14 Major, 10 Nit) - 405-GOLDFISH-R2-design.md
  implementation_readiness: completed (4 Blocker, 10 Major, 10 Nit) - 405-GOLDFISH-R2-implementation-readiness.md
raw_counts: {blocker: 6, major: 24, nit: 20}
merged_counts: {blocker: 6, major: 18}
outcomes: {FIXED: 23, CUT: 0, CONTESTED: 0, OWNER: 1}
owner_items_new: 1 (O8)
owner_rulings_applied: [OR-8, OR-9]
clean_round: false
next: 405-DESIGN.md r3; a narrow round 3 on 3.3, 3.5, 3.7a and slice 9
---

# 405 Goldfish round 2: resolution

Rule: each merged Blocker and Major has one outcome. Duplicates across the two reviewers are merged.

## Blockers

| Id | Source ids | Finding | Outcome | Where in r3 / evidence |
|---|---|---|---|---|
| R2B1 | DC2-B1, DC2-M5, IR2-M3 | Refused set too narrow and keyed on fields that do not exist; "ordinary" includes material steps and egress approvals | FIXED | 3.5: attested = browser_nonce or the existing elicitation check; refusal by effect through `isMaterialApproval` (roomCreation, TRUTH_CLAIM_TYPES promotions incl. opportunity, needs_evidence, goal-gate, material_step, research egress, Eureka pair-screen); renderers text, none, askuserquestion; AC4.1 one row per path |
| R2B2 | DC2-B2, IR2-M6 | `.mcpb` drop list removes folders the server reads at run time | FIXED | 3.7a: full mos-desktop payload; a run-time read scan test (AC5a.3) and one call per class (AC5a.4) |
| R2B3 | IR2-B1 | THEO line pinned by sha (test-359:88) and by a harness policy (contract-parity-larry.json:46) | FIXED | 3.6: final line, 1999 bytes, new sha given; AC7.0 re-bases both pins and runs the policy |
| R2B4 | IR2-B2 | checkPayload refuses @scope, symlinks, needs plugin.json | FIXED | 3.7a: separate checkMcpbPayload; `--no-bin-links`; SP7 tests @ paths with an If B bundling route |
| R2B5 | IR2-B3 | No launcher marker; collision rule would hit the CLI server | FIXED | 3.7a: scripts/mcpb-entry.cjs sets `MINDRIAN_LAUNCHER=mcpb`; collision and heartbeat on the marker; AC5a.6 |
| R2B6 | IR2-B4 | Release lockstep steps unnamed | FIXED | slice 9: Step 6.8b build pre-tag, Step 9.x `gh release upload --clobber` after push, RULE 5 place 5 sub-item, release-process.md text, verify-release check, both step-hash fixtures, network note, receipt field |

## Majors

| Id | Source ids | Finding | Outcome | Where in r3 / evidence |
|---|---|---|---|---|
| R2M1 | DC2-M1 | Desktop runtime may be Electron Node | FIXED | SP7 legs (node:sqlite with timeout, execPath, 367 runner from inside); fingerprint `sqlite_timeout_ok`; B goes to the owner |
| R2M2 | DC2-M2 | No guarded Brain route in chat on the primary path; "when available" dropped | FIXED | 3.6 option (c): theo-context is the chat route (OR-7, OR-8); shim ACs only with the fallback; "when available" kept |
| R2M3 | DC2-M3 | Instructions forwarding untested; Part 8 text may not arrive | FIXED | SP6 leg d canary; If B copies the sentence into room_bind and room_list (AC7.4) |
| R2M4 | DC2-M4 | theo-context never installed or checked | FIXED | Answered by r2.2 3.10 and OR-8: shipped key-free in the plugin, connector fallback, doctor probe, SP8 render leg |
| R2M6 | DC2-M6, IR2-M5 | client_write_id ignores existing keys, no conflict rule, race, no storage | FIXED | 3.3: reuse dedupe_key, source_segment upsert, gate_id replay; new `write_keys` table only for artifact_file and graph_write, migration in the room-db chain, BEGIN IMMEDIATE pending claim, conflict and in-progress reasons; AC3.3 to AC3.5 |
| R2M7 | DC2-M7 | Three artifacts on one room.db; no ordered schema floor; drift visible only in the doctor | OWNER | Drift reporting in chat is FIXED (3.7a `install_versions`, AC5a.8). The write refusal for an older server is a cross-surface behaviour change: O8 |
| R2M8 | DC2-M8, IR2-M4 | SP7 If B changes the OR-6 artifact without the owner; SP1 If A conflicts with OR-6; SP2 If B undesigned; two-server rule; SP4 on the wrong host | FIXED | section 6: SP7 B = NEEDS_HUMAN with evidence; SP1 A = doctor note only; SP2 B = slice 3 blocked, back to EGM; two-server If A/If B; SP4 on the extension |
| R2M9 | DC2-M9 | App nonce carrier, lifetime and binding undefined | FIXED | 3.5: result `_meta` `mindrian/app_nonce`, single-use, gate and binding bound, 10 min TTL, `card_expired`, `card_binding_mismatch`, `appRouteOf` separate from `routeOf`; SP6 leg c; slice 4b |
| R2M10 | DC2-M10 | Eureka spawn on P4 unreviewed | FIXED | 3.8: refused `local_session_required` on a marked process except an attested pair-screen approval; AC4.4 |
| R2M11 | DC2-M11, IR2-M1 | `/mos:rooms adopt` does not exist; birth and adopt impossible in chat | FIXED | 3.2a builds adopt (register in place, F.1, born wired); hookless texts route birth and adopt to the Code tab (AC2.5, AC2.6) |
| R2M12 | DC2-M12 | Heartbeat proves a spawn, not a chat reach | FIXED | 3.7a `chat_reached` on the first non-Claude-Code tools/call; doctor state `loaded_never_reached_by_chat` |
| R2M13 | DC2-M13 | Receipt cannot tell which disk without SP3 | FIXED | receipt carries `host_hash` and `cloud_session`; GM4 marked conditional on SP3 |
| R2M14 | DC2-M14 | sqlite-vec native per-OS package | FIXED | 3.7a: bundle darwin-arm64, darwin-x64, win32-x64 packages; degrade `vector_native_missing`; AC5a.5 (install method GUESS, pinned in slice 5a) |
| R2M15 | IR2-M2 | Rule breaks about 104 test files; refusal shape and sources unnamed | FIXED | 3.2: refusal inside `refusal`; every source named incl. session.primary and operator pins; slice 2a fixture migration helper, named suites |
| R2M16 | IR2-M7 | Census counts and env undefined; 367 file edited | FIXED | AC4.5: new tests/test-405-census-bridge.cjs, env stated, 0 tools added, 69 and 7 unchanged |
| R2M17 | IR2-M8 | 3.9 tool set unnamed | FIXED | 3.9 lists the 12 call sites and their tools; snapshot diff stated |
| R2M18 | IR2-M9 | Parent-exe method, budget, salt unnamed | FIXED | 3.1: per-OS method, timeouts, once at start, `unknown` fallback, salt file 0600; AC1.2, AC1.3 |
| R2M19 | IR2-M10 | Mirror check and tool-schema budget not in gates | FIXED | section 7 common gates add mirror --check and test-270; slices 3 and 6 update AFTER |

## Nits

| Id | Outcome |
|---|---|
| DC2-N1 birth fence wording | FIXED (rooms home in 3.2 and 3.8) |
| DC2-N2 instructions statement conflict | FIXED (3.3 no longer claims byte-identical; 3.6 and AC7.0 own it) |
| DC2-N3 GB6 CUT justification | FIXED (non-goals: the fence is the server rule; no script change) |
| DC2-N4 signing | FIXED (3.7a `mcpb sign` if supported; R16) |
| DC2-N5 Windows parent method | FIXED (3.1) |
| DC2-N6 rooms_home_mismatch | FIXED (3.7a doctor state) |
| DC2-N7 observed range | FIXED (`change_observed`) |
| DC2-N8 THEO wording | FIXED (3.6: "no room content to any Theo server") |
| DC2-N9 one install path | FIXED (goal 1 says two installs) |
| DC2-N10 MCP prompts as slash commands | FIXED (UNVERIFIED; SP6 leg e) |
| IR2-N1 prompts count | FIXED (9 calls) |
| IR2-N2 doctor helper cite | FIXED (:98, :130) |
| IR2-N3 call sites | FIXED (12, listed in 3.9) |
| IR2-N4 test seam convention | FIXED (MINDRIAN_TEST_MODE=1) |
| IR2-N5 harness manifest name | FIXED (data/harness-manifest.json) |
| IR2-N6 order of risks and ACs | FIXED (section 11 in order; slice 9 ACs in order) |
| IR2-N7 run-all and AC map | FIXED (section 9) |
| IR2-N8 setup Desktop branch | FIXED (AC5a.9) |
| IR2-N9 user_config mapping | FIXED (3.7a env literal) |
| IR2-N10 real-room receipt field | FIXED (AC9.8) |

## Round 1 outcomes re-checked by round 2

GB1, GM4, GM7 were partly fixed and are completed by R2B1, R2M13, R2M12. GB6 justification corrected (DC2-N3). GM5 and ZO-N2 CONTESTED outcomes held.

## Owner items

| Id | Question | Recommended |
|---|---|---|
| O8 | When a newer MindrianOS has written a room, should an older copy (for example a stale extension) refuse to write that room until it is updated? | Yes: refuse writes with `room_schema_newer` and one update line; reads stay allowed. Until ruled, r3 reports the drift only. |

Conditional (not asked now): if SP7 = B, the owner gets the NEEDS_HUMAN question of 3.7a with the evidence.
