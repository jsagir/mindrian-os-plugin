---
status: fixed
leak_proof: OPEN until the owner runs tests/test-387-eureka-live-leak.cjs (Plan 387-10) and the result is pasted below.
kind: rca
trigger: "eureka-engine-unreachable-on-normal-install"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [7, 8, 9]
created: 2026-11-06T08:25:26Z
updated: 2026-11-06
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 578193b225492a0beb1f49427feb3e17dae916dd (HEAD at the start of plan 387-01), plugin version 2.0.0-beta.80 (from `node lib/core/repo-version.cjs`).
- **WIRE claims probe against:** local stdio server `bin/mindrian-mcp-server.cjs` taken from an `npm pack` layout laid out as the Claude Code plugin cache, `@ 2.0.0-beta.80`. No deployed server is probed. The Brain URL is a dead loopback address.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each source-code claim below was read at the sha above. A claim is PROVEN when the executor read the line, and UNVERIFIED when it was not read or not run.

## Current Focus

hypothesis: CONFIRMED with one change. The 22 engine tools refuse because nothing in the shipped files sets MINDRIAN_EUREKA_ROOT. Of the 2 tools that need no engine, only eureka_graph_project answers; eureka_critic fails on every install because its baseline file is not shipped.
test: Run the real stdio server from an installed-layout copy with no engine present (done, linked layout, 6 scenarios, 2 client identities).
expecting: (met) 24 eureka names; 19 engine_not_configured; 3 job_session_not_found; 1 ok.
next_action: The plugin-side fixes of plans 387-03 to 387-11 are done and tested (see Resolution). The proof against the real engine is OPEN: the owner runs tests/test-387-eureka-live-leak.cjs (Plan 387-10, runbook 387-LEAK-RUNBOOK.md) and pastes the result under Owner leak test result. The eureka_critic shipping defect was fixed by the peer quick 261106.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (a worktree of the dev repo, branch main)
- Plugin version: 2.0.0-beta.80
- Reported by: external auditor, sections D6 and B of `.planning/audits/AUDITOR-FINDINGS-source.md`; owner statement that Eureka is critical
- Date first observed: 2026-11-06
- Related debug sessions: none

## Problem Statement

On a normal install the Eureka engine tools cannot reach the engine, because the engine path comes only from the environment variable MINDRIAN_EUREKA_ROOT and no shipped file sets it. The auditor claims 1 of 23 tools works; the tool count differs between reports.

## Symptoms

expected: A person who installs the plugin can see which Eureka tools work, and gets a clear next step for the others.
actual: On the installed layout with MINDRIAN_EUREKA_ROOT unset, 1 of the 24 Eureka tools answers ok (eureka_graph_project, only when a room is bound). 19 engine tools answer engine_not_configured, 3 job tools answer job_session_not_found, and eureka_critic answers a text-only ENOENT error. See Runtime Observations.
errors: Static strings (PROVEN, see Static Findings 3): "Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool." and "The configured Mindrian Eureka checkout is unavailable."
reproduction:
  1. Run `npm pack` and lay the package out as `<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/` with a scratch HOME.
  2. Start `bin/mindrian-mcp-server.cjs` over stdio with MINDRIAN_EUREKA_ROOT unset.
  3. Call tools/list, then call every tool whose name starts with eureka.
started: Since the Eureka bridge tools were added (Phase 373 and earlier). The first bad version is not established by this plan.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the MCP server is the same code on all three)
- Affected commands: the 22 engine tools; `/mos:eureka` is the research planner perspective and needs no engine (Static Finding 6)
- Affected users: every install without a hand-set MINDRIAN_EUREKA_ROOT
- Version range: first-bad not established - 2.0.0-beta.80
- Severity: high
- Blast radius: `lib/mcp/tools/eureka-*.cjs` (16 modules), `lib/mcp/tool-router.cjs` (eureka_critic)

## Eliminated
<!-- APPEND only -->

(none yet)

## Evidence
<!-- APPEND only -->

- timestamp: 2026-11-06T08:25:26Z
  checked: static read of the 16 modules under `lib/mcp/tools/eureka-*.cjs` and `lib/mcp/tool-router.cjs`
  found: see Static Findings below
  implication: static expectation is 24 tool names; runtime must confirm
- timestamp: 2026-11-06T09:00:00Z
  checked: runtime tools/list from the installed layout (linked mode), both client identities
  found: 75 distinct tools, 24 start with eureka, identical for claude-code and claude-ai in all 6 scenarios
  implication: the static count of 24 is confirmed; no Desktop tool budget removes any Eureka tool
- timestamp: 2026-11-06T09:05:00Z
  checked: eureka_critic called on the installed layout (S1 to S6, bound and unbound)
  found: text-only error "eureka_critic: ENOENT: no such file or directory, open '<TMP>/home/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.80/evals/eureka/212-critic-baseline.json'" in all 12 calls; `package.json` "files" has no evals entry; 0 of 2411 shipped files are under evals/
  implication: a tool that needs no engine is broken on every install (NEW FAILURE)
- timestamp: 2026-11-06T09:10:00Z
  checked: S6 fake uv log and server stderr
  found: the uv error line reaches the MCP server stderr (19 of 19 bound spawning calls (the 2 unbound generic calls spawned too)) and the caller message holds none of it (0 of 19)
  implication: the uv error line is lost to the caller

## Static Findings

All facts below were read at sha 578193b225492a0beb1f49427feb3e17dae916dd. Line ranges are at that sha. Mark: PROVEN means the executor read it (or ran a read-only command). UNVERIFIED means it was not read or not run.

### 1. Tool inventory - PROVEN

Method: required each module under `lib/mcp/tools/eureka-*.cjs` in a node process and called its `register` with a stub server that records `registerTool` names (this loads code only; no engine and no uv process starts). Plus a read of `registerRouterTools` in `lib/mcp/tool-router.cjs` (function starts line 988; the eureka_critic block is at lines 2363-2480).

