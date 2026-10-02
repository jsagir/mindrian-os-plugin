---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 22
status: complete
subsystem: runner-retirement
tags: [runner-retire, D-01, D-02, doctor, eureka-recall, B51-01]
requires:
  - 366-21 (RUNNER_FILES and the RR1-RR5 gate)
  - 366-25, 366-26, 366-27 (slices B, D, C off the runner)
provides:
  - the standalone Eureka runner deleted (scripts/eureka-command.cjs, scripts/eureka-portfolio-report.cjs)
  - tests/test-366-runner-retired.cjs green (RR1-RR5)
  - doctor class S checks the Eureka perspective path
  - eureka-recall admits an authored FEYNMAN again (B51-01 restored)
affects: [366-23, 366-24]
tech-stack:
  added: []
  patterns: [pointer-only legacy command names, perspective smoke over a mkdtemp room, body-dependent scaffold predicate]
key-files:
  created: []
  modified:
    - lib/mcp/tool-router.cjs
    - commands/eureka.md
    - skills/eureka/SKILL.md
    - lib/core/eureka/eureka-enable.cjs
    - lib/core/doctor/class-s-eureka-smoke.cjs
    - scripts/doctor.cjs
    - lib/core/research-planner/perspectives/eureka-recall.cjs
    - lib/core/eureka/candidate-exclusion.cjs (comment)
    - lib/core/eureka/explored-artifact.cjs (comment)
    - lib/core/eureka/opportunity-statement.cjs (comment)
    - lib/core/eureka/reasoning-mode.cjs (comment)
    - lib/core/eureka/room-native-substrate.cjs (comment)
    - scripts/entity-extract.cjs (comment)
    - scripts/measure-355-hit-rate.cjs (comment)
    - tests/test-366-eureka-alias.cjs
    - tests/test-366-eureka-filing.cjs
    - tests/test-366-router-redirects.cjs
    - tests/test-363.1-eureka-exclusion.cjs
    - tests/test-eureka-smoke.cjs
  deleted:
    - scripts/eureka-command.cjs
    - scripts/eureka-portfolio-report.cjs
decisions:
  - "/mos:eureka keeps two subcommands: run (the perspective quick run) and enable. enable moved from the deleted dispatcher to a CLI entry on lib/core/eureka/eureka-enable.cjs, so every '/mos:eureka enable' remedy string in the tree stays true and doctor --fix eureka spawns that CLI"
  - "The doctor perspective probe rides beside the five wire-locked class S layers as payload.perspective (a blocker), not as a sixth layer, because scripts/doctor.cjs's acceptance point and two tests pin exactly five layers"
  - "eureka-recall drops a FEYNMAN row only when its on-disk file is the seeded template (scaffold-predicate.isScaffoldFile, the candidate-exclusion rule); no roomDir or a missing file reads as content"
  - "The router pointer for eureka-run/status/report no longer names a legacy escape; any context, {\"legacy\":true} included, gets the same pointer and starts nothing"
metrics:
  tasks_done: 2
  tasks_total: 2
  duration: ~45 min
  completed: 2026-10-02
---

# Phase 366 Plan 22: Delete the standalone Eureka runner Summary

The standalone Eureka runner is gone. `/mos:eureka` is now only the research planner's Eureka perspective (plus `enable`, which installs the local embedding stack). The MCP `intelligence eureka-run`, `eureka-status` and `eureka-report` names still exist, but each one only answers with a pointer to `research_run` op `perspective_recall`. The doctor's class S smoke now runs the perspective's recall over a throwaway room. The static retirement gate is green.

## Preconditions (checked before any deletion)

- Ruling: `grep -qE "^runner: *retire\b" 366-SPIKE-RULINGS.md` matched line 50, `runner: retire`.
- Global closure: `grep -rlE "eureka-command|eureka-portfolio-report" tests | grep -v "^tests/test-366-"` printed nothing. That grep's inputs were the 366-25, 366-26 and 366-27 SUMMARYs, all complete. The four RR2 offenders were exactly this plan's files: class-s-eureka-smoke, tool-router, test-366-eureka-alias, test-366-eureka-filing.
- Pitfall 11: `git log` on both runner files shows no Phase 368 commit, so no 368 runner-side guards were retired with them. 368's spawner guards are untouched.

## Commits

| Commit | Message |
|--------|---------|
| e5082a9d0 | feat(366-22): delete the standalone Eureka runner and its legacy doors |
| 660354036 | feat(366-22): doctor eureka smoke checks the perspective path |

Both commits used `git add -f` and `git commit --only <paths>`. The deletions went through `git rm`, and the deleted paths were named in `--only`.

## What changed

