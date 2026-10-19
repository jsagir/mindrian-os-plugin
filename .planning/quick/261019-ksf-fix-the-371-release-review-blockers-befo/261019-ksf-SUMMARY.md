---
quick_id: 261019-ksf
phase: quick-261019-ksf
plan: 01
subsystem: mcp-startup
tags: [371, release-review, canon-part-9, workday, gate-ledger, 267-pins, 276-ledger]
requires: [371-CLAUDE-RELEASE-REVIEW.md]
provides: [CR-01 fix, CR-02 fix, WR-02 fix, WR-01 room_list ruling restored, IN-02 timeout]
affects: [lib/mcp/tools/gate.cjs, lib/core/session-binding.cjs, lib/core/navigation/room-workday.cjs, lib/core/navigation.cjs, lib/mcp/startup-operations.cjs, lib/mcp/tools/startup.cjs, lib/mcp/tools/room.cjs, tests/test-startup-flows.cjs, tests/test-366-semantic-index-integrity.cjs]
key-files:
  created: []
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/core/session-binding.cjs
    - lib/core/navigation/room-workday.cjs
    - lib/core/navigation.cjs
    - lib/mcp/startup-operations.cjs
    - lib/mcp/tools/startup.cjs
    - lib/mcp/tools/room.cjs
    - tests/test-startup-flows.cjs
    - tests/test-366-semantic-index-integrity.cjs
decisions:
  - "A room-creation gate leaves no gate_raised or gate_closed record in the bound room (Canon Part 9 locality)"
  - "A workday visit is scoped to one room binding (the binding file updated stamp), not to the stdio process"
  - "workdayGateId is the one next-move gate id formula, exported from room-workday.cjs through navigation.cjs"
  - "Task 3 (267 pins and 276 freeze) DONE at 3379e406c after the orchestrator ruled the 2 ui:// resources into the pin and the peer stashed its wave; the pin moved from a 50-tool capture equal to the committed tree"
metrics:
  duration: "about 110 minutes"
  completed: 2026-10-19
  commits: 6
  tasks: "4 of 4 DONE"
---

# Quick 261019-ksf: fix the 371 release-review blockers before the v2.0.0-beta.71 cut. Summary

One line: CR-01, CR-02 and WR-02 are fixed with 3 RED-then-GREEN test legs; the ruled Desktop sentence is back in room_list; test-366 I3 has 300 s; the 267 and 276 re-baseline did not run because the delta gate found 2 added resources outside the ruled delta.

## Task 1: CR-01, CR-02, WR-02 (3 commits)

| Sub-step | Leg | RED (seen before the fix) | GREEN | Commit |
|---|---|---|---|---|
| A, CR-01 | secondRoomStaysLocal | `AssertionError: A briefing for room A does not list the creation card of room B: [{"gate_id":"gate-1e3ab2888a4e0576","header":"Create Secret Beta?",...}]` at HEAD 73aa714f1 | PASS line printed; roomLeaks(A) returns 0 rows for B's gate id, "Secret Beta" and "BETA-CONFIDENTIAL", before and after the approval | a4be33734 |
| B, CR-02 | rebindOpensNewVisit | `AssertionError: a re-bind opens a new visit` (visit_id 3c53e070... equal before and after room_bind) at a4be33734 | PASS line printed; new visit_id, later opened_at, framework_invoked in changes.items, live next-move card; a retry keeps the second visit | ea4ad8078 |
| C, WR-02 | retryHidesOwnCard | `AssertionError: the briefing does not list its own card as pending: [{"gate_id":"workday-4382b979...","header":"What would you like to work on in retry-room?"},{"gate_id":"gate-99d34ecc...","header":"Keep the pilot budget?"}]` at ea4ad8078 | PASS line printed; own card absent, "Keep the pilot budget?" present | 8853e6a2d |

