# Phase 342 - Findings prelude (2026-09-09, pre-discuss). Shared with the Theo session.

Status: registered, not planned. Navigator-locked at a Decision Gate (2026-09-09): own phase,
right after Phase 341 (install overhaul). Phase 341 must NOT preclude anything below.

## Navigator directive (verbatim, 2026-09-09)

- "i want Theo to be aware of the eurica engine ! to be able to trigger it !"
- "also the RS engine, the whitapapce, all all all intelgence layer"
- "make sure the eurika engine is not only working but working with theo ... becouse this might
  be the moat !"
- "update theo session running parrleel with context ! so it can be aware and build a
  comlimentry phase on its end"

## The shape Canon Part 8 fixes

Theo never sees room content. "Theo triggers X" therefore means: Theo names a GENERIC HANDLE
(a command or framework name) inside a recommendation or chain; the LOCAL plugin executes it
through the already-shipped route (chain_resolve -> chain_run, lib/core/chain-executor.cjs
runChain, halting at the first material step per Canon Part 3); results stay local. This is
exactly how chains run today. No new transport is needed for the trigger leg; what is missing
is Theo KNOWING the handles.

## Verified topology of Eureka today (file:line, this tree, 2.0.0-beta.30)

- Eureka is 100 percent LOCAL, critic included. `eureka_critic` is registered on the local
  `mindrian-os` MCP server (lib/mcp/tool-router.cjs:1987) and calls
  lib/core/eureka-critic.cjs `criticRule` in-process (tool-router.cjs:2046; eureka-critic.cjs
  requires only node:fs, node:path, rs-egress-prompts.cjs; no fetch, no brain-client).
  lib/core/eureka/eureka-reach-runner.cjs:120 consumes the critic by direct require.