- 16 modules register 23 names through `registerEurekaTool` (`lib/mcp/eureka-tool-contract.cjs`):
  - `eureka-capability-jobs.cjs`: eureka_capability_start, eureka_capability_job_status, eureka_capability_job_result, eureka_capability_job_cancel
  - `eureka-capability-run.cjs`: eureka_capability_run
  - `eureka-graph-analyze.cjs`: eureka_graph_analyze
  - `eureka-graph-backtest.cjs`: eureka_graph_backtest
  - `eureka-graph-compare-topics.cjs`: eureka_graph_compare_topics
  - `eureka-graph-discovery-signals.cjs` (symbol `TOOLS`, 5 tools): eureka_graph_find_shared_neighbor_gaps, eureka_graph_find_network_holes, eureka_graph_find_community_bridge_pairs, eureka_graph_assess_category_edge_patterns, eureka_graph_find_similar_unlinked_items
  - `eureka-graph-genesis-plan.cjs`: eureka_graph_genesis_plan
  - `eureka-graph-map.cjs`: eureka_graph_map_neighbourhoods
  - `eureka-graph-opportunity-scout.cjs`: eureka_graph_opportunity_scout
  - `eureka-graph-package-relationships.cjs`: eureka_graph_package_relationships
  - `eureka-graph-prepare-artifacts.cjs`: eureka_graph_prepare_artifacts
  - `eureka-graph-projection.cjs`: eureka_graph_project
  - `eureka-graph-propose.cjs` (through `registerForCapability` in `eureka-graph-analyze.cjs`, lines 238-258): eureka_graph_propose_relationships
  - `eureka-graph-rank-paths.cjs`: eureka_graph_rank_paths
  - `eureka-graph-score-surprise.cjs`: eureka_graph_score_surprise
  - `eureka-hsi-interpret-whitespace.cjs`: eureka_hsi_interpret_whitespace
- `data/mcp-tool-connectors.json` lists the same 23 names (set difference both ways: empty).
- `lib/mcp/tool-router.cjs` (symbol `registerRouterTools`, lines 2363-2480) registers one more name, `eureka_critic`, by `server.registerTool`. It is outside `registerEurekaTool` and outside `data/mcp-tool-connectors.json` (the comment at lines 2376-2381 says so on purpose).
- Static count of names that start with eureka: 23 + 1 = 24. This is a hypothesis for the runtime tools/list (Tool Count section).

### 2. Engine need per tool - PROVEN

- The 22 tools that call the engine (symbols `callEurekaWorkflow`, `callEurekaOpportunityScout`, `callEurekaCapability`):
  - Generic bridge (`callEurekaCapability`, `eureka-capability-run.cjs` lines 189-227): eureka_capability_run.
  - Async job bridge (`configuredRoot` lines 22-28 and `startCapability` in `eureka-capability-jobs.cjs`): eureka_capability_start. The 3 job tools (status, result, cancel) read an in-process session map (`getSession`, line 108) and call the engine only through a session that eureka_capability_start made. With no session they answer job_session_not_found.
  - Graph workflow (`callEurekaWorkflow`, `eureka-graph-analyze.cjs` lines 19-60): eureka_graph_analyze, eureka_graph_propose_relationships, the 5 discovery-signal tools, eureka_graph_backtest, eureka_graph_compare_topics, eureka_graph_genesis_plan, eureka_graph_map_neighbourhoods, eureka_graph_package_relationships, eureka_graph_prepare_artifacts, eureka_graph_rank_paths, eureka_graph_score_surprise, eureka_hsi_interpret_whitespace.
  - Scout (`callEurekaOpportunityScout`, lines 103-197): eureka_graph_opportunity_scout.
  - Count: 1 (run) + 1 (start) + 3 (jobs) + 1 (analyze) + 1 (propose) + 5 (signals) + 1 (backtest) + 1 (compare) + 1 (genesis) + 1 (map) + 1 (package) + 1 (prepare) + 1 (rank) + 1 (score) + 1 (hsi) + 1 (scout) = 22.
- The 2 tools that need no engine: eureka_graph_project (`project` in `eureka-graph-projection.cjs`, lines 47-93: reads the room graph read-only and returns the snapshot) and eureka_critic (pure function `criticRule` of `lib/core/eureka-critic.cjs`, no room and no engine).
- Which tools run the room projection first (symbol `project` in `eureka-graph-projection.cjs`): every graph tool calls `project(...)` before `callEurekaWorkflow` or `callEurekaOpportunityScout` (analyze line 205, discovery-signals `runDiscoverySignalUnlabeled` line 90, and the corresponding first lines of backtest, compare-topics, genesis-plan, map, package-relationships, prepare-artifacts, rank-paths, score-surprise, hsi-interpret-whitespace). Several of them run a pure argument check first (for example eureka_graph_map_neighbourhoods checks base and target, rank-paths checks path nodes against node_ids). The 3 tools that check the engine root before anything else: eureka_capability_run (line 194), eureka_capability_start (`configuredRoot` called at line 35 before the session limit), and none of the graph tools.
- Refusal precedence for graph tools (hypothesis for runtime): with no room bound and no engine, `project` returns no_bound_room (line 52) before the engine check, so no_bound_room comes first.

### 3. Exact refusal text - PROVEN

- engine_not_configured: `Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool.` (sites: `eureka-capability-run.cjs` line 196, `eureka-capability-jobs.cjs` line 24, `eureka-graph-analyze.cjs` lines 26 and 107). The message map in `eureka-graph-discovery-signals.cjs` (symbol `ENGINE_CALL_FAILURES`, lines 67-76) holds a different text for the 5 discovery-signal tools: `The local Eureka engine is not configured. Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool.`
- engine_checkout_unavailable: `The configured Mindrian Eureka checkout is unavailable.` (same 4 sites plus the message map). The test is only `fs.existsSync(ROOT/pyproject.toml)`.
- engine_unavailable: five different texts, one per call site: `Could not call the configured local Eureka MCP server: <first 500 characters of the error, root path replaced>` (callEurekaCapability line 223); `Could not start or call the configured local Eureka MCP server.` (callEurekaWorkflow line 56); `Could not complete the local Eureka opportunity scout MCP session: <error>` (scout line 193); `Could not start an asynchronous job in the configured local Eureka MCP server.` (startCapability line 99); `Could not start or call the configured local Eureka engine.` (message map). The `<error>` detail in two of them is the SDK transport error text; whether it holds the uv error line is the S6 question.
- job_session_not_found: `No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job.` (`eureka-capability-jobs.cjs` line 110).
- The root check is written 4 times as code (capability-run, capability-jobs `configuredRoot`, graph-analyze twice) and a fifth time as a message map in discovery-signals. The 4 engine-root check sites do not share code.

### 4. What sets MINDRIAN_EUREKA_ROOT - PROVEN (read from the shipped files)

Method: `npm pack --dry-run --json --ignore-scripts` (no tarball written): 2411 shipped files. Searched only those files for the string MINDRIAN_EUREKA_ROOT.