Fix detail:
- gate.cjs `_onGateMinted`: `if (entry.roomCreation === true) return;` with a dated comment, beside the recovery skip. `_roomForMintedGate` and the other mint paths are unchanged.
- session-binding.cjs: new `readSessionBindingGeneration(sessionId, opts)` returns the `updated` stamp or null, never throws; exported; `readSessionBinding` shape unchanged; header note added.
- room-workday.cjs: visit id = sha256(JSON.stringify([roomId, sessionId, navigatorId, bindingGen])); `workdayGateId(visitId)` exported; the pending list drops the visit's own card.
- navigation.cjs: `workdayGateId` lazy wrapper beside `startRoomWorkday`.
- startup.cjs: imports `readSessionBindingGeneration`, passes `bindingGen`; description sentence changed to "Records one local visit checkpoint per room binding: each room_bind starts a new visit, and a retry in the same binding keeps the original baseline."
- startup-operations.cjs `nextMoveForWorkday`: gate id from `navigation.workdayGateId(briefing.visit_id)`.
- realFlows stays green (retry stability, answered status, returning-session pending decisions). No --check script in run-all-371 needed regeneration after the description edit.

## Task 2: room_list Desktop sentences (1 commit)

Commit a34e4cda5 appends to the room_list description: "If the person asks to open the MindrianOS workspace in a browser, say exactly: This runs on your machine from Claude Code. Open Claude Code on this computer and run /mos:dashboard shell to see your room in the browser." Every room-first sentence stays. Results after the edit: arm 6 "the Desktop delivery matches the ruling" PASS. test-270 5/0. test-234 212/0.
- Arm 4 stays red (pre-existing, IN-06): `assert.ok(src.includes('Heavy pipeline work belongs in Claude Code - say so when asked for it here.'))`.
- Arm 6b stays red: it spawns test-267-mcpv2-registration-api and test-276-tool-honesty-findings-closed, both red (Task 3 not applied; the room_list and room_search rows).
- The 276 room_list.(default) HIGH_RISK row stays. The claim "Read-only: listing does not bind or create a room and reads no room contents." is true; no disposition added; reported for the navigator (371 review WR-01).

## Task 3: 267 pins and 276 freeze. DONE (commit 3379e406c)

Final state: commit 3379e406c changes only the 4 fixture files (73 insertions, 10 deletions). Applied after the orchestrator released the hold (the peer stashed its wave as stash@{0} hold-eureka-adapter-wave-for-beta.71; not touched). Before the commit the live wire was recaptured on the clean tree at c2042b4e1 and compared with the 50-tool capture: 0 tool or prompt diffs, resources, templates and instructions equal. The script ran with HEAD c2042b4e1 (refrozen_at.commit). Guard checks before the commit: 0 em-dash or en-dash in the diff, trailing newlines kept, the only other modified tracked file was .planning/STATE.md (not mine, excluded by --only).

Suites run one at a time after 3379e406c:

| File | Result | Red rows | Cause |
|---|---|---|---|
| test-267-mcpv2-registration-api.cjs | 73/0 | none | fixed here |
| test-267-mcpv2-zod4-contract.cjs | 4/0 | none | fixed here |
| test-267-mcpv2-dual-era.cjs | 5/0 | none | fixed here (the resources hunk) |
| test-276-tool-honesty-findings-closed.cjs | 149/2 | room_list.(default) row; room_search.(default) row | room_search pre-existing (IN-06); room_list reported for the navigator; GROUP F passes (47/142) |
| test-369-launch-surface.cjs | 28/2 on the rerun alone (27/3 on the first run) | arm 4; arm 6b; arm 1q once | arm 4 pre-existing (IN-06); arm 6b spawns test-276 findings, which exits 1 on the 2 navigator rows; arm 1q (WR-12 process-title probe) failed once with "titled process with cwd = entry directory is ours: false !== true" and passed on the immediate rerun and in the earlier full run: intermittent, not owned by this plan, reported only |

