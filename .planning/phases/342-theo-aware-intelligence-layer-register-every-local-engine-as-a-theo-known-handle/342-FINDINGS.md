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