- 7 shipped files hold the string: `commands/eureka.md`, `skills/eureka/SKILL.md` (both only tell a person to confirm it points to a checkout and use it in a `uv run --project "$MINDRIAN_EUREKA_ROOT"` example), and `lib/mcp/tools/eureka-capability-jobs.cjs`, `eureka-capability-run.cjs`, `eureka-graph-analyze.cjs`, `eureka-graph-discovery-signals.cjs`, `eureka-graph-opportunity-scout.cjs` (all only READ it, or print it in a message).
- No shipped file assigns, exports, puts in an env block or writes it to `process.env` (search for an assignment, `export`, and a `"MINDRIAN_EUREKA_ROOT":` key: 0 hits).
- Checked by name: `.mcp.json` (two servers, no `env` block), `hooks/hooks.json`, `settings.json`, `.claude-plugin/plugin.json` (no EUREKA string), `scripts/session-start` and `scripts/first-install-router.cjs` (not in the 7-file hit list). The installer `lib/core/eureka/eureka-enable.cjs` installs the local measuring tool (the encoder) and never mentions the engine path.
- `eurekaChildEnvironment` (`eureka-capability-run.cjs` lines 69-78) copies only the keys of `EUREKA_CHILD_ENV_KEYS` (lines 26-34). MINDRIAN_EUREKA_ROOT is not in that list, so the engine child never sees it (it receives the folder as `--project` argument and `cwd`).
- Conclusion: the only source is the launching process environment. PROVEN for the shipped files at this sha.

### 5. What the engine call needs, from code only - PROVEN

- Command: `env.MINDRIAN_EUREKA_UV || 'uv'` on all 3 builders.
- Argument lists (read; the S6 fake uv log re-proves them at runtime):
  - `clientOptions` (`eureka-capability-run.cjs` lines 53-62), used by `callEurekaCapability` and `startCapability`: `run --project <root> --extra mcp-server [--extra hmm | --extra modern-encoder | --extra reference-encoder] eureka-mcp`. The hmm extra is added for decision.compare_sequence_patterns and decision.fit_sequence_patterns. The encoder extra is added for opportunity.find_cross_domain_pairs and opportunity.synthesize_discovery_signals (reference-encoder when MINDRIAN_EUREKA_RS_ENCODER is reference-bert, else modern-encoder).
  - `callEurekaWorkflow` (`eureka-graph-analyze.cjs` line 37): `run --project <root> --extra mcp-server eureka-mcp`.
  - `callEurekaOpportunityScout` (line 117): `run --project <root> --extra mcp-server --extra <encoder extra> eureka-mcp`.
- None of the 3 builders passes `--no-sync`, `--offline`, `--frozen`, `--locked` or `--no-python-downloads`. So a plain `uv run`, which the engine audits say auto-syncs, runs on every path. The engine side of that claim is UNVERIFIED here (the engine is private and is not run).
- Child environment: allowlist `EUREKA_CHILD_ENV_KEYS` (HOME, USERPROFILE, PATH, SHELL, TERM, USER, LANG, LC_ALL, TMPDIR, TEMP, TMP, the MINDRIAN_EUREKA_* model and cache keys, HF_* and torch cache keys, HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE, TOKENIZERS_PARALLELISM). It drops UV_CACHE_DIR, UV_PYTHON_INSTALL_DIR, UV_PROJECT_ENVIRONMENT, UV_OFFLINE and all proxy variables (HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY).
- Forced offline: `eurekaChildEnvironment(env, { forceOffline: true })` sets UV_OFFLINE, HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE to 1 unless MINDRIAN_EUREKA_ALLOW_NETWORK=1. Only `callEurekaWorkflow` passes `forceOffline` (line 39). `clientOptions` calls `eurekaChildEnvironment(env)` with no option, and the scout (line 119) too. So UV_OFFLINE is 1 on the graph workflow path only.

### 6. Eureka paths that need no engine - PROVEN (read) and UNVERIFIED (run, until Runtime Observations)

- `scripts/research-planner.cjs` (subcommand `eureka-recall`, line 371: `perspectiveRecall(room, 'eureka', flags)`) and `lib/core/research-planner/perspectives/*.cjs` (eureka-recall, eureka-judge, shared, index, and the others): a search for `spawn`, `child_process`, `execSync`, `execFile`, `uv`, `python` and `MINDRIAN_EUREKA` in those files, comment lines excluded, returned 0 spawn or child_process hits. The MCP twin is `research_run` op `perspective_recall` with perspective `eureka` (`lib/mcp/tools/research.cjs` line 67).
- The portfolio path: `scripts/eureka-portfolio.cjs` line 67 returns the plain reason encoder_unavailable with the sentence: `The local measuring tool is not installed, so there are no fitness numbers. Run /mos:eureka enable once to install it.` That sentence is about the local measuring tool (installed by `/mos:eureka enable`), not about the engine.

### 7. Shipped or not - PROVEN

From the npm pack file list: 0 files under `r-and-d/`, 0 files under `.planning/`, 0 paths that contain `mindrian-eureka`. The engine is not shipped.

## Owner shell case (not run)

MINDRIAN_EUREKA_ROOT set to a real engine checkout with uv on PATH is NOT RUN. The engine is private and is never started in this plan. Static prediction, UNVERIFIED: the gate passes on the root and `pyproject.toml`, then real uv starts `uv run --project <root> --extra mcp-server eureka-mcp`, which may sync and reach a package index if the lock or extras differ.

## Runtime Observations (installed layout)

Method. `tests/helpers/eureka-installed-layout-387.cjs` ran `npm pack --ignore-scripts`, laid the package out as `<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.80/` in a scratch HOME, and started the real `bin/mindrian-mcp-server.cjs` over stdio. Layout mode: linked (the repo `node_modules` is symlinked into the layout). The layout holds no `.planning`, no `r-and-d` and no folder named `mindrian-eureka`. The run is pinned by `tests/test-387-eureka-installed-layout.cjs` and stored in `.planning/phases/387-eureka-reachable-on-a-normal-install/387-01-OBSERVATIONS.json`.

Mode of each number: every number below is PROVEN for the linked layout. It is UNVERIFIED for the npm ci layout. The `--npm-ci` mode of the probe was not run, because the plan rules forbid network access and `npm ci` needs the registry.

