Source: relayed from the owner's parallel session, hypotheses, verify in code; scratch export sha c30bf6ff4

# Phase 390 step 1 - keep / recalibrate / cut-candidate TABLE (no cuts)

Author: jsagi-cc (Larry). Date: 2026-11-06. STATUS: HYPOTHESES until jsagi-33 re-verifies in code at plan time.
Source tree: `git archive HEAD` of /home/jsagi/dev/MindrianOS-Plugin-release, sha `c30bf6ff4604b41b8bc3aaf1d45d741f7cfa745c`, exported to a scratch folder. Last-commit dates came from `git log -1 -- <path>` on the real repo (read only). No tests, no builds. Every command ran with `nice -n 19 taskset -c 4-7`. No room data used.

## Method (and its limits)

- Scan: every text file under the export (excluding node_modules, dist, .git; files over 1.5 MB skipped) searched for the surface name. Hits grouped by top folder (lib, scripts, hooks, commands, skills, agents, pipelines, data, docs, tests, planning, r-and-d, ui, templates). A bare-name search catches string-built paths and prose; it does NOT prove a runtime call.
- Real-require check: `require(...)` lines with the module name, outside `*.test.cjs`. Dynamic requires: only `scripts/session-start` and `scripts/release.sh` build paths (from a plugin-root variable plus a fixed `lib/core/...` suffix). No `readdirSync` of lib/core was found. So no module here is loaded by a directory walk (PROVEN for lib scripts hooks bin; UNVERIFIED for ui/ and mcp-server-brain).
- Hooks: no orphan candidate below is named in `hooks/`, `settings.json` or `scripts/` (grep found none).
- Not covered: Desktop and Cowork runtime paths, `ui/` TypeScript sources, the npm `dist/` copies (regenerated), and callers that load names from a data file at run time (see "Open risks").
- Usage counts from session logs are NOT used for any verdict here.

## Prior owner ruling to respect

Phase 385 `385-PROOF.md` section 10 (R9) and section 14: the lib/core test-only modules (coverage-monitor, cross-room-triggers, expert-genesis, nl-graph-queries, tone-filter, synthetic-expert-*-gate, ralph-loop-gate and others) were ruled "KEEP all, delete none without a per-module ruling" (planned-but-unwired contracts, Canon Part 11). This table adds evidence for the per-module ruling. It does not reverse that ruling.

## A. Orphan candidates in lib/core

Common facts: no `require` outside tests, no hook, command, skill, agent or pipeline caller (unless stated). "Test" = the module's own test file.

