---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
verified: 2026-10-04T12:00:00Z
status: gaps_found
score: 6/8 goal clauses verified (2 partial or failed; see Gaps)
overrides_applied: 0
re_verification:
  previous_status: none
gaps:
  - truth: "A decision gate is a real button with the recommendation preselected, and a person can reach it from the shipped shell"
    status: partial
    reason: "The button, the preselection and the recovery contract are built and proven, but only for a gate the test harness raises. The shipped client never calls askClaude (grep of ui/shell/client finds no call; only tests/e2e-369/*.cjs and tests/test-369-*.cjs call it). A default launch runs MOS_PROPOSAL_SOURCE=fixed, which answers no_proposal. listOpenGates and readGate read only gates minted into the same browser session by askClaude (gatesOf(key)), so a gate Larry raises in Claude Code through gate_render never appears in the shell. A person using the shell as launched cannot start the Approve flow."
    artifacts:
      - path: "ui/shell/server/actions.ts"
        issue: "listOpenGates / readGate read only gates minted by askClaude into the browser session's in-memory map; no path surfaces a gate raised by the room's own gate_render"
      - path: "ui/shell/client"
        issue: "no control calls the askClaude action; the ADAPTER-RULING hop 'the shell raises the gate on the browser session' is not built"
    missing:
      - "A browser control that raises a gate (calls askClaude), or a read path that surfaces gates minted by Larry's gate_render in the same room"
      - "Launcher default (or the control's own path) that does not answer no_proposal"
  - truth: "The shell ships as release-built assets and the payload ceiling still passes (TS369-08)"
    status: failed
    reason: "lib/ui-shell/dist is tracked, fresh (build-ui-shell --check: source hash f9e43808, 103 files), has no node_modules, and release.sh runs the freshness gate. But check-release-payload-ceiling fails: npm-shrinkwrap.json declares hasInstallScript:true for node_modules/sharp (optional dependency of next, introduced by 369-19's RULE 8 ruling). Re-measured in this verification (run-all-369 FAIL=1; doctor --acceptance harness-policies). A release cut would abort."
    artifacts:
      - path: "npm-shrinkwrap.json"
        issue: "sharp hasInstallScript:true would run an install script on every user machine"
    missing:
      - "scripts/release-lib/prune-shrinkwrap.cjs at the cut (Phase 369.1 D-16 / D-16a 'prune', ruled by the navigator 2026-10-04); TS369-08 stays [ ] until it lands"
  - truth: "A restarted shell tells a person an old decision was already recorded"
    status: partial
    reason: "Gate records live in shell memory. After a restart an old gate id reads 'This decision is no longer open' instead of 'already recorded'. The room replays correctly (one node, replayed:true). Wording and in-memory record only; no data loss."
    artifacts:
      - path: "ui/shell/server/actions.ts"
        issue: "answeredOf/gatesOf maps are in-process; no read from the room's durable anchor on unknown_gate"
    missing:
      - "On unknown_gate, check the room's durable anchor (decision node / gate_answer memory_event) and show 'already recorded'"
  - truth: "The one recoverable journey passes every time (SHELL369-11)"
    status: partial
    reason: "journey.cjs step 6 (restart both servers, recover) timed out once in 10 runs in the close gate (60 s waiting for the read copy to hold 19 items). Cause not established. It passed in this verification's aggregator run."
    artifacts:
      - path: "tests/e2e-369/journey.cjs"
        issue: "intermittent step 6 timeout, about 1 in 10"
    missing:
      - "Root-cause the step 6 catch-up stall (ReplicaProvider restart path) and capture host load at failure"
  - truth: "Phase-caused baselines are refreshed (369 left three reds with no or partial owner)"
    status: failed
    reason: "Re-measured here. (1) test-267 zod4 contract fails: tool:room_list description diff from 369-22; pinned accepted set not refreshed. (2) 267 lockstep Check 1 and 2 (package.json vs package-lock.json) from 369-19, no owner. (3) tests/test-369-bakeoff-agent-native.cjs --built: 12 passed, 1 failed (stale 'answered:false' on second approve, since 369-26 idempotent replay). All are phase-caused, small, and unowned except the sharp item above."
    artifacts:
      - path: "tests/test-267-mcpv2-zod4-contract.cjs"
        issue: "pinned accepted diff set missing tool:room_list:description"
      - path: "tests/test-369-bakeoff-agent-native.cjs"
        issue: "stale single-use assertion on --built arm"
    missing:
      - "Refresh the zod4 pinned set with a reason; give the lockstep red an owner (release shrinkwrap step regenerates package-lock.json); one-line assertion update in the retired candidate's --built smoke"