Conditions. Baseline S1 and S2: MINDRIAN_EUREKA_ROOT is absent, the scratch HOME holds no `.mindrian/eureka-engine.json` and no `.mindrian/eureka-engine` folder, no maintainer path or checkout is inherited, and the Brain URL is a dead loopback address. A synthetic bound-room fixture (a born room with 6 synthetic nodes and 2 edges) serves the room-dependent calls; every call is made first with no room bound and again after `room_bind`. Synthetic arguments were derived from each tool schema, and the probe fails on any schema validation error (none occurred).

The real-engine case (MINDRIAN_EUREKA_ROOT set to the owner engine, real uv on PATH) was NOT RUN. Static prediction, UNVERIFIED: see Owner shell case above.

### Exact texts (referenced by the tables)

| Id | Reason family | Exact message |
|----|---------------|---------------|
| M1 | job_session_not_found | No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job. |
| M2 | engine_not_configured | Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool. |
| M3 | no_bound_room | Bind the intended MindrianOS room before preparing an engine projection. |
| M4 | engine_not_configured (5 discovery-signal tools) | The local Eureka engine is not configured. Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool. |
| M5 | engine_checkout_unavailable | The configured Mindrian Eureka checkout is unavailable. |
| M6 | engine_unavailable (eureka_capability_run, S4) | Could not call the configured local Eureka MCP server: spawn <TMP>/no-such-uv-387 ENOENT |
| M7 | engine_unavailable (eureka_capability_start) | Could not start an asynchronous job in the configured local Eureka MCP server. |
| M8 | engine_unavailable (12 graph tools) | Could not start or call the configured local Eureka MCP server. |
| M9 | engine_unavailable (5 discovery-signal tools) | Could not start or call the configured local Eureka engine. |
| M10 | engine_unavailable (eureka_capability_run, S5) | Could not call the configured local Eureka MCP server: spawn uv ENOENT |
| M11 | engine_unavailable (eureka_capability_run, S6) | Could not call the configured local Eureka MCP server: Connection closed |

eureka_critic (all scenarios, bound and unbound): isError true, no reason, no structuredContent, text: `eureka_critic: ENOENT: no such file or directory, open '<TMP>/home/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.80/evals/eureka/212-critic-baseline.json'`.

### S1 table (unset, full environment)

| Tool | Unbound (S1) | Bound (S1) |
|------|--------------|------------|
| eureka_capability_job_cancel | job_session_not_found (M1) | job_session_not_found (M1) |
| eureka_capability_job_result | job_session_not_found (M1) | job_session_not_found (M1) |
| eureka_capability_job_status | job_session_not_found (M1) | job_session_not_found (M1) |
| eureka_capability_run | engine_not_configured (M2) | engine_not_configured (M2) |
| eureka_capability_start | engine_not_configured (M2) | engine_not_configured (M2) |
| eureka_critic | text-only error | text-only error |
| eureka_graph_analyze | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_assess_category_edge_patterns | no_bound_room (M3) | engine_not_configured (M4) |
| eureka_graph_backtest | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_compare_topics | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_find_community_bridge_pairs | no_bound_room (M3) | engine_not_configured (M4) |
| eureka_graph_find_network_holes | no_bound_room (M3) | engine_not_configured (M4) |
| eureka_graph_find_shared_neighbor_gaps | no_bound_room (M3) | engine_not_configured (M4) |
| eureka_graph_find_similar_unlinked_items | no_bound_room (M3) | engine_not_configured (M4) |
| eureka_graph_genesis_plan | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_map_neighbourhoods | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_opportunity_scout | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_package_relationships | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_prepare_artifacts | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_project | no_bound_room (M3) | ok |
| eureka_graph_propose_relationships | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_rank_paths | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_graph_score_surprise | no_bound_room (M3) | engine_not_configured (M2) |
| eureka_hsi_interpret_whitespace | no_bound_room (M3) | engine_not_configured (M2) |

Totals S1 bound: 19 engine_not_configured (14 with M2, 5 with M4), 3 job_session_not_found, 1 ok (eureka_graph_project), 1 text-only error (eureka_critic). Totals S1 unbound: 18 no_bound_room (every tool that opens the room projection, eureka_graph_project included), 3 job_session_not_found, 2 engine_not_configured (eureka_capability_run and eureka_capability_start, which do not open a projection), 1 text-only error (eureka_critic).

Refusal precedence (answers the plan question): with no room bound and no engine, the 18 projection tools answer no_bound_room first. The 2 generic tools (run, start) answer engine_not_configured first, because they never read a room.

### Delta tables (cells that differ from S1)

S2 (unset, minimal environment: `env -i` with HOME, USERPROFILE, MINDRIAN_ROOMS_HOME, TMPDIR, PATH; a simulation of a Desktop launch, not a real Desktop run):

(no cell differs from S1)

S3 (MINDRIAN_EUREKA_ROOT is an empty folder; reason engine_checkout_unavailable, text M5):

| Tool | State | S1 | S3 |
|------|-------|----|----|
| eureka_capability_run | unbound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_capability_run | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_capability_start | unbound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_capability_start | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_analyze | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_assess_category_edge_patterns | bound | engine_not_configured (M4) | engine_checkout_unavailable (M5) |
| eureka_graph_backtest | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_compare_topics | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_find_community_bridge_pairs | bound | engine_not_configured (M4) | engine_checkout_unavailable (M5) |
| eureka_graph_find_network_holes | bound | engine_not_configured (M4) | engine_checkout_unavailable (M5) |
| eureka_graph_find_shared_neighbor_gaps | bound | engine_not_configured (M4) | engine_checkout_unavailable (M5) |
| eureka_graph_find_similar_unlinked_items | bound | engine_not_configured (M4) | engine_checkout_unavailable (M5) |
| eureka_graph_genesis_plan | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_map_neighbourhoods | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_opportunity_scout | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_package_relationships | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_prepare_artifacts | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_propose_relationships | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_rank_paths | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_graph_score_surprise | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |
| eureka_hsi_interpret_whitespace | bound | engine_not_configured (M2) | engine_checkout_unavailable (M5) |

S4 (fixture folder with a two-line pyproject.toml; MINDRIAN_EUREKA_UV is a path that does not exist):

