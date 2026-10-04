---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 41
subsystem: mcp-baselines
tags: [gap-closure, gap-4, baselines, zod4, wire-snapshot, tool-honesty, gate-base, bakeoff, d-03, d-07, d-15]
requires: [369-33, 369-36, 369-38, 369-39, 369-40]
provides:
  - "both 267 wire snapshots carry the live gate_list, gate_render and gate_answer text; zod3 carries the D-03 room_list sentences (gap 4 closed)"
  - "zod4-accepted-deltas pins gate_list membership; 267-BASELINE CONNECTOR_DESCRIPTORS 35; test-270 AFTER 48 tools / 57056 bytes"
  - "276 honesty sweep re-frozen at 45 tools / 140 branches; gate_render F-9 re-dispositioned documented-no-action/MEDIUM"
  - "GATE_BASE = cd27faa94eabbb6d69a5c0d2541abba4fe131784 (the last gate.cjs commit), moved once, in its own dated commit"
  - "regenerated shell adapter (gateList, GateRenderArgs mirror_of and approving) and rebuilt dist"
  - "agent-native --built smoke asserts the replay contract (GREC369-02)"
  - "Theo handoff note for the changed gate contract"
affects: [369-42 and later 369 plans (every pin is now at the 48-tool state), 369.1 (zod importer baseline names its two moved executables)]
tech-stack:
  added: []
  patterns:
    - "surgical single-string description replacement in both wire snapshots; new tool and schema deltas captured from the live wire"
    - "one dated re-pin of GATE_BASE after the last gate.cjs commit of a gap closure"
key-files:
  created:
    - /home/jsagi/Theo/.planning/HANDOFF-2026-10-04-mos-gate-contract-369-gap-closure.md (untracked, additive, no git run in Theo)
  modified:
    - tests/fixtures/267/wire-snapshot-zod3.json
    - tests/fixtures/267/wire-snapshot-zod4.json
    - tests/fixtures/267/zod4-accepted-deltas.json
    - tests/fixtures/267/zod-importers-baseline.txt
    - .planning/phases/267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp/267-BASELINE.md
    - tests/test-270-tool-schema-budget.cjs
    - tests/fixtures/tool-honesty/276-dispositions.json
    - tests/test-365-never-do-gate.cjs
    - tests/test-289-cli-card-dual-era.cjs
    - tests/test-369-bakeoff-agent-native.cjs
    - ui/shared/src/generated/mcp-adapter.ts
    - lib/ui-shell/dist/ (rebuilt)
key-decisions:
  - "gate_render F-9 moved from description-correction/OK to documented-no-action/MEDIUM instead of editing gate.cjs: plan 369-33 made the description honest about the room record, so the static sweep (which cannot follow the ledger observer callback) reads a weak claim with no reachable write; gate.cjs is pinned at GATE_BASE and this plan does not touch it"
  - "the two scripts/mindrian-*.cjs runtime executables that plan 369.1-04 moved out of bin/ are added to the zod-importers baseline (they were baselined as bin/ entries): a fixture-only move that clears check (d) of the zod4 contract"
  - "no data/*.json file is committed: the orchestrator's regeneration at 4d61eeb9f is current, all three --check calls read OK"
metrics:
  duration: "about 75 minutes"
  completed: 2026-10-04
  tasks: 3
  files: 12
---

# Phase 369 Plan 41: Gate closure baselines Summary

Every pin the gap closure's MCP changes moved (gate_list, gate_render mirror_of and approving, the new gate_answer states) is moved once, GATE_BASE points at the last gate.cjs commit (cd27faa94), and the two phase-caused reds in this plan's remit (zod4 room_list description, stale single-use bake-off assertion) are green.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | ef7814d8b | 267 wire snapshots, zod4 accepted deltas, zod importers baseline, 267-BASELINE, test-270 byte history |
| 2 | cb8cebaa7 | 276 honesty sweep re-freeze and gate_render F-9 re-disposition |
| 2 | 0a4e5f84c | GATE_BASE re-pin to cd27faa94 (its own dated commit) |
| 2 | 15988a24d | test-289 dual-era: each leg draws the card under its own gate id (gate_id_in_use, WR-05) |
| 3 | 391b3ae0b | regenerated shell adapter and rebuilt dist |
| 3 | 359f7cba2 | bake-off --built smoke asserts the replay contract |

