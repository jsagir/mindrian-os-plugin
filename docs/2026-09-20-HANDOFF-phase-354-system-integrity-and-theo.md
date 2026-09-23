# Phase 354: System Integrity and Theo Integration

Status: registered, independent research required before implementation.
Owner: Claude Code GSD in `/home/jsagi/dev/MindrianOS-Plugin` on Ubuntu WSL.
Requested by the user on 2026-09-20: make this the next phase, investigate independently first, then fix the reviewed issues under the direction in this handoff.

## Mission

Establish how well the complete plugin fulfills its intended purpose, then repair confirmed failures across the assembled system. Cover the whole plugin, not only the localhost interface. Trace intent through command/skill/agent/pipeline, routing and gates, room binding, file and graph persistence, Theo consultation, rendering, and subsequent reuse.

The prior review is an input, not an authoritative audit or an implementation plan:
`docs/reviews/2026-09-20-full-system-code-review.md` (commit `594bc5ce8`). Its title overstated coverage. It was a broad architecture and integration review, not an exhaustive review of all source. The conversation's 5/10 plugin and 6/10 integration ratings are subjective estimates, not measured acceptance criteria.

## Start with independent research

Run the installed research-only GSD mode first:

```text
/gsd-plan-phase --research-phase 354 --research
```

Read this handoff and the phase CONTEXT before research. Produce `354-RESEARCH.md` before generating implementation plans or changing production code. Reproduction scripts and isolated fixtures are permitted during research. Do not use `--skip-research`, treat old research as current proof, or start with automatic fixes.

1. Read project instructions, current roadmap/state, open handoffs, architecture includes, and relevant canon sections. Check worktree status and preserve existing edits. Record commit, installed version, runtime, and dirty files in the research baseline.
2. Inventory all production areas. For each, record purpose, inputs/outputs, data owner, callers, dependencies, persistence, failure behavior, surface coverage, and evidence. Include hooks, installation/update, commands, skills, agents, pipelines, MCP, local graph, Brain client, views/editor, export, and release/doctor tooling. Mark unexamined areas explicitly.
3. Reproduce each candidate below independently. Classify CONFIRMED, REFUTED, ALREADY FIXED, or BLOCKED with commands, output, source references, impact, and confidence. Search adjacent call sites for the same failure class. Record additional defects in the same ledger.
4. Inspect Theo's own source and instructions at `/home/jsagi/Theo` read-only. Compare consumer and provider contracts. For live checks, use generic synthetic requests only and record origin, build/version, time, request shape, and sanitized response. Never send room content or secrets to Theo.
5. Draw the actual dependency/data-flow map. Identify shared root causes and repair order. Reconcile overlap with existing phases, especially 273, 345, 350, 351, and 352. Reuse existing mechanisms rather than building competing resolvers, writers, registries, or gates.

## Candidate issue ledger and required proof

| ID | Research target | Required repair/verification outcome if confirmed |
| --- | --- | --- |
| SYS-01 | MCP section resource containment: `lib/mcp/resources.cjs`, reasoning resources, shared path helpers | Reproduce through the actual SDK URI matching/decoding path, not only a direct handler call. Test encoded traversal, sibling prefixes, symlinks and normal discovered sections. Unauthorized paths cannot disclose files; valid reads remain usable. |
| SYS-02 | Cross-process locking: `lib/core/write-lock.cjs`, `graph-ops.cjs`, every lock caller | Test independent processes, a live holder exceeding the stale threshold, contender recovery, old-owner release, crash recovery and nesting. Mutual exclusion must hold for the whole write. An ownership token alone does not fix stealing a live holder's lock. Do not claim SQLite corruption without demonstrating it; prove the locking failure precisely. |
| SYS-03 | Chat output safety: `lib/chat/chat-panel.js` and component renderers | Browser-level inert-payload tests for streamed and restored assistant text, inline/fenced markdown and tool components. Trace existing escaping/sanitization and CSP before asserting exploitability. Preserve useful formatting; no execution or access to origin-held credentials. |
| SYS-04 | Tool registration: `lib/mcp/register-core-tools.cjs` and runtime health | Inject require/register failures and compare declared versus actually registered tools. Healthy siblings work, failed modules are visible in diagnostics, and health cannot claim complete capability. Keep MCP stdout protocol-clean. |
| SYS-05 | `extract_shallow` persistence contract | Trace real callers and user expectations. Its current connector explanation already acknowledges pure parsing; the earlier report incorrectly says all connector metadata promises writes. Decide whether the public contract should be honest parsing or governed persistence. Test the chosen behavior through the MCP handler and disk/database after reopening, not response text alone. |
| SYS-06 | Localhost POC: server, editor, graph tab | Verify actual browser cross-origin write exposure, content types, Host/Origin handling and browser restrictions. Test atomic save, stale-tab conflicts, failure feedback, markdown round trips, room isolation, graph refresh and graph-answer provenance. Research document placement against actual artifact rules. Keep deterministic graph lookup visibly distinct from model conversation. |
| SYS-07 | Acceptance command timeout | Reproduce with an explicit time budget and phase diagnostics. Separate normal suite duration, environment restrictions, network waits and child-process hangs. A 20-second timeout alone proves no defect. On a real failure, show the exact phase, bounded termination and actionable status; verify no orphan processes. |
| THEO-01 | Taxonomy vocabulary and response shape | Compare `strategy/taxonomy-climb.cjs`, `rung-vocabulary.cjs`, egress guard and Theo's current `taxonomy_ladder` schema. Test all four rungs through the real client, including egress validation. Require a real Theo-sourced result and visible failure/degradation; local fallback is not proof of successful integration. |
| THEO-02 | Release registry synchronization | Inspect both the plugin's notification/stamp gates and Theo's receiving workflow. Sending an event is not proof it was consumed. Verify version, commit, digest, applied registry stamp and failure/retry/idempotency behavior. Coordinate with Phase 351; do not duplicate it or claim historical drift is still current without checking. |
| THEO-03 | Complete teaching-to-action loop | Trace generic methodology request -> guarded client -> Theo response/provenance -> local application -> governed room write -> later retrieval/render. Test healthy, unavailable, invalid-schema and thin-result cases. Verify local user bytes never enter outbound requests, and no fallback masquerades as Theo evidence. |