- **Runner files:** `scripts/eureka-command.cjs` and `scripts/eureka-portfolio-report.cjs` were deleted.
- **tool-router.cjs:** The legacy branch is gone: the flag parse, the in-process run, the detached spawn, the in-flight map, the status/report file reads and the `EUREKA_LEGACY_NOTICE` line. Every eureka compute command returns `EUREKA_PERSPECTIVE_POINTER`. The names stay in `EUREKA_COMPUTE_COMMANDS` and on the `intelligence` enum, ALL_TOOL_COMMANDS is still 65, and the tool description and inputSchema are byte-unchanged. Because of that, no wire snapshot refresh was needed (`check-tool-honesty --check` OK, `build-connector-registry --check` OK).
- **commands/eureka.md:** `argument-hint` is now `[run|enable]`. The legacy routing row, the whole "Legacy runner (--legacy)" section, the legacy F.8 close, the legacy error line and the legacy cross-surface sentences are gone. The MCP twin line now names op `perspective_recall` with perspective `eureka`, not the deprecated `eureka_recall` alias. A new "Subcommand: enable" calls `node "${CLAUDE_PLUGIN_ROOT}/lib/core/eureka/eureka-enable.cjs"`. The mirror skills/eureka/SKILL.md was regenerated by build-skill-mirrors. The command, connector, projection and render registries regenerated with no byte change.
- **eureka-enable.cjs:** It gained a `main(argv)` CLI (`--dry-run`, `--help`) that copies the dispatcher's former `cmdEnable` exactly. **Deviation (Rule 3):** without it, deleting the runner would have broken `doctor --fix eureka` (it spawned `eureka-command.cjs enable`) and every user-facing "run /mos:eureka enable" remedy.
- **class-s-eureka-smoke.cjs:** `fixEurekaSmoke` spawns `require.resolve('../eureka/eureka-enable.cjs')`. The new `_perspectiveProbe` builds a mkdtemp room under `os.tmpdir()`. The room starts as a zero-byte `room.db`, opened through `navigation.openRoomDbForCaller`, so the room-db bypass audit never writes telemetry. It holds two sections and three things (`insertNode`) plus one known `INFORMS` edge (`navigation.writeEdge`). The probe runs `getPerspective('eureka').runRecall` and requires exactly one candidate (the unconnected cross-section pair), `known_pairs >= 1` and `excluded_known >= 1`, then removes the room. The reason line carries only counts, for example `perspective recall things 3, sections 2, candidates 1, known_pairs 1, excluded_known 2`. scripts/doctor.cjs renders it, and its acceptance point names it when it is the failing blocker.
- **eureka-recall.cjs (folded-in deviation, the 366-26 finding):** `buildSubstrate` no longer drops every FEYNMAN by name. A FEYNMAN row is dropped only when `scaffold-predicate.isScaffoldFile` reads its on-disk file as the seeded template. The path comes from source_path, props.path or the id, and an absolute path or a `..` segment is never read (T-363.1-09). Every other scaffold basename still drops by name. This restores the runner's B51-01 behavior, so retirement loses nothing. The regression leg is E4 in tests/test-363.1-eureka-exclusion.cjs: an authored FEYNMAN is a thing and a recalled endpoint, and a seeded one is neither. E4 was run against the HEAD copy of eureka-recall and fails there (`not ok - E4`), then passes with the fix.
- **Tests (the 366-26 handover list):**
  - test-366-eureka-alias was rewritten. A1: any context answers the pointer and spawns nothing on http and stdio. A2: `{"legacy":true}` is ignored, with no deprecation line. A3: status and report answer the pointer with or without the flag. A4: the door has no `--legacy`, no legacy section and no runner name, and enable runs eureka-enable.cjs. A5: 65 commands, the names stay on the enum, no `flags.legacy`, no runner file in the router, zero network.
  - test-366-eureka-filing F4 keeps only the filing-stamped export shape. The runner re-export identity half is dropped.
  - test-366-router-redirects D4 asserts that the pointer names no legacy escape. Before, it asserted the escape was named.
  - test-eureka-smoke gained two legs: the real probe passes and cleans up its temp room, and a mocked probe failure fails the run.
- **Comments:** Runner file names were reworded to "the standalone runner, retired in Phase 366-22" in lib/core/eureka/{candidate-exclusion, explored-artifact, opportunity-statement, reasoning-mode, room-native-substrate}.cjs, scripts/entity-extract.cjs and scripts/measure-355-hit-rate.cjs. No behavior changed.

## Acceptance

- RR1-RR5: `node tests/test-366-runner-retired.cjs` gives PASS 5, FAIL 0.
- `grep -c -- "--legacy" commands/eureka.md` = 0, and `grep -c "flags.legacy" lib/mcp/tool-router.cjs` = 0.
- `grep -c "eureka-command\|eureka-portfolio-report" lib/core/doctor/class-s-eureka-smoke.cjs` = 0.
- All of these exit 0: build-skill-mirrors, build-command-registry, build-connector-registry and build-orchestration-projection (`--check`); check-shape-declaration `--check`; check-registry-drift `--check`; check-render-coverage `--check`; check-tool-honesty `--check`; check-plugin-path-anchoring; check-substrate `--diff`; test-205-surface-fence; test-366-router-redirects; test-366-eureka-alias; test-366-eureka-filing; test-eureka-mcp-tools; test-341-eureka-no-brain-reach; test-341-eureka-enable-argv; test-341-class-s-layer-split; test-341-slim-install-honest-degrade; test-276-busy-timeout-propagation; test-doctor-module-contract-parity; test-eureka-smoke.

