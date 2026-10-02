# Phase 364: Scientific Roadmapping command /mos:scientific-roadmap - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning
**Source:** PRD Express Path (364-INPUT.md + SEED-098 locked rulings NR-1..NR-3 + navigator direction 2026-10-02)

<domain>
## Phase Boundary

Ship `/mos:scientific-roadmap` end to end on the plugin side: a constraint-first methodology command,
born wired (connector registry, command registry, recipe maps), with a declared HITL shape, registered
so it runs on the CLI and is discoverable on Desktop/Cowork through the MCP methodology surface, and
with a Theo-sync handoff so Theo learns the command exists (USES_FRAMEWORK edge on Theo's side after
release). It walks Theo `framework_step("Scientific Roadmapping")` content only, runs as a door on the
Phase 363 research-planner `scientific-roadmapping` template (no second engine, D-18), and hands
falsifiable hypotheses to `/mos:research`.

Navigator direction 2026-10-02 (verbatim intent): "do it e2e, make Theo aware of it, shape it properly,
make sure it's registered on the command line and Theo knows about it."

Out of scope here (Theo repo, Theo Phase 25): authoring the 7 step bodies in canon, the problem-type /
Systems Thinking / HDPS edges in canon, and the USES_FRAMEWORK MindrianCommand edge write. This phase
produces the plugin-side artifacts those Theo steps consume (registry entry, handoff note) and refuses
honestly while Theo's steps are NULL.

</domain>

<decisions>
## Implementation Decisions

### Locked (SEED-098 NR-1..NR-3, 2026-09-27)
- NR-1: find-bottlenecks, dominant-designs, explore-futures are BOUND as inputs (read their filed
  artifacts through navigation.cjs, or offer to run them at their own gate), never re-implemented.
  find_bottlenecks `not_scored` maps to `not_ready`, never `unreachable` (Theo 20.2).
- NR-2: enterable mid-journey from LOCAL room state through `lib/core/navigation.cjs`; entry resolver
  proposes an entry step at an F.1 entry gate (navigator may override to step 1); skipped steps
  recorded `not_run` with the stand-in artifact; never collides with explore-opportunity.
- NR-3: consistent with Theo's Scientific Roadmapping FEEDS_INTO/COMPLEMENTS Hypothesis-Driven
  Problem Solving edges; the plugin does not assert them, Theo Phase 25 verifies them.

### Rooting (navigator ruling 2026-10-01)
- Primary rooting: Well-Defined with solution criteria known and the HOW unknown; secondary bridge
  from Ill-Defined innovation of meaning (meaning produces the WHAT).
- Entry check: the room has a needs or solution-criteria statement (what to deliver). If not, route
  back to define it first; never improvise the WHAT.
- Step 3 names the rung/output type; the filed plan names its rung.

### Entry points (navigator requirement 2)
- Direct `/mos:scientific-roadmap`, `--from-hypothesis`, researcher persona (role_blend researcher),
  /mos:ignite Researcher or Door 3 Hypothesis (hypothesis_text as goal seed).

### Systems layer (requirement 3)
- A Systems Thinking pass (bind /mos:systems-thinking or /mos:analyze-systems, ch06) BEFORE Path
  Enumeration and Constraint Interrogation; bound, not duplicated.

### Hypothesis link (requirement 4)
- Stage B turns each ranked bottleneck into a falsifiable hypothesis (Hypothesis-Driven Problem
  Solving); HDPS steps 2 and 3 handed to /mos:research on the 363 engine; a refuted bottleneck drops.

### Theo contract (25-PLUGIN-CONTRACT)
- Walk steps from framework_step in list order; never sort by sourceOrder; never write step text from
  memory; skip DEFINITION and ASIDE; a null label or runIt is refused honestly: "Theo has not authored
  this step yet". (Live 2026-10-02: all 7 steps return NULL label/runIt; the command must ship and
  behave correctly in that state.)
- Stage A: the 7 steps, a human gate each, claims filed as proposed.
- Output: room/research-plan/PLAN.md filed through the 363 F.8 basket; plan names its rung and steps run.
- No second engine: a door on the 363 `scientific-roadmapping` template; plans handed to /mos:research.
- Canon Part 8: only generic handles reach Theo, through the guarded mindrian-brain shim. Theo decides
  nothing. No skill writes canon.
- Thin coverage stated out loud: a thin recommend_chain / problem-type answer says "uncovered", never
  reads as a fit verdict (SEED-106 item 3). Business-terminated chains are never accepted as the spine
  (SEED-106 item 1). Scientific-method rubric (falsifiability, controls, priors, mechanism vs property)
  carried as a PLUGIN-SIDE labelled rubric until Theo ingests it (SEED-106 item 2).