The Theo note is outside this repository (no git command run there).

## Measured before and after

| Pin | Before | After |
|-----|--------|-------|
| live tools/list | 48 vs snapshot 47 | 48 vs 48 |
| wire-snapshot-zod3 | room_list, gate_render, gate_answer old text (room_list lacked the D-03 sentences) | live text; D-03 sentences present verbatim |
| wire-snapshot-zod4 | 47 tools, stale gate_render and gate_answer | 48 tools: gate_list added (with title, 369-13 style), gate_render and gate_answer description and schema from the live wire |
| zod4-accepted-deltas zod4_other | 4 membership pins | 5 (gate_list, dated 2026-10-04, reason names 369-33) |
| 267-BASELINE CONNECTOR_DESCRIPTORS | 34 | 35 |
| test-270 AFTER | 47 tools, 53330 bytes (369-22) | 48 tools, 24369 desc + 32687 schema = 57056 bytes, about 14264 tokens (router 9 / atomic 39); +6.99 percent from the 369-22 record, inside the 10 percent tolerance; gate_list's own cost 885 + 229 = 1114 bytes, the rest is gate_render (+1252 desc, about +903 schema), gate_answer (+94 desc) and about +442 bytes of room-dashboard, room-graph, room-wiki, methodology schema drift (peer work, no tool added) |
| 276 frozen_sweep | 44 tools / 139 branches (OK 127, MEDIUM 12) | 45 / 140 (OK 127, MEDIUM 13, HIGH_RISK 0); refrozen_at cd27faa94 names 369-41 |
| GATE_BASE | b2f03de02 (369-26) | cd27faa94eabbb6d69a5c0d2541abba4fe131784 |
| shell adapter | 47 tools | 48 tools, gateList, GateRenderArgs gains approving and mirror_of; dist source hash d80ec9a1428efab7 |

## Verification (all measured at the final tree)

- tests/test-267-mcpv2-zod4-contract.cjs PASS=4 FAIL=0 (check a zero description diffs, b pinned set reproduced exactly with zero extras, c, d).
- tests/test-267-mcpv2-registration-api.cjs PASS=71 FAIL=0 (48 tools, every title non-empty); dual-era 5/0; lockstep 6/0 (plan 369-35 had landed).
- `bash tests/run-all-267.sh`: PASS=31 FAIL=0 SKIP=3 (the three skips are the existing ENV GAP legs: CLI live wire probe, HTTP flag-OFF, process lifecycle). zod4, lockstep, CIRS gates, registration, dual-era and the payload ceiling regression leg all PASSED.
- tests/test-365-never-do-gate.cjs 75 pass / 0 fail (N12 green on GATE_BASE).
- `bash tests/run-all-289.sh`: PASSED=47 FAILED=0 SKIPPED=0 KNOWN=1, the Phase 369 precondition probe PASSED. `bash tests/run-all-238.sh`: PASS=10 FAIL=0.
- tests/test-270 5/0; tests/test-276-tool-honesty-findings-closed.cjs 149/0; `check-tool-honesty --check` OK (45 tools, 140 branches, 0 high-risk).
- tests/test-369-launch-surface.cjs 30/30 (arm 6b follows the moved 267 pin).
- `build-connector-registry --check`, `build-orchestration-projection --check`, `gen-mcp-adapter --check`, `build-ui-shell --check`: all OK at the last commit.
- tests/test-369-bakeoff-agent-native.cjs 11/0 static and `--built` 13 passed / 0 failed; `grep -c "single use"` prints 0.
- tests/test-369-shell-actions 17/0, test-369-human-only 10/0, test-369-shared-core 15/0, test-369-ui-dist-fresh 11/0, test-369-289-precondition PASS, plus the gate suites test-369-gate-raised 11/0, gate-mirror 10/0, gate-hardening 20/0, gate-recovery 11/0, sessionful-acceptance 6/0.
- AgentShield self-scan: `mcp_tool_description` verdict clean, 0 findings (so none on gate_list, gate_render or gate_answer); `totalFlagged` 0; the only output is 3 ambiguous `supply_chain` entries (next, react, react-dom), unrelated to this plan.
- Dash guard (`LC_ALL=C /usr/bin/grep -nP "\xE2\x80\x94|\xE2\x80\x93"`) prints nothing over every file this plan touched, including the Theo note.

## Deviations from Plan

