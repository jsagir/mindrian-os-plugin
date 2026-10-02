---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 16
subsystem: mcp-canvas-surface
tags: [router-stubs, perspective-recall, offline-proof, counter-metrics, floor-ledger, d-06, d-09, 355-d-46]
requires:
  - 366-03 (eureka-run default pointer, legacy gate)
  - 366-08 (perspective registry)
  - 366-12 (research_run perspective_recall / perspective_candidates / perspective_judge)
  - 366-13, 366-14, 366-15 (per-perspective budgets disclosed here)
provides:
  - router stubs for find-bottlenecks, whitespace, scout-hsi answer with a pointer to research_run op perspective_recall and the matching perspective
  - eureka-run/status/report default pointer names perspective_recall with perspective "eureka"
  - COUNTER_METRICS (seven stage pairs, Phase 343 shape) exported from perspectives/index.cjs
  - tests/test-366-offline-recall.cjs (six-perspective zero-socket proof plus Z4 end-to-end shape)
  - floor sweep covers perspectives/*.cjs and ambient.cjs; ten new disclosed ledger rows
affects:
  - 267-18 (wire snapshot fixtures: the orchestration tool description changed, see Notes)
key-files:
  created:
    - tests/test-366-router-redirects.cjs
    - tests/test-366-offline-recall.cjs
    - tests/test-366-counter-metrics.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/core/research-planner/perspectives/index.cjs
    - scripts/check-floor-ledger.cjs
    - data/floor-ledger.json
    - tests/test-366-eureka-alias.cjs
    - tests/test-355-naming-honesty.cjs
decisions:
  - "The pointer is one shared helper (perspectivePointer(id)) so the three stub branches say the same sentence; the command names stay in every enum and ALL_TOOL_COMMANDS stays 65"
  - "find-bottlenecks and whitespace used to echo the reference file through buildContext; they now answer the one pointer line. The analysis pipeline-state step record and suggested-next are unchanged"
  - "scout-hsi keeps its NOT EXECUTED banner and still names /mos:scout hsi for the full CLI pipeline; only the 'reference only, no compute' sentence is gone"
  - "COUNTER_METRICS entries carry stage, optimizes, watched_by only; declared, never enforced at runtime"
  - "The floor sweep's patterns only hit const decimals and env reads, so the object-literal BUDGETS rows were added by hand to the ledger (the plan's 'one row per reported floor' would have produced one row, EUREKA_ENTITY_MIN)"
metrics:
  tasks: 3
  files: 9
  completed: 2026-10-02
---

# Phase 366 Plan 16: Canvas surface closed Summary

The router no longer calls a perspective that has an op "reference only": find-bottlenecks, whitespace and scout-hsi point at `research_run` op `perspective_recall` with the rs, whitespace and hsi perspective. Every recall is proven offline in one test, each stage declares its counter-metric pair once, and every perspective floor and budget has a ledger row.

## What was built

- **Task 1 (router stubs).** `perspectivePointer(id)` in `lib/mcp/tool-router.cjs` returns one line naming research_run, op perspective_recall, the perspective id, and the paging and Stage A ops. `analysis find-bottlenecks` (rs), `intelligence whitespace` (whitespace) and the `orchestration scout-hsi` banner (hsi) use it. `EUREKA_PERSPECTIVE_POINTER` now names perspective_recall with perspective "eureka". The orchestration description's scout-hsi sentence no longer says "reference only, no compute". The legacy escape `{"legacy":true}` is still named in the eureka pointer. `tests/test-366-router-redirects.cjs` legs D1-D5 cover the pointers, the fence (65 unique commands, find-bottlenecks and find-analogies reachable, every name still in its enum) and the descriptions.
- **Task 2 (offline proof and counter-metrics).** `tests/test-366-offline-recall.cjs` runs all six ids through `research_run` perspective_recall on the planted fixture room with a fetch guard plus counters on net sockets and http(s).request (zero attempts). Z2: statement_template rides analogies only. Z4: per perspective, the question set builds a plan `plan.validatePlan` accepts, and one pair-carrying researchable leaf rolled supported yields exactly one candidate of the template's declared kind (cross_domain_transfer for eureka and connections, constraint_attack for rs, mechanism_transfer for hsi and analogies, literature_gap for whitespace) carrying that leaf's pair and the perspective id. `COUNTER_METRICS` is a frozen list of seven pairs (substrate, recall, recall_exclusion, judge, research, filing, whole_run) in `perspectives/index.cjs`; `tests/test-366-counter-metrics.cjs` legs Q1-Q3 read the banned-word list out of `graph-integrity-counts.cjs` rather than restating it.
- **Task 3 (floor sweep and ledger).** `SCAN_FAMILIES` gains `lib/core/research-planner/perspectives/*.cjs` and `lib/core/research-planner/ambient.cjs`. The sweep reported exactly one undisclosed hit (`EUREKA_ENTITY_MIN` in eureka-judge.cjs); the object-literal budgets are not matched by the sweep's patterns, so they were disclosed by hand. Ten rows, all `disclosed`: eureka `lexical_floor 0.08`, eureka caps `[200, 5, 2000, 8]`, rs `[200, 8, 10]`, hsi `[200, 8, 5, 2000]`, whitespace `[100, 8, 4]`, analogies `lexical_ceiling 0.15` and caps `[100, 8]`, connections `[100, 8, 5]`, eureka-judge `EUREKA_ENTITY_MIN 2`, ambient `EUREKA_OFFER_PAIRS 3`. The ledger now has 62 rows over 84 scanned files.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 8a66273ce | feat(366-16): router stubs point at the perspective ops of research_run |
| 2 | 334153e3b | feat(366-16): six-perspective offline proof and per-stage counter-metrics |
| 3 | 2de1ce441 | feat(366-16): floor sweep covers the perspectives; ledger rows for every floor |

## Verification

- `node tests/test-366-router-redirects.cjs`: 29 passed, 0 failed (D1-D5)
- `node tests/test-366-offline-recall.cjs`: 12 passed (Z1-Z4, zero network attempts)
- `node tests/test-366-counter-metrics.cjs`: 9 passed (Q1-Q3)
- `node tests/test-366-eureka-alias.cjs`: 55 passed (A1 and the A3 default half now assert perspective_recall with perspective "eureka")
- `node tests/test-205-surface-fence.cjs`: 20 checks (pin 65 holds); `node tests/test-234-tool-description-floor.cjs`: 192 passed; `node tests/test-270-tool-schema-budget.cjs`: 5 passed, measured totalBytes 50820 (20633 desc, 30187 schema, 45 tools)
- `node tests/test-355-naming-honesty.cjs`: 18 passed; `node tests/test-355-floor-sweep.cjs`: 109 passed; `node scripts/check-floor-ledger.cjs --check`: 62 rows, 0 unresolved
- `node scripts/build-connector-registry.cjs --check`: OK with no regeneration (the description edits do not reach the generated connector data, so data/connector-registry.json and data/mcp-tool-connectors.json are unchanged); `node scripts/check-tool-honesty.cjs --check`: OK, 42 tools, 0 high-risk, so the 276 dispositions fixture needed no re-freeze
- `LC_ALL=C bash tests/run-all-366.sh` (temp HOME): PASSED=61 FAILED=1 SKIPPED=6 KNOWN=1. The one failure was `366 egress policy`, the concurrent 366-17 plan's test, which passed 24/0 when re-run directly a minute later (its files were mid-edit). The skips are planned tests of later plans; KNOWN is the standing 355 direction-agreement red.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/test-355-naming-honesty.cjs pinned the removed wording**
- **Found during:** Task 1
- **Issue:** Two legs required "reference only, no compute" in the scout-hsi response and the orchestration description. The plan's own acceptance (`grep -c "reference only, no compute" lib/mcp/tool-router.cjs` equals 0) makes those legs unsatisfiable.
- **Fix:** The two legs now assert the pointer (research_run, perspective_recall, perspective "hsi") and a description sentence naming perspective_recall and `/mos:scout hsi`. NOT EXECUTED, no-rename and no-write legs untouched.
- **Files modified:** tests/test-355-naming-honesty.cjs
- **Commit:** 8a66273ce

**2. [Rule 1 - Plan wording] find-bottlenecks and whitespace were not "stubs" in the router, they echoed the reference file**
- **Found during:** Task 1
- **Issue:** The plan describes three reference-only stubs; only scout-hsi carried that sentence. The other two returned buildContext reference text.
- **Fix:** Both now answer the pointer line (as the plan's "replace the response body" says); the analysis pipeline step record and suggested-next stay.
- **Commit:** 8a66273ce

**3. [Rule 2 - Missing coverage] The floor sweep would have disclosed only one floor**
- **Found during:** Task 3
- **Issue:** The sweep's hit patterns do not match `BUDGETS` object literals, so extending SCAN_FAMILIES alone produced a single undisclosed hit while nine floors and budgets from the plan's list stayed undisclosed.
- **Fix:** Added a row for each (see Task 3 above), with anchors on the literal lines so a stale value fails the stale-anchor check.
- **Commit:** 2de1ce441

**4. Task 2 RED:** the offline proof and the Z4 shape describe behavior that already shipped, so `test-366-offline-recall.cjs` passed on its first run; the counter-metrics test was RED first (no COUNTER_METRICS) and went green with the registry change. No false RED was forced.

## Notes for 267-18 and the MCP peer

- `lib/mcp/tool-router.cjs` changed: blob sha `b6ff1f6af22cd62abfc78c80fbb494e41ea436bb`, last commit 8a66273ce (on top of peer commit e22a8f6ca). No registration API was touched; only response bodies, one helper, constants and the orchestration description.
- Tool count is unchanged (45 registered, 65 commands). The orchestration tool DESCRIPTION text changed, so `tests/fixtures/267/wire-snapshot-zod3.json` and `wire-snapshot-zod4.json` still carry the old sentence ("scout-hsi: reference only, no compute; ..."). `tests/test-267-mcpv2-zod4-contract.cjs` check (a) reports exactly `tool:orchestration` as a description diff; 267-18 should re-pin that one description. The same test also reports `tool:research_run:membership` (366-12's op list) and a zod importer `scripts/fork359-permission-probe.cjs`; neither is from this plan. I did not touch tests/fixtures/267/*.
- `tests/test-267-mcpv2-dual-era.cjs` showed a "process hygiene" failure (a leftover local server process from that test) in this tree; it is peer-owned work and not caused by this plan.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access; the offline test is the standing proof for T-366-67.

## Self-Check: PASSED