| Surface | Last commit | Caller proof (non-planning) | Overlap | Verdict | Note |
|---|---|---|---|---|---|
| expert-genesis | 2026-07-02 | comment in synthetic-expert-construction-gate.cjs; tests/test-203-genesis-fanout.cjs; copy under r-and-d | uses live `navigation/synthetic-expert.cjs` | keep (owner R9); cut-candidate only by per-module card | Part 11 planned contract. Cutting it orphans its own test and the r-and-d copy. |
| synthetic-expert-construction-gate, synthetic-expert-behavior-gate | 2026-07-02 | tests only (test-synthetic-expert-writer, ...nodetype-floor); evals/plurai CSVs 10 and 11 | parity gates for expert-genesis | keep with expert-genesis (decide as one group) | Same group fate as expert-genesis. |
| navigation/synthetic-expert.cjs | 2026-09-03 | LIVE: `lib/core/navigation.cjs:65`, `lib/core/expert-genesis.cjs:44`, `scripts/close-loop.cjs:44` | - | KEEP (not an orphan) | The glob "synthetic-expert-*" in the PRD must exclude this file. |
| grill-engine | 2026-09-24 | tests (205, 213, 355); comments in `part8-egress-guard.cjs` lines 1168 and 1241 | the egress guard keeps a closed list that mirrors grill-engine bias-technique strings | recalibrate-check first | Coupling: before any removal, check whether the guard's closed list must stay in step. |
| fusion-router | 2026-07-03 | prose in commands/find-analogies.md and skills/find-analogies/SKILL.md; comments in eureka/lateral-engine-adapter, eureka/portfolio-dimensions, navigation/typed-frame; docs/ARBITRATION-CONTRACT.md; tests 205, 210, 358, 213 | find-analogies, Eureka lateral adapter ("the socket already exists") | keep (documented seam) | 385 did not list it as test-only; I found no `require` outside tests. Discrepancy to settle by jsagi-33. |
| nl-graph-queries | 2026-09-24 | docs/BACKEND-MAP.md line 203; tests/test-355-direction-readers.cjs requires it | 385: "old module, likely abandoned (ASSUMED)" | cut-candidate (weak) | Last touched 2026-09-24 and test-355 still reads it, so it is not abandoned code. Owner card. |
| methodology-ingest | 2026-06-23 | commands/ingest-methodology.md and skills/ingest-methodology/SKILL.md say "engine is lib/core/methodology-ingest.cjs"; data/connector-registry.json sub_mode `methodology-ingest` (2 rows); data/brain-orchestration-projection.json; scripts/methodology-ingest-local.sh; docs | the command + skill are the surface | keep or recalibrate with the command | The command says the engine is WIRED, yet no `require` exists. Test the command path before any verdict. |
| ralph-loop-gate | 2026-07-01 | comments in card-fire-gate and synthetic-expert-construction-gate; tests/test-201; evals/plurai | eval gate, "precedent" for other gates | keep (closure of dead set) | 385: loaded only by dead-set modules. |
| tone-filter | 2026-07-01 | tests/test-205-decision-axes.cjs only | - | cut-candidate (owner card) | Single test caller, 147 lines, no doc caller. |
| voice-transition-detector | 2026-06-29 | comment in lib/core/fork-declaration.cjs line 41; tests/test-voice-transition-detection-187.cjs; CHANGELOG | fork-declaration cites it as precedent | keep for now | 385 did not list it test-only; no `require` found. Settle the discrepancy. |
| cross-room-triggers | 2026-07-01 | tests/test-195-triggers.cjs | cross-room-aggregator (named in the same test) | keep (owner R9) | Planned-but-unwired ("triggers on the presence ledger"). |
| coverage-monitor | 2026-06-23 | tests/test-coverage-rollup.cjs | - | keep (owner R9) | Planned-but-unwired monitor. |
| session-register | 2026-07-02 | prose in commands/ignite.md line 166 and skills/ignite/SKILL.md line 162 ("call resolveSessionRegister"); comment in user-md-ops.cjs; docs/CANON-PHASE-MAP.md; tests/test-204 | ignite front door | recalibrate | The ignite command tells Larry to call a function that no code `require`s. Either wire it or fix the prose. This is a real behaviour gap, not a cut. |

## B. Skills