deferred: []
human_verification:
  - test: "Record the Claude Desktop and Cowork host build numbers for the D-03 plain line"
    expected: "Build numbers written into 369-MANUAL-VERIFICATION.md next to the navigator's 2026-10-04 approval. The navigator approved the two sentences on both surfaces but reported no build numbers."
    why_human: "Only a person with the host app open can read its build number"
  - test: "MCPV2-13 Claude Desktop smoke (Phase 267's owed human check)"
    expected: "Desktop lists the MindrianOS tools and room_list shows the two D-03 sentences"
    why_human: "Real host application; owned by Phase 267 follow-ons, not 369's gate"
  - test: "Open navigator items (wording): NOT_FOUND 404 copy (369-20), duplicate 'Reconnect now' placement and 'Catching up' fallback (369-24), Research A5 (rank-only recommendation vs the 0.70 Brain-confidence rule)"
    expected: "Navigator rulings recorded"
    why_human: "Product and canon judgment"
---

# Phase 369: UI shell over the MindrianOS MCP server - Verification Report

**Phase Goal:** Ship the fourth surface: a browser workspace whose only access to a room is the MindrianOS MCP server (Streamable HTTP, per-connection session mode), where a decision gate is a real button with the recommendation preselected, the room view stays current without a reload through a one-way RxDB read copy, every pixel follows Design Canon v3, no outside host is contacted, CJS-only is lifted for TypeScript under erasable-only rules, and the shell ships as release-built assets never built on the user's machine.
**Verified:** 2026-10-04
**Status:** gaps_found
**Re-verification:** No, initial verification

The starting stance was that the goal was missed. The evidence moved that stance on six of the eight clauses. It held on two, and on a third in part. A person cannot yet start a decision from the shipped shell, and the release payload ceiling still fails.

## Goal Achievement