### Shape and registration (navigator 2026-10-02: "shape it properly", "registered on the command line")
- Frontmatter: kind methodology, autonomous_safe false, reach context_block, frameworks
  [Scientific Roadmapping, Hypothesis-Driven Problem Solving], produces room/research-plan/*,
  declared hitl_stages (entry F.1, per-step gates, F.8 filing basket) with hitl_why, canon_parts.
- Wired via /mos:new-surface then the registry sync (data/command-registry.json, recipe-maps,
  connector registry), never a hand MERGE. Born-wired, shape-declaration, projection and render gates
  pass (`build-connector-registry --check`, `check-shape-declaration`, `build-orchestration-projection
  --check`, `check-render-coverage`).
- CLI: the command resolves and runs as `/mos:scientific-roadmap`; Desktop/Cowork: reachable through
  the MCP methodology surface where the registry exposes it (Tri-Polar).

### Theo awareness (navigator 2026-10-02: "make Theo aware", "Theo knows about it")
- Plugin side owns: the command-registry row Theo's registry sync reads, a handoff note to Theo
  (Theo Phase 25 part 3) naming the slug, frameworks and release in which it ships, and an entry in
  25-PLUGIN-CONTRACT's handoff log via the Theo session (cross-repo, messaged, not written from here).
- Theo-side USES_FRAMEWORK edge lands only after a plugin release carrying the command.


### Navigator rulings 2026-10-02 (post-research)
- What-anchor: no new node type. The entry check accepts existing stand-ins (the ratified goal, the
  governing question, or a hypothesis claim from /mos:ignite's hypothesis door), and the navigator
  confirms which one at the F.1 entry gate.
- NULL Theo steps: the command runs the entry check and entry resolver, then refuses at step 1 with
  "Theo has not authored this step yet" and offers /mos:research directly.
- Canon snapshot: Wave 0 runs `node scripts/refresh-framework-names.cjs --live`; if names other than
  Scientific Roadmapping change, the executor STOPS at a checkpoint and shows the navigator the diff
  before committing (human review), then re-runs the egress and stamp tests.

### Claude's Discretion (open items from 364-INPUT, resolved with defaults)
- Slug: `/mos:scientific-roadmap` (already used by Theo Phase 25 and 25-PLUGIN-CONTRACT; `/mos:roadmap`
  rejected as colliding with GSD roadmap vocabulary).
- Two-framework registry storage: one primary framework (Scientific Roadmapping) plus a recipe edge
  to Hypothesis-Driven Problem Solving, following whatever the registry already does for any existing
  multi-framework command (planner to check and mirror; if none exists, primary + recipe edge).
- hierarchy_rank: read from connector-registry.json conventions for methodology commands of the same
  family (research/methodology); planner picks and states it.
- find-analogies as an optional NEXT_IN_RECIPE: include as optional, not required.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase inputs
- `.planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-INPUT.md` - full planning input
- `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md` - locked NR-1..NR-3, entry resolver table
- `.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md` - seven-operations artifact table, keep-unresolved rules
- `.planning/seeds/SEED-106-mindrian-theo-relationship-insights-2026-10-02.md` - items 1-3
- `/home/jsagi/Theo/.planning/phases/25-scientific-roadmapping-adoption-and-research-plan-route-seed/25-PLUGIN-CONTRACT.md` - the cross-repo contract
- `/home/jsagi/Theo/.planning/phases/25-scientific-roadmapping-adoption-and-research-plan-route-seed/25-INPUT-command-draft.md` - navigator draft spec (starting spec)

### Engine (Phase 363, reuse)
- `lib/core/research-planner/CONTEXT.md` and `lib/core/research-planner/*.cjs` (perspective, plan, planner, structure, question-templates, filing)
- `.planning/phases/363-*/` SUMMARYs for 363-06, 363-07, 363-22 (SEED-098 reuse contract)
- `commands/research.md`, `skills/research/SKILL.md`

### Bound surfaces
- `commands/find-bottlenecks.md`, `commands/dominant-designs.md`, `commands/explore-futures.md`,
  `commands/systems-thinking.md`, `commands/analyze-systems.md`, `commands/ignite.md`

### Wiring and shape
- `commands/new-surface.md`, `docs/CONNECTOR-CONTRACT.md`, `docs/HITL-SHAPE-DECLARATION-CONTRACT.md`
- `data/command-registry.json`, `lib/core/recipe-maps.cjs`, `scripts/build-connector-registry.cjs`,
  `scripts/check-shape-declaration.cjs`, `scripts/build-orchestration-projection.cjs`, `scripts/check-render-coverage.cjs`
- `lib/core/navigation.cjs` (the only read path for room state)
- `docs/MINDRIAN-CANON.md` Parts 3, 7, 8, 9, 11, 12

</canonical_refs>

<specifics>
## Specific Ideas

- Step map (Theo labels, when authored): 1 Tension Qualification, 2 Goal Quantification, 3 Rung
  Placement and Type Selection, 4 Forum Construction, 5 Path Enumeration, 6 Constraint Interrogation,
  7 Catalytic Ranking, plus the 7-to-1 re-survey loop. Content always from framework_step.
- Live fact 2026-10-02: framework_step("Scientific Roadmapping") returns 7 steps sr-v1-step-1..7 with
  every content field NULL; aliases Field Roadmapping, Roadmapping, Tech Tree Mapping, Technology
  Roadmapping resolve to it. Tests must cover the all-NULL state (honest refusal) and an authored state
  (fixture), never a model-memory fallback.
- Peer coordination: jsagi-be is executing Phase 366 and owns lib/core/research-planner, lib/mcp/tools/
  views|research.cjs, tool-router.cjs. Plans must prefer new files (a perspective/door module) over
  edits to those files, and any unavoidable edit is sequenced after messaging jsagi-be.

</specifics>

<deferred>
## Deferred Ideas

- Theo Phase 25 (Theo repo): sr-v1 provenance audit, authoring the 7 steps, problem-type / Systems
  Thinking / HDPS edges, the human-run canon write, and the USES_FRAMEWORK edge after release.
- Plugin release cut carrying the command (release.sh lockstep), then Theo sync.
- Theo ingest of scientific-method content (SEED-106 item 2).

</deferred>

---

*Phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0*
*Context gathered: 2026-10-02 via PRD Express Path*