| Surface | Last commit | Caller proof | Overlap | Verdict | Note |
|---|---|---|---|---|---|
| client-discovery-interview | 2026-09-14 | `commands/discover.md` lines 45, 163 (design source and scaffold JSON `skills/client-discovery-interview/discovery-scaffold.json`); skills/discover/SKILL.md; data registries (7); scripts/build-render-coverage.cjs; tests (run-all-1434, test-209) | /mos:discover command | recalibrate as part of the discover family; owner card on mission fit | NOT a stand-alone skill: removing it breaks /mos:discover. Off-mission is a judgement (it targets client website/brand/UX engagements), not a code finding. Cut the whole discover group or keep it; do not cut the skill alone. |
| pws-methodology | 2026-08-27 | `scripts/verify-release:307` REQUIRED_SKILLS list; `tests/test-143.2-doctrine-presence.cjs:53`; comment in lib/workflow/command-resolver.cjs; data/brain-orchestration-projection.json | intelligence-orchestrator, Theo routing | keep (release gate requires it) | A cut would first need the verify-release list and the doctrine test changed. Overlap with Theo routing is a content question for step 2. |
| intelligence-orchestrator | 2026-07-28 | commands/memory-cortex-reach.md, skills/memory-cortex-reach, lib/workflow/dial-close-reach.cjs, data/dispatch-framework-map.json, data/connector-registry.json, 7 test files | the reach dispatcher itself | KEEP | Core. Distinct from pws-methodology (dispatcher vs reference). |
| mullins-scaffold | 2026-09-14 | skill + lib/core/mullins-scaffold.cjs (callers: its own test only); data/connector-registry.json:2253; scripts/build-render-coverage.cjs (names it among 3 of 5 unwired declarations) | commands/mullins.md (a different surface); ignite front door mentions Mullins resolve | recalibrate or cut-candidate | The only runtime reach is Larry reading the skill. `render-coverage` already counts it as an unwired declaration. Owner card. |
| mos-deck-engine | 2026-09-14 | commands/deck.md lines 56, 82 ("reuses the shipped mos-deck-engine 6-stage pipeline"); commands/discover.md:178; data/deck-aliases.json; tests (publish-needs, deck-consolidation) | deck command | KEEP while /mos:deck stays | Follows the deck decision, as the PRD says. Legacy alias handle `MOSDeckEngine` is a Phase 175 deprecate-not-delete contract. |
| mva-pipeline | 2026-09-14 | commands/mva-option.md, skills/mva-option, scripts/mva-run.cjs; data registries; tests | whole MVA family | follows Phase 389 | Auto-activates from a state file written by the `mva-detect.cjs` UserPromptSubmit hook. |

## C. Agents

Agent files: 17. Last commit: chain-step-reviewer 2026-09-15; analogy-query-fetcher, competitor-watch-fetcher, vault-section-reviewer, grant-reviewer, reverse-salient-agent 2026-09-14; dominant-design-researcher 2026-09-23; research-lane-analyst and framework-runner 2026-09-30; persona-analyst 2026-11-05; opportunity-scanner and brain-query 2026-11-06.

| Agent | Caller proof (non-planning) | Verdict |
|---|---|---|
| chain-step-reviewer | `lib/core/chain-step-dispatcher.cjs:441-447` builds a dispatch only when a chain step declares `reviewer.kind: 'subagent'`; tests/test-347-reviewer-*. Grep of pipelines, data, lib, commands, skills found NO step that declares `kind: subagent`. | recalibrate (give it a real chain) or fold into framework-runner (PRD idea E). The code path is tested, so it is wired but never fed. |
| analogy-query-fetcher | commands/find-analogies.md (--external), commands/scout.md; skills/scout, skills/find-analogies; data/subagent-dispatch-grants.json | keep, reachable via parent command only |
| competitor-watch-fetcher | commands/scout.md; skills/scout | keep, parent command only |
| dominant-design-researcher | commands/dominant-designs.md; skills/dominant-designs; data/subagent-dispatch-grants.json; tests 361/363.1 | keep, parent command only |
| research-lane-analyst | commands/research.md; skills/research; tests 363 | keep, parent command only |
| vault-section-reviewer | commands/vault.md; skills/vault; `chain-step-dispatcher.cjs` header cites it | keep, parent command only |
| grant-reviewer | commands/grade-grant.md; lib/core/eureka/grade-grant-examine.cjs; lib/core/bono/reviewer-governance.cjs | KEEP (owner ruled grade-grant keep) |
| reverse-salient-agent | commands/find-bottlenecks.md; lib/core/rs-engine.cjs, rs-backend-dispatch.cjs; many tests | keep |
| persona-analyst, opportunity-scanner, brain-query, framework-runner | teams/mindrian.json; scripts/on-agent-complete; commands (models, act, pipeline, explore-opportunity, persona); lib/core/model-profiles.cjs; tests | keep (wired in several places) |
| investor, grading, larry-extended, research, meeting-perspective-extractor | not rescanned here (outside the PRD list); known launched by hand | keep |

