---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 10
subsystem: research-planner
tags: [research-shape-ledger, graph-snapshot, scientific-detection, planners-by-relevance, diffusion-lens, d-02b, d-09, d-17, d-18, d-19]

requires:
  - phase: 363-01
    provides: test hygiene and research-planner folder
  - phase: 363-02
    provides: fixture room helper
  - phase: 363-06
    provides: question templates and pyramid applyLogicTreeSteps
  - phase: 363-07
    provides: perspective srStepGuide and SR_OPERATIONS
provides:
  - data/research-shape-ledger.json - shipped, IP-capped structure data built from the graph
  - scripts/build-research-shape-ledger.cjs - deterministic builder, --check, --live diff, buildLedger and liveSnapshot exports
  - lib/core/research-planner/structure.cjs - loadLedger, detectScientific, structureFor, plannersForRoom, nextFramework, lensSelection, refreshLive
  - tests/fixtures/363-graph-snapshot.json - the dev-time snapshot (source neo4j_direct)
  - tests/test-363-structure.cjs (B1-B4, D0-D7, E1-E2)
affects: [363-12, 363-13, 363-15, 363-17, 363-18, 363-19, 363-20]

key-decisions:
  - "Snapshot source was Source A (neo4j_direct, mcp__my-neo4j__read_neo4j_cypher), anchored reads with bound parameters, allowed fields only."
  - "structure object exposes logic_trees_steps ([{order,name}]) and frameworks['Scientific Roadmapping'].steps ([{order,name,key_question,gates}]); it has no top-level steps key, so pyramid and perspective each read their own shape unambiguously."
  - "plannersForRoom lists templates whose framework names the room's rung first, then rung-agnostic ones (frameworks with no problem-type edge, today HSI whitespace). The plan text said only rung-addressing templates; the agnostic tail keeps /mos:whitespace reachable."
  - "explicit_only templates (scientific-roadmapping) are never offered by plannersForRoom; they are reached by template id."
  - "lensSelection returns {selected:[{lens,source,reason,signals}], refused:[{lens,reason:'reason_required'}]}; source precedence navigator_toggle > larry > room_signal > ledger_feeds_into > sr_step, all fired signals listed."
  - "nextFramework picks the first FEEDS_INTO target that addresses the rung and has a command; if targets exist but none has a command it returns the framework with command null."
  - "refreshLive is async, takes {brainClient?}, never mutates the cached ledger, returns {source:'theo_live', live:{...}} or {source:'theo_ledger', reason}."
  - "Six Thinking Hats holds 11 process steps in the graph; edges-only framework, steps not shipped, theo_gap null."

requirements-completed: [DRP363-12]

duration: ~35min
completed: 2026-09-29
---

# Phase 363 Plan 10: Research-Shape Ledger and Structure Reads Summary

The graph's knowledge of how to structure research now ships as checked, IP-capped data, and the planner reads it locally for scientific structure, planner relevance, the next framework and the diffusion lens.

PLAN_BASE: ecd57686621e4bd2c91df980663582b7f609aaec
Commit: 54f465a67e5fe26ec6c2883fa1fa66af8ad47842 (all five plan files, `git commit --only`; ancestor of HEAD verified).

## Snapshot source and capture queries

Source A: `mcp__my-neo4j__read_neo4j_cypher`, framework names and problem-type ids bound as parameters; no description field read (one `keys(f)` read returned property key names only, to learn the alias and property vocabulary). Queries used:

- `MATCH (f:Framework {name:$n})-[:HAS_PROCESS_STEP]->(s) RETURN s.order AS ord, s.name AS name, s.key_question AS key_question, s.gates AS gates` (Scientific Roadmapping, Logic Trees)
- `MATCH (f:Framework {name:$n})-[r]->(t:Technique) RETURN type(r) AS rel, t.name AS name` (rel = USES_TECHNIQUE); `MATCH (f:Framework {name:$n})-[:USES_TECHNIQUE]->(t:Technique) RETURN t.name AS name` (Logic Trees: none)
- `MATCH (f:Framework {name:$n})-[:HAS_PROCESS_STEP]->(s)-[:LEADS_TO]->(t) RETURN s.order AS from_ord, t.order AS to_ord`
- `MATCH (f:Framework {name:$n}) RETURN keys(f) AS k`; `MATCH (f:Framework {name:$n})-[r]->(x) RETURN DISTINCT type(r) AS rel, labels(x) AS lbl`; `MATCH (x)-[r]->(f:Framework {name:$n}) RETURN DISTINCT type(r) AS rel, labels(x) AS lbl` (vocabulary discovery: aliases are `ALIAS_OF` edges from alias Framework nodes)
- `MATCH (f:Framework)-[:FEEDS_INTO]->(g:Framework) WHERE f.name IN $names RETURN f.name AS f, g.name AS g`; reverse (fed-by); the same shapes for `PREREQUISITE`, `COMPLEMENTS`
- `MATCH (a:Framework)-[:ALIAS_OF]->(f:Framework) WHERE f.name IN $names RETURN f.name AS f, a.name AS alias`
- `MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(p:DomainConcept) WHERE p.id IN $pts RETURN p.id AS pt, f.name AS f`
- `MATCH (f:Framework) WHERE f.name IN $names RETURN f.name AS name` (all 17 found); `... -[:HAS_PROCESS_STEP]->(s) ... RETURN f.name AS f, count(s) AS steps` (only Six Thinking Hats, 11)

