---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 12
subsystem: research-planner
tags: [mcp, cli, perspectives, research_run, deprecated-aliases, tool-budget]
requires:
  - 366-08 (perspective registry PERSPECTIVE_IDS / getPerspective / available, shared judge with opts.module)
  - 366-13, 366-14, 366-15 (rs, hsi, whitespace, analogies, connections modules; analogies STATEMENT_TEMPLATE)
provides:
  - research_run ops perspective_recall, perspective_candidates, perspective_judge with a perspective enum from the registry
  - eureka_recall, eureka_candidates, eureka_judge as deprecated aliases (deprecated true, use_instead)
  - CLI subcommands perspective-recall and perspective-judge with --perspective validated against the same frozen list
affects: [366-16 (test-366-offline-recall asserts the analogies statement_template through perspective_recall), 267-18 (wire snapshot, see Notes)]
tech-stack:
  added: []
  patterns:
    - one handler set over the registry, a frozen id map, no path built from input
    - alias = the new op's body under the legacy op name plus deprecated and use_instead (355 D-26)
key-files:
  created:
    - tests/test-366-mcp-perspective-ops.cjs
    - tests/test-366-cli-perspective.cjs
  modified:
    - lib/mcp/tools/research.cjs
    - scripts/research-planner.cjs
    - tests/test-363-mcp-tool.cjs
    - tests/test-270-tool-schema-budget.cjs
    - tests/test-365-never-do-gate.cjs
decisions:
  - "Alias refusals keep the eureka op names in their hints (the seed103 test pins /eureka_recall/ on a refused eureka_judge), so the handlers take an optional names object; the generic ops name perspective_recall and perspective_judge"
  - "perspective_unavailable is also the handler answer for an id that is not in the registry (the zod enum stops it at the edge; the handler never trusts that)"
  - "The CLI eureka-recall and eureka-judge are not marked deprecated: commands/eureka.md calls them and the plan keeps them as thin callers with 'eureka'; their output equals the perspective subcommands exactly"
  - "Honesty fixture needed no re-freeze: the sweep reads a `command` key for its vocabulary, research_run has none, so it stays one '(default)' branch and the sweep stays 42 tools / 136 branches"
metrics:
  tasks: 2
  files: 7
  completed: 2026-10-02
---

# Phase 366 Plan 12: Perspective ops on MCP and the CLI door Summary

One op set (`perspective_recall`, `perspective_candidates`, `perspective_judge`) now serves all six perspectives through `research_run`, the three `eureka_*` ops answer as deprecated aliases, and the CLI reaches every perspective through `perspective-recall` and `perspective-judge`.

## Commits

- ee034f0a8 feat(366-12): research_run perspective ops with deprecated eureka aliases
- 70123e935 test(366-12): re-pin research_run parity base in test-365 N12 to the perspective-ops commit
- 369dcd51f feat(366-12): CLI perspective-recall and perspective-judge with registry-enum validation

## What was built

**MCP (lib/mcp/tools/research.cjs, current v2 `server.registerTool` API, unchanged).**
- `OPS` is the ten core ops plus `perspective_recall`, `perspective_candidates`, `perspective_judge`, `eureka_recall`, `eureka_judge`, `eureka_candidates`. The input schema gains `perspective: z.enum(PERSPECTIVE_IDS).optional()` (exactly one occurrence, read from `perspectives/index.cjs`).
- `opPerspectiveRecall`, `opPerspectiveCandidates`, `opPerspectiveJudge` look the module up with `getPerspective(id)`; judge runs `eurekaJudge.runJudge(..., {judge:'none', module})`, candidates reads with the module's own `readCandidates` and `readVerdicts(..., {module})`. The recall response carries `perspective`, and carries `statement_template` exactly when the module's `runRecall` returns one (analogies; eureka: absent). The candidates page limit is capped at `CANDIDATES_MAX_LIMIT` in the handler as well as the schema.
- `deprecate(out, legacyOp, newOp)` sets `op: legacyOp, deprecated: true, use_instead: newOp`.
- Refusals carry a reason and a hint naming the next op: `perspective_required`, `perspective_unavailable`, `run_tag_required`, `candidates_missing`.
- `DESCRIPTION` rewritten once: every old claim kept, the six perspectives named, the new ops described, `eureka_recall` and `eureka_candidates` kept as deprecated aliases for one release. It stays under 2048 bytes (test-234 and the seed103 token assertion pass).

**CLI (scripts/research-planner.cjs).**
- `FLAGS['--perspective']`, `valueOk('perspective')` against `PERSPECTIVE_IDS`, `COMMANDS` rows `perspective-recall` and `perspective-judge`, a `perspective_required` reason in `parseArgv` (never `room_required`), usage header updated.
- One handler pair `perspectiveRecall(room, id, flags)` / `perspectiveJudge(room, id, flags)`; `eureka-recall` and `eureka-judge` call them with `'eureka'`. A bogus `--perspective` value or free text refuses `free_text_argv_refused` with exit 2 and the token is never echoed.

## Verification

