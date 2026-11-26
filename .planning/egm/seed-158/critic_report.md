# EGM Stage 7: Critic Review - SEED-158

Target: `.planning/seeds/SEED-158-icm-routes-the-hooks.md`, FeatureRange lines 1-38. Date: 2026-11-26. Round 1 (direct dispatch, fresh contexts).
Reviewers: egm-design (feature-spec-standard), egm-structural (feature-spec-standard), egm-style (persona rules). All three completed; none "not run".
Verdicts: design FAIL (3 Blocker, 8 Major, 4 Nit); structural FAIL (2 Blocker, 4 Major, 5 Nit); style REVISE (0 Blocker, 5 Major, 6 Nit).
Note from two reviewers: the target is a dormant seed held to a full feature-spec standard; most structural gaps are expected now and must close before Phase 402 planning. The security finding must be recorded now.

## Consolidated findings (deduplicated; ids: reviewer-round-n)

### Blockers
| Id | Source ids | Lines | Finding | Fix |
|---|---|---|---|---|
| K1 | design-1-B1, structural-1-2 | 17, 29, 32, 38 | Security checks can be routed away: a user-editable (and in Cowork shared, model-writable) room file deciding which checks run can drop admin-command-gate (a block gate); if extended per l.38 to PreToolUse, also part8-egress-guard-hook and web-credential-guard-hook (onFailure block). Not stated whether a declaration adds to or replaces the default set. | Non-routable always-on set (admin gate at minimum; egress and credential guards if other events are ever added); declarations may only ADD advisory checks. (Same as Stage 5 Z3, I2.) |
| K2 | design-1-B2, structural-1-1 | whole file | No Alternatives Considered section. Only mcp_tool vs dispatcher (transport) is weighed; per-nest routing itself is never compared with: (a) plan 13 dispatcher with a static list and per-check in-code predicates; (b) one plugin-level routing table keyed by job or section type; (c) gating only on the session-bound room (QA-F12 decision 1); (d) per-process checks with only the busyMs fix (QA-F11 part A). | Add the section with concrete trade-offs: latency, testability, user-file attack surface, cross-room drift. |
| K3 | design-1-B3, style-1-M3 | 19-25 | Evidence does not support the cause: QA defects F5, F6, F7, F10 are not ICM bypasses; admin gate and install router never touch room.db (25-140 ms, host starvation); the three real ICM-state defects are already QA-F12 decisions 1-4 and the process count is plan 13. "Every defect" is an unsupported universal. | Name a problem the 400.4 fixes leave open, cite the QA report path and "N of M"; else the seed has no motivation. (Same as Stage 5 Z1; Stage 6 C4.) |
| K4 | structural-1-2 | 27-33 | No Risks and Mitigations section: missing failure modes for a malformed or missing routing file, an unknown check id at run time, MCP server down, and the deadline/skip behavior (skipped_deadline, 2,500 ms). | Add the section. |

### Majors
| Id | Source ids | Lines | Finding | Fix |
|---|---|---|---|---|
| K5 | design-1-M1, structural-1-5, style-1-M1 | 15 | "53 hook entries" is wrong for this worktree: 41 command entries (6 on UserPromptSubmit). (53 was the all-plugins reload count.) | Drop the total or cite method, file and date; keep the per-prompt 6. |
| K6 | structural-1-6 | 15, 17, 32 | Baseline is stale: after 400.4 the six entries are one dispatcher (plan 13; now being revised to mcp_tool per the spike). Routing would change that dispatcher's check list. | Re-baseline on post-400.4. |
| K7 | structural-1-3, design-1-M7 | 14-27 | No Goals and Non-Goals, no success metrics. | Add measurable targets (UserPromptSubmit timeout rate under the RCA load profile, p95 latency) and non-goals (no Stop/PostToolUse/SessionStart in v1, no new invocable surface, no suggest_next change, no advisor flag change). |
| K8 | structural-1-4, design-1-M3 | 17 | Architecture too thin: no declaration schema or example, no active-nest resolution (raw active nest or the F2-picked nest; no-room case for first-install-router), no output-merge contract, order or deadline policy. | Specify. |
| K9 | design-1-M2 | 17, 28 | Hot path not costed; resolving the nest may open room.db and inherit the lock failure. | p95 budget, data source (no room.db, or the busyMs opener with fallback), timeout behavior. |
| K10 | design-1-M4 | 17, 36 | mcp_tool single point of failure. | Spike now answers part: timeout or tool error is silent to the model (400.4-SPIKE-mcp-tool-hook.md). Define fail-closed or fail-open per check class; keep block checks as command hooks. |
| K11 | design-1-M5 | 17 | Conflicts with the plan 13 parity contract (output identical to six hooks); per-nest routing makes output vary by room. The "a new check is not a new process" benefit already holds under plan 13. | State the new output contract and a parity test across declarations. |
| K12 | design-1-M6 | 30 | Build-time id test cannot see user rooms; run-time unknown or misspelled ids unhandled; no schema version. | Ignore with a stderr note, keep the always-on set, version the declaration. (Stage 5 I5.) |
| K13 | design-1-M8 | 27-33 | Risks missing: room-varying behavior is hard to debug; concurrent edits to a shared declaration in Cowork; declaration vs default drift after a plugin update; test-matrix growth. | Add to K4's section. |
| K14 | style-1-M2 | 15 vs 19-24 | Contradiction: "everything else routes through the ICM; hooks are the outlier" vs the cue file and NAV block, two non-hook bypasses. | Narrow l.15 to "several components". |
| K15 | style-1-M4, structural-1-10 | 24 | "Killed at 3 s" is imprecise: intent-classifier has 5 s; "under load" uncited. | "3-5 s" and cite the RCA. |
| K16 | style-1-M5 | 25, 32 | Overclaims: "single source of what runs, where and why" while a default set remains; "nothing regresses" untested. | "a nest with no declaration runs the same checks as today". |

### Nits
| Id | Source ids | Lines | Finding |
|---|---|---|---|
| K17 | design-1-N1, structural-1-3 (part), style-1-N6 | 33, 38 | suggest_next driver is scope creep; l.38 is a fragment, rewrite as a question. |
| K18 | design-1-N2 | 37 | BRIEF.md is generated (overwritten); ROOM.md is identity (Decision 15). (Stage 5 Z6.) |
| K19 | design-1-N3, style-1-N5, structural-1-11 | 31 | "Part 8: local reads only" too short: say no room content to the Brain, no mindrian-brain or Theo calls, and whether a routing read may touch room.db. |
| K20 | design-1-N4 | 8 | canon_parts: say whether a declaration is a Part 3 material choice needing a gate. |
| K21 | structural-1-7 | 14, 19 | Heading names do not map to the standard's sections. |
| K22 | structural-1-8, style-1-N3 | 7 | Trigger points to a session scratchpad; the spike result is now filed at `.planning/phases/400.4-.../400.4-SPIKE-mcp-tool-hook.md`. |
| K23 | structural-1-9 | 9, 29, 37 | Unlinked references (QA ids, Key Decision 2, icm-architect walk test). |
| K24 | style-1-N1, N2, N4 | 17, 28, 30 | "ONE", "ideally", "small", "plumbing": emphasis, hedge, uncheckable size, informal. |

## Cross-stage pattern
Stages 5, 6 and 7 converge independently on the same three points: (1) the evidence supports the room-key and job-scope fixes already in 400.4, not per-nest routing; (2) block and guard checks must never be routable; (3) the surviving slice is transport (one mcp_tool hook into the running server for the routable checks), which the spike now supports with a JSON-only contract.