### Observable Truths (goal clauses and ROADMAP contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only access to a room is the MCP server (legacy sessionful Streamable HTTP, one session per browser session) | VERIFIED | `grep` of ui/shell/server, client, app and ui/shared/src for fs, sqlite and child_process imports finds one hit: `server/control.ts` writes the launcher control-token file (not a room). Actions go through `ui/shared/src/mcp-session-pool.ts`. `test-369-shared-core` PASS=13, `test-369-sessionful-acceptance` PASS=6 re-run in this verification's aggregator pass. |
| 2 | A decision gate is a real button with the recommendation preselected | VERIFIED as a component | `gate-model.ts` derives `preselected` from `rendered.contract.recommended` (single-select Shape F, one recommended max); `GateView.tsx:180` seeds selection from it. `test-369-gate-web-mapping` 22, `gate-button.cjs` 15 arms PASS in this run (lost response, replay, stale_subject, persistence failure). |
| 2b | A person can reach that gate from the shipped shell | FAILED (known, recorded) | No client call to `askClaude`; default `MOS_PROPOSAL_SOURCE=fixed` answers `no_proposal`; gates are per-browser-session in-memory, so Larry's `gate_render` never shows. See Gaps 1. |
| 3 | Room view stays current without reload via one-way RxDB read copy | VERIFIED | `ui/shared/src/replica.ts` calls `replicateRxCollection` with `pull` only (no `push` key); dev-mode plugin never imported; `replica.cjs` 12 arms PASS in this run (catch-up, live update, 200-write burst, restart, hard delete, warm reload pulls 0). Metrics this run: catch_up 855 ms, live_update 119 ms, lost_writes 0, restart_missing 0. Change feed side: CHG369/FEED369 tests all PASSED in the aggregator. |
| 4 | Every pixel follows Design Canon v3 | VERIFIED (automated) plus navigator visual approval | `test-369-canon-skin` 30, `egress-and-canon` C1-C11 PASS (aggregator run). Radius rule: only exceptions are the cobalt circle (`base.css`) and BlockNote vars set to 0. Navigator "approved" on the 31 captures 2026-10-04 (369-MANUAL-VERIFICATION.md). Composition items accepted. |
| 5 | No outside host is contacted | VERIFIED | `egress-and-canon` C1 PASSED in this run (runtime request log, loopback only; 4 fonts bundled). Strings such as nextjs.org and json-schema.org in dist are library text, not requests; the runtime log is the evidence. |
| 6 | CJS-only lifted for TypeScript under erasable-only rules | VERIFIED | CLAUDE.md lines 134-136 carry the lifted rule and the erasable-only constraints; `test-369-constitution` 7, `ts-erasable-gate` 8, `walled-manifest` 8, `hook-require-graph` 5 (0 TS reachable from hooks), engines floor `>=22.18.0` in package.json. No `.ts` under lib/ outside lib/ui-shell. Exact-floor Node 22.18.0 leg SKIPPED (ENV GAP, binary absent). |
| 7 | Shell ships as release-built assets, never built on the user's machine, payload ceiling holds | PARTIAL | dist tracked (262 files), `build-ui-shell.cjs --check` fresh, no node_modules in dist, release.sh runs freshness gate and never builds. Payload ceiling FAILS on sharp (Gaps 2). `next`, `react`, `react-dom` are root dependencies installed per machine by navigator ruling (RULE 8), not built. |
| 8 | Chassis chosen by navigator at a Decision Gate (D-07) | VERIFIED | `369-BAKEOFF-DECISION.md` records "workroom (Recommended)" with transplants and the RULE 8 ruling. Bake-off measures for both candidates in `ui/bakeoff/results.json`; `test-369-bakeoff-measure` PASS=12 in the aggregator. |

**Score:** 6 of 8 clauses fully verified (1, 2 as component, 3, 4, 5, 6, 8 verified; 2b and 7 not). Counted as 6/8 because 2 and 2b are one goal clause and the clause fails at the user-reach level.

### Probe and Aggregator Execution (own process, this verification)

| Command | Result | Status |
|---------|--------|--------|
| `bash tests/run-all-369.sh` | PASS=54 FAIL=1 SKIP=1, exit 1. FAIL = release payload ceiling (sharp). SKIP = exact-floor Node 22.18.0. Matches the close gate exactly. All five core e2e legs PASSED (replica, gate-button, views, egress-and-canon, journey; human-only HTTP arm 8 "PASS 8 over real HTTP"). | Matches claim |
| `node scripts/build-ui-shell.cjs --check` | exit 0, dist fresh, 103 files | PASS |
| `node tests/test-267-mcpv2-zod4-contract.cjs` | PASS=2 FAIL=2: `tool:room_list` description diff | FAIL (phase-caused) |
| `node tests/test-369-bakeoff-agent-native.cjs --built` | 12 passed, 1 failed | FAIL (phase-caused, stale assertion) |
| `node scripts/doctor.cjs --acceptance` | 21/22, failed `harness-policies` | Matches claim (sharp) |

### Requirements Coverage

All 59 IDs appear in plan frontmatter (59 unique IDs across the 32 plans) and in the REQUIREMENTS.md Phase 369 block: no orphans, no unclaimed rows.

