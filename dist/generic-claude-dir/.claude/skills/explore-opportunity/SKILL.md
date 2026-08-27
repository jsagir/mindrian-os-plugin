---
name: explore-opportunity
description: Run the explored-stage analysis chain on a qualified opportunity
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Turn a qualified opportunity into a deep-researched, Minto-shaped, evidence-backed analysis."
argument-hint: "[opportunity]"
body_shape: E (Action Report)
hitl_shape: "F.1"
hitl_why: "Exploration spends navigator-controlled research cost and crosses material gates; explicit per-opportunity trigger only - never auto-fired on qualify."
# Phase 265-04 reward-before-investment declaration (blocking-gate auto-fix, not
# the dedicated ~85-command backfill phase named in docs/reward-before-investment-rule.md).
# Grounded in the shipped chain below: the four analysis legs (web evidence, timing,
# analogs, demand validation) run and their findings are visible at the material filing
# gate as a structural preview of the Minto-shaped explored artifact, before the
# navigator invests in the approve verb that actually files it.
interactive_first_reward: schema_preview
serves_jtbd: ["explore"]
teaching: "A qualified opportunity is still conceptual: a connection without a defined problem. /mos:explore-opportunity runs the analysis chain (deep research, diffusion timing, analogies, web validation) and files a Minto-shaped explored artifact - a governing thought backed by cited sources and typed graph evidence. Opportunities must be researched and explored to become well-defined problems; this is that step, and its cost stays in your hands."
allowed-tools: Read Bash WebSearch WebFetch AskUserQuestion
# --- Phase 219-05 connector frontmatter (born-wired, Canon Part 11 CIRS R1 / D-10) ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: deep_research
  sub_mode: explore-opportunity
  framework: null
  posture: hold
  hierarchy_rank: 5
  filing: none
  plan_gated: true                 # rides the sanctioned deep_research exception (D-07)
  web_scope: green
  surface: F.1
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:explore-opportunity -- The Explored-Stage Analysis Chain

> The EXPLICIT [Explore] action on a QUALIFIED opportunity (REQ-4). It NEVER auto-fires on
> Qualify (navigator cost control, T-219-18): you trigger it per opportunity, and material
> steps halt at real gates (Canon Part 3). The output must read as ANALYZED - a governing
> thought with cited web sources and typed graph evidence, never a candidate one-liner.

## How It Works

The chain composes through the SHIPPED machinery only (D-06): framework names resolve to
registry commands via `lib/workflow/command-resolver.cjs::composeWorkflow` (zero hardcoded
slugs; a framework with no command degrades honestly to a manual step), and
`lib/core/chain-executor.cjs::runChain` is the one gated loop. The entry point is
`lib/core/eureka/explore-chain.cjs::exploreOpportunity(roomDir, opportunityNodeId, opts)`.

The four analysis legs, in order:

