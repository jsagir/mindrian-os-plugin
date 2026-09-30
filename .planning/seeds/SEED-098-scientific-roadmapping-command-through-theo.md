---
id: SEED-098
status: promoted
promoted_to: "Phase 364 (2026-09-30, commit 4c43ce167; /mos:scientific-roadmap, planning input 364-INPUT.md)"
priority: high
planted: 2026-09-27
updated: 2026-10-01
planted_during: "quick task 260927-vfu (live Theo check of Scientific Roadmapping), after the Phase 355.1 close-out"
trigger_when: "when SEED-097's Theo-side authoring requirement passes its acceptance check (framework_step returns non-null label and runIt for all 7 steps on the hosted endpoint through the guarded shim), or when SEED-097's discuss-phase schedules the Scientific Roadmapping perspective fixture, whichever comes first"
scope: "medium (one new methodology command binding three existing ones, its connector and HITL declarations, a mid-journey entry resolver over navigation.cjs reads, fixtures; no new engine, no parallel roadmap implementation)"
depends_on: [SEED-097 Theo-side authoring requirement]
feeds: [SEED-097 Scientific Roadmapping perspective]
canon_parts: [3, 7, 8, 9, 11, 12]
navigator_ruling: "2026-09-27: NR-1 binds find-bottlenecks/dominant-designs/explore-futures as inputs rather than duplicating them (still a new command, constraint-first); NR-2 the command is enterable mid-journey from local room state via navigation.cjs, distinct from and never colliding with explore-opportunity; NR-3 consistent with Theo's Scientific Roadmapping FEEDS_INTO/COMPLEMENTS Hypothesis-Driven Problem Solving edges."
---

# SEED-098: /mos: Scientific Roadmapping through Theo - a constraint-first command that binds find-bottlenecks, dominant-designs and explore-futures and can be entered mid-journey

## Why This Matters

Scientific Roadmapping lives in Theo (SEED-097's Live Theo check measured 7 steps, 12
techniques and the 7-to-1 LEADS_TO loop live in production), but no /mos: command
USES_FRAMEWORK it (commands [] on the live framework_neighborhood check), and no plugin
surface names it anywhere (planner grep across commands/, agents/, skills/, pipelines/,
lib/, data/, 2026-09-27, zero hits). The navigator's research-builder reading needs a
governed way to turn a valuable-but-disputed goal into falsifiable constraint questions.
Without a command, the perspective is reachable only as ad-hoc conversation, never as a
filed, reviewable, born-wired run.

## The flow (constraint-first)

goal -> rung -> paths -> limiter ledger -> assumed constraints become falsifiable
questions -> catalytic ranking, mapped onto Theo's seven steps: 1 TENSION, 2 QUANTIFY,
3 RUNG, 4 FORUM, 5 ENUMERATE, 6 INTERROGATE, 7 RANK, and the 7-to-1 re-survey loop. Reuse
SEED-097's seven-operations artifact table by reference; do not copy it here. Keep
SEED-097's rules: preserve `unresolved` when no derivation or decisive test exists; never
infer an assumption is false because it has not been proved fundamental; preserve
rejected routes and reasons; step content comes from Theo's typed framework_step, never
from model memory.

## Locked navigator ruling (2026-09-27)

NR-1, NR-2 and NR-3 below are LOCKED. Discuss-phase implements them; it does not
re-decide "new command vs extension" (NR-1 already settled that).

### Binding, not duplicating (NR-1, Canon Part 7 reuse before build)