**1. [Rule 3 - blocking] zod4 check (d) was red for a reason outside the gate work**
- **Found during:** Task 1.
- **Issue:** the zod4 contract's check (d) failed on `scripts/mindrian-brain-mcp-client.cjs` and `scripts/mindrian-mcp-server.cjs`: plan 369.1-04 moved those executables from bin/ (exempt from the check) to scripts/, so they read as new zod importers. The plan requires the zod4 leg to read PASSED.
- **Fix:** added the two paths to `tests/fixtures/267/zod-importers-baseline.txt` (they were baselined under bin/). Fixture-only, no 369.1-owned file edited. 369.1 should know the baseline names them.
- **Commit:** ef7814d8b.

**2. [Rule 1 - honest baseline] gate_render F-9 had to be re-dispositioned**
- **Found during:** Task 2. tests/test-276 expected `gate_render.(default)` to be OK (F-9, description-correction, resolved at 02468fcb). Plan 369-33's honest description (no global no-write disclaimer; it now records the card in the room) makes the sweep read MEDIUM: a weak tool-scoped claim, with the write behind the ledger observer callback the reachability walk cannot follow.
- **Fix:** the F-9 row became documented-no-action with expected_final_verdict MEDIUM and a file:line reasoning citing lib/mcp/tools/gate.cjs:474, :483 and :1198; owner_plan stays 276-11. gate.cjs was not touched (it is pinned). This is a deliberate honest move, not silencing: the description is true, the detector is the limit. The plan's "no disposition for gate_list unless asked" held: gate_list scans OK.
- **Commit:** cb8cebaa7.

**3. [Plan wording] the gate_render input-schema pin**
- tests/test-365 N12's `shape()` reads zod 3 `_def.typeName`, so under zod 4 its schema comparison cannot see field changes (it passed before this plan even with mirror_of and approving added). I moved gate_render's schema pin to GATE_BASE as the plan states and left the helper alone; the real schema pins are the zod4 snapshot and gen-mcp-adapter. Noted for the verifier, not changed.

## Listed files not touched

tests/test-238-chosen-validation.cjs, tests/test-238-one-ledger.cjs, tests/test-276-meeting-gate-wiring.cjs, tests/test-289-ledger-consume-after-checks.cjs, tests/test-354-concurrency-surfaces.cjs, tests/test-363-mcp-tool.cjs, tests/test-366-mcp-release-route.cjs, tests/test-c55-one-resume-owner.cjs, tests/test-198-gate-renderers.test.cjs, tests/test-369-gate-recovery.cjs, tests/test-369-sessionful-acceptance.cjs: no gap-plan SUMMARY recorded a measured flip in them, and each was run and is green (except test-363, below). data/mcp-tool-connectors.json, data/connector-registry.json and data/brain-orchestration-projection.json were already current (orchestrator commit 4d61eeb9f), so nothing was regenerated or committed.

## Pre-existing reds, named, not touched

- tests/test-363-mcp-tool.cjs: PASS 11 / FAIL 4 (M3, M4, M5, M7), the same set plans 369-33 and 369-38 recorded as red before the gap closure.
- Plan 369-33 also listed test-237-approve-executes, test-237-autonomy-parity, test-345-gate-ratify, test-365-floor-gate and test-366-gated-term-release as pre-existing reds; I did not rerun the 237 and 345 files. test-365-floor-gate now reads 59 pass / 0 fail and test-366-mcp-release-route reads 13/0.

## Known Stubs

None.

## Threat Flags

None. The threat register held: only SUMMARY-recorded changes were moved, each dated; the AgentShield self-scan is clean for tool descriptions; generated files came from their generators and read OK under `--check`; the Theo note names contract states only, no room content (Canon Part 8).

## Notes for later plans

- The dual-era hygiene arm of test-289-cli-card-dual-era passed on every run here; I never killed a mindrian-mcp-server I did not start.
- Plan 369-41 was edited around a live peer (Phase 369.1): I only wrote files this plan names, plus the one fixture in Deviation 1.

## Self-Check: PASSED

- Commits ef7814d8b, cb8cebaa7, 0a4e5f84c, 15988a24d, 391b3ae0b, 359f7cba2 exist on main.
- The Theo note exists and carries the three descriptions verbatim (compared byte-for-byte against the live wire).
- The files listed under key-files exist; STATE.md, ROADMAP.md and every 369.1-owned file were not written.