Finding for recalibration moves A to F: 6 helper agents have exactly ONE entry (their parent command). `larry-extended` and `references/personality/agent-operations.md` list none (from my earlier read; not re-run here).

## D. Command groups (owner card per group)

Mirror rule: each command has a skill mirror under skills/ (built by scripts/build-skill-mirrors.cjs). A cut removes both, plus rows in data/ registries, the Desktop `ui/mindrian-workspace-mod/assets/command-registry.json` and `ui/mos-face/hooks/commands.ts`, and `templates/room-skeleton` section contracts. The caller counts below ARE the cost of a cut.

| Group | Last commit | Real inbound references (non-planning) | Verdict |
|---|---|---|---|
| trend / futures: macro-trends, explore-trends, explore-futures, futures, scenario-plan, trending-to-absurd | 2026-09-14 (trending-to-absurd 2026-11-05) | referenced by 13 to 14 data registries each, room-skeleton section contracts (market-analysis, opportunity-bank, business-model, problem-definition, strategy), ui command registry, mullins/find-connections/value-proposition/explore-domains commands, tests/test-176-scenario-chain, test-361-filing, lib/core/futures/orchestrator.cjs, lib/core/research-planner/sr-entry.cjs | recalibrate or merge (they chain into each other: futures calls explore-trends and explore-futures; scenario-plan feeds value-proposition). Not a cut: the room templates name them. |
| rs-experts, rs-explain, rs-fetch, rs-thesis | 2026-10-24 to 2026-11-05 (recent) | scripts/rs-*-command.cjs; commands/eureka.md names rs-experts and rs-thesis; skills/eureka; MCP tools `rs_experts_find` and `rs_thesis_read`; r-and-d copies; tests run-all-252 | recalibrate (fold into /mos:eureka as sub-modes); recent commits mean active work. Owner card. |
| dashboard / deck / wiki / radar / visualize / present / publish / snapshot | dashboard, deck, radar 2026-10-04; publish, snapshot 2026-11-05; wiki, visualize, present 2026-09-14 | visualize and present are soft-aliased (lib/memory/soft-alias.test.cjs, scripts/soft-alias-runner.cjs); dashboard has loopback-server tests (test-261030-et9); radar is read by lib/core/doctor/capability-ledger-module.cjs and tests/test-265-*; wiki appears in lib/mcp/tool-router.cjs and MCP app views; publish feeds sensor-show-share and lib/core/mva-rule-linter | split: visualize and present are already soft aliases (cut-candidate after alias window); radar KEEP (doctor module reads its ledger); dashboard, wiki keep until Desktop check (MCP views); publish and snapshot active; deck follows mos-deck-engine. |
| lean-canvas, value-proposition, user-needs | 2026-09-14 | 8 test files for lean-canvas, lib/core/rs-chain-feeder and rs-query-to-text name lean-canvas, jtbd-taxonomy, ui command registry, validate/analyze-needs/export/discover skills chain into them | recalibrate (user-needs and analyze-needs overlap by name; check) rather than cut. |

## E. Open risks and gaps

- Data-driven callers: `data/connector-registry.json`, `data/*-ledger.json` and `data/brain-orchestration-projection.json` name most surfaces. They are build outputs (born-wired registries, Part 11). A removal must regenerate them through their generators, or tests (test-209-declared-implies-wired, 341 registry drift baseline) fail. I did not run them.
- 385 vs this scan disagree on fusion-router, grill-engine, methodology-ingest, session-register and voice-transition-detector (385 did not list them as test-only, I found no non-test `require`). The 385 scan matches a token ending in a code extension, so a `path.join` style require in some place may exist. jsagi-33 should run `385-no-caller-scan.cjs` at current HEAD and compare.
- `ui/` (TypeScript) and `mcp-server-brain/` were searched only by name; their runtime loading was not traced.
- Desktop, Cowork and tester use are unobserved. A zero in session logs is not used anywhere here.