| Tool | State | S1 | S4 |
|------|-------|----|----|
| eureka_capability_run | unbound | engine_not_configured (M2) | engine_unavailable (M6) |
| eureka_capability_run | bound | engine_not_configured (M2) | engine_unavailable (M6) |
| eureka_capability_start | unbound | engine_not_configured (M2) | engine_unavailable (M7) |
| eureka_capability_start | bound | engine_not_configured (M2) | engine_unavailable (M7) |
| eureka_graph_analyze | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_assess_category_edge_patterns | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_backtest | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_compare_topics | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_find_community_bridge_pairs | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_network_holes | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_shared_neighbor_gaps | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_similar_unlinked_items | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_genesis_plan | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_map_neighbourhoods | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_opportunity_scout | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_package_relationships | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_prepare_artifacts | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_propose_relationships | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_rank_paths | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_score_surprise | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_hsi_interpret_whitespace | bound | engine_not_configured (M2) | engine_unavailable (M8) |

S5 (same fixture folder; uv absent from PATH, which holds only the node folder; the probe asserted that no file named uv sits there):

| Tool | State | S1 | S5 |
|------|-------|----|----|
| eureka_capability_run | unbound | engine_not_configured (M2) | engine_unavailable (M10) |
| eureka_capability_run | bound | engine_not_configured (M2) | engine_unavailable (M10) |
| eureka_capability_start | unbound | engine_not_configured (M2) | engine_unavailable (M7) |
| eureka_capability_start | bound | engine_not_configured (M2) | engine_unavailable (M7) |
| eureka_graph_analyze | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_assess_category_edge_patterns | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_backtest | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_compare_topics | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_find_community_bridge_pairs | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_network_holes | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_shared_neighbor_gaps | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_similar_unlinked_items | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_genesis_plan | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_map_neighbourhoods | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_opportunity_scout | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_package_relationships | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_prepare_artifacts | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_propose_relationships | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_rank_paths | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_score_surprise | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_hsi_interpret_whitespace | bound | engine_not_configured (M2) | engine_unavailable (M8) |

S6 (same fixture folder; MINDRIAN_EUREKA_UV is a fake uv that logs its argument list and exits 2 after printing one uv-style error line to stderr):

| Tool | State | S1 | S6 |
|------|-------|----|----|
| eureka_capability_run | unbound | engine_not_configured (M2) | engine_unavailable (M11) |
| eureka_capability_run | bound | engine_not_configured (M2) | engine_unavailable (M11) |
| eureka_capability_start | unbound | engine_not_configured (M2) | engine_unavailable (M7) |
| eureka_capability_start | bound | engine_not_configured (M2) | engine_unavailable (M7) |
| eureka_graph_analyze | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_assess_category_edge_patterns | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_backtest | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_compare_topics | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_find_community_bridge_pairs | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_network_holes | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_shared_neighbor_gaps | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_find_similar_unlinked_items | bound | engine_not_configured (M4) | engine_unavailable (M9) |
| eureka_graph_genesis_plan | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_map_neighbourhoods | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_opportunity_scout | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_package_relationships | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_prepare_artifacts | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_propose_relationships | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_rank_paths | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_graph_score_surprise | bound | engine_not_configured (M2) | engine_unavailable (M8) |
| eureka_hsi_interpret_whitespace | bound | engine_not_configured (M2) | engine_unavailable (M8) |

### S6 argument and environment log (the before-state of every spawning path)

The fake uv logged exactly 1 spawn per engine call (0 spawns for the 3 job tools and for the two tools that need no engine). The exact argument list on each path:

| Path | Calls | Logged argv (uv arguments) | UV_OFFLINE, HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE in the child |
|------|-------|----------------------------|------------------------------------------------------------------|
| generic call (callEurekaCapability, eureka_capability_run) | 2 (unbound, bound) | run --project <TMP>/fixture-engine-folder-387 --extra mcp-server eureka-mcp | unset, unset, unset |
| async job start (startCapability, eureka_capability_start) | 2 | run --project <TMP>/fixture-engine-folder-387 --extra mcp-server eureka-mcp | unset, unset, unset |
| graph workflow (callEurekaWorkflow, 17 graph tools, bound) | 17 | run --project <TMP>/fixture-engine-folder-387 --extra mcp-server eureka-mcp | 1, 1, 1 |
| scout (callEurekaOpportunityScout, direct call of the shipped function) | 1 | run --project <TMP>/fixture-engine-folder-387 --extra mcp-server --extra modern-encoder eureka-mcp | unset, unset, unset |

None of the 4 argument lists holds --no-sync, --offline, --frozen, --locked or --no-python-downloads. The working folder of the child is the engine folder. Child environment keys on the generic and scout paths: HOME, LANG, LOGNAME, PATH, SHELL, TERM, TMPDIR, USER, USERPROFILE (LOGNAME comes from the MCP client default environment, not from the plugin allowlist). On the graph workflow path the same keys plus HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE and UV_OFFLINE. MINDRIAN_EUREKA_ROOT never reaches the child.

The uv error line: for 19 of 19 bound spawning calls (the 2 unbound generic calls spawned too) where the fake uv ran, the line `error: No interpreter found for Python >=3.11 in managed installations or search path` appeared in the MCP server stderr (the engine child inherits that stream; the plugin never pipes it) and 0 of 19 caller messages held any part of it. The caller sees "Connection closed" (eureka_capability_run, M11) or a fixed text (all others). For a missing uv binary (S4 and S5), only eureka_capability_run shows the cause ("spawn ... ENOENT", M6 and M10); the 17 graph tools and eureka_capability_start show the generic text.

### Perspective arm (S1 only, no engine)

`research_run` with op perspective_recall and perspective eureka, on a bound planted fixture room, on the installed layout with no engine: ok true, 2 candidate pairs recalled (counts: things 16, sections 4, candidates 2). Network attempts made by the server process: 0 total, 0 non-loopback, measured with a preload that wraps `net.Socket.prototype.connect` and `dns.lookup`; a positive control (a deliberate connect to 127.0.0.1:9 in a child process) was logged, so the zero is meaningful. Note: the Brain URL port 9 is on the fetch bad-ports list, so a fetch to it would not open a socket either; the zero covers every other connect and every DNS lookup. No uv or python process was started (the engine variable was unset).

## Tool Count (runtime tools/list)

