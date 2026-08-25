---
id: SEED-083
status: dormant
planted: 2026-08-25
planted_during: Theo Phase 6 (Command Sync & Parallel-Run Rollout) - planning, after Theo's D-16 extended its recipe-maps.cjs sync to connector-registry.json
trigger_when: "when a phase proposes syncing live reach-adjacency/orchestration data into Theo, when navigation-engine.cjs's decide()/SENSOR_REGISTRY architecture changes in a way that would matter to Theo, or when Theo's SEED-001 framework-ingestion work is scoped and the question of 'how do frameworks/commands connect beyond the static registry' comes up again."
scope: medium
---

# SEED-083: This repo's live reach-adjacency system (navigation-engine.cjs decide() + sensor registry) is richer than anything Theo syncs, and stays that way by design

## Why This Matters

Paired with Theo's `.planning/seeds/SEED-006-live-reach-engine-adjacency-not-synced.md`, filed same session. Navigator, mid Theo Phase 6 planning (2026-08-25): "larry skill knows what frameworks/commands there are, mindrian had more th[a]n the graph! and [that's] by design. the concepts and frameworks can operate a few commands not just the closely related ones. also the suggest_next knows adjacent tools/skills and can be chained as workflows!"

Investigated concretely against this repo's actual source. `lib/core/recipe-maps.cjs` (one of the two files Theo's SYNC-01 is authorized to read) turned out to be a thin joiner over three jobs:

1. `postureForCommand` - posture/autonomy authority (not reach-adjacency, out of scope for this seed).
2. `wiringForReach(reachId)` - reads `data/connector-registry.json` (203 connector entries, nearly double the 113 commands in `command-registry.json`, each carrying `reach_id`, `framework`, `posture`, `hierarchy_rank`, `sensor_triggers`, `decision_surface`). **Theo's Phase 6 now syncs this** (its D-16) - same-file discipline, one of `recipe-maps.cjs`'s own documented jobs.
3. `rankedNextReach(opts)` - reads `data/brain-orchestration-projection.json` (a 207-node/51-edge projection). **Theo explicitly does NOT sync this** - the function's own code comment in this repo states it is "CONTRACT-ONLY... the Wave-2 runChain loop drives next-step selection from `decide()` (`navigation-engine.cjs`), NOT from this function... Live nav-engine consumption of the projection cache is DEFERRED with Phase 157. Do NOT wire this into the loop." This repo's own architecture treats that cache as dark, not live-authoritative.

That comment names the actual live mechanism the navigator was pointing at: `navigation-engine.cjs`'s `decide()`, fed by the Phase 143 `SENSOR_REGISTRY` / `dispatchSensors` path - the real "suggest_next knows adjacent tools/skills, chains into workflows" system. It has been visibly firing throughout the entire Theo Phase 6 planning session, in the Claude Code session that filed this seed, as the `NAVIGATION DECISION (engine v1)` context block injected every turn (`fire_skill`, `suppress_skills`, `routing_source: engine`, ranked reach candidates with confidence percentages). It computes adjacency dynamically at decision time - genuinely richer than a static registry table, by design, exactly as the navigator framed it: a framework/concept can legitimately operate more commands than a fixed alias table would surface.

## Why this is a seed, not a Theo Phase 6 scope change

Same discipline that already rejected Theo's "fuller precedent" schema shape once this session (5 edge types + 5 new node labels pulled from unauthorized sources). `navigation-engine.cjs` / the sensor registry lives entirely outside the two files Theo's SYNC-01 authorizes to read from this repo. Pulling it into Theo's sync now would repeat that exact mistake a third time. The finding is real and worth preserving deliberately as a seed rather than smuggled into an already-locked decision.

## Proposed shape (not yet designed - this is the seed, not the plan)

Not yet scoped. Candidate directions, from this repo's side, when this triggers:
- Expose `decide()`'s live output (or a summarized slice of it) through a read-only surface Theo could query at call time, preserving the "computed at decision time" property rather than flattening it into a stale snapshot.
- OR: accept periodic snapshot sync of whatever parts of `SENSOR_REGISTRY`/`decide()` output are stable enough to snapshot honestly, same GSD-payload discipline as the existing sync contract.
- Either way, this repo's side needs to decide what of the live decision engine is safe/meaningful to expose to an external consumer at all - `decide()` currently has no external contract, only an internal one the runChain loop reads.

## When to Surface

**Trigger:** when a phase proposes syncing reach-adjacency/orchestration data to Theo, when `navigation-engine.cjs`'s architecture changes materially, or when Theo's SEED-001 is scoped and this exact question resurfaces.

## Scope Estimate

**Medium** - not a small detection mechanism; likely means designing a new external contract for a system (`decide()`) that has never had one, probably its own phase on this side.

## Breadcrumbs

- `lib/core/recipe-maps.cjs` - `wiringForReach` (now synced by Theo), `rankedNextReach` (explicitly deferred, this seed's direct trigger)
- `lib/core/navigation-engine.cjs` - `decide()`, the actual live reach-selection authority
- `data/brain-orchestration-projection.json` - the dark cache `rankedNextReach` reads but nothing live consumes yet
- Paired seed: `Theo:.planning/seeds/SEED-006-live-reach-engine-adjacency-not-synced.md`
- Per this repo's own "Dev-Research Compositing" rule, also filed as a research entry in `rethinking-mindrianos/research/2026-08-25-command-framework-sync-drift-detection-and-graph-orchestrator/` (same session, same entry as SEED-005/082)

## Notes

Navigator-directed, same session as SEED-082 (bidirectional sync drift detection) - a related but distinct finding about the same underlying tension (Theo's graph vs. this repo's live command/framework knowledge), caught while extending Theo's D-11 rather than at the top of the phase.
