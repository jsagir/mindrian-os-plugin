---
title: "MindrianOS orchestration today, and methodology commands as thin Theo recipes"
date: 2026-11-24
kind: design-evidence
repo: ~/dev/MindrianOS-Plugin-399 (branch work/400-job-sentences-cynefin-layer, read only)
theo_source: ~/Theo (read only)
builds_on: Phase 399 (decision advisor), Phase 400 (job sentences, cause_effect layer, relay; planning)
status: research only; no repo edit, no commit. Written by the orchestration research subagent; saved here by the main session (the subagent's write outside the worktree was refused by the worktree path guard).
---

# Methodology commands as thin Theo recipes

Question: can a methodology command become a thin recipe? The recipe asks Theo for the framework's steps, sends each step to a small set of shared agents that take a mode, then files the result. PROVEN = seen in a file or in a live probe. UNVERIFIED = not run. ASSUMED = inference.

## 1. How a methodology command runs today

### 1.1 The parts

| Part | Where | What it does |
|---|---|---|
| Command text | commands/<name>.md, mirrored in skills/<name>/SKILL.md | Frontmatter (registry data) plus prose: read the reference, ask quick or deep, run the phases, file. |
| Reference file | references/methodology/<name>.md | Local phases, voice lines, artifact template. |
| Registry | data/command-registry.json (scripts/build-command-registry.cjs) | 113 commands; 51 kind methodology; 48 autonomous_safe; 38 framework names in framework_index; 23 curated_chains. PROVEN. |
| Resolver | lib/workflow/command-resolver.cjs:281 composeWorkflow | Maps a framework name to a /mos: command. Reads the registry only and "NEVER touches the Brain" (:9). The 399 advisor ranks the commands inside one framework (:196-240). |
| Autonomy check | command-resolver.cjs:331 validateChainAutonomy | Names every step that is not autonomous_safe. |
| Chain loop | lib/core/chain-executor.cjs:1028 runChain | The one gated loop. Halts on a material step (:617), forces a halt on an irreversible step (:593), halts on low quality (:891). Fan-out seam (:380 _dispatchFanOut, :437 _applyFanIn) and reviewer seam (:653-737). |
| Posture | lib/core/recipe-maps.cjs postureForCommand | The one posture authority. Default is halt (chain-executor.cjs:565-570). |
| /mos:act | commands/act.md (530 lines), scripts/act-command.cjs (522 lines) | Chain from recommendChain (lib/brain/chain-recommender.cjs:616), composed with composeWorkflow, walked with runChain (act.md:290, act-command.cjs:66-74). Each step goes to agents/framework-runner.md (act.md:258, :291). Swarm mode sends N runners in parallel (act.md:379, :447). |
| Framework runner | agents/framework-runner.md (259 lines) | Tools Read, Write, Bash, Glob (:7-11). No Brain access (:27, :254). Reads references/methodology/{framework}.md (:66); errors when missing (:70). |
| Gate cards | lib/mcp/tools/gate.cjs (1908 lines), lib/mcp/gate-render.cjs | Mint, render, ratify. A chain halt is a material_step card (gate.cjs:399). gate_answer resumes the step in the same call. |
| Curated chains | registry curated_chains (23 rows) | Hand-maintained, kept through every rebuild (scripts/build-command-registry.cjs:266-279). Read by lib/workflow/local-chain-recommender.cjs and chain-source.cjs. |

### 1.2 The 23 curated chains (PROVEN)

17 feeds_into, 1 chain, 2 prerequisite between framework names, 3 feeds_into rows that start at a command (find-bottlenecks -> pipeline, scientific-roadmap -> research, scientific-roadmap -> find-analogies). One row, pipeline -> Scenario Planning, goes from a command to a framework. Hubs: Adoption-Capacity Theory (4 in, 3 out), Scenario Planning (6 in, 1 out), Domain Selection (4 out). Confidence 0.50 to 0.82. These rows say which framework comes next, not the steps inside a command.

### 1.3 Where a command gets its steps today

| Source of steps | Of the 51 methodology commands | Evidence |
|---|---|---|
| Command prose that reads references/methodology | 30 | grep, computed |
| A same-name reference file exists | 26 | computed; 25 commands have none, so framework-runner.md:70 errors unless a variant name matches (UNVERIFIED) |
| Theo framework_step with a disclosed fallback to the reference | 1 (/mos:dominant-designs) | commands/dominant-designs.md:136-151; lib/core/dominant-design/theo-structure.cjs:20-25, :288-310 |
| Theo framework_step with refusal, no fallback | library only | lib/core/research-planner/sr-steps.cjs:40, :87 |

Text volume of the 51: commands 8772 lines, skills 8526, references 4398.

Conclusion 1 (PROVEN): Theo supplies WHICH framework (recommend_chain, used by /mos:act). Local prose supplies HOW to run it.

## 2. Theo step tools and coverage

### 2.1 Tools

- framework_step (~/Theo/src/mcp/content/framework-step.ts): one exact framework name in; steps in document order out, each with stepId, label, stepKind, runIt, prompts, expectedOutput, artifactRubric, transitionCriteria, recoveryGuidance, researchDirective, flowKind, source refs. An empty list is a normal answer.
- framework_run_plan (framework-run-plan.ts): stored controls only (sequences, any-order and parallel groups with a consolidate step, optional steps, choices, repeat-returns). The client decides how to run them (:31-38).
- framework_techniques, case_story, step_sources, recommend_chain in the same folder.
- theo-context (~/dev/theo-context) has framework_steps, framework_walkthrough, play_method; the plugin does not use them.

Plugin wiring (PROVEN): brain-client.cjs wraps recommend_chain, feeds_into_chains, normalize_framework_name, orchestration_readiness, discover_structure and brain_*. framework_step is reachable only through generic callTool (:429). The egress guard has a typed arm for it (part8-egress-guard.cjs:633-639, :879). framework_run_plan is classed content (data/theo-tool-classes.json:36). The mindrian-brain shim (scripts/mindrian-brain-mcp-client.cjs) registers only the six brain_* tools, so Desktop and Cowork have no route to Theo steps.

### 2.2 Five frameworks probed live (framework names only)

| Command | Framework | Steps | Flow | Status |
|---|---|---|---|---|
| challenge-assumptions | Red Teaming | 5 | one any-order group, no consolidate step | draft |
| find-bottlenecks | Reverse Salient Analysis | 5 | ordered, repeat-return to step 2 | draft |
| lean-canvas | Lean Canvas | 7 | ordered | draft |
| root-cause | Root Cause Analysis | 6 | ordered, a choice (why chain or fishbone), repeat-return | draft |
| beautiful-question | Beautiful Question Framework | 3 | ordered, repeat-return to Why | draft |

Every step has runIt, expectedOutput, artifactRubric, transitionCriteria. Each basis field says the text is AI-authored in Larry's voice, not a verbatim quotation.

### 2.3 Coverage of all 38 registry framework names (through guarded callTool)

- 30 of 38 have runnable steps; 8 have none: Pre-mortem Analysis, CIAs approach to challenging analytical assumptions, Black Hat Thinking, Era of Ferment Analysis, TRIZ / Genrich Altshuller Innovation Algorithm, Extensive Searching, Macro Trends/Macro Trending, 5 Whys Technique.
- 1 active (Six Thinking Hats), 37 draft.
- 50 of 51 methodology commands name a framework with steps; /mos:grade-grant names none.
- Partial coverage is common: challenge-assumptions names 4 frameworks, only Red Teaming has steps; its local Pre-mortem phase has no Theo analog.

## 3. Agent reuse

Inventory (PROVEN): read-only one-lens JSON workers (meeting-perspective-extractor 97 lines, research-lane-analyst 121, chain-step-reviewer 152, vault-section-reviewer 110, grant-reviewer 194); Brain-tool reviewers (investor 144, grading 213); persona-analyst 204 (Write, web, Brain); three fetchers (analogy-query-fetcher, competitor-watch-fetcher, dominant-design-researcher); framework-runner 259. No agent sets omitClaudeMd; only comments mention it.

Proposed merge (ASSUMED):
- lens-worker: modes perspective, lane, step-review, section-review, rubric-category, framework-step. Read only, omitClaudeMd true. Replaces the 5 read-only workers.
- evaluator: modes investor, grade, grant-consolidate, black-hat. Brain reads move to the caller (as framework-runner.md:27 already rules).
- fetcher: modes analogy, competitor, dominant-design-lane; keeps the "never compose, never rephrase" contract.
- framework-runner stays the only writer. persona-analyst stays separate (lens-engine.cjs:120-121 owns the hat sets).
- framework-step mode: one Theo step plus a caller-chosen room excerpt in; JSON shaped by expectedOutput plus a self-check against artifactRubric out.
- Risk: Part 11 born-wired and HITL gates must still pass; host support for omitClaudeMd on plugin agents is UNVERIFIED.

## 4. Behaviour tests

Existing (PROVEN): evals/larry-voice (probes, rubric R1-R15 and OP1-OP5, cells); lib/hmi/larry-reply-checks.cjs (findMachineryNarration, findToolOutputShape, findClosingShape, findUnsourcedNumber, findDashes, detectFrameworkDump, :733-739); tests/test-3696-rubric-eval.cjs, test-203-behavior-gate.cjs, test-3696-persona-drift.cjs; evals/plurai/03-command-routing.csv; tests/test-176-scenario-chain.cjs, test-254-one-chain-source.cjs, test-399-workflow-advisor.cjs, test-361-theo-parity.cjs.

Gap: no per-command scenario file and no test that a command ran its framework's steps.

Proposed evals/recipes/<command>.json: command, framework handle, job sentence id; a recorded framework_step and run_plan fixture with sha256 (Theo drift fails loud); an invented room; a probe prompt and expected flow; per-step checks from expectedOutput, artifactRubric, transitionCriteria; negative legs (Theo unreachable, zero steps, draft, egress blocked, shape refused) that must give the typed refusal or the disclosed fallback, never silent local text; code checks (no narration, no dashes, wire args = {framework} only, no second resolver); optional Jev judge leg.

## 5. Worked example: /mos:challenge-assumptions

Before (PROVEN): commands/challenge-assumptions.md 79 lines (40 frontmatter, 13 firing block, 26 body); skills mirror 75; references/methodology/challenge-assumptions.md 126. Total 280. The body reads the reference (:64) and runs the black-hat lens through lens-engine.cjs (:60, :72).

After (plan, not code): keep frontmatter, add recipe: theo-steps, move the firing block to a shared include. Body about 8 lines:
1. Render the job sentence slots.
2. `node scripts/framework-recipe.cjs steps "Red Teaming"` (new script reusing the theo-structure classifier, the _pickStep whitelist and a one-key wire object).
3. Read the run plan: one any-order group of 5 steps.
4. Fan out 5 lens-worker calls in framework-step mode through _dispatchFanOut (chain-executor.cjs:380); fan in with _applyFanIn (:437).
5. Synthesize with the existing tension-map synthesizer.
6. File through the declared fileEvidenceWithReadback filing.

Reference file: keep only as the disclosed fallback, or delete if the owner rules strict refusal. Estimate (ASSUMED): command about 48 lines; across the 51 commands the references hold 4398 lines.

Lost: the local Pre-mortem phase (Pre-mortem Analysis has 0 Theo steps). The recipe must name the gap and must not present local text as Theo method.

### One recipe, no second resolver

| Question | Authority (unchanged) | Data |
|---|---|---|
| Which command next | composeWorkflow (command-resolver.cjs:281), composeNextMove (lib/core/feyminto/next-move.cjs:219) | Registry; 399 table via shortlist.cjs; Phase 400 domain key and in-band move_type reorder |
| Halt or run | recipe-maps postureForCommand, runChain gates | autonomous_safe, irreversibility ledger |
| Which steps | Theo framework_step and run_plan (a read, not a resolver) | connector.framework handle |
| How to run them | Theo flowKind | any-order: fan-out; ordered: sequential; choice: gate card; repeat-return: gate card, never an auto-loop |
| Which worker mode | Phase 400 move_type | categorize: sort mode; analyze and slice: framework-step; probe: evaluator; act: 0 commands |
| When done | job slots | when: entry frame; want: goal line; so: whole-recipe exit check beside each step's transitionCriteria |

The recipe runs only after the one selector chose the command, so single-authority tests stay valid. F-08 rules out chaining by slots: the so slot is an exit check, never a next-step selector.

Removed from today's command text (ASSUMED): the read-the-reference setup, phase prose, the quick-or-deep branch (UNVERIFIED that Theo marks required steps), cross-reference lists, most of the artifact template.

### Failure when Theo has no steps

Rules: decisions.md rows 1, 5, 8 ("never an imitation", "never a silent local substitute", "serves no methodology the graph did not give"). Precedents: sr-steps.cjs:40 refuses; theo-structure.cjs:20-25 degrades to the reference and names the reason.

Ladder:
1. Theo has steps: run them; state source and status (draft or active).
2. Primary framework empty, another named framework has steps: run that one and name the empty one.
3. Theo unreachable, egress blocked, shape refused, or all empty: refuse in the turn with the typed reason and queue enrichment. Offer a run labelled "plugin reference, not Theo" only if the owner keeps D-09.

OPEN (owner): does the D-09 disclosed fallback stay for recipes, or do recipes refuse strictly?

## 6. Risks

1. Availability: one Theo origin (brain-client.cjs:41, :2795); retry and rate-limit waits exist (:63-170); 38 of 38 probe calls answered.
2. Offline: no Theo, no steps; section 5 decides.
3. Desktop and Cowork: the shim has no step tool and no shell. Add a framework_steps tool to the existing shim with the typed guard arm; no new server (Part 7).
4. Draft status: 37 of 38 draft, AI-authored step text. "PwS sources supreme" applies. Show status; owner ruling on whether draft steps run by default.
5. Tokens: step payloads duplicate controlJson and sourceRefsJson per step; whitelist fields.
6. IP: do not file runIt text verbatim into rooms; do not cache step bodies on disk.
7. Single authority: the recipe script reads one named framework and never ranks. Re-run test-254, test-399-workflow-advisor, command-resolver.test, run-all-399.sh.
8. Part 8: only {framework} and an optional step_id cross the wire. The raw mcp__theo__ server bypasses the guard, so recipes use brain-client or the shim. This research sent 6 name-only calls through raw mcp__theo__ and 38 through guarded callTool.
9. Hidden gaps: 8 empty frameworks inside multi-framework commands lose method silently unless the recipe names them.

### 6.1 Stale pre-Theo Brain references (owner 2026-11-24: the Brain is Theo; the old services are retired)

Counts exclude node_modules, .git, .planning.
- mindrian-brain.onrender.com: 32 files (14 tests, 9 docs, 6 lib, r-and-d, mcp-server-brain/CLAUDE.md:5, CHANGELOG). Fix the live comment at lib/core/rs-nl-to-query.cjs:13 (and its r-and-d mirror). Keep the rejection fixtures (lib/core/telemetry/validator.test.cjs:166-172, lib/memory/mos-status-renderer.test.cjs:475). Owner decision: delete legacy mcp-server-brain/ (own render.yaml) or mark historical. Test fixtures still use the old host: lib/core/doctor/class-m-brain-smoke.test.cjs:521, :569, :749; lib/memory/brain-derivation-graceful-degradation.test.cjs:625.
- pws-brain-mcp: 74 files. Keep the blocking matchers and retired lists (hooks/hooks.json:208, :332; brain-response-sanitize.cjs:151; data/theo-tool-classes.json:13; class-m-brain-smoke.cjs:133; owner ruling 2026-11-18: retired means blocked). Regenerate the stale dist/ build: dist/generic-claude-dir/.claude/skills/brain-connector/SKILL.md:171 and dist/zed/.agents/skills/brain-connector/SKILL.md still route Larry to pws-brain-mcp tools. Fix the comment at lib/core/enrichment-queue.cjs:492.
- pinecone-brain: 12 files. Remove from tools lists in agents/brain-query.md:10, agents/investor.md:10, agents/research.md:13 and fallback prose at brain-query.md:58, research.md:64 (Pinecone retired).
- mcp__neo4j-brain__ in comments at brain-query.md:30, investor.md:30, research.md:35: remove.
- Unscoped mcp__mindrian-brain__* names in 39 files (for example commands/act.md:47-48, :160); the plugin exposes mcp__plugin_mos_mindrian-brain__*. UNVERIFIED whether the unscoped name resolves; verify, then align.
- memgraph: 12 files, history only, low priority.

## 7. Recommendation

Build one recipe end to end first: challenge-assumptions (any-order fan-out) or root-cause (choice and repeat-return, which tests the gate path). Prerequisites in order: a step tool on the shim; the field whitelist; the owner ruling on the fallback; the owner ruling on draft status; one scenario file. Do not change composeWorkflow, composeNextMove, recipe-maps, runChain or gate.cjs.
