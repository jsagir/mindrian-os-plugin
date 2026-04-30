---
filed: 2026-04-29
type: decision
methodology: challenge-assumptions
depth: deep
problem_type: schema-conformance
venture_stage: Investment
room_section: decisions
status: APPROVED
canon_parts: [Part 6, Decision 15]
supersedes: none
---

# Decision: MindrianOS-Plugin/room/ uses Investment-stage meta-room shape by intent

## Status Quo

`MindrianOS-Plugin/room/` contains two sections (`decisions/` and `product-evolution/`). `scripts/analyze-room` hardcodes a `CORE_SECTIONS` list of eight canonical PWS sections (problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model) and reports anything missing from that list as a high-severity structural gap.

When run against the plugin's own room, the script reports six structural gaps. A naive reading of Canon Part 6 (dog-fooding mandate) frames the divergence as a violation: "the plugin ships methodology to users but does not follow it itself."

## Devil's Advocate Verdict

The "violation" framing does not survive Phase 2-3 challenge. Three independent findings collapse it:

1. **Canon Part 6 mandates the process, not the schema.** Part 6 requires that plugin work runs inside its own room, that every phase produces artifacts, and that every decision becomes graph data. The plugin already satisfies all three. Part 6 nowhere mandates the specific eight-section list.

2. **The constitutional schema is ROOM.md per folder + ICM Layer 0**, both of which `MindrianOS-Plugin/room/` satisfies. The `CORE_SECTIONS` list in `analyze-room` is a starter-room template inherited from PWS pedagogy, not a constitutional schema.

3. **The plugin is in a different venture stage than the rooms it serves.** User ventures live in PWS shape during Pre-Opportunity through Validation. The plugin is post-product-discovery, in Investment stage, shipping weekly releases. By Simon's near-decomposability principle (which the plugin itself canonizes), structure follows function: shipping releases produces `decisions/` + `product-evolution/`, not customer-discovery artifacts.

## Killing-Question Findings

| Question     | Finding                                                                              | Severity |
|--------------|--------------------------------------------------------------------------------------|----------|
| Fragility    | Constitutional claim rests on a hardcoded Python list, not on canon prose            | critical |
| Irrelevance  | Phase 92 drift-detection-engine forces this question one way or the other regardless | high     |
| Dependency   | Frame requires plugin-as-venture == user-venture; stages differ                      | high     |
| Replacement  | Two co-equal room shapes (USER-room PWS, META-room dev) replace the violation frame  | resolved |

## Pre-Mortem (forced shoehorn scenario)

If we had backfilled the six "missing" canonical sections, we would have created six empty directories that stayed empty for 24 months, because plugin development at this stage does not produce customer-discovery artifacts. The dog-fooding argument that was supposed to prove we use the methodology would instead have proved we'd outgrown it for this stage. The cheapest experiment to test this counterfactual is one we are explicitly not running.

## Decision

The room shape `decisions/` + `product-evolution/` is **the correct shape for this room at this venture stage**, by intent and by canon-internal reasoning.

## Real Bug

The bug is in `scripts/analyze-room`, not in `MindrianOS-Plugin/room/`. The script's `CORE_SECTIONS` list is a brittle assumption: room shape is one schema, not a per-room declaration. Two acceptable fixes:

1. **Local fix (cheap):** add a `ROOM.md` to `MindrianOS-Plugin/room/` declaring `sections: [decisions, product-evolution]`. Patch `analyze-room` to read declared sections from `ROOM.md` when present and fall back to `CORE_SECTIONS` otherwise.
2. **Systemic fix (Phase 92):** drift-detection-engine treats schema mismatch as either drift or evolution, not as binary violation. Per-venture-type schemas become first-class.

This decision picks (1) for the immediate gap and queues (2) for Phase 92.

## Next Steps

1. Add `ROOM.md` to `MindrianOS-Plugin/room/` declaring two-section meta-room shape.
2. Patch `scripts/analyze-room` to prefer `ROOM.md`-declared sections when present.
3. File a Phase 92 design note referencing this decision as the canonical drift-vs-evolution example.

## Provenance

Surfaced 2026-04-29 during v1.12.0 fresh-session smoke test. The smoke test wrote `room/decisions/v1-12-0-smoke-fresh-session/v1-12-0-smoke-fresh-session.md`; the post-write hook silently guard-skipped because the active-room registry points at `mindrianOS`, not at this room. The skip exposed the registry mismatch; subsequent investigation exposed the `analyze-room` schema mismatch; Devil's Advocate session resolved which mismatch was real.

This decision artifact's existence inside `decisions/` (rather than `competitive-analysis/`, where the methodology default would file it) is itself proof of the decision: this room files where the work happens, not where the methodology template prescribes.