## Suite results (hermetic: temp HOME / USERPROFILE / MINDRIAN_ROOMS_HOME, CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID unset)

| Suite | Before (base bf0724c7a) | After 366-22 | Note |
|---|---|---|---|
| run-all-366 | PASSED=67 FAILED=1 SKIPPED=2 KNOWN=1 | PASSED=68 FAILED=0 SKIPPED=2 KNOWN=1 | the runner-retired leg flipped green; KNOWN is the 355 direction-agreement leg H |
| run-all-341 | | PASS=22 FAIL=0 SKIP=6 | the 310 scoped-diff leg is green on a clean tree |
| run-all-363.1 | | PASS=10 FAIL=0 SKIP=1 | test-363.1-eureka-exclusion now 16/16 with E4 |
| run-all-seed103 | | PASSED=20 FAILED=0 | |
| run-all-216 | | PASS=8 FAIL=1 | the known strict shape-declaration leg only (baseline) |
| run-all-218 | | PASS=17 FAIL=0 | |
| run-all-219 | | PASS=13 FAIL=0 | |
| run-all-3551 | | PASS=62 FAIL=6 | equals the stated baseline |
| run-all-355 | 4 legacy reds | PASS=67 FAIL=4 | the 4 legacy reds: direction-agreement H, doctor --acceptance no-new-regression (install-state, deployment-surfaces, version-of-record, session-start, activation; no eureka point), 272-cache-probe, run-all-272 |
| run-all-223 | 3 legs | PASS=16 FAIL=3 | matches base |
| run-all-343 | 2 legs | PASS=9 FAIL=2 | the two git-status-porcelain legs (shared tree held untracked 366-23 work while they ran) |
| run-all-215 | | PASS=6 FAIL=0 | |
| run-all-226 | | PASS=4 FAIL=0 | |

## Deviations from Plan

1. **[Rule 3 - Blocking] `/mos:eureka enable` and `doctor --fix eureka` would have pointed at a deleted file.** Fixed with a CLI entry on eureka-enable.cjs. The door keeps an `enable` subcommand, and the fixer spawns the CLI. Files: lib/core/eureka/eureka-enable.cjs, commands/eureka.md, lib/core/doctor/class-s-eureka-smoke.cjs. Commit e5082a9d0.
2. **[Rule 1 - Bug, folded in by the orchestrator] An authored FEYNMAN was never a Eureka candidate.** This was the 366-26 finding. The fix and regression leg E4 are described above. Commit e5082a9d0.
3. **[Plan reading] "The runner call (about 389)" in class-s-eureka-smoke was the `fix` path (`fixEurekaSmoke` spawning `eureka-command enable`), not a smoke layer.** Both were done: the fix was retargeted (deviation 1), and the perspective probe was added as a new blocker check. It was not made a sixth layer: the five-layer list is pinned by scripts/doctor.cjs `eureka-smoke-stack-ready`, test-eureka-smoke and test-341-class-s-layer-split, and the plan asked that the module contract stay unchanged. Exports and LAYERS are unchanged, and only an optional `mockPerspective` seam was added.
4. **[Rule 3] test-366-router-redirects D4 asserted that the pointer still named `{"legacy":true}`.** It is in the plan's verify list, so the leg was inverted (the pointer names no legacy escape).
5. **[Scope note] scripts/doctor.cjs was edited (two hunks)** to render the probe line and name the probe in the acceptance finding. Without that edit, a failing probe would read as "unknown layer".

## Known Stubs

None.

## Threat Flags

None new. T-366-90: the all-pairs loop is deleted. T-366-91: RR2 is green over lib, scripts, hooks, bin and tests. T-366-92: the probe room is a mkdtemp under os.tmpdir(), removed in a finally block, never registered, and no telemetry is written (the navigation door is the opener). T-366-93: the mirror and registries were regenerated by script, and every `--check` leg is green.

## For plan 366-24 (carried in deferred-items.md)

(a) The shared_entity lane cannot fire from extractor output (DESCRIBES only to memory_artifact, a non-thing). (b) tests/fixtures/355/eureka-ranking-pin.json is orphaned. (c) The `cross_connection_stamped` memory_event has no producer, and memory-events.cjs still names the deleted runner in a comment. (d) disclosureLine('eureka') is rendered by nothing live. Also: dist/zed still carries the old door text until the next release regenerates the bundles. The optional comment-only runner mentions (ambient-framing, filing-stamped, gate.cjs, memory-events) are left in place. 366-23's scope covers none of these.

## Self-Check: PASSED

- e5082a9d0 and 660354036 exist and are ancestors of HEAD.
- scripts/eureka-command.cjs and scripts/eureka-portfolio-report.cjs are absent. Every modified file listed above exists.
