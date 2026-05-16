---
phase: 129
slug: spine-repair-memory-event
status: scoped (ready for /gsd:discuss-phase 129)
priority: P0 -- closes the backward arc of the proactive loop; without this, every Phase 116/117/121 emission lands in a partial event stream
created: 2026-05-16
updated: 2026-05-16
milestone: v1.13.1
beta_target: 1.13.1-beta.3
wave: 4 (Stream F -- parallel to 115/116/117/121/128)
absorbed_from: synthesis plan P2 (Spine Repair -- 6 silent spine scripts emit memory_event)
absorption_source: .planning/v1.13.1-EXECUTION-PLAN.md "Synthesis-Plan Absorption (2026-05-16)" section
canon_parts:
  - Part 3 (Tri-Context Decision Gate -- every gate transition becomes a memory_event)
  - Part 4 (every choice is graph data -- the spine's transitions ARE choices)
  - Part 9 (memory locality -- the spine reads + writes via navigation.cjs)
depends_on:
  - Phase 109 sql-context-memory-navigation-spine (shipped -- the chokepoint these scripts will route through)
  - Phase 122 workflow-layer (shipped beta.11 -- command-resolver + chain-recommender that act/suggest-next consume)
dependents:
  - Phase 116 unresolved-tension-hook (consumes the now-complete memory_event tail)
  - Phase 117 auto-explore-domains (consumes spine event stream for first-material detection)
  - Phase 121 trajectory-telemetry (consumes the spine event log)
  - Phase 130 lens-engine-skeleton (mandatory memory_event emission depends on the spine working)
  - Phase 131 research-as-graph-aware-workflow-step (consumes memory_event tail for context extraction)
brain_impact: NONE (LOCAL-only spine refactor)
hotfix_discipline: NO (refactors existing scripts but adds new behavior; ships as a phase, not a hotfix)
estimated_days: 3-4
---

# Phase 129: Spine Repair -- Route 6 Silent Spine Scripts Through navigation.cjs

## Goal

Refactor the 6 spine scripts that currently bypass `lib/core/navigation.cjs` to read via the chokepoint and emit `memory_event` on every state transition. After this phase, the proactive loop has a real backward arc -- every action a user takes via `/mos:act`, `/mos:suggest-next`, `/mos:operator`, `/mos:jtbd`, `/mos:memory` is journaled to the canonical event log and visible to the NEXT `/mos:status` / `/mos:suggest-next` invocation.

## Why this matters

The Cluster 3 audit (2026-05-15) found:

> `grep "memory_event\|logMemoryEvent"` across all 7 spine scripts (`mos-status / suggest-next-command / act-command / pipeline-command / operator-command / jtbd-command / memory-command`) returns **zero matches**.

The forward link of the proactive loop is coherent (Phase 122 shipped the resolver + registry). The backward link is broken: actions are taken but never recorded. The next `/mos:suggest-next` cannot read what just happened because the actions were never written to the spine.

## The 6 scripts to repair

| Script | Current state | After Phase 129 |
|---|---|---|
| `scripts/mos-status.cjs` | Reads MINTO via `folder-memory.readTriple`; no memory_event | Reads via `navigation.cjs.getRoomContext`; emits `status_rendered` event with current section + JTBD + operator snapshot |
| `scripts/suggest-next-command.cjs` | Imports recommender + resolver only; zero writes | Reads via navigation; emits `suggestion_surfaced` event (with the suggested commands + their confidence scores from chain-recommender) |
| `scripts/act-command.cjs` | Dispatches framework-runner; zero writes | Emits `act_dispatched` event (calling command + dispatched methodology + autonomy mode) on dispatch; `act_completed` on return |
| `scripts/pipeline-command.cjs` | Larry-as-glue; soft chain | Emits `pipeline_stage_entered` / `pipeline_stage_completed` events per stage |
| `scripts/jtbd-command.cjs` | Writes to `<roomDir>/.mindrian/jtbd-state.json`; no memory_event | Emits `jtbd_set` / `jtbd_overridden` events on every transition; state file stays as fast-read cache |
| `scripts/operator-command.cjs` | Writes to `<roomDir>/.mindrian/conversation-operator.json`; no memory_event | Emits `operator_transitioned` event on every mode change |
| `scripts/memory-command.cjs` | Reads jtbd-state + jtbd-history; no emit | Emits `memory_inspected` event with which layer was inspected |

Net: 7 new event types added to the canonical enum (scope-locked per the v1.13.1 alignment audit risk #3: cap event-type additions at 5 -- one of jtbd_set/jtbd_overridden and one of operator_transitioned/pipeline_stage_completed will be consolidated during discuss-phase).

## Concrete deliverables

1. **`lib/core/navigation.cjs` extensions** -- helper functions for the 5-7 new event types (e.g., `logStatusRendered`, `logSuggestionSurfaced`, `logActDispatched`). These wrap `logMemoryEvent` with the right payload shape.
2. **Refactor of 7 spine scripts** -- replace direct file reads with `navigation.cjs.getRoomContext` calls; replace silent state transitions with helper-function calls that emit events.
3. **State-file consistency**: `jtbd-state.json` and `conversation-operator.json` stay as fast-read caches but the AUTHORITATIVE record becomes the memory_event log. `navigation.cjs` adds `getCurrentJTBD()` / `getCurrentOperator()` that read from the event log with the state file as fallback.
4. **Tests**: instrumented acceptance test (mirrors Phase 109 pattern) that runs the full proactive loop (status → suggest-next → act → completion) and asserts (a) zero non-SQLite filesystem reads outside the cache files, (b) exactly N memory_event rows written per loop pass, (c) the next status render reads the just-emitted events.

## Open design decisions

1. **Event-type cap**: the synthesis plan capped at 5 new event types. The 7 scripts naturally suggest 7+ types. Discuss-phase must consolidate (e.g., `status_rendered` + `memory_inspected` could merge into a generic `spine_read` event).
2. **State-file deprecation timeline**: do `jtbd-state.json` + `conversation-operator.json` stay as caches forever, or do they sunset in v1.14.0 once the event log is proven authoritative? Recommend: keep as fast-read cache through v1.13.x; revisit for v1.14.0.
3. **Idempotency**: if `/mos:status` is invoked 10 times in a row with no state change, do we emit 10 `status_rendered` events or dedupe to 1? Recommend dedupe with a 60-second TTL (telemetry noise reduction).
4. **Backfill**: do we write a one-shot migration that backfills memory_event for the last 30 days of jtbd-state.json + operator-state history? Recommend NO -- forward-only from beta.3 cut.

## Acceptance criteria

- [ ] All 7 spine scripts route reads through `navigation.cjs.getRoomContext` (or equivalent helpers)
- [ ] All 7 spine scripts emit `memory_event` on every state transition
- [ ] Net new event types added to canonical enum ≤ 5 (per scope lock)
- [ ] Instrumented acceptance test passes: full proactive loop produces the expected event count + sequence
- [ ] `/mos:status` Zone 3 (post-Phase 130) can render the memory_event tail for "what changed since last look"
- [ ] No regression in existing test suite (Phase 109 navigation tests + Phase 122 workflow tests still pass)
- [ ] `FOLLOWS_FROM` cascade edge type added to the canonical cascade vocabulary (per 2026-05-16 dual-graph review additive scope expansion); enum-only properties; emitted by spine repair when one memory_event clearly follows another in the proactive loop

## Additive scope expansion (2026-05-16 dual-graph review verdict)

The 2026-05-16 architectural review (verdict at `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` top section + three reviews at `.planning/research/2026-05-16-dual-graph-review-{A,B,C}-*.md`) approved ONE additive primitive that rides Phase 129's scope:

- **`FOLLOWS_FROM` cascade edge type** added to the canonical 7-type cascade vocabulary (INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES / REJECTED / DEFERRED). Becomes the 8th type. ~30 lines additive to `lib/core/navigation/memory-events.cjs` (the cascade enum + the `writeEdge` validator). Emitted by spine repair work when one memory_event clearly follows another in the proactive loop (e.g., `status_rendered FOLLOWS_FROM suggestion_surfaced`). Properties are enum-only per Canon Part 8 constraint from the review (no freeform user-content fields). Rejects the dual-graph proposal's lens-class taxonomy (ASSOCIATION_LENS / TRANSITION_LENS); accepts a single additive cascade type that extends the shipped vocabulary.

This scope expansion is small (~30 lines + the schema invariant) and natural to Phase 129's existing memory_event emission work; it does NOT introduce parallel lens classes or DGEKT-inspired ensemble vocabulary. The full architectural framing (transition aggregates, learned weights, lens-engine extension) is REJECTED for v1.13.1; learned-weights piece DEFERRED to v1.14.0 plant-seed at `.planning/seeds/2026-05-16-learned-ranker-weights.md` (to be filed in this verdict execution).

## Cross-references

- `.planning/v1.13.1-EXECUTION-PLAN.md` (Wave 4 Stream F)
- `docs/MINDRIAN-CANON.md` Part 9 (Memory Locality and Interpretation)
- 5-cluster Cluster 3 audit (Room/State/Navigation spine) -- 2026-05-15
- Phase 128 substrate-contract-adr (the CI guard that prevents this drift from recurring)