- `node tests/test-366-mcp-perspective-ops.cjs`: PASS 9, FAIL 0 (M1-M7 plus M1b every registered perspective; zero network attempts)
- `node tests/test-366-cli-perspective.cjs`: PASS 7, FAIL 0 (L1-L6 plus L1b every registered perspective)
- `node tests/test-seed103-eureka-perspective.cjs`: PASS 39 / 0
- `node tests/test-270-tool-schema-budget.cjs`: 5 passed; 45 tools, 50502 total bytes (20540 desc, 29962 schema)
- `node tests/test-234-tool-description-floor.cjs`: 192 passed (45/45 tools)
- `node tests/test-363-mcp-tool.cjs`: PASS 15 / 0; `tests/test-205-surface-fence.cjs`: 20 checks passed
- `node tests/test-365-never-do-gate.cjs`: PASS 75 / 0 (after the re-pin, see Deviations)
- `node tests/test-276-tool-honesty-findings-closed.cjs` 148 passed; `test-276-tool-honesty-switch-branches.cjs` 17 passed; `node scripts/check-tool-honesty.cjs --check`: OK (42 tools, 136 branches, 0 high-risk)
- `node scripts/build-connector-registry.cjs --check`: OK. Regenerating with `node scripts/build-connector-registry.cjs` produced no diff in `data/connector-registry.json` or `data/mcp-tool-connectors.json` (connector entries name the tool and shape, not ops), so nothing was committed there.
- Also green: test-363-cli, test-363-part8-sweep, test-363-command-contract, test-363-runner-contract, test-365-never-do-cli, test-366-eureka-alias, test-366-perspective-interface, test-seed104-grant-family-loop.

## Tool budget (test-270)

research_run gained a six-name op enum, a perspective enum and a longer description. Measured live: before 50140 total bytes (this tree carries peer work since 363-17), after 50502 (+196 desc, +166 schema, +362 total, 45 tools unchanged, ~12626 approx tokens). Signed pctChange(48712, 50502) = 3.67 percent, inside the 10 percent drift. The recorded baseline was NOT moved; a re-baseline note block was added after the 363-17 block in the test file.

## check-registry-drift finding

`node scripts/check-registry-drift.cjs --check` prints "OK (0 findings, baseline=git-tag)". It compares only the `command` keys of `data/command-registry.json` between the last release tag and now; it does not see MCP op names. So renaming or removing an op on a tool is invisible to it. This is the known 355 D-26 gap (folded todo): the deprecated-alias discipline here is held by test-366-mcp-perspective-ops (M2), not by the drift gate.

## Honesty ledger

`tests/fixtures/tool-honesty/276-dispositions.json` stays at frozen_sweep 42 tools / 136 branches. The sweep builds its vocabulary from a `command` key and research_run has none, so adding ops changes nothing it counts; live sweep equals the ledger and `check-tool-honesty --check` is green. No fixture diff, so none was committed. There is no generator script for the ledger counts (hand-frozen with an in-test live-vs-frozen comparison); the comparison passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] test-365 N12 pinned research_run to a pre-366 commit**
- **Found during:** Task 1 verification (aggregate sweep of tests naming research_run)
- **Issue:** `tests/test-365-never-do-gate.cjs` N12 asserts research_run's description and title are byte-identical to PLAN_BASE `ab5e1d16b`. Changing the description is the point of this plan, so the leg failed.
- **Fix:** gate and chain stay pinned to PLAN_BASE; research.cjs now loads from `RESEARCH_BASE = ee034f0a84e961e3f0d0a0b99a3441bf3cb9d973` (the 366-12 task 1 commit), with a comment that a later edit to research_run's registration must re-pin it.
- **Files modified:** tests/test-365-never-do-gate.cjs
- **Commit:** 70123e935

**2. [Rule 1 - Bug] Literal dash characters in the new MCP test**
- **Found during:** Task 2 hygiene grep
- **Issue:** the dash guard regex in tests/test-366-mcp-perspective-ops.cjs was written with literal em and en dash characters, breaking the no-em-dash rule.
- **Fix:** rewritten with `—–` escapes.
- **Commit:** 369dcd51f

**3. [Plan note] perspective_unavailable leg**
- All six modules exist, so a registered-but-missing id is unavailable to test. The leg uses an id for which `available(id)` is false (`not-a-perspective`) and prints a skip note for the registered-id case, as the plan allows. No override was added to index.cjs.

## Notes for peers

- No new MCP tool was added (45 tools before and after), only new ops, an enum and a description on research_run.
- `tests/test-267-mcpv2-registration-api.cjs` (live 45 vs wire-snapshot-zod4 44 tools) and `tests/test-267-mcpv2-zod4-contract.cjs` (extras `tool:research_run:membership`, plus a zod importer `scripts/fork359-permission-probe.cjs`) were already failing before this plan: the 267 wire snapshot does not contain research_run at all. Not touched; jsagi-65's 267-18 absorbs it. This plan also changes research_run's input schema, so its snapshot entry will need to carry the new op and perspective enums.
- `tests/fixtures/267/wire-snapshot-zod4.json` and `tests/fixtures/267/zod4-accepted-deltas.json` were not touched.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or file-access pattern; the perspective id is validated at both edges (zod enum, `valueOk`) and looked up only in the frozen registry map (T-366-49); room resolution unchanged (T-366-50); argv tokens never echoed (T-366-51); candidates limit capped (T-366-52); aliases keep deprecated and use_instead (T-366-53).

## Self-Check: PASSED

Files exist: lib/mcp/tools/research.cjs, scripts/research-planner.cjs, tests/test-366-mcp-perspective-ops.cjs, tests/test-366-cli-perspective.cjs. Commits ee034f0a8, 70123e935, 369dcd51f are in `git log`. Acceptance greps: `z.enum(PERSPECTIVE_IDS)` count 1, `use_instead` count at least 1, `perspective_required` and `'perspective-recall'` present in the CLI.