Also read `docs/reviews/2026-09-20-localhost-workspace-review.md` if present. Recheck its legacy dashboard context, refresh, layout and chat-integration findings rather than silently excluding them or assuming they still reproduce.

## Research gate and execution direction

Deep research completed on 2026-09-23 is recorded in `docs/reviews/2026-09-23-deep-system-research.md` with runnable characterization probes under `docs/reviews/phase-354-probes/`. It confirmed additional P1 seams that must be added to planning: gate approval confirms the decision instead of the subject claim; repeated-command resume skips a later step and loses predecessor output; lock takeover and release are not owner-safe; artifact writes follow room symlinks; Theo recommendation classifications and executable chains are not contract-safe; free-form egress can classify private prose as generic; and the POC save/render/origin paths fail under browser testing. It narrowed the earlier URI traversal claim: SDK percent-decoding did not reproduce direct traversal, while symlink escape did. Treat this research as evidence to challenge and convert into regression tests, not as permission to skip the GSD research gate.

Before implementation, publish the research ledger, coverage map, root-cause analysis, ownership/dependency map, and a disposition for every ID. An independent GSD review must challenge the reproductions and proposed fixes. Refuted findings require evidence and a correction to the original report. Research uncertainty is not permission to label a finding fixed.

Then use `/gsd-plan-phase 354 --prd docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md` with the completed research as mandatory input. Run the plan checker before `/gsd-execute-phase 354`. Organize plans around complete user-visible paths and shared root causes. Add failing behavioral regressions before fixes. Continue through GSD verification and gap closure for confirmed issues; research is the first gate, not the final deliverable.

Existing user authorization covers researching and repairing these issues. Resolve routine implementation choices from evidence. Any material product/canon decision must be stated with its impact under the existing decision process. Theo-side changes belong in Theo's own GSD workflow and must respect its repo instructions; never patch or deploy that repository incidentally from this plugin phase. Link its concrete task and verification back here if required. Do not mark the integration complete while its provider-side dependency remains open.

## Acceptance and close-out

- Every candidate and newly discovered issue has evidence-backed disposition, owner, implementation reference if applicable, and verification. Blocked cases remain open.
- One temporary room supports a real end-to-end journey: select/bind room, edit/save/reopen file, index through governed graph writes, inspect graph, ask a grounded question with references, and observe an external edit. Trace each promised propagation step and expose unsupported ones honestly.
- A separate synthetic Theo journey proves provider contribution and local application, including meaningful failure behavior. A mock-only pass cannot certify the live integration.
- Concurrent CLI/MCP/browser clients do not cross rooms, lose updates silently, or bypass required human decisions. Run representative CLI, Desktop protocol, and Cowork/shared-state checks; label unavailable host UI checks explicitly.
- Run targeted regressions plus the repository's substrate, connector, orchestration, render, and bounded acceptance gates. Record actual command, exit status, duration and environment. Existing passes do not substitute for the new behavior tests.
- Correct the prior review's overstatements. Write a tracked close-out with actual coverage, measured results, residual risks and deployment status. No release, external notification, or live-room mutation is needed merely to produce this handoff or prove fixture behavior.

## Claude Code start message

"Work in /home/jsagi/dev/MindrianOS-Plugin on WSL. Take Phase 354 next. Read docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md and its phase CONTEXT. Independently research and reproduce the findings first using /gsd-plan-phase --research-phase 354 --research. Challenge the earlier review, map the whole system and Theo contracts, then plan, repair and verify every confirmed issue through GSD. Do not skip research or call fallback output successful integration. Preserve existing work and report measured evidence."
