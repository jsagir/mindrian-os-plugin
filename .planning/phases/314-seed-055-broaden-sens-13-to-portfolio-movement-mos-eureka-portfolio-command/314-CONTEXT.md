# Phase 314: SEED-055 Broaden SENS-13 to portfolio movement + /mos:eureka-portfolio command - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship two surfaces over the one portfolio engine that Phase 215 built, and mint no second engine:

1. **Door 1, a discoverable command.** `/mos:eureka-portfolio` runs the existing batch runner (`scripts/eureka-portfolio-report.cjs`) with measured numbers, provenance and an honest qualitative degrade. It mirrors the find-analogies command surgery (Phase 214-03, `commands/find-analogies.md`).
2. **Door 2, a broader sensor.** SENS-13 (the Eureka-bridge sensor from Phase 213) learns a SECOND evidence shape, portfolio movement, beside the existing pairwise-bridge shape. It hands that shape to a new sibling offer composer, `composePortfolioOffer`. Zero new `SENSOR_REGISTRY` entry, zero new `decide()` wiring, zero second born-wired proof (213-03 already proved SENS-13's reachability).

Out of scope: any new scoring engine, any change to the AHP weights or the band definitions, any per-turn full portfolio scan, any background scheduler.

**Gate cleared.** The seed was gated on Phase 215-05's human-verify checkpoint. PROVEN: `215-05-SUMMARY.md` is COMPLETE with the navigator spot-check verdict recorded as YES. The seed graduates to this phase.

</domain>

<decisions>
## Implementation Decisions

### Refresh cadence of evidence shape B
- **D-01:** On-demand only, diff against the prior run. Each `/mos:eureka-portfolio` run is compared with the previous stored run, and SENS-13 reads that diff. No scheduled refresh, no background compute. (Navigator, 2026-10-28.)
- **D-02:** The sensor never starts a portfolio run. A full run scores about 2.2M pairs and takes real minutes. The sensor reads only the stored diff. If no prior run exists, shape B is silent.

### What counts as movement worth surfacing
- **D-03:** Composite rule. Surface when an opportunity crosses a band, OR enters the tail quadrant, OR the top-N order reshuffles. (Navigator, 2026-10-28.)
- **D-04:** Thresholds (the N in top-N, what counts as a reshuffle) are NOT guessed here. The plan calibrates them against a real portfolio run, and records the measured values and the run used.

### Command name and scope
- **D-05:** The command is `/mos:eureka-portfolio`. It scores the whole room by default and accepts a named opportunity-bank subset. (Navigator, 2026-10-28.)

### Claude's Discretion
- **D-06:** `composePortfolioOffer` lives in a sibling file under `lib/core/eureka/`, next to `composeEurekaOffer`, with the same fence pattern. It mirrors the 213-02 evidence-producer and 213-04 offer-composer split. (Recommendation of the seed; the navigator left technical placement to Claude.)
- **D-07:** Where the previous-run diff is stored, and its format, is a planner choice. Constraint: local only, inside the room, written through the governed paths.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/seeds/SEED-055-eureka-dual-surface-portfolio-movement-plus-command.md` - the seed (gap, resolution, gating)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-10-seed-055-eureka-dual-surface/2026-07-10-seed-055-eureka-dual-surface.md` - full reasoning, reuse map, Canon compliance, open questions (answered above)
- `.planning/phases/213-eureka-reach-wiring-the-key-eureka-reach-wiring/213-02-SUMMARY.md`, `213-03-SUMMARY.md`, `213-04-SUMMARY.md` - the sensor, the reachability proof, the bridge offer composer
- `.planning/phases/215-eureka-portfolio-scale-fusion-eureka-portfolio-fusion/215-01-SUMMARY.md` to `215-05-SUMMARY.md` - AHP weights, scorer, tail-quadrant classifier, Opportunity Statement emitter, batch runner, and the cleared checkpoint
- `.planning/phases/214-eureka-pattern-transfer-find-analogies-eureka-pattern-transf/214-03-PLAN.md` and `commands/find-analogies.md` - the discoverable-command surgery precedent
- `docs/MINDRIAN-CANON.md` Parts 7 (reuse before build), 8 (graph boundary), 11 (born wired, HITL shape declaration)

</canonical_refs>

<code_context>
## Existing Code Insights

- SENS-13 already sits in `SENSOR_REGISTRY` (`lib/core/insight-sensors.cjs`). Broaden it. Do not add an entry.
- `scripts/eureka-portfolio-report.cjs` is the composed batch runner from 215-04. The command wraps it.
- The Eureka tool surface is now 24 `eureka_*` MCP tools, and the tool-schema budget was re-baselined to 75 tools. Do not add an MCP tool for this phase unless the plan proves it is needed, and re-baseline per the recorded protocol if so.

</code_context>

<specifics>
## Specific Ideas

- Door 1 must show measured numbers with provenance and degrade honestly in plain words when the engine or the encoder is unavailable.
- Every new invocable surface is born wired or excluded (Canon Part 11) and declares its HITL shape.
- Plain words in every user-visible string. No stack vocabulary.

</specifics>

<deferred>
## Deferred Ideas

- A scheduled slow refresh through the scout and scheduled-tasks machinery (navigator chose on-demand only). Revisit only if the diff goes stale in practice.
- A raw score-delta trigger (rejected as noisy).

</deferred>
