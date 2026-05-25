---
id: SEED-009
status: dormant
planted: 2026-05-16
planted_during: v1.13.0-beta.18 working tree (active milestone -- "The Closed Loop"; v1.13.1 wave-4 architectural shift design-locked)
trigger_when: |
  Two-part trigger gate. Surface ONLY when BOTH conditions are met:
  (1) Tester cohort grows to >= 30 active users (currently 4 in Wave-1).
  (2) F-selector outcome edge count in aggregated room.db telemetry reaches >= 1000
      events (REJECTED + DEFERRED via Phase 125 D7 + accepted-trajectory edges
      from FOLLOWS_FROM cascade type shipped in Phase 129 per 2026-05-16 verdict).
  Surface during /gsd:new-milestone v1.14.0 scoping OR when /gsd:plan-phase is
  invoked against any v1.14.0 phase that proposes to consume F-selector ranker
  outputs.
scope: large
bundle: learning-loops
canon_parts: [Part 4, Part 7, Part 8, Part 9]
target_milestone: v1.14.0
implementing_phase: TBD (v1.14.0 -- proposes ranker-weight-updater.cjs extension to shipped Phase 125)
related_phases: [125, 127, 129]
related_seeds: [SEED-002]
companion_artifacts: []
authority:
  - .planning/research/2026-05-16-dual-graph-architectural-proposal.md
  - .planning/research/2026-05-16-dual-graph-review-A-canon-compliance.md
  - .planning/research/2026-05-16-dual-graph-review-B-execution-plan-contract.md
  - .planning/research/2026-05-16-dual-graph-review-C-adversarial.md
  - .planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md (verdict-logged section at top)
---

# SEED-009: Learned ranker weights from outcome edges (the deferred half of the 2026-05-16 dual-graph verdict)

## Why This Matters

The F-selector ranker (Phase 125, shipped v1.13.0-beta.14 at `lib/workflow/f-selector-ranker.cjs:47-52`) scores next-move candidates with hardcoded ensemble weights: `0.40 * brain_confidence + 0.30 * recency_decay * investment_level + 0.30 * problem_type_bind * investment_level`. The weights are Jonathan's heuristic priors. They never adapt.

`investment_level` is adaptive: it counts `framework_invoked` memory_event rows per framework and grows with use. But the *ensemble weights themselves* are static. When a user accepts a recommendation, nothing learns. When they reject one (with a captured reason per Phase 125 D7), the REJECTED edge lands in the graph -- and no future score is nudged. The room learns about its own moves but the ranker is deaf to that signal.

This seed proposes closing that loop: reading the accumulated outcome-edge graph (REJECTED + DEFERRED + accepted FOLLOWS_FROM) and adapting the three ensemble weights per-room over time.

## The 2026-05-16 review history (why this is a SEED and not a phase)

On 2026-05-16 an outside DGEKT-inspired proposal proposed a full dual-graph reading layer (ASSOCIATION_LENS + TRANSITION_LENS + ensemble scoring across structural/temporal/semantic/policy signals) as cross-phase amendments to v1.13.1. Three independent reviewers (canon compliance, execution-plan contract, adversarial framing) ran and converged on a synthesized verdict:

- **REJECT** the architectural framing (DGEKT vocabulary doesn't transfer; lens-class taxonomy collapses semantic structure)
- **APPROVE** two minimal additive primitives in v1.13.1: `FOLLOWS_FROM` cascade edge type (Phase 129) and `local-chain-recommender.cjs` Tier-LOCAL helper (Phase 127)
- **DEFER** the learned-weights feedback loop to v1.14.0 -- which is what this seed captures

The single most empirical attack from the adversarial review (Agent C, attack 4): training learned weights on the current Wave-1 tester cohort of 4 users is overfitting -- 4 testers x ~10-50 ranker invocations per week x 4 weeks = roughly 640-3200 events, which encodes Jonathan + three friends as universal truth across a 3-weight parameter grid. Cohort needs to be 30-50+ for the learned weights to generalize. This seed's trigger gate enforces that.

## When to Surface

Two independent gates, both must clear:

**Gate 1: Cohort size >= 30 active users.** Counted from the Brain admin panel's API-key registration. Currently 4 (Wave-1 cohort). At Wave-2 cohort growth or the public launch following v1.13.0 final + v1.13.1 ship, this gate becomes reachable.

**Gate 2: F-selector outcome edge accumulation >= 1000 events.** Across all tester room.db files in aggregate (NOT cross-user-aggregated learning -- per Canon Part 8 the LEARNING stays room-local, this gate is just a readiness signal). Counted from telemetry mirror per Phase 121 trajectory-telemetry surface. The event types that count:
- `f_selector_decision` with `outcome: REJECTED` (Phase 125 D7)
- `f_selector_decision` with `outcome: DEFERRED` (Phase 125 D7)
- Implicit-accept trajectories captured as `FOLLOWS_FROM` cascade edges (Phase 129 additive primitive per 2026-05-16 verdict)

When both gates clear, surface this seed:
- During `/gsd:new-milestone v1.14.0` scoping
- During `/gsd:plan-phase` against any v1.14.0 phase that proposes to consume F-selector ranker outputs
- During `/gsd:review-backlog` if it runs against the seeds directory

## What This Seed Proposes (NOT a phase yet -- this is the scoping input)

Three deliverables, all room-local per Canon Part 8 fence:

1. **`lib/workflow/ranker-weight-updater.cjs`** (~120 lines). Reads outcome edges via `navigation.findRecentChanges` (Canon Part 9 chokepoint enforcement). Applies a simple per-room weight-update rule (gradient descent on log-loss against accepted-vs-rejected outcomes, OR softer heuristic update with decay). Writes a `ranker_weight_updated` memory_event with the before/after weights as scalar properties. Bound to update at most once per N events (e.g., N=50) to avoid thrash.

2. **Schema additive: `ranker_weights` table in room.db.** Per-room weight history with timestamp + scalar weight values. Enum-only properties (NO freeform user-content fields per Canon Part 8 constraint from Agent A review). NOT a parallel graph; a side table that the ranker reads at score-time.

3. **CI tripwire mirroring Phase 90's 5-tripwire pattern.** A test that scans `lib/workflow/ranker-weight-updater.cjs` for forbidden surfaces: no cross-room aggregation; no Brain packet field containing weight values; no freeform-string projections from memory_event payloads.

Surface contract: `rankForSelector(candidates, opts) -> ranked[]` -- unchanged. The internal scoring formula reads the room's current `ranker_weights` row instead of the hardcoded `0.40 / 0.30 / 0.30`. Default values match the current hardcoded ones (initial weights = current weights), so the change is byte-stable for any room with zero ranker_weight_updated events.

## Canon Part Compliance Notes (carried forward from the 2026-05-16 review)

- **Part 4 (Every Choice Is Graph Data):** the `ranker_weight_updated` memory_event itself is graph data. The weight updates become navigable as a trajectory of decisions per Canon Part 4.
- **Part 7 (Reuse-Before-Build):** extends the shipped F-selector ranker (Phase 125) and the shipped memory_event log (Phase 109); no new substrate.
- **Part 8 (Graph Boundary):** weights are room-local. NEVER aggregated across rooms. NEVER written into a Brain Context Packet. CI tripwire enforces.
- **Part 9 (Memory Locality + Interpretation):** the room remembers its own weight evolution. Brain still reasons over typed packets; the packets carry framework handles + enum scalars, never weight values.

## What Could Make This Seed Die

If by the trigger time:
- The cohort grows but the F-selector ranker has been replaced by a different surface (e.g., Phase 130's lens engine matures into the canonical ranker), this seed retires without action.
- The four hardcoded weights turn out to be empirically near-optimal across the cohort (i.e., learned weights converge near 0.40 / 0.30 / 0.30 without intervention), this seed becomes a no-op and retires.
- The Canon Part 8 fence cannot be enforced practically (e.g., outcome-edge schema unavoidably leaks user-content into weight features), this seed converts to a reject autopsy: "we considered learned weights, the privacy fence couldn't hold, we keep hardcoded weights as the safe baseline."

## Provenance

Planted 2026-05-16 as the DEFER half of the dual-graph architectural review verdict. Three independent reviewer deliverables cited above; synthesized verdict logged in `121.5-CONTEXT.md` top section + DISCUSSION-LOG.md banner update. Reject reason for the full architectural proposal (DGEKT-inspired lens-class taxonomy) captured at `.planning/research/2026-05-16-dual-graph-architectural-proposal.md` Section 6 + Section 9; the rejection is itself graph data per Canon Part 4, to be filed as an `architectural_proposal_decided` memory_event when the v1.13.1 additive primitives ship.