- Runtime tools/list total: 75 distinct tool names, 75 entries (no duplicates), identical for the clients `claude-code` and `claude-ai 0.1.0` in all 6 scenarios. No Desktop-shaped difference exists in tools/list.
- Names that start with eureka: 24 for both identities (S1 to S6).
- Static expectation: 24 (23 registered through `registerEurekaTool` plus `eureka_critic`). Runtime 24 equals static 24. The difference between the auditor 23 and the runtime 24 is `eureka_critic`, registered by `registerRouterTools` in `lib/mcp/tool-router.cjs` outside the 16 modules and outside `data/mcp-tool-connectors.json` (which lists 23).
- Other tools that serve Eureka: `research_run` (op perspective_recall, perspective eureka, needs no engine) and `rs_experts_find` and `rs_thesis_read` (the two rs_ tools in tools/list; not called by this probe).
- Tools that need the engine: 22 (eureka_capability_run, eureka_capability_start, the 3 job tools, eureka_graph_analyze, eureka_graph_propose_relationships, the 5 discovery-signal tools, eureka_graph_backtest, eureka_graph_compare_topics, eureka_graph_genesis_plan, eureka_graph_map_neighbourhoods, eureka_graph_opportunity_scout, eureka_graph_package_relationships, eureka_graph_prepare_artifacts, eureka_graph_rank_paths, eureka_graph_score_surprise, eureka_hsi_interpret_whitespace). Runtime: 22 refuse with no engine (19 engine_not_configured, 3 job_session_not_found).
- Tools that answered ok without an engine: 1, `eureka_graph_project` (bound room only). `eureka_critic` was expected to answer and does not: it fails on the installed layout (see Technical Root Cause).

### Hypothesis check

| Hypothesis | Verdict | Measured number |
|------------|---------|-----------------|
| Auditor: on a normal install 1 of 23 Eureka tools works | CHANGED | 1 of 24 answers ok (eureka_graph_project, bound room only). The count is 24, not 23. If eureka_critic worked it would be 2 of 24. |
| 19 tools answer engine_not_configured | CONFIRMED | 19 bound (14 with M2, 5 with M4) |
| 3 tools answer job_session_not_found | CONFIRMED | 3 (the job status, result and cancel tools) |
| Nothing sets MINDRIAN_EUREKA_ROOT | CONFIRMED | 0 assignments in 2411 shipped files; S1 and S2 both unset |
| The projection runs before the engine check on graph tools | CONFIRMED | 18 of 18 projection tools answer no_bound_room when unbound |
| The tool count is 23 or 24 | CHANGED | 24 from runtime tools/list (static 24, auditor 23) |
| A plain uv run on every path (no --no-sync, --offline, --frozen or --locked) | CONFIRMED | 4 of 4 argument lists, from the S6 fake uv log |
| UV_OFFLINE is passed only on the graph workflow path | CONFIRMED | UV_OFFLINE=1 on 17 of 17 graph calls; unset on generic, async and scout paths |
| The uv error line is lost to the caller | CONFIRMED | 0 of 19 caller messages hold it; 19 of 19 reach the server stderr |
| /mos:eureka answers with no engine | CONFIRMED | perspective_recall ok, 2 pairs, 0 network attempts |
| eureka_critic needs no engine and answers | REFUTED | text-only ENOENT error in 12 of 12 calls |

## Technical Root Cause

Plain facts, per item. Each is PROVEN for the linked installed layout unless it says otherwise.

(a) The only input that reaches the engine tools is the variable MINDRIAN_EUREKA_ROOT, and nothing in the shipped files sets it. 7 shipped files hold the string; all only read it or print it. `eurekaChildEnvironment` does not pass it to the engine child. Site: `lib/mcp/tools/eureka-capability-run.cjs` lines 189-200 (and the 3 other check sites listed in Static Findings 3).

(b) The variable can only come from the launching process environment. S2 (`env -i` launch) answered exactly like S1, because the variable is absent in both. A Desktop-shaped launch gets no shell environment; this is a SIMULATION (a real Desktop launch was not run, UNVERIFIED), and the claim that Desktop passes no shell variable is ASSUMED from the S2 shape.

(c) The refusal text names an environment variable and says nothing about what to do. It does not say that `/mos:eureka` needs no engine, or that only 22 of 24 tools need one. Text M2 and M4.

(d) The reason does not tell absent, misconfigured and broken apart for the user. S1 gives engine_not_configured; S3 gives engine_checkout_unavailable; S4, S5 and S6 (no uv, uv absent, uv fails) all give the one reason engine_unavailable with a generic text. The only cause visible to a caller is a missing uv binary on one tool (eureka_capability_run, M6 and M10).

(e) The 18 projection tools open the room projection before they check the engine (I2: all 18 answer no_bound_room unbound). A person without an engine and without a bound room is told to bind a room, then told about the engine only after binding.

(f) Every path starts the engine with a plain `uv run` (4 of 4 argument lists, S6 log): no --no-sync, --offline, --frozen, --locked or --no-python-downloads. The plugin side is PROVEN: nothing in the plugin argument list prevents uv from syncing, so a missing extra can make uv install packages and reach a package index at call time. UV_OFFLINE=1 is set on the graph workflow path only (17 of 17), and the allowlist drops UV_OFFLINE, proxy variables and UV_CACHE_DIR from every other path. "Offline after setup" is therefore not true for the generic, async and scout paths. The ENGINE side (that uv really syncs and fetches) is UNVERIFIED: the engine was never run.

(g) A missing uv, Python, extra, model or Node, a stale lock and a bad folder all reach the caller as the one reason engine_unavailable with a generic text, and the uv error line is lost (0 of 19 caller messages; the line goes to the server stderr that the plugin never reads). S6 is the proof for uv and Python. A missing extra, model, Node and a stale lock are UNVERIFIED at runtime (the real engine was not run); only the single reason code is PROVEN for them through the same code path.

(h) NEW: `eureka_critic` fails on every install. Site: `lib/core/eureka-critic.cjs` line 533, symbol `BASELINE_PATH` and function `loadBaseline`: it reads `evals/eureka/212-critic-baseline.json` relative to the repo root. `package.json` "files" has no `evals` entry, so the file is not shipped (0 of 2411 shipped files are under evals/). The tool is registered and listed (`lib/mcp/tool-router.cjs` lines 2363-2480) but answers a text-only ENOENT error. Why it surfaces now: the tool was tested only in the dev tree, where the file exists; the installed-layout probe is the first run on a packed copy. It needs no engine, so no engine plan fixes it.

What works (PROVEN): the research planner perspective answers on the installed layout with no engine, the projection tool answers when a room is bound, the tool list is complete and identical for both client identities, and no network attempt was made by the perspective call.

perspective_without_engine: yes

Classification list (docs/RCA-TEMPLATE.md classes):

