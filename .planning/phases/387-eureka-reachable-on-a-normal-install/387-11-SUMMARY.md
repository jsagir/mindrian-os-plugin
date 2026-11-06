---
phase: 387-eureka-reachable-on-a-normal-install
plan: "11"
subsystem: eureka-tool-contract
tags: [route-needs, typed-refusal, start-capture, part-8, tdd]
requires: ["387-03", "387-05"]
provides:
  - "routeGate, refusalFromEngineText, captureStartLine, startFailureRefusal, setProbeDeps in lib/mcp/eureka-tool-contract.cjs"
  - "reasons engine_extra_missing, engine_model_missing, engine_node_missing; cause env_not_synced; field engine_start_line"
key-files:
  modified:
    - lib/mcp/eureka-tool-contract.cjs
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - lib/mcp/tools/eureka-graph-analyze.cjs
    - lib/mcp/tools/eureka-graph-discovery-signals.cjs
    - tests/test-387-eureka-installed-layout.cjs
    - tests/test-387-eureka-engine-states.cjs
    - tests/test-eureka-373-02-error-scrub.cjs
    - tests/helpers/eureka-installed-layout-387.cjs
  created:
    - tests/test-387-eureka-route-needs.cjs
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 11: Route needs and typed start causes Summary

Each Eureka route now says what it needs before the engine starts, and a start failure is told apart by cause with the cleaned first stderr line.

## What was done (TDD)

- Decision gate: the six record lines matched option A.
- RED (3f795388c): `tests/test-387-eureka-route-needs.cjs` arms N1 to N9 (all failed); installed-layout EXPECT edited for N10 (I4 and I8 failed).
- GREEN (173a5b1e9): contract (routeGate, refusalFromEngineText, captureStartLine, startFailureRefusal, setProbeDeps) and capability-run. N1 to N9 pass.
- GREEN (25838bb02): job start, graph workflow and scout paths, discovery-signals fixed sentences, error-scrub test.

## Route families and the honest state each can answer

| Route family | needs extra | needs model | needs Node | env not prepared |
|---|---|---|---|---|
| 15 graph and HSI tools | mcp-server (installed on a minimal setup) | no | no | yes (env_not_synced) |
| eureka_graph_genesis_plan, research.run_genesis_local_plan | mcp-server | no | yes | yes |
| eureka_graph_opportunity_scout, opportunity.find_cross_domain_pairs, opportunity.synthesize_discovery_signals | mcp-server plus modern-encoder or reference-encoder | typed from the engine text only | no | yes |
| decision.compare_sequence_patterns, decision.fit_sequence_patterns | mcp-server plus hmm | no | no | yes |
| the 19 Node capability ids (RS workers, portfolio, critic) | mcp-server | unknown | yes | yes |
| other capability ids, job tools | mcp-server | unknown | unknown (never gated) | yes (job tools are not gated) |

The model is never gated by the plugin. It is typed (engine_model_missing) only when the engine replies with its own text.

## SDK stderr

PROVEN: `StdioClientTransport` offers the option `stderr: "pipe"` and exposes `transport.stderr` (a PassThrough) before the start. Source: node_modules/@modelcontextprotocol/client/dist/stdio.cjs. All 4 spawn sites set it. The capture stops when `client.connect` settles and keeps draining. The start line is used only when the connect itself failed.

## Deviations from Plan

**1. [Rule 3 - Blocking] Fixture engine folders need an environment folder.** The new env_not_synced gate refuses a folder with no `.venv`. The fixtures of tests/test-387-eureka-engine-states.cjs (arms G5, G7) and of the installed-layout probe helper (tests/helpers/eureka-installed-layout-387.cjs) now hold `.venv/pyvenv.cfg` (config file only, so the layout is unreadable and the gate does not refuse). Without it S4 to S7 would answer env_not_synced instead of the start causes they pin.

**2. [Rule 3 - Blocking] Probe helper records two more fields.** The helper now records `engine_start_line` on each call row and `cause` and `engine_start_line` on the scout direct call. N10 cannot observe them otherwise. The helper is not in the plan file list.

**3. [Rule 2 - Safety] start line only when the connect failed.** The catch blocks pass the captured line only when `client.connect` itself failed (a `connected` flag). A later failure never forwards stderr. `captureStartLine` also has a `settle()` (25 ms) so the stream can deliver the text before the read.

**4. [Rule 1 - Test text] I8 now expects the opposite of the old pin.** With stderr piped, the uv line no longer reaches the server stderr (`server_stderr_has_uv_line` is false) and arrives as `engine_start_line`.

## Known Stubs

None.

## Threat Flags

None new. engine_start_line is a new output field; T-387-11-01 mitigations (start phase only, root and home replaced, control and non-ASCII stripped, 160 characters, token-like run and Traceback dropped) are pinned by N5 and N6. The placeholder `<MINDRIAN_EUREKA_ROOT>` is excluded from the token-like check.

## Verification

- N1 to N9 pass. Installed-layout 9 of 9 (I4, I8 carry N10). Engine-states 9 of 9. Error-scrub passes.
- All 29 non-live Eureka tests (test-eureka-*, test-341-eureka-*, test-366-eureka-*, test-seed103-eureka-perspective, test-387-eureka-*) exit 0 (before: 28 of 28).
- Part 11: command-registry, connector-registry, orchestration-projection, render-coverage, registry-drift, skill-mirrors all OK before and after; no regeneration.
- The real engine was never started. No uv sync, no network, no real room.

## Self-Check: PASSED

- Commits 3f795388c, 173a5b1e9, 25838bb02 exist.
