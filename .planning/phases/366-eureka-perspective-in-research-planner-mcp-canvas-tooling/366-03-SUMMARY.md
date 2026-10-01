---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 03
subsystem: eureka-door
tags: [eureka, alias, legacy-flag, mcp-router, hitl-form-b, deprecation]
requires:
  - 366-01 (tests/run-all-366.sh run_if leg for test-366-eureka-alias.cjs)
provides:
  - /mos:eureka default run = the perspective quick run on scripts/research-planner.cjs (eureka-recall, eureka-judge --judge none, F.6 review approve, F.0 grant, run-quick, prose, basket, file-run)
  - /mos:eureka --legacy <subcommand> as the only CLI door to scripts/eureka-command.cjs, with one deprecation line
  - MCP intelligence eureka-run/status/report gated on a strict context {"legacy":true}; default answers a research_run eureka_recall pointer
  - EUREKA_LEGACY_NOTICE and EUREKA_PERSPECTIVE_POINTER constants in lib/mcp/tool-router.cjs
affects: [366-16 (pointer op eureka_recall becomes perspective_recall), 366-21 and 366-22 (runner deletion removes the legacy section, the gate and tests/test-eureka-mcp-tools.cjs)]
tech-stack:
  added: []
  patterns:
    - D-G context-flag parse with a strict === true gate in front of a retiring compute path
    - door-level and router-level deprecation line, never printed from scripts/eureka-command.cjs (Pitfall 11)
key-files:
  created:
    - tests/test-366-eureka-alias.cjs
  modified:
    - commands/eureka.md
    - skills/eureka/SKILL.md (generated)
    - data/command-registry.json (generated)
    - data/harness-manifest.json (generated)
    - lib/mcp/tool-router.cjs
decisions:
  - "The legacy path's suggested-next args and its no-report Fix text carry context {\"legacy\":true}, so a client that follows them stays on the legacy path instead of bouncing to the pointer"
  - "A JSON array context parses to no flags (Array.isArray guard added to the D-G parse); only a strict legacy === true opens the runner"
  - "The door keeps connector.filing: none and the rest of the connector frontmatter unchanged; only hitl_shape moved to Form B hitl_stages (F.6, F.0, F.8)"
metrics:
  duration: ~35min
  completed: 2026-10-01
  tasks: 2
  files: 7
---

# Phase 366 Plan 03: /mos:eureka quick-run alias and the legacy gate Summary

`/mos:eureka` now runs the Eureka perspective quick run through the research planner: recall, Stage A, F.6 plan review, F.0 grant, run-quick, prose from the evidence card, then F.8 filing only on the navigator's yes. The standalone all-pairs runner is reachable only through `/mos:eureka --legacy <subcommand>` on the CLI, or through `{"legacy":true}` in the MCP `intelligence` context. Each of those paths prints the one deprecation line.

## What was built

- **commands/eureka.md**
  - `argument-hint` is now `[run|--legacy <run|start|status|report|html|enable|reasoning-*>]`.
  - The Form B `hitl_stages` declare F.6 (plan review), F.0 (quick policy grant) and F.8 (filing), with a one-line `hitl_why`.
  - The default run walks seven steps on `scripts/research-planner.cjs`:
    1. `eureka-recall --mode quick`
    2. `eureka-judge --judge none` (the host judges; Jev stays dev-time)
    3. F.6 plan review, then `review approve`
    4. `status`, `grant propose` and `grant approve`
    5. `run-quick`
    6. the host writes the prose
    7. `basket`, then `file-run` on the yes
  - A new "What this run writes and what leaves the machine" section replaces the stale ZERO writes / ZERO network and report-only (D-03) text. The run writes files under `.mindrian/`. `room.db` changes only on the F.8 yes. Only the audited queries under a grant leave the machine.
  - The "Legacy runner (--legacy)" section opens with the deprecation line and keeps the old subcommands, the reasoning loop and the 4-zone render spec. These were condensed (see Deviations).
- **lib/mcp/tool-router.cjs**
  - The D-G flag parse moved to the top of the `EUREKA_COMPUTE_COMMANDS` branch, before room resolution.
  - The gate is `const legacyRequested = flags.legacy === true`. Without it, all three commands return `EUREKA_PERSPECTIVE_POINTER`, which names `research_run` op `eureka_recall` and the `{"legacy":true}` escape. They resolve no room, spawn no child, call no runner and write no state.
  - With the flag, the existing branch runs unchanged, except that every response goes through `legacyResponse`, which prepends `EUREKA_LEGACY_NOTICE`.
- **tests/test-366-eureka-alias.cjs** (hermetic: temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, net guard, a counting `child_process.spawn`, and a counting stand-in for `scripts/eureka-command.cjs` in `require.cache`). 55 checks:
  - **A1:** 8 contexts on each of the http and stdio transports answer the pointer and start nothing. The contexts are none, empty, malformed, `"true"`, `1`, an array, `null` and `{"offline":true}`.
  - **A2:** the legacy flag runs in-process on http (one `main`) or detached on stdio (one spawn), and the response starts with the deprecation line.
  - **A3:** status and report give the pointer without the flag, and the deprecation line plus the runner answer with it.
  - **A4:** static legs on the door and its mirror.
  - **A5:** ALL_TOOL_COMMANDS is 65, the gate token is present, and there were zero network attempts.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | e0e5f719e | feat(366-03): /mos:eureka runs the perspective quick run; runner behind --legacy |