Classification: (a) no setter for MINDRIAN_EUREKA_ROOT in the shipped files - KNOWN (the 2026-11-06 README says Eureka needs an optional external engine; no tracked debug session; this phase is the fix)
Classification: (b) Desktop gets no shell variable - ENV GAP (a simulation only; a real Desktop launch was not run)
Classification: (c) refusal text names a variable and gives no next step - KNOWN (fixed by plans 387-05 and 387-11)
Classification: (d) absent, misconfigured and broken are not told apart - KNOWN (auditor finding, fixed by plans 387-03, 387-05 and 387-11)
Classification: (e) projection runs before the engine check - WORKING as coded, and KNOWN as a usability gap (plan 387-05 reorders)
Classification: (f) plain uv run on every path, offline only on the graph workflow path - NEW FAILURE for Canon Part 8 (plugin side proven; fixed by plan 387-06)
Classification: (g) generic engine_unavailable, uv error line lost - KNOWN (fixed by plan 387-11, typed causes)
Classification: (h) eureka_critic broken on the installed layout, evals/ not shipped - NEW FAILURE (not covered by plans 387-03 to 387-11)
Classification: the research planner perspective with no engine, and eureka_graph_project with a bound room - WORKING

## Required Code Changes
<!-- Explicit, imperative, one block per change; plans 387-03 to 387-11 are pointed at by goal -->

- Change 1 (plan 387-03, resolver and requirements map):
  - Location: new core module (engine home resolver and a map of what each Eureka tool needs); replaces the 4 duplicated root checks in `lib/mcp/tools/eureka-capability-run.cjs` (`callEurekaCapability`), `eureka-capability-jobs.cjs` (`configuredRoot`), `eureka-graph-analyze.cjs` (`callEurekaWorkflow`, `callEurekaOpportunityScout`) and the message map in `eureka-graph-discovery-signals.cjs` (`ENGINE_CALL_FAILURES`).
  - Current behavior: the root comes only from the environment variable; the check is written 4 times plus a message map.
  - Required behavior: one resolver (override variable, then a saved setting, then a default folder) and one needs map.
- Change 2 (plan 387-09, enable command): build `/mos:eureka enable engine` on the resolver (adopt a folder, check uv, Python, Node, packages, model, run the one granted packages step).
- Change 3 (plan 387-04, command text): wire the enable command into `commands/eureka.md` and remove the advice to hand-set the variable (`commands/eureka.md` lines 200-216 and `skills/eureka/SKILL.md` lines 197-213).
- Change 4 (plans 387-05 and 387-11, tool states): replace the generic refusals (M2, M4, M5, M6 to M11) with typed states from one text source; check the engine before the room projection only for the states that do not need the room; add the typed causes engine_extra_missing, engine_model_missing and engine_node_missing; pass the first stderr line of the engine child to the caller (S6 shows it is lost). Update EXPECT in `tests/test-387-eureka-installed-layout.cjs` in the same commits.
- Change 5 (plan 387-06, egress): pass --no-sync, --offline, --locked and --no-python-downloads in the uv arguments of all 4 builders (S6 shows none has them) and force the offline variables on every path, not only the graph workflow path.
- Change 6 (plan 387-07, doctor): add the Eureka engine readiness point to `scripts/doctor.cjs`.
- Change 7 (plan 387-08, docs): make README and docs say that 22 of 24 tools need the engine, that `/mos:eureka` needs none, and that setup has three parts.
- Change 8 (plan 387-10, owner-run leak test): the real-engine leak test; this plan did not run the real engine.
- Change 9 (NOT covered by any plan 387-03 to 387-11): ship the critic baseline.
  - Location: `lib/core/eureka-critic.cjs` line 533 (`BASELINE_PATH`) and `package.json` "files".
  - Current behavior: `eureka_critic` reads `evals/eureka/212-critic-baseline.json`, which is not in the pack; the tool answers ENOENT on every install.
  - Required behavior: the baseline is read from a shipped location (for example under `data/`), and the shipped copy is checked by the installed-layout test (arm I3 then changes on purpose).
  - Short-term patch: add `evals/eureka/212-critic-baseline.json` to the `files` list in `package.json`.
  - Long-term fix: move the baseline into `data/` with the critic tags file `data/eureka-critic-tags.json`, which already ships.

## Tests to Add or Update

- Test 1 (added by this plan):
  - Type: integration (installed layout, real stdio server)
  - Location: `tests/test-387-eureka-installed-layout.cjs` with helper `tests/helpers/eureka-installed-layout-387.cjs`
  - Given: a packed copy of the repo laid out as the plugin cache in a scratch HOME, MINDRIAN_EUREKA_ROOT unset or set to a fixture folder
  - When: the 24 eureka tools are listed and called unbound and bound to a synthetic fixture room, in 6 scenarios, with 2 client identities
  - Then: the table equals EXPECT (arms I1 to I8); a wrong copy of EXPECT fails (arm I7)
  - Runner registration: `bash tests/run-all-387.sh` discovers it by glob; exit 77 counts as SKIPPED
- Test 2 (plans 387-05, 387-06, 387-11): change EXPECT in the same commit that changes the behavior; add fake-engine tests for the offline arguments.
- Test 3 (change 9): after the baseline ships, change arm I3 so eureka_critic answers ok on the installed layout.

## Non-Code Follow-ups

- CHANGELOG.md and `.planning/debug/knowledge-base.md`: owned by plan 387-08; not edited here.
- Release lockstep: a fix to the critic baseline or the engine flow ships only in a release; the lockstep in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 applies.
- Canon gates: Part 8 (no room text leaves: the perspective arm made 0 network attempts; the plugin side of the engine path is a gap, fixed by plan 387-06), Tri-Polar (the MCP server is one code path for CLI, Desktop and Cowork; tools/list is identical for both client identities; a real Desktop and a real Cowork run were not made), cross-platform (probe run on Linux only; the S2 launch uses `env -i`, which Windows lacks, so Windows is UNVERIFIED), no em dashes (checked), reuse before build (the probe reuses the pack and layout idea of `tests/test-369-installed-layout.cjs`, the session-binding approach of `tests/test-desktop-stdio-session-binding.cjs`, `tests/helpers/isolated-home-36925.cjs` and `tests/helpers/fixture-366.cjs`).
- UNVERIFIED: the npm ci layout (no network allowed); the real engine behavior for uv sync, extras, model and Node; a real Desktop launch environment.

## After table (Plan 387-08, same probe, same fixtures)

Source: `.planning/phases/387-eureka-reachable-on-a-normal-install/387-08-OBSERVATIONS-AFTER.json` (probe at plugin 2.0.0-beta.80, linked layout, 7 scenarios, both client identities) next to `387-01-OBSERVATIONS.json`. Compared per tool and bound state on reason, engine_state, cause, fix and engine_start_line. S1 to S6 each list 48 calls (24 tools, unbound and bound); S7 is new.

