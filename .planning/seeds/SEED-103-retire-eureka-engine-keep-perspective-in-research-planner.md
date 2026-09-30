---
id: SEED-103
status: dormant
priority: high
planted: 2026-10-01
updated: 2026-10-01
planted_during: "the 2026-10-01 Eureka rethink (ICM system-map + architecture review + Phase 355 record), after the navigator's steer that Eureka may be redundant with the MCP-based mos:canvas layer"
trigger_when: "at the discuss step of Phase 363's successor (the MOS-CANVAS perspectives wave), or before any new Eureka engine work, whichever comes first"
scope: "medium (two small stage modules writing run-folder files; one question template in the research planner; retire the standalone runner behind the spike's answer; the semantic-index split stays its own phase)"
depends_on: [Phase 363 research planner (20/22 plans executed), SEED-099 step 1 guards, the runtime-Jev ruling]
feeds: [Phase 363 successor, SEED-097 MOS-CANVAS perspectives, SEED-099, SEED-100, SEED-101]
supersedes: "SEED-100 as planted (the spike is re-framed in section 9 of the design)"
canon_parts: [7, 8, 9, 10, 12]
evidence: ".planning/REVIEWS/2026-10-01-eureka-v2-design.md"
navigator_steer: "2026-10-01: Eureka might be redundant; the better approach is to do the MCP-based mos:canvas layer properly with Jev and research."
---

# SEED-103: Retire Eureka as a standalone engine; keep it as a MOS-CANVAS perspective inside the research planner

**Governing thought:** Phase 355 measured today's engine at 43 of 96 useful (44.8%), direction
right 16 of 96, Theo not asked for 80.2% of pairings, and 45 of 96 pairings already known to the
navigator. Phase 363 built the one plan-and-run engine and lists Eureka as a perspective that
contributes questions, a lens and a falsifier. So the standalone Eureka runner (all-pairs, AHP
composite, its own report, its own ambient scorer, its own filer) is redundant. What survives
is bounded local **recall** of cross-domain pairs with the room graph as the exclusion set,
**Jev** as the human-routed first-pass judge and citation checker, and the planner doing
research, prose and filing. Full design, measured facts, ADRs E12-E16 and the spike are in the
evidence document.

## Build this, in order

1. SEED-099 step 1 (guards, `--offline` stops the Haiku pre-step, `--no-extract` forwarded).
2. Two stage modules, `substrate` and `recall` (lexical lane, optional vector lane, known-pair
   exclusion, hard cap), writing `things.jsonl` and `candidates.jsonl` into the planner's run
   home. Old runner untouched, behind a flag.
3. The spike (design section 9): same three 355 fixture rooms, same blind protocol, bar fixed
   before the run: useful rate above 44.8% with a Wilson interval that clears it, three repeats.
4. Eureka question template in `question-templates.cjs`; `/mos:eureka` becomes a quick-run
   alias; the standalone runner retires per the spike.
5. Runtime Jev ruling and the one egress policy file (ADR-E15, E16).
6. Semantic-index split (ADR-E12), its own phase.

## Acceptance

- [ ] A quick run with the Eureka template completes with `--offline` (Stage A only, plan not sent).
- [ ] No candidate pair whose endpoints are already joined by a room edge, or already the evidence ids of an existing `opportunity` node, reaches stage 03.
- [ ] `candidates.jsonl` carries per-lane counts and `pairs_truncated`; no all-pairs code path remains on the live route.
- [ ] Every Jev verdict carries the band from `confidenceFromBucket`; at `medium` every verdict is human-routed.
- [ ] Filing goes only through `navigation.writeOpportunityNode` (D-36..D-40), proposed-only, F.8 gate.
- [ ] `commands/eureka.md` no longer claims "ZERO writes" or "ZERO network"; the egress policy file lists every line.
- [ ] The spike record exists with the 44.8% comparison and the bar stated before the run.

## Decisions the navigator owns

1. Retire the standalone engine (this seed's premise)?
2. Runtime Jev under the planner's grant and audit ledger, or dev-time only?
3. Entity pre-step: a planner egress line, or a separate producer?
4. Label the spike rooms?

## Shipped 2026-10-01 on branch `seed-103-eureka-perspective` (worktree, not yet merged)

Steps 2 and part of 4 of the build order, plus the model routing the navigator asked for:

- `lib/core/research-planner/perspectives/eureka-recall.cjs`: stages 01 substrate and 02 recall from
  the local graph and the ICM structure (lanes shared_entity, lexical, icm_declared from per-section
  `CONTEXT.md` Inputs), the room graph as the exclusion set, a hard cap with `pairs_truncated`,
  files as edit surfaces, `STATUS.md` derived, a `canon_resolved` count per run (Theo readiness),
  and the question set the planner consumes. No embeddings, no model, no network.
- `lib/core/research-planner/perspectives/eureka-judge.cjs`: stage 03, Stage A gates plus an
  injected `judgeFn`; the band comes from the measured Phase 355 bucket (73 of 96, `medium`, human-routed).
- `question-templates.cjs` gains the `eureka` template (`/mos:eureka` door); `families.cjs` gains
  the `eu.transfer` (ce.pair + ce.counter) and `eu.known` lenses.
- MCP `research_run` gains ops `eureka_recall` and `eureka_judge` (judge `none` on that surface).
  CLI door gains `eureka-recall` and `eureka-judge`. `scripts/eureka-jev-judge.cjs` is the dev-time
  Jev first pass (D-44 honored: nothing under lib/ or hooks/ references the Jev client).
- `lib/core/claude-routing.cjs`: the one home for Claude model ids under lib/. Every lib caller of
  api.anthropic.com (entity classifier, MVA classifier, name suggester, edge derivation, briefing,
  wiki chat) routes through it; default alias opus for every role (the claude-api rule), per-role
  effort, env overrides `MINDRIAN_MODEL_<ROLE>` / `MINDRIAN_EFFORT_<ROLE>`; request shapes follow
  the model generation (no sampling params on 5.x, effort only there). A tripwire test forbids any
  other hardcoded `claude-*` id under lib/.
- Tests: `tests/test-seed103-claude-routing.cjs`, `tests/test-seed103-eureka-perspective.cjs`
  (31 checks, hermetic), aggregator `tests/run-all-seed103.sh` (20 legs green on 2026-10-01).
- Measured on a copy of a real 798-node room: 51 things across 9 sections, 47 candidates, top pairs
  problem-definition <-> research and competitive-analysis <-> solution-design; canon_resolved 0.

Still open (unchanged): the runtime-Jev ruling, the Haiku entity pre-step as a planner egress line,
the spike with the navigators
