---
layer: graph
status: active
canon_parts: [7, 8, 11, 12]
implementing_phase: 346
sibling_contract: docs/LAYER-DECLARATION-CONTRACT.md
---

# The Arbitration Contract

This document is the durable half of Phase 346 (the arbitration node). `.planning/` is
gitignored (`.gitignore:97`), so every decision this phase makes that lives only in a
`PLAN.md` evaporates at the next machine switch. This file is the tracked survivor: the
naming fence, the three axes, the result struct, the ranking, the floors, the Tri-Polar
statement, the layer declaration and the working-decision ledger all live here, not in
`346-01-PLAN.md`.

## Why this contract exists

On 2026-07-02 a WATCH item named "less like Larry" caught a real regression: two
independent conversation-time loops, an enforcement loop (the Stop-hook gates that block
or warn) and a judgment loop (the persona/mode ladder that decides how Larry teaches),
each healthy on its own dashboard, fighting like two thermostats in one room. The
founding source is the graph-engineering note at `5189:5238`, cited via
`346-LANGTALKS-CONSULT.md`: an arbitration node decides trade-offs by context instead of
optimizing one metric. The consult itself names an assumption this phase carries rather
than hides: persona-conditioned posture arbitration (role_blend, JTBD, problem-type rung,
escape-hatch phrases, stall count, surface capability, feeding a teach-versus-deliver and
a guided-versus-autonomous read) is MindrianOS doctrine from the `larry-personality`
skill, not corpus evidence. The corpus has no source that evaluates an arbiter; the
replay eval against the WATCH transcript set is this phase's own design.

## The naming fence

The word `posture` is already bound three times in this codebase and drift-tested. This
document names all three bindings so a fourth is never minted by accident:

1. `sensor-types.POSTURE_IDS` = `push_forward` / `hold` / `pull_back`, the Hierarchical
   Navigator / Usher-cycle read, asserted EXACTLY 3 (no more, no fewer) by
   `tests/test-posture-ids-drift.cjs`.
2. `recipe-maps.postureForCommand(command)`, "the ONE registry posture authority."
3. `stance-state.STANCES` = `['research', 'tell-act', 'ask', 'redteam']`, the SEED-042
   4-pole manual override dial. `lib/core/stance-state.cjs:8-23` already fought and
   settled this exact naming fight for its own axis.

The ruling, mirroring `stance-state.cjs`'s own resolution in spirit: the code identifier
for this phase's output is `arbitration` everywhere (module, function, JSON key, event
type, trace field). User-facing prose may still say "posture decision", exactly as the
roadmap's own language reads; only the CODE identifier must avoid the collision. Prose
may still say `posture decision`; code may not use the word `posture` as an identifier.
This phase mints no fourth posture id, and `tests/test-posture-ids-drift.cjs` stays green
for the whole phase as the drift guard.

## The three axes

| Fork (roadmap wording) | Axis name | Closed vocabulary | Resolver |
|---|---|---|---|
| teach versus deliver | `delivery` | `ask_and_hedged \| tell_and_hedged` | `lib/core/decision-axes.cjs` `resolveDecisionMode()`, reused verbatim |
| guided versus autonomous | `autonomy` | `GUIDED \| HYBRID \| AUTONOMOUS` | `lib/core/directive-envelope.cjs` `selectMode()`, reused verbatim |
| enforce versus judge | `enforcement` | `enforce \| judge \| not-applicable` | new, `lib/core/arbitration.cjs` |

Reusing the first two resolvers is a Canon Part 7 requirement (search the surface from
disk and justify net-new before building), not a convenience: both are already pure,
both already never throw, and both already ship their own drift tests.

## The result struct

Every field this phase's resolver emits is a closed-enum token, a number, or an array of
those. No prose, ever, mirroring the discipline `navigation-engine.cjs` already enforces
on the reach rationale (Part 8: name the reach id and the posture only, never a
user-derived value).

The literal field list: `arbitration_version`, `delivery{value,rationale}`,
`autonomy{value,rationale}`, `enforcement{value,rationale}`, `ranked`, `inputs_read`,
`inputs_missing`, `floors_applied`.

