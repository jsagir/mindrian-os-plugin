# SEED-055 - Eureka dual-surface: broaden SENS-13 to portfolio movement, plus the /mos:eureka-portfolio discoverable command

> Framing (navigator, 2026-07-10, live conversation during the 212-215 Eureka
> Two-in-a-Box execution run): Red Team stress-test surfaced the question of
> whether Phase 215's portfolio-scoring engine should ship as a discoverable
> `/mos:` command, given its numbers weren't yet validated (215-05's
> human-verify checkpoint was in flight) and given its more powerful sibling
> (213's SENS-13 Eureka-bridge sensor) shipped invisibly, wired straight into
> the conversational reach. Navigator's answer: not either/or - both surfaces.
> And don't stop at a thin wrapper: broaden SENS-13 itself so it notices
> portfolio-level movement too, "not JUST pairwise bridges." Full reasoning,
> Red Team pass, reuse map, and open questions are filed in the durable
> room-side entry (cross-referenced below) per the Dev-Research Compositing
> mandate; this file is the dev-repo pointer + actionable summary.

**Registered:** 2026-07-10 (navigator-directed, live conversation, mid-execution
of the 212-215 arc)
**Class:** ARCH | **Status:** ready  # PULLED FORWARD 2026-07-14 (navigator-directed): Phase 216 ("Depends on: Phases 211-215, all complete") confirms this seed's own gating condition cleared; 215-05's human-verify checkpoint independently confirmed COMPLETE 2026-07-10 (full 2117-tech run, both manual gems reproduced). Trigger has fired, zero implementation started. Was "seed"; queue at next milestone/phase scoping.
**Grounding:** `213-02-SUMMARY.md`, `213-03-SUMMARY.md`, `213-04-SUMMARY.md`
(SENS-13 detector + producer + `decide()` reachability proof + `composeEurekaOffer`),
`215-01-SUMMARY.md` through `215-04-SUMMARY.md` (AHP weights, portfolio-dimensions
scorer, tail-quadrant classifier, Opportunity Statement emitter, the composed
`scripts/eureka-portfolio-report.cjs` batch runner)

## The gap

213 shipped SENS-13 wired invisibly into the conversational reach (one evidence
shape: a guard-cleared pairwise bridge). 215 shipped a real, tested portfolio
engine composed on the same reused 211 spine - but only as a CLI batch script,
undiscoverable to a navigator who doesn't read the repo.

## The resolution (both, not either/or)

1. **`/mos:eureka-portfolio`** (name TBD at plan time) - a discoverable command
   mirroring the `find-analogies.md` surgery precedent (214-03): measured
   numbers + provenance, honest qualitative degrade, gated live behind 215-05.
2. **SENS-13 broadened, not cloned.** One sensor recognizes a SECOND evidence
   envelope (portfolio movement: band-crossing, tail-quadrant appearance, rank
   reshuffle) alongside the existing pairwise-bridge envelope, dispatching to a
   new sibling offer composer (`composePortfolioOffer`). Zero new
   `SENSOR_REGISTRY` entry, zero new `decide()` wiring, zero second
   born-wired proof - 213-03 already proved SENS-13's reachability.

## The open design question

Evidence shape B's refresh cadence: the portfolio batch run scores ~2.2M pairs
(real minutes), so it cannot run per-turn like the bridge scan. Candidates:
piggyback on `/mos:eureka-portfolio` runs (diff against the prior run), a slow
scheduled refresh (the room's `scout`/`scheduled-tasks` machinery), or both.
Not pre-decided here - see the room entry's Open Questions section.

## Gating

BOTH additions stay gated behind Phase 215-05's human-verify checkpoint (real
2117-node room run + navigator spot-check) clearing first. Timing gate, not a
shape objection - per the navigator's own Red Team resolution in-conversation.

## Full reasoning, reuse map, Canon compliance, open questions

Filed at:
`~/MindrianRooms/rethinking-mindrianos/research/2026-07-10-seed-055-eureka-dual-surface/2026-07-10-seed-055-eureka-dual-surface.md`

## Cross-references

- `.planning/phases/213-eureka-reach-wiring-the-key-eureka-reach-wiring/213-0{2,3,4}-SUMMARY.md`
- `.planning/phases/215-eureka-portfolio-scale-fusion-eureka-portfolio-fusion/215-0{1,2,3,4}-SUMMARY.md`
- `.planning/phases/214-eureka-pattern-transfer-find-analogies-eureka-pattern-transf/214-03-PLAN.md`
  + `commands/find-analogies.md` (the discoverable-command-surgery precedent)
- SEED-048 (portfolio-scale fusion, the seed Phase 215 executed), SEED-049
  (Eureka generator), SEED-050 (Eureka critic / Grounding Guard)
- Next action when unblocked: `/gsd-spec-phase` or `/gsd-discuss-phase` once
  215-05 clears and this seed graduates to a registered ROADMAP phase.
