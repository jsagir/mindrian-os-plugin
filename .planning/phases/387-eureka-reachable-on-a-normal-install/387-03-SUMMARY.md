---
phase: 387-eureka-reachable-on-a-normal-install
plan: "03"
subsystem: eureka-engine-core
tags: [resolver, requirements, uv-args, part-8, tdd]
requires: ["387-02"]
provides:
  - lib/core/eureka/eureka-engine-resolver.cjs (one rule for where the engine is; 3 states; 13 typed causes; saved setting file)
  - lib/core/eureka/eureka-engine-requirements.cjs (needs map, uv argument builders, probes, text classifier)
affects: [387-04, 387-05, 387-06, 387-07, 387-09, 387-10, 387-11]
key-files:
  created:
    - lib/core/eureka/eureka-engine-resolver.cjs
    - lib/core/eureka/eureka-engine-requirements.cjs
    - tests/test-387-eureka-engine-resolver.cjs
    - tests/test-387-eureka-engine-requirements.cjs
key-decisions:
  - "The engine is the NEW mindrian-eureka only. The resolver searches three places (env, saved setting, default folder) and never any other folder; a folder without the engine pyproject.toml is engine_checkout_unavailable. checkEngine also refuses a pyproject that names another project or has no eureka-mcp script (project_name_mismatch)."
  - "Safety flags live in the uv arguments (--no-sync --offline --locked --no-python-downloads), not in the environment."
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 03: Resolver and requirements core Summary

One resolver and one requirements module now own the engine location rule, the typed causes, the per-tool needs and the uv argument arrays. Nothing calls them yet; plans 387-05, 387-06, 387-07, 387-09 and 387-11 do.

## What was done (TDD, RED then GREEN)

- Decision gate: the six record lines in 387-DECISION-RECORD.md matched option A.
- RED (18d15352b): both test files; 12 and 13 arms printed FAIL with the modules absent.
- GREEN resolver (79305241a): R1 to R12 pass; the old deps resolver test still passes (6 of 6).
- GREEN requirements (554660914): Q1 to Q13 pass.
- Smoke: `uvRunArgs("/x", ["mcp-server"], {})` gives `run --no-sync --offline --locked --no-python-downloads --project /x --extra mcp-server eureka-mcp`.
- `bash tests/run-all-387.sh`: PASS=4 FAIL=0 SKIPPED=0.

## Needs table: which cells were settled from the engine files

Read-only reads of /home/jsagi/dev/mindrian-eureka (names only, no source copied). The engine is the new mindrian-eureka; no other Eureka folder was read.

Settled, label engine-read:
- 15 graph and HSI tools (analyze, propose, 5 discovery signals, backtest, compare topics, map, package relationships, prepare artifacts, rank paths, score surprise, HSI interpret): model no, node no. The handler modules (`graph_relations/*`, `discovery_workflows.py`, `hsi_interpret_whitespace.py`) hold no encoder, model or Node reference.
- eureka_graph_genesis_plan: node yes (`run_genesis_local_plan` checks Node), model no.
- eureka_graph_opportunity_scout and the ids opportunity.find_cross_domain_pairs and opportunity.synthesize_discovery_signals: model yes (`opportunity_discovery.py` passes a model path with downloads off; `opportunity_pairs/encoders.py` uses local_files_only), node no.
- decision.compare_sequence_patterns and decision.fit_sequence_patterns: model no, node no (`decision_patterns/*` hold no such reference).
- graph.* capability ids: model no, node no.
- 19 capability ids whose handler checks Node (the RS workers, the Genesis plan, the IP-finance detector, the weak-signal tail, portfolio dimensions, opportunity statement, graph-event harvest, and the 4 critic ids): node yes.

Stay audit-hypothesis (unknown): the model cell of the 18 Node-checking ids other than Genesis, and both cells of every other capability id, the 3 job tools and any unknown tool.

The two audits disagreed about which workers need Node. The handlers decide: the Node check sits in the RS workers, Genesis, IP-finance, weak-signal tail, portfolio dimensions, opportunity statement, graph-event harvest and the critic worker. Both audits were partly right. The graph tools and the scout need no Node, which the first audit had marked NOT CHECKED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Owner reminder] Retired folder guard**
- **Found during:** a message from the main session (owner reminder, 2026-11-06).
- **Issue:** the engine must be only the new mindrian-eureka; the retired plugin-style Eureka folder must never be discovered or adopted.
- **Fix:** a note line `engine_identity` in 387-DECISION-RECORD.md (commit: docs(387-02) note); arm R11 (a plugin-style folder and a default folder without pyproject.toml are refused as engine_checkout_unavailable); arm Q8 (a pyproject with another project name, or with no eureka-mcp script, gives project_name_mismatch); static checks in R12 and Q12 that the modules name no retired folder. checkEngine's project check also requires the eureka-mcp script entry.
- **Files modified:** tests and modules above, the decision record.

**2. [Rule 1 - Bug in own test] Q12 regex**
- The first Q12 regex flagged `RegExp.exec`; it now matches only a bare exec call (commit 554660914).

**3. [Peer change in the shared tree] eureka_critic pin**
- A peer quick (261106, uncommitted `package.json` change plus `tests/test-quick-261106-critic-baseline-ships.cjs`) ships the critic baseline, so `eureka_critic` answered a ruling during this run and arm I3 of the 387-01 pin failed. The pin now accepts both states (the ENOENT error or a ruling) so it holds in either order (commit 1a2179deb). Narrow it after the peer commit lands. The peer files were not touched.

### Counts differ from the plan text
- The resolver test has 12 arms (plan: 10) and the requirements test has 13 (plan: 12), because of the owner reminder and a module-reuse arm.

## Known Stubs

None.

## Threat Flags

None. The modules open no network and no Brain connection; the only spawns are the probes in checkEngine and nodeStatus (uv --version, uv python find --no-project, node --version) with shell false. The real engine was never started and no uv sync or uv run was run.

## Self-Check: PASSED

- Files exist: both modules and both tests.
- Commits exist: 18d15352b (RED), 79305241a, 554660914, 1a2179deb.
- `node tests/test-387-eureka-engine-resolver.cjs` 12 passed; `node tests/test-387-eureka-engine-requirements.cjs` 13 passed; `node tests/test-341-eureka-deps-resolver.cjs` PASS=6.