## The ranking

The order is frozen in v1.0: `enforcement`, `delivery`, `autonomy`, highest precedence
first. An enforcement decision can short-circuit the whole turn (a Stop hook can block
it); how the answer is phrased cannot. A future phase may make the order
context-dependent; this one does not.

## The floors, and what they are not

Three floors, and none of them is ever an input to the arbiter:

- **Part 8 Brain-egress** (`scripts/part8-egress-guard-hook.cjs`). LOCAL data never
  egresses to the Brain; this is constitutional, never a weighted signal.
- **The write-scope / room-binding check.** Data-boundary and security, not persona.
- **No fabricated numbers** (Canon Part 5 evidence bar).

The Part 12 voice glyph is a SPLIT, not a single rung: a doctrinal floor (Larry always
wears one) AND an observational `declared` rung (the harness logs, never blocks). Nobody
promotes the rung in this phase; promotion is a one-line human edit to the policy file,
made only after reading `evaluatePromotion`'s verdict.

## Tri-Polar (ARB-14)

One row per `CAPABILITY_MAP` surface (`lib/mcp/surface-detect.cjs`), read live rather
than hand-typed:

| Surface | `hooks` | Enforcement axis reports | Why |
|---|---|---|---|
| `cli` | true | live (`enforce` or `judge`) | The enforcement loop exists: `check-card-fire.cjs` and `check-voice-style.cjs` run on the Stop hook. |
| `desktop` | false | not-applicable | `check-card-fire`, `check-voice-style` and `intent-classifier` never run there; there is no enforcement loop to arbitrate. |
| `cowork` | false | not-applicable | Same reason as desktop: `CAPABILITY_MAP.cowork.hooks` is false. |

The arbiter is active on one surface and honest on two. It never emits a value for a loop
that is not there.

## The layer declaration (ARB-15)