- Zero `brain-client` requires under lib/core/eureka/ or scripts/eureka*.cjs. The retired
  origin pws-brain-mcp.onrender.com survives only in matchers, tests, data/brain-census
  .generated.json:4 and prose - never on the Eureka path. Phase 339's Theo cutover
  (lib/core/brain-client.cjs:40 default https://theo-mcp.onrender.com) cannot have broken it.
- Consequence: "does Eureka work with Theo on beta.29" is a non-question today. The MISSING leg
  is Theo -> local trigger (awareness + recommendation), which is this phase.
- No test proves any intelligence engine end to end with Theo; the four tests matching both
  "eureka" and a Brain/Theo string are Part 8 boundary greps asserting the ABSENCE of a reach.

## The handle inventory (local, data/command-registry.json, 113 commands; 30 match the
## intelligence/analysis vocabulary)

/mos:analyze-systems, /mos:analyze-timing, /mos:bono, /mos:build-thesis,
/mos:challenge-assumptions, /mos:compare-ventures, /mos:deep-grade, /mos:diagnostics,
/mos:dominant-designs, /mos:eureka, /mos:explore-futures, /mos:explore-opportunity,
/mos:explore-trends, /mos:find-bottlenecks, /mos:find-connections, /mos:futures, /mos:grade,
/mos:intel-pipeline, /mos:leadership, /mos:macro-trends, /mos:memory-cortex-reach,
/mos:opportunities, /mos:research, /mos:root-cause, /mos:rs-fetch, /mos:scenario-plan,
/mos:score-innovation, /mos:skill, /mos:systems-thinking, /mos:whitespace

Plus the MCP-side engines on the local server: `intelligence` (find-connections, build-thesis,
compare-ventures, research, deep-grade, grade, leadership, whitespace, eureka-run,
eureka-status, eureka-report), `analysis` (analyze-systems, analyze-timing, find-bottlenecks,
root-cause, systems-thinking, macro-trends, explore-trends, explore-futures, dominant-designs,
scenario-plan, causal-extract, causal-trace, causal-predict), `whitespace_scan`,
`contradiction_check`, `graph_reason`, `eureka_critic`, and the reverse-salient agent
(lib/agents/reverse-salient-agent.cjs; RS engine lib/core/rs-engine.cjs lazy-requires
transformers).

Posture authority: lib/core/recipe-maps.cjs `postureForCommand(command)` ->
{command, autonomous_safe, posture} (the ONE registry posture authority, line 181); the chain
executor sources it, never re-derives it. Forced-material classes always halt
(chain-executor.cjs:190-192). Any Theo-recommended chain containing these handles inherits
these rules unchanged.

## What the Theo side is asked to build (the complementary phase)

1. AWARENESS: the teaching graph knows every handle above as a command/framework node, with
   problem-type routing (Undefined / Ill-Defined / Well-Defined / Wicked) and FEEDS_INTO /
   chain edges, so `find_commands_for_problem_type`, `command_neighborhood`, `recommend_chain`
   and `orchestration_readiness` can surface them. Today's readiness of these handles in the
   graph is UNVERIFIED from this side (to be checked with a generic-handle query).
2. RECOMMENDATION: `recommend_chain` can emit chains that include them, sequenced (never a flat
   list), e.g. whitespace -> find-connections -> eureka-run -> build-thesis for an Ill-Defined
   opportunity question.
3. TRIGGER CONTRACT: Theo's `chain_run` / DirectiveEnvelope carries only the handles; the
   plugin's chain_run executes locally and halts at material steps. Define the envelope fields
   the plugin will read (handle list, posture hints, reason tag); nothing else crosses.
4. PROOF: one end-to-end case: Theo recommends a chain with an intelligence handle; the plugin
   resolves it (chain_resolve), runs the autonomous_safe prefix, halts at the gate; no room
   bytes reached Theo (wire-level invariant test on the plugin side, Phase 257 idiom).

## What Phase 341 (install overhaul) must NOT preclude

- The slim npm-source install keeps every engine above reachable (the pure-JS set is bundled;
  only the 380 MB embedding stack becomes an explicit, visible opt-in with the existing
  `encoder_unavailable` degrade). Engines that need the model report "model not installed, run
  /mos:eureka enable" honestly rather than no-op silently.
- data/command-registry.json (visibility, posture) stays the single local handle authority
  Theo's awareness is synced FROM; the projection direction is local registry -> Theo, never
  the reverse.
- Doctor class S keeps a blocker for "capability reachable" and an advisory for "model
  installed" (see 341 research), so a slim install cannot pass a gate by skipping Eureka.

## Plugin-side open items for 342's discuss step

- Does a local -> Theo handle projection already exist (Phase 254 orchestration projection,
  framework-vocabulary sync, skill-mirrors coverage gate)? If yes, extend it to the 30 handles;
  if no, this phase builds the one-way sync.
- Class S live bug to fix on the way: class-s-eureka-smoke.cjs:180 calls the async
  `isModelCached` without await (cache-miss branch unreachable).
- SEED-049 D14's unshipped first-run Larry-voiced notice for the lazy model download.

## Research findings (advisor research, 2026-09-09) - facts, not yet ratified decisions

- The Theo -> local trigger spine ALREADY EXISTS and is already fenced: lib/brain/chain-recommender.cjs:594
  `chainOfferForReach` -> :616 `brainClient.recommendChain(problemType)` -> :626 `adaptChainToRunInput` ->
  chain_run; :644-646 verbatim: "NEVER computes posture: posture authority stays LOCAL in recipe-maps.cjs via
  chain_run; the Brain recommends, never triggers (fence 6)". lib/core/brain-client.cjs:1879-1888
  `recommendChain` sends Theo only `problem_type` + `max_steps`.
- The door is closed by VOCABULARY, not transport. lib/workflow/command-resolver.cjs:85-90
  `commandsForFramework` reads only `framework_index`; :110-121 `composeWorkflow` yields `command: null,
  optional: true` for a framework with no command; :131-140 `validateChainAutonomy` blocks any step not
  `autonomous_safe: true`. data/command-registry.json:538-556 `/mos:eureka`: `frameworks: []`,
  `autonomous_safe: false`; live `postureForCommand('/mos:eureka')` -> posture `halt` (control:
  `/mos:deep-grade` -> `run`). No eureka recipe in NAMED_RECIPES (recipe-maps.cjs:355-361, one recipe,
  PWS_grading) nor in SENS10_CAUSE_RECIPES (:286).
- The vocabulary gate is THEO-SIDE. scripts/build-command-registry.cjs:516 refuses any `frameworks:` value not
  in data/framework-names.json, a build-time snapshot of Theo's `:Framework` node names, `snapshot_date:
  "2026-05-12"` (four months before the 2026-09-03 cutover), 105 names + 7 curated_extras, refreshed by
  `node scripts/build-command-registry.cjs --refresh-names`. No eureka/RS/whitespace name exists in it; the
  nearest is "HSI Semantic Surprise Analysis Assistant". Frontmatter is the single edit surface (:318
  `frameworks`, :339 `autonomous_safe`; compare commands/deep-grade.md:17,20).
- data/brain-orchestration-projection.json (384 nodes / 73 edges) is LOCAL despite its name: it already
  carries `command:/mos:eureka` (reach_id context_block, sub_mode eureka-portfolio, hierarchy_rank 3, posture
  hold, sensor_triggers SENS-13) plus `skill:eureka` and `sub_mode:eureka-portfolio` nodes; consumers are
  local (local-chain-recommender.cjs:48, navigation-engine.cjs:1092, decide-projection-reader.cjs:15);
  tests/test-orchestration-projection-part8-boundary.cjs:38-45 forbids any brain-client require in the
  generator. Nothing pushes it to Theo. Theo's own `orchestration_readiness` tool documents the same:
  "the plugin-side orchestration projection is NOT synced into Theo".
- Chain executor rules a Theo-named engine would inherit: lib/core/chain-executor.cjs:190-236 a step is
  material when the posture verb is not `run`, when irreversible, or `step.material === true`; :332-335 a
  step auto-runs only when posture is `push_forward` AND reversible. Keeping `hold` means a Theo-recommended
  chain halts at a navigator gate rather than auto-launching a portfolio scan.
- Recommended landing (advisor, Option A): register each engine as a Theo-known `:Framework` (Theo side) +
  declare `frameworks:` (and, if ever, `autonomous_safe`) in each command's frontmatter (plugin side) +
  `--refresh-names`; NOT a second dedicated Theo trigger tool (a second selection brain and a second
  transport next to chain_resolve/chain_run, against Canon Part 7 and the one-governed-path rule).
- Phase 341 must NOT preclude (verified list): keep `data/` in the npm `files` whitelist
  (command-registry.json, framework-names.json, connector-registry.json, brain-orchestration-projection.json,
  harness-manifest.json are runtime reads); capability must never be conditional on the model at the
  REGISTRY level (Theo naming the handle, chain_run reaching it, and an honest "model not installed, run
  /mos:eureka enable" render must all work on a slim install); the `enable` subcommand must not change
  `command: "/mos:eureka"` identity; keep data/framework-names.json and `--refresh-names` intact.

## Live Theo facts (generic handles only, queried 2026-09-09 from the plugin session)

- `command_neighborhood("/mos:eureka")` -> Theo DOES know the command: kind utility, surface navigator,
  autonomousSafe false, jtbdLabel "Connect Domains", reach context_block / posture hold / hierarchyRank 3 /
  decisionSurface F.1 / subMode eureka-portfolio, `frameworks: []`, sensors [], feedsInto [],
  `mappedBy: "command-registry@2.0.0-beta.12"` (the command sync EXISTS and is stale: current is beta.30).
  Diagnostic warning: property `declaration_side` absent in Theo's database (a schema-drift note for the
  Theo side).
- `normalize_framework_name("Eureka")` -> FRAMEWORK_NOT_FOUND. `("Whitespace")` -> FRAMEWORK_NOT_FOUND.
  `("Reverse Salient")` -> canonical "Reverse Salient Analysis", matched_via alias. coverage.total = 420
  live `:Framework` nodes (data/framework-names.json snapshot holds 105 + 7: four months stale).
- Consequence for 342: the command layer is synced (refresh it); the framework layer is the gap for Eureka
  and Whitespace (and to be checked for each of the 30 handles); RS already has a canonical framework name
  the plugin can declare in commands frontmatter today, once `--refresh-names` admits it.

## Navigator framing 2026-09-09: "we might need to wrap them as MCPs mindrian is using"

Most engines are ALREADY MCP tools on the local `mindrian-os` server (.mcp.json -> bin/mindrian-mcp-server.cjs):
`intelligence` (find-connections, build-thesis, compare-ventures, research, deep-grade, grade, leadership,
whitespace, eureka-run/status/report), `analysis` (analyze-systems, analyze-timing, find-bottlenecks,
root-cause, systems-thinking, macro-trends, explore-trends, explore-futures, dominant-designs,
scenario-plan, causal-extract/trace/predict), `methodology` (find-analogies, explore-domains,
score-innovation, ...), `whitespace_scan`, `contradiction_check`, `graph_reason`, `eureka_critic`.
The catalogs (342-CATALOG-A/B/C) record per engine which MCP surface exists; any engine WITHOUT one is a
plugin-side gap to close in this phase.

Direction is fixed by Canon Part 8 and by topology: Theo is remote; the local MCP server runs on the
navigator's machine with the room. Theo cannot and must not call into it. "Wrapped as MCP" therefore
means the LOCAL surface exists for chain_run and for the hosts (CLI / Desktop / Cowork) to invoke; the
awareness leg is Theo knowing the handle names (command + framework + MCP tool name) so `recommend_chain`
can name them. No Theo -> plugin call-in is to be built.

## Correction from Catalog A (2026-09-09): the MCP surfaces are mostly reference-echo stubs

- The `intelligence` / `analysis` / `methodology` MCP branches for RS (find-bottlenecks), HSI
  (score-innovation, whitespace) and most other engines call `buildContext()`
  (lib/mcp/tool-router.cjs:489): they return the command's reference doc + room state so the MODEL performs
  the methodology in conversation. They do not execute engine code. Only Eureka's eureka-run/status/report
  and `eureka_critic` execute for real over MCP today. (Detail: 342-CATALOG-A-insight-engines.md.)
- Phase 268 "Transition Selected Workflows to MCP Tools" (ROADMAP.md:2025) already owns real tools with
  real `outputSchema`s for find-bottlenecks/RS and Eureka (W1) and every code-running command (W2);
  zero plans; depends on Phase 267 (MCP SDK v2), blocked upstream on ext-apps (navigator ruling
  2026-09-01); carries the 2026-09-02 ruling to schema-design promoted tools for Theo's single catalog.
- Three-surface consequence for 342: on the CLI a Theo-named handle already reaches a working engine
  (chain_run invokes the /mos: command; Larry runs it). On Desktop/Cowork (no slash commands) a
  Theo-recommended step on a stubbed engine lands on the reference-echo. 342 delivers AWARENESS on all
  surfaces now; REAL execution on hookless surfaces is gated by 268 -> 267 -> upstream. Do not design
  a Theo-side trigger against a tool that is not there yet; design the handle names to survive both.
- Other Catalog A facts: entity-classifier.cjs egresses candidate entity names + an excerpt to the raw
  Anthropic LLM transport (its docblock states Part 8 does not govern that boundary); rs-fetch/rs-explain
  are live Theo touchpoints via brain-client.cjs while rs-thesis/rs-experts strip Brain access; Phase 161
  is a phantom (goal shipped as Phase 211); `/mos:scout hsi` hardcodes `python3 compute-hsi.py`,
  bypassing the Phase 272 CJS backend-dispatch chokepoint (a defect to file, see also SEED-013).

## Catalog B highlights (intelligence commands, 15 engines; detail: 342-CATALOG-B-intelligence-commands.md)

- 10 of 15 MCP surfaces are the same `buildContext()` reference-echo (tool-router.cjs:489); the real
  scripts, agents and Brain calls fire only where Claude Code executes the command's own instructions.
- THREE engines have NO MCP registration at all: intel-pipeline, explore-opportunity, grade-grant.
  Desktop and Cowork cannot invoke them; CLI slash commands only. A 342 plugin-side gap.
- `whitespace` is three unrelated things under one name: (1) the CLI Python HSI/UMAP pipeline that writes
  anonymized data to the Brain, (2) the MCP `whitespace_scan` tool (a pure local SQL gap scan over
  open_question / unsupported-claim nodes), (3) the Brain-side `find_whitespace` graph algorithm this
  repo never calls directly. Theo naming must not collapse these: propose distinct handles (e.g.
  "Whitespace Gap Scan (local)" vs "HSI Whitespace Map") rather than one "Whitespace".
- Stale tool grants: agents/investor.md and agents/research.md still grant
  `mcp__pinecone-brain__search-records` although Pinecone is RETIRED per CLAUDE.md; agents/investor.md
  has no dispatch site anywhere in the repo (description-only "PROACTIVE", unwired).
- Part 8, VERIFIED (2026-09-09): find-connections and compare-ventures do not bypass anything. Their
  command files instruct the model to call `mcp__mindrian-brain__brain_query` / `brain_search` /
  `read_neo4j_cypher` (commands/find-connections.md:18-21, commands/compare-ventures.md:18-22, :83), i.e.
  the client stdio shim = path P1, which the Phase 257 host-independent egress guard covers
  (lib/core/part8-egress-guard.cjs names find_connections). The guard, not the command, rules on what
  crosses. grade-grant.cjs `askBrainForCoaching` remains the cleanest generic-handle example. Catalog B's
  phrase "send free-text descriptions to Brain" should be read as "submit a search through the guarded
  shim".
- Already Theo-reachable TODAY through the recommend_chain -> chain_run spine (frameworks declared +
  autonomous_safe true): find-connections ("Usher's Model of Cumulative Synthesis"), compare-ventures
  ("PWS Triple Validation Compass"), deep-grade ("PWS Triple Validation Compass"). Catalog C's closing
  table enumerates reachability for the analysis family; the 342 plan's first task is that table for
  all 30 handles.

## Catalog C highlights (analysis + graph engines, 21 engines; detail: 342-CATALOG-C-analysis-graph-engines.md)

- Most of the 13 `analysis` MCP commands run zero deterministic code: `buildContext()` hands Larry the
  command markdown to reason over live. Real backing logic exists only for find-bottlenecks (the RS
  engine), futures (`futures/orchestrator.cjs`) and diagnostics (four Python scripts).
- `causal-trace` / `causal-predict` are structurally dead: commands/causal.md's own body refuses both
  ("ships in v1.7.0"), unmet at v2.0.0-beta.30; the MCP enum values resolve to nothing. Do NOT register
  them in Theo until they exist.
- The word "whitespace" names two unrelated engines (graph-native `whitespace_scan`, pure SQL, zero Brain;
  vs the HSI/Python-backed `/mos:whitespace`). Distinct Theo handles are mandatory.
- Locally shipped framework names ("PEST Analysis", "Dominant Design", "Futures Wheel",
  "Adoption-Capacity Theory") are absent from the Brain's FEEDS_INTO-linked snapshot, so Theo cannot
  recommend them by name although the local chain machinery already runs them. Theo-side: add them
  with FEEDS_INTO links; plugin-side: --refresh-names.
- THE structural gap: every graph-native tool (contradiction_check, whitespace_scan, graph_reason,
  memory-cortex-reach, and the reach/sensor dispatch machinery) declares no `frameworks:` name.
  They are unreachable through the Theo -> chain_run seam regardless of Theo's vocabulary. This is
  LOCAL vocabulary work (commands frontmatter + registry regeneration), the plugin half of 342.
- Catalog C's closing section traces brain-client.recommendChain -> chain-recommender.cjs
  chainOfferForReach -> adaptChainToRunInput -> command-resolver composeWorkflow / commandsForFramework
  -> chain-executor runChain and tabulates, per engine, reachable-today vs not.

## Hand-off status

- 2026-09-09: catalogs A (6 engines), B (15), C (21) = 42 engines, committed; paths sent to the Theo
  session with the request to reconcile each catalog's "proposed Theo name" column against Theo's live
  `:Framework` set (exact or alias only) and return the canonical list before the plugin-side
  frontmatter declarations are written.
