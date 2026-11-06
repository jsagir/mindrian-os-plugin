---
status: investigating
kind: rca
trigger: "eureka-engine-unreachable-on-normal-install"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [7, 8, 9]
created: 2026-11-06T08:25:26Z
updated: 2026-11-06T08:25:26Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 578193b225492a0beb1f49427feb3e17dae916dd (HEAD at the start of plan 387-01), plugin version 2.0.0-beta.80 (from `node lib/core/repo-version.cjs`).
- **WIRE claims probe against:** local stdio server `bin/mindrian-mcp-server.cjs` taken from an `npm pack` layout laid out as the Claude Code plugin cache, `@ 2.0.0-beta.80`. No deployed server is probed. The Brain URL is a dead loopback address.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each source-code claim below was read at the sha above. A claim is PROVEN when the executor read the line, and UNVERIFIED when it was not read or not run.

## Current Focus

hypothesis: On a normal install the Eureka engine tools refuse because nothing in the shipped files sets MINDRIAN_EUREKA_ROOT; the 2 tools that need no engine answer.
test: Read the code (this section), then run the real stdio server from an installed-layout copy with no engine present (Runtime Observations).
expecting: The runtime tools/list holds 24 names that start with eureka; 22 engine tools refuse with engine_not_configured or job_session_not_found; eureka_graph_project and eureka_critic answer.
next_action: Build the installed-layout probe (plan 387-01 task 2), run it, fill the two runtime sections.

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
actual: PENDING-RUNTIME (the runtime section below holds the measured result).
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

PENDING-RUNTIME

## Tool Count (runtime tools/list)

PENDING-RUNTIME

## Required Code Changes
<!-- Filled by task 3 -->

PENDING-RUNTIME

## Tests to Add or Update

PENDING-RUNTIME

## Resolution

root_cause: PENDING
fix: none yet
verification: none yet
files_changed: []
commits: none yet
