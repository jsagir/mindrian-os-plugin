---
phase: 373
plan: "MVP"
type: execute
wave: 1
depends_on: []
status: draft-for-owner-approval
objective: "Land the minimum safe path: a bound room goes in, five Eureka graph services run on its authorized projection, and a lead-labeled result comes back with scope and snapshot lineage intact."
supersedes_scope_of: 373-01-PLAN.md (written by Codex; left untouched, compare before choosing)
source_branch: origin/feat/eureka-adapter-rebased (4a32b0937, 14 commits, 89 files, unmerged)
review_basis: "2026-10-20 three-reviewer pass (security, MCP quality, test and gates run). Verdict on the branch: RED as it stands, fixable."
---
# Phase 373 MVP plan: five graph services over an authorized projection

## Gates before any task starts
- Hold: the beta.73 cut (CONTEXT of this phase). No commit of lifted code before it.
- The plugin checkout `node_modules` must be restored (a peer's package change removed it on 2026-10-19). Do not run npm here without the owner. Verify in an isolated export until then.
- Rights: authorship and reuse rights of the five services are unresolved (Codex, 2026-10-20). Keep them local-only. No user-facing text may call them ready.

## In scope (about 6 tools, about 8 lifted files)
Tools: `eureka_graph_project` and the five services `graph.find_structural_gaps`, `graph.find_network_holes`, `graph.find_bridge_pairs`, `graph.assess_edge_atypicality`, `graph.find_semantic_gaps`.
Lifted files (read from the branch with `git show origin/feat/eureka-adapter-rebased:<path>`; check each import chain and add only what is required):
- lib/core/navigation/engine-projection.cjs and lib/core/navigation/engine-projection.test.cjs
- lib/core/navigation.cjs (the one export line)
- lib/mcp/eureka-tool-contract.cjs
- lib/mcp/tools/eureka-graph-projection.cjs
- lib/mcp/tools/eureka-graph-analyze.cjs (transport helpers only, if the services import it)
- lib/mcp/tools/eureka-graph-discovery-signals.cjs (the five services)
- tests/test-eureka-graph-projection.cjs, tests/test-eureka-graph-discovery-signals.cjs
- generated: data/connector-registry.json, data/mcp-tool-connectors.json, data/connector-coverage-ledger.json (REGENERATE, never copy)
- lib/mcp/contract-version.cjs (one bump), tests/test-198-contract-schema.test.cjs (only the lines the new tools need)
- docs/integrations/mindrian-eureka-engine.md (Known limits section; trim to the six tools)

## Out of scope (separate phase or branch)
The 13 other dedicated graph tools; eureka_capability_run/start/job_status/job_result/job_cancel; host_handoff returns; rs_experts_find, rs_thesis_read and the /mos:rs-experts rewrite; the brand commit bb5f30ad8 (git-SSH devDependency; fails test-341); docs/design/**; .icm/**; the dangling CLAUDE.md link; .agents skill.

## Task 1: Lift the minimal files, no behavior change
- Action: copy only the in-scope files. Do NOT copy package.json, npm-shrinkwrap.json, CLAUDE.md, .icm, docs/design, or any rs-* file. Remove tool registrations for out-of-scope tools if a lifted file registers them.
- Verify: `git diff --stat` lists only in-scope paths; `node tests/test-eureka-graph-projection.cjs` and `node tests/test-eureka-graph-discovery-signals.cjs` pass (with the Eureka engine path set and UV_OFFLINE=1 where they start it).

## Task 2: The four behaviors, each test-first (write the failing test, then the fix)
1. Fail-closed lineage. In every service path require `scope_id` and `snapshot_id` to be non-empty strings in the engine result and equal to the host-held values from the projection (never caller-supplied). Do not branch on status. Tests: engine returns null ids, missing `scope`, `failed` status with no ids, `blocked` with no ids, wrong ids: all refused with a typed reason.
2. Status mapping. One function maps engine statuses `invalid_input`, `failed`, `blocked` (and `cancelled`, `expired`) to `ok:false` with `isError: true` and a typed `failure_code`. Test the registered handler end to end for each status.
3. Projection hardening. Refuse a sealed room (GUARDRAIL.md present, sealed or archived disposition) and a room whose identity state is not `ready`. Keep the `partial` flag and omissions at the top level. Decide per service whether empty text makes it partial: the four structural services ignore text, so they must not report partial for empty-text nodes (semantic_gaps does). Pre-check engine limits before launch: network_holes 1,200 nodes and 6,000 edges; bridge_pairs 2,500 and 12,000; edge_atypicality `category_attribute` must be in the projected attribute keys.
4. Honest tool surface. Title and description of each service end with: "Experimental. Not validated: a 2026-10-19 backtest placed 0 of 30 held-out edges in the top 200 for every graph method and baseline. No numeric parity with upstream reference outputs. Results are leads, not findings. Starts a local process; persists nothing." Add `readiness: 'experimental'` to the response envelope. Annotations: readOnlyHint true only where nothing persists; say "starts a local process". Force `UV_OFFLINE=1`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1` in the child environment unless an explicit opt-in is set. Scrub root and HOME paths from engine error text; map to fixed messages.
- Verify: new tests fail on the lifted code and pass after; a temp-room end-to-end test covers: bound room, full path works; unbound and registry-fallback session refused (real resolver, no stub); sealed room refused; null-id result refused; `failed` gives isError; no tool writes graph state.

## Task 3: Gates and docs
- Regenerate: `node scripts/build-connector-registry.cjs` then `--check`. Regenerate the 267 wire snapshots (membership only; review the diff). Re-baseline `tests/test-270-tool-schema-budget.cjs` for the new count with the token figure stated in the commit message. Re-freeze the 276 ledger (do not add tolerance). Fix `tests/run-all-372.sh` so its 276 leg compares the full failing set, not two names. Rename or scope `brain_framework_id` only if a lifted file still trips `test-234-free-core-network-scan`.
- Docs: Known limits paragraph (0 of 30 backtest, no numeric parity, authorship unresolved, local-only), the six tools only.
- Verify: `node scripts/build-connector-registry.cjs --check`; `node tests/test-270-tool-schema-budget.cjs`; both 267 tests; `node tests/test-276-tool-honesty-findings-closed.cjs` (only room_list and room_search fail); `node tests/test-341-shrinkwrap-no-dev.cjs`; the Part 8 invariant tests; `bash tests/run-all-372.sh` (Phase 372 intact); `git diff --check` on owned files; no em-dashes.

## Done when
All Task verifies pass in an environment with working node_modules; the live tests (bridge, job cancel) are re-run once on an idle host and any failure is explained; the diff contains only in-scope paths; the owner has seen the Known limits text.

## Rules for the executor
STE report fields. `git commit --only` on explicit paths after `git add -f` for ignored paths. Never stage package.json, npm-shrinkwrap.json, ROADMAP.md, REQUIREMENTS.md or STATE.md. No push. No branch changes.
