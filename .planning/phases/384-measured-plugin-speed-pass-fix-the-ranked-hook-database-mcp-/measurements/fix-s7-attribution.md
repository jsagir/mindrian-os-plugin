# Phase 384 plan 15: load attribution per MCP tool file (S7)

Tree: a pinned export of START_SHA 5c6bfb89563b9a2b2eeece417c5894c88583c8d7 (plan 384-15), not the live checkout. Tool: bench/s7-load-attribution.cjs. Host: 12 cores, taskset -c 0-3 for every child, node v22.23.1. Lock held. load1 at the start of the timed table: 2.67 (the plan asks for below 2 for gated timing; this table is for selection by module counts, the milliseconds in it are informational only and are not used in any verdict); load1 at its end 1.57. Each row is n of 7 fresh node child processes: zod is required first, then the one tool file; "modules added" is the growth of require.cache by that file without the file itself.

## Table 1: cold load of each tool file in isolation (n of 7, sorted by load median)

| file | modules added | load median ms | load p95 ms | n |
|---|---|---|---|---|
| eureka-graph-compare-topics.cjs | 200 | 252.5 | 291.6 | 7 |
| eureka-graph-map.cjs | 200 | 209.6 | 303.2 | 7 |
| eureka-graph-analyze.cjs | 199 | 207.3 | 302 | 7 |
| eureka-graph-backtest.cjs | 200 | 185 | 263.3 | 7 |
| eureka-graph-rank-paths.cjs | 200 | 184 | 302 | 7 |
| eureka-graph-opportunity-scout.cjs | 201 | 177.2 | 309.4 | 7 |
| eureka-graph-genesis-plan.cjs | 200 | 177 | 269.1 | 7 |
| eureka-graph-score-surprise.cjs | 200 | 176.2 | 217.3 | 7 |
| research.cjs | 261 | 176.2 | 264.8 | 7 |
| eureka-graph-propose.cjs | 200 | 156.9 | 188.4 | 7 |
| eureka-graph-discovery-signals.cjs | 200 | 154.4 | 227.9 | 7 |
| graph-reason.cjs | 167 | 141.4 | 190.3 | 7 |
| eureka-graph-prepare-artifacts.cjs | 200 | 141.2 | 160.3 | 7 |
| eureka-capability-run.cjs | 30 | 134.3 | 141 | 7 |
| eureka-hsi-interpret-whitespace.cjs | 200 | 127.5 | 128.5 | 7 |
| views.cjs | 181 | 125.5 | 159.8 | 7 |
| eureka-graph-package-relationships.cjs | 200 | 125.3 | 127.4 | 7 |
| gate.cjs | 197 | 100 | 109.6 | 7 |
| eureka-graph-projection.cjs | 170 | 89 | 190.6 | 7 |
| feed.cjs | 167 | 86.3 | 132 | 7 |
| startup.cjs | 189 | 84.8 | 96.6 | 7 |
| context.cjs | 176 | 80.5 | 90.4 | 7 |
| rs-thesis-read.cjs | 170 | 78.8 | 102.4 | 7 |
| eureka-capability-jobs.cjs | 31 | 76.4 | 100.1 | 7 |
| claim.cjs | 169 | 76.1 | 79.7 | 7 |
| room.cjs | 188 | 74.6 | 92.8 | 7 |
| chain.cjs | 193 | 72.2 | 76.9 | 7 |
| dual-path.cjs | 170 | 71.5 | 87.5 | 7 |
| question.cjs | 172 | 62.9 | 155.4 | 7 |
| claim-verify.cjs | 169 | 61.6 | 97.8 | 7 |
| sensors.cjs | 183 | 61.2 | 91.6 | 7 |
| graph.cjs | 169 | 61.1 | 84.3 | 7 |
| rs-experts-find.cjs | 171 | 60 | 63.8 | 7 |
| stop-gate.cjs | 15 | 19.6 | 24.7 | 7 |
| artifact-read.cjs | 4 | 7.6 | 8.1 | 7 |
| identity.cjs | 2 | 6.1 | 8.7 | 7 |
| status.cjs | 8 | 3 | 5.4 | 7 |