## content_gaps

- Logic Trees steps carry no key_question or gates in the graph (null).
- Six Thinking Hats holds 11 process steps in the graph; not captured (edges-only framework).
- Logic Trees has no techniques in the graph.
- Aliases are ALIAS_OF edges into the canonical Framework.

## theo_gap rows (for the Theo companion work)

All `zero_steps` (no HAS_PROCESS_STEP in the graph): Adoption-Capacity Theory, Adversarial Research Protocol, Diffusion Theory, Diffusion of Innovations (Rogers), Dual-Use Technology, HSI Semantic Surprise Analysis Assistant, Herbert Simon The Sciences of the Artificial, Hypothesis-Driven Problem Solving, Knowns and Unknowns Matrix Framework, Law of Diffusion of Innovation, Research Validation and Early Business Framing, Root Cause Analysis, Scientific Method, The Pyramid Principle. No `name_not_found` (all 17 names exist). Note Theo's typed `framework_step` still returns empty labels for the scientific frameworks (363-RESEARCH finding 3); the ledger route avoids it.

## Verification

- `node tests/test-363-structure.cjs`: 14 checks PASS (B1-B4, D0-D7, E1, E2), exit 0
- `node scripts/build-research-shape-ledger.cjs --check`: OK
- Static scan: no `brain-client` text before `function refreshLive`
- E1 feeds the real `structureFor` output into 363-06 `applyLogicTreeSteps` (applied, 5 steps, hypothesis at WellDefined, no unmapped steps; local-template structure does not apply) and into 363-07 `srStepGuide` (source ledger, names equal SR_OPERATIONS, ledger key questions and gates used); `srStepGuide(loadLedger())` also reads it
- tests/run-all-363.sh already carries run_if legs for both files; not run here (aggregator runs are the orchestrator's)

## Deviations

- Rule 2 (reachability): plannersForRoom includes rung-agnostic templates after the named fits (see key-decisions). Without it /mos:whitespace would never be offered, since its HSI framework has no ADDRESSES_PROBLEM_TYPE edge.
- The plan's single commit covers all three tasks (plan Task 3 says commit together); Task 1 and Task 2 were not committed separately.

## Downstream contract notes

- `require('./structure.cjs')`: `loadLedger(path?)`, `detectScientific({templateId, roomDir, navigatorToggle}) -> {scientific, signals:['S1'|'S2'|'S5']}`, `structureFor({templateId, rung, scientific, engine}) -> {source:'theo_ledger'|'local_template', reason, scientific, tree_type_hint, logic_trees_steps?, frameworks?, steps? (local only)}`.
- Pass `structureFor(...)` result straight as the `structure` argument to `buildPyramid` and `applyLogicTreeSteps`, and to `srStepGuide`. Store `source` and `reason` on the plan's structure record.
- `plannersForRoom({roomDir}|{rung}) -> {planners:[{template_id,doors,framework,shape,default_mode,reason}], source, rung_source, reason}`; never surfaces the rung label. `default_mode` comes from the ledger shapes (IllDefined is deep, with `quick_when` only in the ledger; the caller applies "one lens named -> quick").
- `nextFramework({lensFramework, rung}) -> {none:false, framework, command, commands, source, reason} | {none:true, reason}`; reasons: no_feeds_into_for_rung, rung_unknown, ledger_unavailable. Pass the rung from `resolveRoomRung`, not question text.
- `lensSelection({templateId, frameworks, perspective, roomDir, requested:{lens:'diffusion',reason}, navigatorToggle}) -> {selected:[{lens,source,reason,signals}], refused}`; `selected` items already fit `validateQuestionSet` lens_selection (lens, reason). Show `reason` on the card.
- `refreshLive({brainClient?})` is async; the CLI/MCP process passes nothing and it lazy-requires the guarded client. Treat `disposition !== 'blocked'` as fine; a non-`theo_live` result means keep using the ledger and print the reason.
- Rebuild the ledger: `node scripts/build-research-shape-ledger.cjs` (from the snapshot) or `--live --write` (guarded Theo, which may not serve key_question or gates; content then degrades to names). Never hand-edit `data/research-shape-ledger.json`.
- Logic Trees `key_question` and `gates` are null in the graph, so those steps ship names only.

## Self-Check: PASSED

All five files exist and are committed; commit 54f465a67 is an ancestor of HEAD; tests and --check pass.