`layer: graph`, converging on three independent sources: the langtalks consult's
`Arbitration node --part_of--> Graph engineering` edge; the input spec's own filing of
the arbitration node as a GRAPH gap and Phase 346 as its owner
(`docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md:83,85`); and the 2.6 decisive signal at
`:88` ("if the agent can check its own output, loop; if an independent reviewer node
must, graph"). The arbiter exists precisely because two loops each pass their own
dashboard; it is the independent reviewer node.

The counter-argument, answered in writing: the arbiter attaches to `decide()`, which
fires once per turn, which looks like a loop-layer cadence. Cadence is not scope:
`decide()` itself is already filed under GRAPH in the same map
(`docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md:81`). Declaring `graph` is consistent
with its host. Per WD-6 of the layer contract, this document declares the ONE rung it
engineers, never the highest rung it transitively rests on.

## The disclosure rule (WD-3)

Disclosure is flip-only: a change from the prior turn's value on any axis surfaces one
short line; a hold stays silent. This reconciles three doctrines at once: arbitration
rule 7 forbids a silent posture change; Part 12 demands invisibility; Phase 210 item B
removed the every-turn footer and replaced it with "offered when genuinely relevant,
never forced." Flip-only is the only rule that honors all three.

## Working decisions, reversible by the navigator

This table, not `346-01-PLAN.md`, is the durable home for these thirteen decisions,
because `.planning/` is gitignored and a decision recorded only in a plan evaporates at
the next machine switch. Every row is Claude's working call, adopted so planning could
proceed without stopping for a ruling; each is a one-line edit to overturn.

| # | Decision | Why | Source | Status | Reverses by |
|---|---|---|---|---|---|
| WD-1 | The code identifier is `arbitration` everywhere: module, function, JSON key, event type, trace field. Prose may still say "posture decision". | `posture` is bound three times and drift-tested to exactly 3 values (`tests/test-posture-ids-drift.cjs`); `stance` is bound to the 4-pole manual dial (`stance-state.cjs:46`). `stance-state.cjs:8-23` already fought and settled this exact fight. | 346-RESEARCH.md "Naming: do NOT call it posture" | WORKING | renaming the module and its exports |
| WD-2 | The Part 12 glyph is recorded as a SPLIT: a doctrinal floor (Larry always wears one) AND an observational `declared` rung (the harness logs, never blocks). Nothing is promoted in this phase. | The consult and CLAUDE.md:57 both say floor; `check-voice-style.cjs:16-18` never blocks; `voice-glyph-present.json` sits at `declared` with an honest note. All three are right about different things. Promotion needs a reviewed evidence window per `_schema.json`, and this phase has none. | Navigator instruction (1); 346-RESEARCH.md Open Question 1, Pitfall 4 | WORKING | a one-line `rung` edit in the policy file, after reading `evaluatePromotion`'s verdict |
| WD-3 | Disclosure is flip-only: a change from the prior turn's value on any axis surfaces one short line; a hold stays silent. | Arbitration rule 7 forbids silent posture change; Part 12 demands invisibility; Phase 210 item B removed the every-turn footer and replaced it with "offered when genuinely relevant, never forced". Flip-only is the only rule that honors all three. | Navigator instruction (2); 346-RESEARCH.md Pitfall 3 | WORKING | changing the flip predicate in `lib/core/navigation/arbitration-log.cjs` |
| WD-4 | Tri-Polar: the resolver is a pure `lib/core/` function reachable on all three surfaces through `fusion-router`/`decide()`. The `enforcement` axis reports `not-applicable` where `CAPABILITY_MAP` says hooks are absent (Desktop, Cowork), never a fake value. The arbiter is honest on two surfaces and active on one. | `CAPABILITY_MAP` (`surface-detect.cjs:22-26`) gives `hooks: false` for desktop and cowork, so `check-card-fire`, `check-voice-style` and `intent-classifier` never run there. The enforcement loop the arbiter arbitrates does not exist on two of three surfaces. Emitting `enforce` or `judge` there would be a documented lie. | Navigator instruction (3); 346-RESEARCH.md Open Question 3 | WORKING | adding a fourth enforcement value or CLI-gating the module |
| WD-5 | The arbiter gets its own harness policy file at rung `declared` with `runner: null`, with its `promotion_rule` authored before any evidence exists. | The `voice-backend-noun-free.json` honest-ghost precedent. Declaring at `logged` before a human has read a window is exactly the T-233-04 / T-217-01 defect class `_schema.json`'s counting rule exists to prevent. | Navigator instruction (4); 346-RESEARCH.md Open Question 4 | WORKING | a one-line `rung` edit plus a real runner path |
| WD-6 | Stall count is NOT produced here. Until Phase 345 ships it, the input is `null` and the resolver treats `null` as no signal, never a fabricated zero. It appears in `inputs_missing` at runtime. | Phase 345 owns the stall signal (`ROADMAP.md` Phase 345 deliverable 1). No producer exists today (`grep -rni "stall"` across `lib/`, `scripts/`, `data/` finds none). | Navigator instruction; 346-RESEARCH.md Gap 2 | WORKING | wiring 345's producer onto `ctx.arbitration_inputs.stall_count` |
| WD-7 | The escape hatch is fed on Claude Code by a new, small, explicit detector in `lib/core/arbitration.cjs` matching exactly the two phrases already doctrine in `skills/larry-personality/SKILL.md`: "just tell me" and "bottom line". | `selectMode`'s highest-precedence rule (`directive-envelope.cjs:42-44`) is fed by nothing on the CLI path: the only producer is `mcp-server-brain/lib/brain-ask.cjs:331`, a different server. The rule Larry's own skill calls non-negotiable currently never fires on Claude Code. | Navigator instruction; 346-RESEARCH.md Gap 1 | WORKING | widening or narrowing the phrase set in one exported const |
| WD-8 | The requirement prefix is `ARB`, sixteen ids, one family. | Verified free: `grep -rn "ARB-0\|\bARB\b" .planning/REQUIREMENTS.md .planning/ROADMAP.md` returns zero hits; no second requirement namespace exists. | 346-RESEARCH.md Phase Requirements; A4 | WORKING | a family-wide rename before execution starts |
| WD-9 | `layer: graph`. The counter-argument (the arbiter fires once per turn, which looks like loop cadence) is answered in writing: cadence is not scope, and `decide()` itself is already filed under GRAPH in the same map. | Three independent sources converge: the consult's `Arbitration node --part_of--> Graph engineering`, `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md:83,85`, and the 2.6 decisive signal at `:88`. | 346-RESEARCH.md "The layer: declaration"; A3 | WORKING | one frontmatter value in `docs/ARBITRATION-CONTRACT.md` |
| WD-10 | Three files this phase must touch are also listed in a Phase 344 plan: `.planning/REQUIREMENTS.md` (344-01, 344-09), `.planning/ROADMAP.md` (344-09) and `data/harness-manifest.json` (344-02). They are touched anyway, because minting requirements, closing the roadmap entry and regenerating the manifest after adding a policy file are all unavoidable. Everything avoidable is avoided: this phase touches no `commands/*.md`, no `agents/*.md`, no `skills/*/SKILL.md`, no `data/command-registry.json`, and no `docs/OPEN-HANDOFFS.md`. | Phase 346 cannot execute until `data/layer-declaration-schema.json` exists, which is Phase 344-01's output, and the roadmap chain is 344 -> 345 -> 346. By execute time 344 has closed, so these are sequential edits, not concurrent ones. Each is an append or a regeneration, never a rewrite of a LAYER row. | Planning-context repo facts; ROADMAP.md Phase 346 "Depends on: Phase 345" | WORKING | splitting the requirement mint into a tracked side file |
| WD-11 | The catalogue's row count (12 conversation-time rules) is a measured census, stated with the command that produced it, never a frozen contract number. The test enumerates from `hooks/hooks.json` at run time. | The `gate_count_principle` in `data/harness-policies/_schema.json` and the `surface_count_principle` idiom 344-01 copies. A frozen literal would go stale the first time a hook entry is added. | 346-RESEARCH.md catalogue Tier A/C | WORKING | pinning a literal in the test (do not) |
| WD-12 | The ranking is a frozen order in v1.0: `enforcement`, `delivery`, `autonomy`, highest precedence first. An enforcement decision can short-circuit the whole turn (a Stop hook can block it); how the answer is phrased cannot. A future phase may make the order context-dependent; this one does not. | The roadmap asks for "a single ranked decision per turn". A fixed, stated, testable order is honest; a computed order with no evidence behind the weights is not. | 346-RESEARCH.md "The result struct" | WORKING | making `RANKED_ORDER` a function of the inputs |
| WD-13 | The cold-start floor is unoverridable by every arbiter-derived input (role_blend, JTBD, problem-type rung, stall count, surface) and overridable ONLY by the explicit user escape hatch. | `selectMode` puts the escape hatch at rule 1, above the cold-start force at rule 2, and it is reused verbatim per Canon Part 7. Arbitration rule 7 says the user is the only helm. Re-ordering a shipped ladder would be minting a second ladder, which is the violation this phase is curing. | `directive-envelope.cjs:42-49`; `skills/larry-personality/SKILL.md` rule 7; 346-RESEARCH.md "The hooked-model first-step constraint" item 2 | WORKING | re-ordering `selectMode` (do not) or adding a post-hoc clamp above it |

## What later plans in this phase land

This document is authored by `346-01-PLAN.md` alongside `.planning/REQUIREMENTS.md`
(ARB-01..16) and the phase's test aggregator. The code this document describes lands in
later plans in the same phase: `lib/core/arbitration.cjs`,
`lib/core/navigation/arbitration-log.cjs`, `data/arbitration-rule-catalogue.json`,
`data/harness-policies/gate-arbitration-decision.json`,
`tests/fixtures/346-watch-incidents.json`, and the remaining `tests/test-346-*.cjs`
files. `tests/run-all-346.sh` names every one of them as a guarded leg from day one.