| Existing surface | What it already does (from its frontmatter) | Which Theo step it feeds | What it lacks that this command adds |
|---|---|---|---|
| find-bottlenecks | Reverse Salient Analysis, hitl_shape F.8, produces room/**/reverse-salients/* | INTERROGATE (a reverse-salient limiter enters the ledger as a claimed bound to classify fundamental / assumed / unresolved) | Quantified goal, path enumeration, limiter classification, a discriminating test, catalytic ranking |
| dominant-designs | Dominant Design, hitl_shape F.1, Phase 361 approved-query research mode (approved-query gate card plus per-lane researcher fan-out) | ENUMERATE (competing variants as candidate routes) and QUANTIFY (current design performance as baseline); its approved-query gate card plus researcher fan-out is the template for any research pass inside INTERROGATE | Constraint ledger and falsifiable questions |
| explore-futures | Scenario Planning, hitl_stages build-path F.2 ordered then ordered-projection F.9 ordered, produces room/**/futures/* | QUANTIFY (time horizon, S-curve position) and ENUMERATE (scenarios as uncovered regions) | Limiter interrogation and unlock ranking |

Binding means reading these three commands' already-filed artifacts through
`navigation.cjs`, or offering to run the existing command at its own gate, never
re-implementing their logic. The exact per-step binding contract (read a filed artifact
versus invoke at gate) is settled at discuss-phase. Why this is still a new command: its
question, output and falsifier differ from all three (SEED-097 V1, independent strategic
pathways), and extending find-bottlenecks would merge the RS and Scientific Roadmapping
perspectives that SEED-097 deliberately keeps independent.

## Mid-journey entry (NR-2)

An entry resolver reads LOCAL room state only, through `lib/core/navigation.cjs` (graph
neighborhoods, opportunity nodes and their stage_history, filed reverse-salients /
dominant-designs / futures artifacts, prior Scientific Roadmapping runs under research/),
and proposes an entry step.

| Room state found | Proposed entry step | Why |
|---|---|---|
| Fresh goal, no room state | 1 TENSION | Nothing to place on a rung yet; qualify the tension first |
| Stated goal without baseline/unit/horizon | 2 QUANTIFY | The goal exists but is not yet falsifiable |
| Quantified goal present | 3 RUNG | Baseline/unit/target/horizon already satisfy step 2 |
| A dominant-design read or futures scenario present | 5 ENUMERATE (after QUANTIFY is satisfied from them where possible) | Existing variants/scenarios are candidate routes already on file |
| An existing RS / bottleneck finding | 6 INTERROGATE, with that limiter as the first ledger row | A claimed bound already exists; classify it rather than re-deriving it |
| A hypothesis already in flight (an explored opportunity, or a Hypothesis-Driven Problem Solving output) | 6 INTERROGATE on the limiter the hypothesis depends on | The hypothesis names its own dependency; test it as a limiter |
| A prior run plus new evidence, or a solved bottleneck | 7-to-1 re-survey (step 1 with the prior ledger) | Rejected routes reopen only on changed evidence |

Rules: the proposal is shown at an entry gate (F.1) and the navigator may override to
step 1; skipped steps are recorded as not_run with the room artifact that stands in for
them as provenance, never fabricated; missing upstream artifacts are disclosed as
`context_insufficient` and unlock claims at RANK stay provisional until QUANTIFY exists;
nothing read here crosses to Theo (only the framework name and step ids are requested).

### No collision with /mos:explore-opportunity

explore-opportunity is the existing hypothesis-driven start and owns the
qualified-to-explored transition (`advanceOpportunityStage`, append-only stage_history;
refuses `not_qualified`; never auto-fires). This command never advances an opportunity's
stage, never auto-runs explore-opportunity, and files its run under research/ linked to
the opportunity by typed evidence edges. Distinct triggers: this command's fresh start
requires a valuable goal with disputed feasibility (TENSION qualification); a qualified
opportunity awaiting exploration stays with explore-opportunity. When both apply (a
qualified opportunity whose feasibility is disputed), the gate offers both and the
navigator picks; neither fires automatically.

### Consistency with the Hypothesis-Driven Problem Solving edge (NR-3)

Theo has Scientific Roadmapping FEEDS_INTO and COMPLEMENTS Hypothesis-Driven Problem
Solving (SEED-097 Live Theo check). Consistent direction: this command's falsifiable
project questions are offered to explore-opportunity (whose deep_research leg is
Hypothesis-Driven Problem Solving) at its own gate. Reverse direction (re-entry from a
hypothesis in flight) is treated as the COMPLEMENTS relation plus the 7-to-1 loop, not a
FEEDS_INTO reversal; whether Theo needs an explicit Hypothesis-Driven Problem Solving to
Scientific Roadmapping edge is ruled in SEED-097's Theo-side authoring requirement item 3,
together with D2.

## Born WIRED (Canon Part 11 / CIRS)

The command ships only born wired or it does not ship.

(a) **HITL declaration.** A proposed `hitl_stages` block, in a fenced yaml snippet, using
only the closed vocabulary and the parallel | ordered | gate modes from
`data/hitl-stages-schema.json`:

```yaml
hitl_stages:
  - stage: "entry-step"
    shapes: ["F.1"]
    mode: "gate"
  - stage: "goal-and-rung"
    shapes: ["F.2"]
    mode: "ordered"
  - stage: "path-enumeration"
    shapes: ["F.4"]
    mode: "ordered"
  - stage: "constraint-interrogation"
    shapes: ["F.8"]
    mode: "parallel"
  - stage: "catalytic-ranking-and-filing"
    shapes: ["F.7", "F.0"]
    mode: "gate"
hitl_why: "An entry-step gate picks up mid-journey; goal-and-rung (steps 1-3) is ordered because each needs the last; path-enumeration (harvest scope, 10X resurvey) is ordered; constraint-interrogation is parallel because limiters are independent; catalytic-ranking-and-filing is a gate where the navigator ratifies rank and files."
```

Labeled proposed; checked by `scripts/check-shape-declaration.cjs`.

(b) **Connector frontmatter** naming the fields the three bound commands use:
`connects_to_spine`, `sensor_triggers`, `reach_id`, `sub_mode`, `framework: "Scientific
Roadmapping"` (matching `frameworks:`), `posture`, `hierarchy_rank`, `filing:
fileEvidenceWithReadback`, `plan_gated`, `web_scope`, `surface`; values set at plan time.
`data/connector-registry.json` rebuilt by `scripts/build-connector-registry.cjs` and green
under `--check`, plus `scripts/build-orchestration-projection.cjs --check` and
`scripts/check-render-coverage.cjs`.

(c) **The gate at ranking/filing** is a Canon Part 3 Tri-Context Decision Gate (APPROVE /
REJECT with reason / DEFER): the human ratifies the catalytic ranking and every limiter
classification before anything is promoted; any external research pass uses the
approved-query gate card before a fetch (SEED-097 open decision 1 governs standing-policy
versus per-query approval).

(d) **Proposed-only claims.** Every ledger row, question and opportunity is written
through `lib/core/navigation.cjs` (`writeOpportunityNode` and typed edges) as proposed;
only a human confirms a truth claim (Part 9); discarded routes become
`REJECTED_BECAUSE` data.

(e) **Part 8.** Only generic handles cross to Theo (framework name, step ids, technique
names, problem-type enum) through the guarded `mindrian-brain` MCP shim
(`bin/mindrian-brain-mcp-client.cjs`, `lib/core/part8-egress-guard.cjs`), never raw theo
tools; the room goal, metric, cohort, path map and limiter ledger stay local.

(f) **Tri-polar.** CLI (`/mos:` command, AskUserQuestion gate cards); Desktop (Larry
recognizes the natural-language "what is really blocking this ambition" ask and runs the
gates via `gate_render` / `gate_answer`); Cowork (shared room state, research/ filing
visible to all members, multi-member FORUM when present, serial solo perspectives marked
provisional otherwise). Any skip is stated, not silent.

(g) **Honest refusal.** While `framework_step` returns null (today), the command refuses
with the measured reason and never improvises steps from model memory.

(h) **Output.** A MOS-CANVAS local envelope with a roadmap/path/constraint `result_kind`
per SEED-097, filed per SEED-097's ICM filing section (research/ holds the run;
opportunity-bank/ gets a concise proposed opportunity; linked, not copied).

## Dependencies and cross-links

Depends on SEED-097's Theo-side authoring requirement (typed steps, provenance, D2/D3
rulings, orchestrationStatus, local/production reconcile). Feeds SEED-097's Scientific
Roadmapping perspective: this command is that perspective's CLI invocation and its
standalone fixture's entry point. Once shipped, Theo adds the USES_FRAMEWORK edge
(authoring requirement item 6). Theo SEED-015 is relevant only if limiter classification
uses a Jev policy, which then needs held-out evaluation per SEED-097.

## Open decisions for discuss-phase

NR-1 removes "new command vs extension" from this list. Remaining:

- Command name (recommend `/mos:scientific-roadmap`; no existing command file collides).
- The per-step binding contract: read a filed artifact versus invoke the bound command at
  its own gate.
- D2 inherited: does a limiter hand off to `/mos:find-bottlenecks`, does an RS finding
  enter at INTERROGATE, or both?
- D3 inherited: well-defined goals - route to a Technical Roadmap once Theo covers
  WellDefined, or reroute?
- FORUM on a solo surface: how a single-navigator session represents the
  insider/entrant/physics perspectives without inventing participants.
- Whether INTERROGATE opens an approved external research child run through the
  SEED-097 research designer.
- Whether limiter classification uses a Jev policy.

## When to Surface

**Trigger:** when SEED-097's Theo-side authoring requirement passes its acceptance check,
or when SEED-097's discuss-phase schedules the Scientific Roadmapping perspective
fixture, whichever comes first.

## Scope Estimate

**Medium.** One new methodology command binding three existing ones, its connector and
HITL declarations, a mid-journey entry resolver over `navigation.cjs` reads, and fixtures.
No new engine and no parallel roadmap implementation.

## Breadcrumbs

- SEED-097 (sections: Scientific Roadmapping through Theo, Live Theo check,
  Theo-side authoring requirement, ICM filing and research-run memory)
- `commands/find-bottlenecks.md`
- `commands/dominant-designs.md` and `agents/dominant-design-researcher.md`
- `commands/explore-futures.md`
- `commands/explore-opportunity.md`, `skills/explore-opportunity/SKILL.md`,
  `lib/core/eureka/explore-chain.cjs`
- `commands/research.md`
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` and `data/hitl-stages-schema.json`
- `scripts/check-shape-declaration.cjs`
- `scripts/build-connector-registry.cjs`
- `lib/core/navigation.cjs`
- `bin/mindrian-brain-mcp-client.cjs`
- `lib/core/part8-egress-guard.cjs`
- `~/MindrianRooms/mindrianOS/methodology/2026-09-27-mos-canvas-scientific-roadmapping-handoff.md`
- The article URL: https://www.essentialtechnology.blog/p/scientific-roadmapping
- `~/Theo/.planning/seeds/SEED-015-judgment-kind-on-the-analytics-seam-theo-as-jev-keyholder.md`

## Promoted to Phase 364 (2026-09-30)

This seed is now Phase 364 (commit 4c43ce167, `.planning/phases/364-*/364-INPUT.md` records the navigator
requirements and the Theo Phase 25 plugin contract). Phase 364 starts after Phase 363 closes; 363-22 writes
the reuse contract below. Step walking still waits on Theo Phase 25 authoring the seven steps.

## Reuse contract from Phase 363 (D-18)

Phase 363 built the engine this command needs. Phase 364 reuses it and builds no second one.

- The engine is `lib/core/research-planner/perspective.cjs`. `describeEngine()` returns the contract
  (`template_id`, `engines`, `operations`, `forum_roles`, `roadmap_types`, `api_version`), and `api_version` is
  1. A command binds to that number; a breaking change to the engine bumps it.
- The template id is `scientific-roadmapping`, registered in
  `lib/core/research-planner/question-templates.cjs`. A plan on that template must carry a perspective
  (`perspective_missing` otherwise) and is gated by its perspective errors: no nameable limiter makes it a wish
  and it does not run.
- The structure comes from `data/research-shape-ledger.json` (built by
  `scripts/build-research-shape-ledger.cjs`, checked with `--check`), never from `framework_step` at runtime and
  never from model memory. The ledger carries step names, order, key questions, gates and technique handles
  only, inside the 2026-09-17 IP ruling.
- A standalone command registers a door on that template: it writes a question set through the question-set
  contract and hands the plan to `/mos:research`, the one governed runner. It adds no second engine, ledger,
  fetcher, cache or approval ledger. Plans are reviewed on the F.6 card, fetched under a grant, and filed
  through the F.8 basket.
- Reuse by require: `perspective.cjs` (buildPerspective, rankByUnlock, nextBindingConstraint, loadSettled,
  srStepGuide, describeEngine), `structure.cjs` for the ledger reads and the local scientific detection, and the
  plan schema in `plan.cjs`. The folder contract and the Part 7 reuse inventory are in
  `lib/core/research-planner/CONTEXT.md`.
- Known limits Phase 364 inherits (see `363-FOLLOW-ONS.md`): the map-unknowns deep plan is `ready` with no
  limiter because the wish gate fires only on the `scientific-roadmapping` template; the restatement heuristic
  is noisy; the `not_scored` refusal from Theo 20.2 must map to `not_ready`.

## Notes

The rethinking-mindrianos room trail entry is filed when this seed is activated at
discuss-phase (no room write in this quick task).