| Family | IDs | REQUIREMENTS.md state | Assessment |
|--------|-----|----------------------|-----------|
| TS369 | 01-07 | `[x]` with Measured lines | SATISFIED (tests re-run green; 04 exact-floor leg SKIPPED, ENV GAP, stated in its Measured line) |
| TS369 | 08 | `[ ]` Open with stated reason | BLOCKED on payload ceiling (sharp) -> Phase 369.1 D-16/D-16a |
| CHG369 | 01-06 | `[x]` | SATISFIED |
| FEED369 | 01-05 | `[x]` | SATISFIED (FEED369-04 note: separate room_list zod4 diff is 369-22's) |
| SESS369 | 01-04 | `[x]` | SATISFIED |
| GREC369 | 01-05 | `[x]` | SATISFIED; GREC369-05 limit: post-restart wording (Gaps 3) |
| HUM369 | 01-03 | `[x]` | SATISFIED (HTTP arm 8 real HTTP re-run) |
| RXP369 | 01-03 | `[x]` | SATISFIED |
| CANON369 | 01-07 | `[x]` | SATISFIED; 06 wording-only open items |
| SHELL369 | 01-08 | `[x]` | SATISFIED |
| SHELL369 | 09 | `[x]` | SATISFIED on the navigator's plain-line approval; host build numbers not reported (human item). Related unmarked red: zod4 `room_list`. |
| SHELL369 | 10 | `[x]` | SATISFIED for the component; reach limit in Gaps 1 |
| SHELL369 | 11 | `[x]` | OVERSTATED. Marked closed, but the Measured line itself says the journey raises its gate through the harness. "Decide" is not reachable by a person from the shipped shell, and step 6 flakes about 1 in 10. Treat as partial. |
| BAKE369 | 01-04 | `[x]` | SATISFIED; BAKE369-02 `--built` stale assertion red |
| CM369 | 01-03 | `[x]` | SATISFIED (counts only) |

58 of 59 closed in the file; this report holds SHELL369-11 as partial and TS369-08 as open, so the honest count is 57 closed, 1 partial, 1 open.

### Anti-Patterns and Debt Markers

Not exhaustively scanned across all 32 plans' files. Targeted checks: the `unconfiguredSource` path in `ui/shell/server/actions.ts` throws `no_proposal` by default (see Gaps 1; it is the substance of the reach gap, not an unflagged stub). No evidence found of a 369 commit causing an unrecorded red. Recorded reds are all in the Gaps list or owned elsewhere (test-198 on-stop 618 against 570 since July; the Phase 289 cascade reds; test-354 stamp drift).

### Research trail (VALIDATION row 369-31-02)

The close recorded the room copy as blocked. In this verification the room copy exists at `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md` and `cmp` against the mirror at `/home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md` exits 0. It is committed in /home/jsagi as `94878236d` ("room write authorized by the navigator 2026-10-04"). VALIDATION row 369-31-02 can flip to green; that file was not edited here. This removes one of the four reasons `nyquist_compliant` is false, leaving three (zod4 room_list, stale `--built`, sharp).

### Human Verification Required

1. Desktop and Cowork host build numbers for the D-03 line. Navigator approved; no build numbers recorded.
2. MCPV2-13 Claude Desktop smoke (owed by Phase 267 follow-ons).
3. Open navigator wording items: NOT_FOUND copy, duplicate "Reconnect now", "Catching up" fallback, Research A5.

### Gaps Summary

The engine is solid and reproduced: the change feed, the one-way read copy, the human-only gate answer, the recovery contract, Canon v3 and the loopback-only egress all pass on re-run, and 54 of 56 aggregator legs agree with the close gate. What the phase did not deliver is the whole goal as a person would live it. A person cannot start a decision from the shipped shell, because nothing in the browser raises a gate and a gate raised by Larry in Claude Code is invisible to it. The release cannot be cut until the sharp install script is pruned (already owned by Phase 369.1 D-16/D-16a). Smaller items: restart wording, one journey flake, and three small baseline reds (zod4, lockstep, stale assertion) that 369 caused. Feed gaps 1, 3 and 4 plus the two small reds to `/gsd-plan-phase 369 --gaps`; gap 2 is Phase 369.1's.

---

_Verified: 2026-10-04_
_Verifier: Claude (gsd-verifier)_