| Leg | Framework (registry-resolved) | What it contributes |
|-----|-------------------------------|---------------------|
| deep_research | Hypothesis-Driven Problem Solving | web evidence via the FROZEN deep_research reach (generic handles only, Part 8; the framework-runner's existing egress chokepoint - never a raw fetch) |
| diffusion_timing | Adoption-Capacity Theory | is the window open? (current Track-1-unrewired form, D-07) |
| analogies | Four Lenses of Innovation | analog domains that solved this shape of problem |
| web_validation | Jobs to Be Done (JTBD) | demand validation against the customer segment |

### How the four legs dispatch, and what bounds the cost

The four legs are analytically INDEPENDENT: each is a separate framing of the same fixed
opportunity node (web evidence, timing, analogs, demand validation). No leg consumes another
leg's output for its own analysis -- the `prev` parameter threaded through `onStep` carries
provenance plus the offline-degrade and engine_mode stamping, not analytical input. Because of
that independence, three of the four legs now run **in parallel**: `diffusion_timing`,
`analogies` and `web_validation` fire concurrently, because there was never a data dependency
between them to begin with (`lib/core/eureka/explore-chain.cjs::runAnalysisLegsParallel`,
Phase 265-18). `deep_research` still runs FIRST, alone, as a probe.

**The cost guard -- read this before assuming parallel means "spend everything".** The
sequential chain's `quality_early_stop` (`lib/core/chain-executor.cjs::runChain`) used to end
the run the moment a step returned LOW quality, which meant a cold `deep_research` leg
returning `insufficient_evidence` never spent the other three legs, honoring this command's own
`hitl_why` commitment that "Exploration spends navigator-controlled research cost." Parallel
dispatch has no "early" left to stop at once three legs are already firing together -- so the
guard did NOT get dropped, it moved one step earlier: `resolveExploreCostPolicy` decides the
mode and `probeClears` evaluates the `deep_research` probe leg with the EXACT SAME quality test
`quality_early_stop` applied, and the remaining three legs are dispatched only when the probe
clears. Plainly: a cold corpus still costs one leg, not four.

**The override.** `EXPLORE_COST_MODE` picks the mode: `cost-conscious` (the default) runs the
probe-first guard above; `all-legs` skips the probe and fans all four legs concurrently
unconditionally. An unrecognized value falls back to `cost-conscious` -- a typo can never select
the more expensive path. `EXPLORE_PARALLEL=0` is the operator escape hatch: it forces the
original sequential `runChain` path regardless of cost mode.

**The fallback, never silent.** If the parallel pre-pass throws, if the engine is absent (the
D-20 OFFER below), or if `EXPLORE_PARALLEL=0`, the run falls back to the existing sequential
`runChain` path and reports exactly which path ran and why in the `dispatch` key of
`exploreOpportunity`'s return (`{mode: 'sequential'|'parallel', reason, ...}`).

**What did not change.** The material filing step still runs through `runChain` with its
unchanged `gateFn`, so filing still halts for your approve verb and nothing files without it.
`lib/core/chain-executor.cjs` has zero diff, and the Phase 264 zero-diff gate in
`tests/run-all-264.sh` (base SHA `c7c33eea449f6f227c4cfbb86f220acaac9b5ab8`) still passes.

The navigator settled parallelizing these legs as `build-now-in-265` (265-04 Task 3); the build
landed in Phase 265 plan 265-18. This is an in-process `Promise.all` fan-out inside
`lib/core/eureka/explore-chain.cjs`, not a subagent dispatch, so this command needs no `Task` /
`Agent` grant in its `allowed-tools` for it.

Then the MATERIAL filing step halts at the gate. On your approve verb:

1. **Research corpus artifact (D-16 item 1):** files nested as
   `research/<dated-slug>/<dated-slug>.md` with frontmatter (date, url-cited sources with
   accessed dates, topic handles) and registers as a `memory_artifact` graph citizen.
2. **Minto explored artifact (D-08):** governing thought + SCQA + MECE sections + citations,
   validated by `feynman-minto-invariants` BEFORE filing, nested per Decision 16 at
   `opportunity-bank/<section>/<name>/<name>.md` (real domain-slug section, 216 contract);
   re-exploration updates in place via the `problem_hash` dedup.
3. **Graph wiring:** >=2 typed evidence edges (SUPPORTS/INFORMS), lifecycle + stage advance
   to `explored` through `advanceOpportunityStage` (D-17 append-only stage_history).
4. **Post-filing extraction (D-16 item 2):** the 218 extractor runs scoped to exactly the
   new artifact paths (`opts.paths` seam - never a full-room re-extract); extracted entities
   land proposed with DERIVED_FROM edges to the artifact node. The research is graph-visible
   to ALL engines at filing time.

## Offline Degrade (D-16 item 3)

When the web leg is unavailable, the chain queries the room's OWN research corpus
(tri-modal retrieval scoped to `research/` artifacts) with the step provenance
`web: absent (room-corpus degrade)` and the run typed `web_degraded_local_fallback`.
A COLD corpus returns `insufficient_evidence` with zero fabricated results and files
nothing - never a crash, never a silent skip (D-19).

## D-20: The Engine-Unavailable Offer

When a chain step's engine cannot run (probe failures beyond the graceful rungs, crash,
missing substrate), the chain HALTS at a gate OFFERING **[LLM manual run (high effort)]**:
the model performs the analysis directly via the frozen deep_research reach + native web
tools (same Part 8 handles). NEVER the default, NEVER a silent substitution (the corepower
lesson). Manual output carries `engine_mode: llm_manual_baseline` in the run trace and every
filed artifact's frontmatter, and is EXCLUDED from calibration sets by that marker.

Test seam: `MINDRIAN_FORCE_ENGINE_ABSENT=1`.

## What This Command Does NOT Do

- It does NOT fire on Qualify. Qualification (`/mos:qualify-opportunity`) and exploration
  are SEPARATE material decisions; a qualified opportunity waits until you explicitly
  explore it.
- It does NOT explore candidates. A non-qualified opportunity is refused with
  `not_qualified` - the human gate always precedes the spend.
- It does NOT mint sub-rooms. A promoted opportunity graduating to its own workspace is a
  follow-on (D-21: sub-room minting is out of v1 scope).

## Canon Compliance

- **Part 3**: the autonomous_safe prefix runs; filing is material and halts at the gate.
- **Part 8**: the web legs carry generic handles through the existing audited egress
  chokepoint; all graph writes are LOCAL room.db via navigation.cjs.
- **Part 9**: extracted entities land `proposed`; only human confirms promote.
- **Part 11 (CIRS)**: born WIRED - explicit surface, hitl_shape F.1 declared above.
- **Part 12**: the explored artifact teaches the analysis, not just the verdict.