| 2 (RED) | b0d33f841 | test(366-03): add failing eureka alias legs A1-A5 for the router legacy gate |
| 2 (GREEN) | 0732c17f0 | feat(366-03): router legacy gate on intelligence eureka-run/status/report |

## Verification

- Generators and checks:
  - `build-skill-mirrors --check`, `build-command-registry --check`, `build-connector-registry --check`, `build-orchestration-projection --check`: all exit 0.
  - `check-shape-declaration --check`: exit 0. eureka has no violation, including under `--strict`.
  - `check-registry-drift.cjs --check`: OK (0 findings). This is the folded todo: `/mos:eureka` passes it.
- Plan greps:
  - `ZERO (writes|network)`: 0 matches in the door and 0 in the mirror.
  - `--legacy`: 13 in the door.
  - `research-planner.cjs" eureka-recall`: 1.
  - No em-dash or en-dash in the door, the mirror, the router or the test.
- `node tests/test-366-eureka-alias.cjs`: PASS 55, FAIL 0.
- Pins:
  - test-205 surface-fence: exit 0. test-270 schema budget: exit 0 (5/0). test-234: 12/0. test-353-tripwires: 5/0.
  - test-seed103-eureka-perspective: 39/0.
  - test-216-eureka-command: 44 passed. test-226: PASS. test-341: 12/0. test-3551-prose: 73/0.
  - `check-tool-honesty --check`: OK.
- `LC_ALL=C bash tests/run-all-366.sh`: PASSED=38 FAILED=0 SKIPPED=27 KNOWN=1. The KNOWN item is the baseline test-355-direction-agreement leg H.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The legacy path's suggested-next would bounce clients to the pointer**
- **Found during:** Task 2
- **Issue:** The legacy `eureka-run` and `eureka-status` responses suggested `{command: 'eureka-status'}` / `{command: 'eureka-report'}` with no context. After the gate, a client following that suggestion gets the pointer instead of the runner state.
- **Fix:** The suggested-next args on the legacy path carry `context: '{"legacy":true}'`. The no-report Fix line names the legacy flag and `/mos:eureka --legacy run`.
- **Commit:** 0732c17f0

**2. [Rule 2 - Missing critical] An array context passed the D-G object check**
- **Found during:** Task 2 (T-366-10)
- **Issue:** `typeof [] === 'object'`, so an array context was kept as the flag object.
- **Fix:** The parse also rejects arrays. Leg A1 covers `[true]`.
- **Commit:** 0732c17f0

**3. [Rule 3 - Blocking] The commit hook required the harness manifest to be regenerated**
- **Found during:** Task 1 commit
- **Issue:** `data/harness-manifest.json` digests `data/command-registry.json`, so the hook refused the commit with a STALE message.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` and committed the regenerated file with the change.
- **Commit:** e0e5f719e

### Interpretations

- **The legacy section is condensed, not byte-identical.** The old subcommands, their exact `eureka-command.cjs` calls, the reasoning-mode loop and the render rules are all kept. The prose around them was tightened, and the footer and Fix lines now name `/mos:eureka --legacy ...` so a legacy user stays on the legacy door. The legacy first-run note no longer claims that nothing leaves the machine.
- **`data/connector-registry.json` and `data/brain-orchestration-projection.json`** were regenerated by script and came out byte-identical. The command-registry changes only the eureka row, so nothing was committed for these two.
- **The door also carries `Write` in allowed-tools.** Steps 4 and 7 write the scratch `proposal.json` and `selection.json`, the same way `/mos:research` does.

## Deferred Issues

- `tests/test-eureka-mcp-tools.cjs` was already red before this plan. Its stub server has only `server.tool`, but the router calls `server.registerTool`, so it is FATAL on the base commit. It is logged in deferred-items.md with the changes it would need. The legacy router path it used to prove is covered by A2 and A3 of the new test.

## TDD Gate Compliance

Task 2: RED b0d33f841 (17 failing checks, with the seams confirmed to count real spawns and runs), then GREEN 0732c17f0. Task 1 was not TDD.

## Known Stubs

None. The pointer naming `eureka_recall` is intentional, and plan 366-16 renames it to `perspective_recall`.

## Threat Flags

None. T-366-09 and T-366-10 are mitigated by the gate and leg A1. The door passes only ROOM_DIR, run ids, tags, enum values and scratch JSON paths (T-366-11). The registries are regenerated by script (T-366-12).

## Self-Check: PASSED

- FOUND: tests/test-366-eureka-alias.cjs, 366-03-SUMMARY.md
- FOUND commits: e0e5f719e, b0d33f841, 0732c17f0