History of the task (kept for the record):
1. The plan's delta gate failed on the resources check (2 added ui:// resources, detail below). Per the plan, no fixture was edited; the task was reported PARTIAL.
2. Orchestrator ruling (2026-10-19): the resource pin may take both ui:// resources (rooms/v4.html from the reviewed 371 commits; decision/v1.html from c53beea37, reviewed and committed by the orchestrator earlier the same day). The rehearsal script was extended with that one hunk (2 `local.resources` entries, live sortByKey order) and run against HEAD 17c64f51b from the a34e4cda5 live-wire capture (50 tools). The resulting diff was inspected: zod4 +room_create, +room_startup, room_list and room-dashboard descriptions, +2 resources, refreshed_by; zod3 the 2 descriptions; accepted-deltas the 2 membership entries after gate_list; 276 frozen_sweep 47/142 (OK 127, MEDIUM 13, HIGH_RISK 2) and refrozen_at { commit: 17c64f51b }. Trailing newlines kept; 0 em-dash or en-dash.
3. Before the commit, a recapture of the live wire on the current shared tree returned 63 tools: a peer's UNCOMMITTED wave (lib/core/navigation.cjs, lib/core/navigation/engine-projection.cjs, lib/mcp/contract-version.cjs, data/connector-*.json, data/mcp-tool-connectors.json, commands/eureka.md, skills/eureka/SKILL.md, tests/test-198-contract-schema.test.cjs) adds 13 eureka_graph_* tools. Resources, templates and instructions were identical in both captures. The orchestrator then ordered HOLD: no fixture commit. The 4 fixture files (my own uncommitted edits only) were restored to HEAD with `git checkout -- <the 4 files>` after the peer released `.git/index.lock`. Nothing of the peer was staged, reverted or touched.
4. Release of the hold: the peer stashed its wave; recapture equal to the 50-tool capture; applied and committed as 3379e406c (results in the table above). The script used was /tmp/claude-1000/-home-jsagi/5a6547a8-8e41-4939-b894-652f80b09af0/scratchpad/update-fixtures.cjs with its source capture live-wire.json (equal to live-wire-a34e4cda5.json, 50 tools) beside it; it takes the short HEAD sha as its argument. It must run on a tree whose committed tools/list equals the capture, and the 5 suites must run on that same committed tree, not on a tree that carries uncommitted tools.