| Scenario | Before | After |
|----------|--------|-------|
| S1 and S2 (nothing set, full and Desktop-shaped environment) | 19 engine_not_configured with texts that name a variable; the 18 projection tools (eureka_graph_project included) answered no_bound_room first when unbound | 19 engine_not_configured, engine_state absent, with a fix line; the engine check runs before the room check, so unbound calls answer the engine state too; 3 job tools answer job_session_not_found with engine_state absent; eureka_graph_project ok; eureka_critic answers a ruling (peer quick 261106) |
| S3 (folder without pyproject.toml) | 19 engine_checkout_unavailable, one generic text | 19 engine_checkout_unavailable, engine_state broken, cause pyproject_missing, fix line |
| S4 and S5 (no uv, uv path missing) | 19 engine_unavailable, several different generic texts | 19 engine_unavailable, engine_state broken, cause uv_missing, fix line |
| S6 (uv fails to start, fake uv) | 19 engine_unavailable, text "Connection closed", uv error line lost | 19 engine_unavailable, cause python_missing, the cleaned first start line as engine_start_line, fixed sentence |
| S7 (new: saved setting, no variable, Desktop-shaped environment) | not present | the gate passes with no variable; calls fail at the missing uv with cause uv_missing (a simulation, not a real Desktop launch) |
| uv arguments on the 4 spawning paths (S6 fake uv log) | plain `run --project ROOT --extra mcp-server ... eureka-mcp`; UV_OFFLINE 1 on the graph path only | `run --no-sync --offline --locked --no-python-downloads --project ROOT --extra ... eureka-mcp`; UV_OFFLINE, HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE are 1 on all 4 paths |

Cell counts, S1 to S6 against the before-state: S1 and S2 46 of 48 calls changed, S3 46, S4 and S5 and S6 23. Unchanged: the job tools' reason in S4 to S6 and the 24-name tool list (75 distinct tools in all scenarios). The 2 calls that changed only in isError are eureka_critic (error before, ruling after).

## Resolution

root_cause: See Technical Root Cause (a) to (h). (a) to (g) were plugin-side and are fixed; (h) was fixed by the peer quick 261106. The engine-side claims stay UNVERIFIED.
fix: |
  Plan 387-03: one resolver (override variable, saved setting, default folder), 13 typed causes, the needs map and the uv argument builders.
  Plan 387-09: /mos:eureka enable engine (check, path, forget, data, grant-gated sync, deep check).
  Plan 387-05: the engine check at the registration chokepoint, before the room projection, with 3 typed states.
  Plan 387-11: route needs (package group, model folder, Node.js) and typed start causes with the cleaned first start line.
  Plan 387-04: command text for the enable flow on every surface.
  Plan 387-07: the eureka-engine-readiness doctor point.
  Plan 387-06: --no-sync --offline --locked --no-python-downloads in the uv arguments of all 4 spawning paths, the offline variables on all 4, UV_PROJECT_ENVIRONMENT in the runtime allowlist, the Part 8 proof with a fake engine.
  Plan 387-10: the owner-run live leak test and its runbook.
  Plan 387-08: README and engine guide wording, this after-table.
verification: |
  bash tests/run-all-387.sh passes (the live leak test shows SKIPPED, exit 77, opt-in absent). The 33 non-live Eureka tests pass. The egress test (22 arms) proves the plugin side of Part 8 with a fake engine. Registry and mirror checks pass. This is plugin-side verification only.
files_changed:
  - lib/core/eureka/eureka-engine-resolver.cjs, eureka-engine-requirements.cjs, eureka-engine-enable.cjs
  - lib/mcp/eureka-tool-contract.cjs, lib/mcp/tools/eureka-capability-run.cjs, eureka-capability-jobs.cjs, eureka-graph-analyze.cjs, eureka-graph-discovery-signals.cjs
  - commands/eureka.md, skills/eureka/SKILL.md, lib/core/doctor/eureka-engine-readiness-module.cjs and data/doctor-modules.json (readiness point)
  - README.md, docs/integrations/mindrian-eureka-engine.md
  - tests/test-387-eureka-*.cjs, tests/test-341-eureka-no-brain-reach.cjs, tests/helpers/*387*, tests/fixtures/eureka-fake-engine-387/
commits: |
  387-03 18d15352b 79305241a 554660914 (summary d710ac24e)
  387-09 a6777ae61 16b4bf2f8
  387-05 c46efc0ed 2b83948cc
  387-07 9e42b00f5 892ab2de4
  387-04 5301209cc 1e49c5ac0
  387-11 3f795388c 173a5b1e9 25838bb02 (summaries 9e0a0e8d4)
  387-06 45553f2b2 e09eb5077 f31a42d57 (summary 1b919d711)
  387-10 dcd9d5617 f11cdc06d ac8fa2d58 (summary 2fef6ed08)
  387-08 e93dafbcc 19982095e, and the closing commits of this plan
leak_proof: OPEN. The plugin side of Part 8 is proven with a fake engine. The proof against the real engine is not done.

## Open items

- The plugin side of Part 8 is proven with a fake engine (Plan 387-06: the engine gets the selected snapshot only, a clean environment, the engine folder as working folder, and the offline arguments on every start).
- The proof against the real engine is NOT done: no non-local connect, writes only in its data and cache folders, a planted marker absent from `jobs.sqlite3` and `embeddings.sqlite3`, and the engine own no_network tests. It is the owner-run test `tests/test-387-eureka-live-leak.cjs` (runbook `.planning/phases/387-eureka-reachable-on-a-normal-install/387-LEAK-RUNBOOK.md`). The live arms are UNVERIFIED because the real engine was not run.
- The effect of `--no-sync --offline --locked --no-python-downloads` inside the real engine project is NOT done. The flags parse together on uv 0.9.4 in an empty folder; no run in the real project was made.
- The model and Node.js cells marked audit-hypothesis in the Plan 387-03 needs table are NOT confirmed.
- A real Claude Desktop launched from a menu and a real Cowork session were not run. Scenarios S2 and S7 simulate a Desktop-shaped launch.

## Owner leak test result

status: not run

Whoever records the owner result later replaces the line above with the pasted output, adds the plugin version and engine commit tested, sets `leak_proof: CLOSED` with the date, and only then moves this file to `.planning/debug/resolved/`.