## F. Suggested order for step 2 (owner cards)

1. Orphans: one card for the "planned-but-unwired" group (expert-genesis + the two gates + ralph-loop-gate + cross-room-triggers + coverage-monitor): keep with a dated wire-or-cut deadline. One card for tone-filter and nl-graph-queries (weak cut-candidates). Fix session-register as a behaviour gap.
2. Skills: decide /mos:discover as a group (client-discovery-interview moves with it). mullins-scaffold card.
3. Agents: wire chain-step-reviewer or fold it; the 6 helper agents get moves A to C.
4. Command groups: trend/futures merge plan; rs-* fold into eureka; visualize/present alias end date.

## G. Caller-scan comparison at HEAD 4b74ae939 (added by the verifying session, 2026-11-06)

Command: `nice -n 19 taskset -c 4-7 node .planning/phases/385-*/385-no-caller-scan.cjs` (read-only, prints to stdout, no arguments; output went to a scratch folder). Exit code 0. PROVEN.

Scan result for lib/core: 565 modules scanned, 0 no-reference, 18 test-only, 2 closure extras (artifact-brain-packet, ralph-loop-gate), 20 dead-set total.
Test-only: behavioral/observation-schema, card-fire-gate, coverage-monitor, cross-room-triggers, expert-genesis, futures/subsystem-render, graph-refine-loop, ignite-branch-gate, metrics/larryreach-loop-health, navigation/memory-cortex-packet, nl-graph-queries, reader/ab-harness, recovery/controller, salient-governance, synthetic-expert-behavior-gate, synthetic-expert-construction-gate, temporal/supersession-gate, tone-filter.

Comparison with the parallel session's list:

| Module | In 385 scan dead set at HEAD? | Non-test `require` at HEAD (git grep, excluding tests, docs, .planning) | Reading |
|---|---|---|---|
| fusion-router | no | none | Parallel claim CONFIRMED for `require`. The scan counts it as referenced because other code names the path in comments (lateral-engine-adapter, portfolio-dimensions, typed-frame). |
| grill-engine | no | none | Same. Referenced by path in comments in part8-egress-guard.cjs (lines 1168, 1241). |
| methodology-ingest | no | none | Same. Referenced by path from commands, skills, scripts/methodology-ingest-local.sh. |
| session-register | no | none | Same. Referenced by path in commands/ignite.md (lines 80, 166), skills/ignite/SKILL.md, user-md-ops.cjs comment. |
| voice-transition-detector | no | none | Same. Referenced by path in a comment in fork-declaration.cjs line 41. |

Conclusion: the discrepancy is explained. The 385 scan counts any path-like token ending in a code extension, so a comment or prose mention counts as a reference. The five modules have no code `require` outside tests. They are "comment-or-prose-referenced only", which the 385 method does not call test-only. PROVEN by the two commands above. UNVERIFIED: dynamic loads through string-built paths (the scan would catch a full path token, a `path.join` of parts it would not).

Also in the 385 dead set but absent from the parallel list: card-fire-gate, graph-refine-loop, ignite-branch-gate, salient-governance, recovery/controller, temporal/supersession-gate, behavioral/observation-schema, futures/subsystem-render, metrics/larryreach-loop-health, navigation/memory-cortex-packet, reader/ab-harness, artifact-brain-packet. The step 2 cards must cover them or state why not. The scripts scope lists 8 no-reference scripts and 38 test-only scripts (see scan output; not analysed here).
Reverse check: the parallel list names tone-filter, nl-graph-queries, expert-genesis, coverage-monitor, cross-room-triggers and the two synthetic-expert gates, and the scan confirms all of them as test-only. ralph-loop-gate is confirmed as a closure extra. PROVEN.