Read this table with care: every file adds about 167 modules that all the others add too (lib/core, lib/mcp shared helpers). That shared base is loaded once in the real server, whatever one file does. So the "modules added" of one file in isolation overstates what a lazy require in that file can remove.

## Table 2: modules that only one tool file adds (exclusive), one fresh child per file

These are the modules that no other tool file loads. A lazy require in a file can remove from the start only these (and not the shared base).

distinct modules over all tool files: 350; modules that at least 80 percent of the files add: 167

| file | modules added | exclusive modules |
|---|---|---|
| research.cjs | 261 | 78 |
| sensors.cjs | 183 | 9 |
| gate.cjs | 197 | 7 |
| stop-gate.cjs | 15 | 6 |
| context.cjs | 176 | 3 |
| status.cjs | 8 | 3 |
| chain.cjs | 193 | 2 |
| dual-path.cjs | 170 | 1 |
| question.cjs | 172 | 1 |
| room.cjs | 188 | 1 |
| rs-experts-find.cjs | 171 | 1 |
| views.cjs | 181 | 1 |
| artifact-read.cjs | 4 | 0 |
| claim-verify.cjs | 169 | 0 |
| claim.cjs | 169 | 0 |
| eureka-capability-jobs.cjs | 31 | 0 |
| eureka-capability-run.cjs | 30 | 0 |
| eureka-graph-analyze.cjs | 199 | 0 |
| eureka-graph-backtest.cjs | 200 | 0 |
| eureka-graph-compare-topics.cjs | 200 | 0 |
| eureka-graph-discovery-signals.cjs | 200 | 0 |
| eureka-graph-genesis-plan.cjs | 200 | 0 |
| eureka-graph-map.cjs | 200 | 0 |
| eureka-graph-opportunity-scout.cjs | 201 | 0 |
| eureka-graph-package-relationships.cjs | 200 | 0 |
| eureka-graph-prepare-artifacts.cjs | 200 | 0 |
| eureka-graph-projection.cjs | 170 | 0 |
| eureka-graph-propose.cjs | 200 | 0 |
| eureka-graph-rank-paths.cjs | 200 | 0 |
| eureka-graph-score-surprise.cjs | 200 | 0 |
| eureka-hsi-interpret-whitespace.cjs | 200 | 0 |
| feed.cjs | 167 | 0 |
| graph-reason.cjs | 167 | 0 |
| graph.cjs | 169 | 0 |
| identity.cjs | 2 | 0 |
| rs-thesis-read.cjs | 170 | 0 |
| startup.cjs | 189 | 0 |

## Selection (rule of the plan, applied to Table 2)

The plan rule picks files by load median and by a movable top-level require. Table 1 alone would pick the 16 eureka-graph files first (200 modules, 125 to 252 ms), but Table 2 shows they add no exclusive module: all 16 add the same set through eureka-tool-contract, so a change in at most 5 of them removes nothing from the start. The 20-module threshold of the plan is therefore applied to the exclusive modules, not to the isolation counts (this is a reading of the rule written down here before any fix exists).

Selected (exclusive modules, each load median above 15 ms in Table 1, each with a require that only handler bodies use):

| file | exclusive modules | identifiers that move into the handlers |
|---|---|---|
| research.cjs | 78 | planner, quick, grants, structure, canonRelease, eurekaJudge |
| sensors.cjs | 9 | reachHedgeRanker, chainRecommender, feyNextMove |
| gate.cjs | 7 | goalGate, gateRaised |
| stop-gate.cjs | 6 | stopGateHandler |

Sum of exclusive modules of the selected files: 100 (threshold 20: met). research.cjs alone is 78 of 100.

Stay eager, with the reason: in research.cjs the identifier perspectives (and PERSPECTIVE_IDS, destructured at module top level and used in the input schema; the module adds 1 module). In the four files every other require stays as it is because it loads a module that other tool files load too (shared base); moving it removes no module from the start.

The number of tool files that change is 4 (cap 5). The baseline of the mechanism test (BASELINE_MODULES 479) is the length of require.cache after registerCoreTools with zod loaded first, on the unchanged code, 3 of 3 repeats; the plan figure of 735 modules is the whole server (SDK, transport, resources, prompts) and is not the same quantity.