Rehearsal results that exist (the planned 4-file edit WITHOUT the resources hunk, run on the tree at a34e4cda5 before the peer's wave, then reverted): test-267-mcpv2-registration-api 73/0; test-267-mcpv2-zod4-contract 4/0; test-276-tool-honesty-findings-closed 149/2 (room_list and room_search rows only; GROUP F pass); test-267-mcpv2-dual-era 3/2 (resource uris vs the pin). The edit WITH the resources hunk was generated and inspected but NOT run through the suites (HOLD came first); the expected effect is dual-era green, since its only remaining assertion failure was the resource URI list. UNVERIFIED.

Original gate detail (kept for the record):

Step 1 gate result (live wire at a34e4cda5 vs tests/fixtures/267/wire-snapshot-zod4.json, through the helper's compareToSnapshot with the accepted deltas, plus a raw compare of instructions, prompts, resources and templates):

| Check | Result |
|---|---|
| added tools | room_create, room_startup (exactly) |
| removed tools | none |
| changed descriptions | room_list (commits ecde228dc, ec3d56380, a34e4cda5), room-dashboard (commits ecde228dc, cec325d5b); all traced to reviewed 371 commits or the Task 2 commit |
| changed inputSchema | none after the suite's normalization (the raw byte compare flags every older entry only because the pin stores draft-07 key order; the suites accept that) |
| prompts | act, bind-room, status differ from the pin; all 3 are in the accepted prompts_fix set |
| templates | unchanged |
| resources | 2 ADDED, not in the pin: `ui://mindrian-os/rooms/v4.html` (name mindrian-rooms, lib/mcp/room-app.cjs, reviewed 371 commits ecde228dc, ec3d56380, cec325d5b) and `ui://mindrian-os/decision/v1.html` (name mindrian-decision, lib/mcp/gate-app.cjs, commit c53beea37 quick 261019-ey0, a commit the review skipped) |
| instructions | the pin's instructions field differs from the live RUNTIME_INSTRUCTIONS; it already differed at f6bf6cb92 (pre-existing stale pin); no 267 suite asserts it (dual-era compares the live module constant) |

The 276 gate passed: live 47 tools / 142 branches (OK 127, MEDIUM 13, LOW 0, UNKNOWN 0, HIGH_RISK 2); the 2 new rows are exactly room_create.(default) OK ("no persistence claim found") and room_startup.(default) OK ("a write primitive is reachable"); HIGH_RISK rows are room_list (371) and room_search (pre-existing).

Decision: the plan says "If either gate fails, do not edit any fixture." The resources check failed, so no fixture was edited and no fixture commit exists. A rehearsal of the planned edits (then reverted with `git checkout -- <the 4 fixture files>`) showed what the ruled edits would give: test-267-mcpv2-registration-api 73/0, test-267-mcpv2-zod4-contract 4/0, test-276-tool-honesty-findings-closed 149/2 (room_list and room_search rows only, GROUP F pass), and test-267-mcpv2-dual-era still 3/2 because `assertSurface` compares the resource URI list against the pin and the pin lacks the 2 ui:// resources. The rehearsal script is /tmp/claude-1000/-home-jsagi/5a6547a8-8e41-4939-b894-652f80b09af0/scratchpad/update-fixtures.cjs (it takes the short HEAD sha as its argument and reads the live wire capture live-wire.json beside it). It needs one more hunk, the 2 resource entries in wire-snapshot-zod4.json `local.resources`, to make dual-era green. That extension needs a ruling because `ui://mindrian-os/decision/v1.html` traces to a commit outside the reviewed set.

## Task 4: test-366 timeout and final verification (1 commit)

Commit 17c64f51b: runGate spawnSync timeout 120000 -> 300000 ms with a dated comment. Run alone: 12 passed, 0 failed, 96 s wall.

Final verification, run one at a time in this order, Node v24.21.0, nothing else running:
1. `bash tests/run-all-371.sh`: exit 0, "Phase 371 local acceptance: PASS".
2. `LC_ALL=C bash tests/run-all-366.sh`: exit 0, PASSED=75 FAILED=0 SKIPPED=0 KNOWN=1 (the known leg is the pin 355 direction agreement).
3. Named suites:

| File | Result | Red rows | Red cause |
|---|---|---|---|
| test-369-launch-surface.cjs | 28 passed, 2 failed | arm 4; arm 6b | arm 4 pre-existing (IN-06); arm 6b reported for the navigator (it needs the 267 registration and 276 findings suites green: Task 3 ruling plus the room_list row) |
| test-267-mcpv2-app-views.cjs | 22/0 | none | - |
| test-267-mcpv2-registration-api.cjs | 72/1 | live tools/list count (50) != pin (48) | Task 3 not applied (gate failed); fixed by the rehearsal edits |
| test-267-mcpv2-zod4-contract.cjs | 2/2 | check (a) room_list, room-dashboard descriptions; check (b) extras room_create, room_startup membership plus the 2 descriptions | Task 3 not applied; fixed by the rehearsal edits |
| test-267-mcpv2-dual-era.cjs | 3/2 | era 2025 and era 2026: resource uris must equal the snapshot (plus the tool deltas) | Task 3 not applied; the 2 ui:// resources need a ruling (one traces to c53beea37, outside the reviewed set) |
| test-270-tool-schema-budget.cjs | 5/0 | none | - |
| test-276-allowed-unverified-contract.cjs | 11/0 | none | - |
| test-276-b6-parameter-describe.cjs | 5/0 | none | - |
| test-276-busy-timeout-propagation.cjs | 20/0 | none | - |
| test-276-claim-write-primitive.cjs | 44/0 | none | - |
| test-276-meeting-gate-wiring.cjs | 14/0 | none | - |
| test-276-orchestration-scout-honesty.cjs | 12/0 | none | - |
| test-276-room-content-honesty.cjs | 26/0 | none | - |
| test-276-spine-events-typed-reason.cjs | 16/0 | none | - |
| test-276-theo-description-parity.cjs | exit 0 | 5 constants DIFFER (coordination signal, never a gate, by its own output) | pre-existing, Theo side |
| test-276-tool-honesty-findings-closed.cjs | 147/4 | room_list row; room_search row; frozen_sweep.tools 45 vs 47; frozen_sweep.branches 140 vs 142 | room_search pre-existing (IN-06); room_list reported for the navigator; the 2 frozen_sweep rows: Task 3 not applied |
| test-276-tool-honesty-switch-branches.cjs | 17/0 | none | - |

## Deviations from plan

1. [Plan rule] Task 3 fixtures not edited: the plan's delta gate failed on the resources check (2 added ui:// resources). The plan's stated fallback was followed (no fixture edit, PARTIAL, full delta recorded above).
2. A peer commit 08ea0a0f8 (docs: plant SEED-134) landed on main between 8853e6a2d and a34e4cda5. It is not from this quick and was not touched.

No auth gates. No Brain or Theo call. No room write outside lib/core/navigation.cjs (the new test legs log work only through navigation.logMemoryEvent, as realFlows does).

## Report-only items (not fixed, out of scope by ruling)

- WR-03 (change list bounded only at one end; truncated flag), WR-04 (room birth approval relay recorded as navigator; SEED-114), WR-05 (replay_lookup_failed treated as final in rooms.html), IN-01 (jsdelivr SDK without SRI), IN-03, IN-04, IN-05.
- STARTUI371-08 real-ChatGPT checkpoint: untouched, still open (0 of 3 UAT checks).
- 276 room_list.(default) HIGH_RISK row stays: a true claim with no write; navigator decision (disposition or wording).
- 369-launch-surface arm 4 (pre-existing) and arm 6b (depends on Task 3 and the room_list row) stay red.
- The 267 pin's `instructions` field is stale since before f6bf6cb92 and unasserted.

## Known stubs

None.

## Threat flags

None beyond the plan's register. T-ksf-01 and T-ksf-02 mitigations are in place and tested.

## Self-Check: PASSED

Files: all 9 modified files exist at HEAD. Commits a4be33734, ea4ad8078, 8853e6a2d, a34e4cda5, 17c64f51b exist and are ancestors of HEAD 17c64f51b. `git diff 73aa714f1..HEAD` carries 0 em-dash or en-dash additions.

---

STATUS: DONE
CHANGED: a4be33734 (lib/mcp/tools/gate.cjs, tests/test-startup-flows.cjs); ea4ad8078 (lib/core/session-binding.cjs, lib/core/navigation/room-workday.cjs, lib/mcp/tools/startup.cjs, tests/test-startup-flows.cjs); 8853e6a2d (lib/core/navigation/room-workday.cjs, lib/core/navigation.cjs, lib/mcp/startup-operations.cjs, tests/test-startup-flows.cjs); a34e4cda5 (lib/mcp/tools/room.cjs); 17c64f51b (tests/test-366-semantic-index-integrity.cjs); 3379e406c (tests/fixtures/267/wire-snapshot-zod4.json, tests/fixtures/267/wire-snapshot-zod3.json, tests/fixtures/267/zod4-accepted-deltas.json, tests/fixtures/tool-honesty/276-dispositions.json). SUMMARY.md written, not committed. No push. stash@{0} not touched. Peer commits seen on main during the run: 08ea0a0f8, c2042b4e1 (not mine). .planning/STATE.md is modified in the tree by another session, not by this executor.
VERIFIED: node tests/test-startup-flows.cjs: 5 PASS lines (2 realFlows + CR-01 + CR-02 + WR-02), each new leg seen RED first. bash tests/run-all-371.sh: exit 0, PASS. LC_ALL=C bash tests/run-all-366.sh alone: 75 passed, 0 failed, 1 known (both at 17c64f51b). After 3379e406c, one at a time: test-267-mcpv2-registration-api 73/0; test-267-mcpv2-zod4-contract 4/0; test-267-mcpv2-dual-era 5/0; test-276-tool-honesty-findings-closed 149/2 (room_list, room_search rows); test-369-launch-surface 28/2 (arm 4, arm 6b; arm 1q intermittent, passed on the rerun). test-270 5/0, test-234 212/0 at a34e4cda5.
UNVERIFIED: run-all-371 and run-all-366 were not rerun after 3379e406c (a fixture-only commit; neither runner reads the 4 fixture files). The real ChatGPT host (STARTUI371-08). Whether Claude Desktop keeps one stdio server process across chats (the CR-02 fix covers both cases).
RISKS: when the peer's stashed wave lands (13 eureka_graph_* tools), the 267 pins and the 276 frozen sweep move again and need their own re-baseline. The 276 room_list row and the 369 arm 4 and arm 6b legs stay red until the navigator rules. Arm 1q is intermittent. The tri-polar read: a host that calls room_bind on every prompt would open a new visit per prompt (the plan proved no writer runs per prompt today).
NEXT: cut v2.0.0-beta.71 after the main session reviews the 6 commits; rule the 276 room_list row (disposition or wording) so arm 6b can go green.
