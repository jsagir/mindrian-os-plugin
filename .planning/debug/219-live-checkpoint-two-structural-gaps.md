---
kind: rca
slug: 219-live-checkpoint-two-structural-gaps
status: both-gaps-resolved-pending-219-06-rerun
opened: 2026-07-13
routed_to: Phase 219 direct fix (GAP-2, this session) + Phase 219 GAP-1 fix (landed, live-verified)
---

# RCA: 219-06's live ador-ip-test checkpoint found two structural gaps fixture-green missed

## Symptom

219-06 (the mandatory live end-to-end proof, D-12) ran the REAL production pipeline on
ador-ip-test: extraction+metadata succeeded live (70/57 -> 955 nodes/1545 edges, 789
entities), eureka ran clean (414,505 pairs, 25 statements, cohort stratification held,
zero artifact-vs-artifact noise) - but banked 0 statements and the harvest sensor found
0 candidates. Both zeros were structural, not noise-related.

## Root causes (traced by the 219-06 executor, verified independently before fixing)

**GAP-1: eureka banking is structurally unsatisfiable on any live run.**
`lib/core/eureka/opportunity-statement.cjs` `runCriticGate` (~L273-292): the real Phase 212
critic's `stageA` is async; the synchronous statement emitter cannot await a Promise, so it
honestly degrades to `{critic: 'pending', banked: false}` on every live call - by design,
never a fabricated pass, exactly per the code's own comment: "A future async runner can
await the real verdict; this synchronous seam never claims a verification it did not
obtain." Nobody ever built that async runner. The 219-01 unit test used a synchronous stub
critic, masking that the real path never resolves. **This predates 219** (inherited from
Phase 212/215/216, which never banked anything so the gap was invisible until 219 made
banking load-bearing) but blocks 219's own REQ-1.

**GAP-2: the harvest bridge lane used an edge vocabulary no live room produces (RESOLVED).**
`lib/core/eureka/opportunity-harvest.cjs` `BRIDGE_EDGE_TYPES` (219-03's own file) only
recognized `RELATED_TO/CONVERGES/SUPPORTS/INFORMS`. Live census on ador-ip-test:
DESCRIBES:1413 (provenance), BELONGS_TO:57, STATES:28, **COMPETES_WITH:21,
USES_COMPONENT:15, SUPPLIES_TO:11** - the exact 218 domain-relationship vocabulary, zero
overlap with the old set. 219-03's own fixture only ever planted a generic RELATED_TO
bridge, so its unit test stayed green while blind to the real signal. The live run named
concrete real pairs the lane should have surfaced: Abbott x TwistDx, BioFire x Cepheid,
Nanogen x Portside, BATM x Ador.

## Fix: GAP-2 (RESOLVED, this session, direct fix)

Additive per D-04 (reuse existing typed edges): extended `BRIDGE_EDGE_TYPES` to add
`COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO`, kept the original four for pre-218 rooms.
Extended the 219-02 hub-skew fixture with a second planted bridge (`domainBridgeA`/
`domainBridgeB`, a `USES_COMPONENT` edge) and a new test assertion (A2b) proving the harvest
lane finds it. `test-219-harvest-sensor.cjs` 14/14 green. **Live-verified directly against
ador-ip-test** (not just fixture): `harvestCandidates('/home/jsagi/MindrianRooms/ador-ip-test')`
now returns **25 real bridge candidates** where it returned 0 before the fix.
`bash tests/run-all-219.sh` PASS=11 FAIL=0 SKIP=0 (no regression). Files: `lib/core/eureka/opportunity-harvest.cjs`, `tests/helpers/fixture-room-219.cjs`, `tests/test-219-harvest-sensor.cjs`.

## Fix: GAP-1 (RESOLVED, dedicated executor run, live-verified)

**Design chosen:** exactly the one the sync gate's own comment named - a SEPARATE bounded
async resolution pass that runs AFTER the synchronous statement-emission batch and BEFORE
the REQ-1 banking batch, NOT an async rewrite of the emission pipeline (which would have
touched every emitter call site for zero honesty gain). Confirmed architecturally sound by
reading the runner: `main()` is already async, and the point between the statements loop
and `bankStatements` is exactly where banked flags flow into both the report and banking.

**What landed (commits `3c6bafe7` RED test, `26c50566` fix):**

- `lib/core/eureka/opportunity-statement.cjs`: additive exports
  `resolveCriticVerdict(statement, opts)` + `resolveCriticVerdicts(statements, opts)` - a
  sequential bounded pass over `critic: 'pending'` statements that AWAITS the real Phase
  212 `stageA` verdict and updates `critic` + `banked` in place via the SAME
  `verdictPasses` predicate the sync gate uses. `criticCandidateFor` is now the ONE
  candidate-shape source shared by the sync gate and the async pass (no drift possible).
- **Honesty floor unchanged:** reject, per-statement timeout, batch deadline, stageA's
  `degraded: true` encoder-unavailable envelope (a NON-evaluation - counting it as a
  resolved fail would let predicate `all` bank statements the critic never looked at),
  and absent-critic all leave the statement `pending`/unbanked. `banked` flips true ONLY
  on a resolved PASSING verdict.
- **Bounds (the vec0/FTS5 bounded-probe discipline):** `MINDRIAN_CRITIC_RESOLVE_TIMEOUT_MS`
  (per statement, default 30000) + `MINDRIAN_CRITIC_RESOLVE_BATCH_MS` (whole pass, default
  120000; `0` = operator kill switch). When the deadline hits, REMAINING statements degrade
  to honest pending instead of blocking the report. The timeout timer is deliberately NOT
  unref'd: an unref'd timer let Node exit silently mid-await against a handle-less
  never-resolving Promise (caught by the new test).
- **Latent bug fixed en route:** the sync gate discarded the real stageA Promise with no
  rejection handler - a later-rejecting async critic would have crashed the whole batch
  runner with an unhandled rejection. Now swallowed with a no-op catch (sync behavior
  byte-identical).
- `scripts/eureka-portfolio-report.cjs`: awaits the pass after emission / before banking,
  re-syncs the ranked `banked` column, reports the outcome in provenance
  (`critic_resolution` row), and renders the third honest statement state
  `NOT BANKED (critic resolved: <verdict>)`. OFFLINE runs SKIP resolution on purpose - a
  stub-encoder verdict would be fixture-green lying about grounding (this RCA's exact
  failure class) - so offline fixture behavior is byte-identical to pre-fix.
- `tests/test-219-critic-resolution.cjs` (10 checks, registered in run-all-219.sh): a REAL
  async stub critic (stageA returns a genuine Promise) pins resolution/banking, honest
  degrade on reject/timeout/degraded/absent, the timeout + deadline bounds (102ms/152ms
  measured), idempotence over already-resolved statements, and the sync floor.

**Suites:** 219 aggregator PASS=12 FAIL=0 SKIP=0 (new leg included), 218 substrate 13/13,
215 aggregator 8/8. The sync stub-critic tests (215-opp-statement, 219-banking) unchanged
and green - the byte-behavior floor held.

**LIVE PROOF (ador-ip-test, 955 nodes / 1545 edges, real encoder, real critic):**

- Run 1 (default predicate `critic`): `critic resolution - 25 resolved (0 passing), 0
  still pending`. Every one of the 25 statements got a REAL awaited verdict
  (`general_shallow` / `entity_nonspecific`, embedder `MongoDB/mdbr-leaf-ir`, swap-shift
  ~0.16 passing gate 2, entity_count 0 failing gate 4) where pre-fix 100% stayed
  `pending` forever. Zero fabrication: the critic looked and honestly said no.
- Run 2 (predicate `all`, the documented live-tuning seam): **banked 25 opportunity
  node(s), 50 DERIVED_FROM evidence edge(s), 0 skipped** - verified in room.db
  (`type='opportunity'` count 0 -> 25, each with statement_text/tier/predicate stamped,
  all writes through navigation.writeOpportunityNode/linkOpportunityEvidence).
  Pre-fix, even `all` banked ZERO because `all` requires `critic !== 'pending'` and
  nothing ever resolved - the "unsatisfiable regardless of predicate" symptom, closed.
- Honest observation for 219-06's remaining quality checkpoint: the 25 verdicts fail
  entity-specificity because the room-native statements' mechanism texts carry 'unknown'
  sections / generic bridge labels ("TBD x BSL-1.1", "unknown x unknown approach") - an
  upstream statement-content/metadata issue, NOT a resolution gap. When the metadata
  slice gives statements real sections/problems, the strict `critic` predicate becomes
  reachable; the resolution machinery is proven either way.

## Consequence chain this closes

GAP-1 fixed -> real statements bank -> GAP-2-fixed harvest lane sees real candidates ->
SENS-14 fires -> qualification card renders -> [Explore] chain reachable -> 219-06's
remaining checkpoint (navigator quality-confirms a real explored opportunity) becomes
reachable for the first time.

## Gates before calling either fix done

- Live re-run of 219-06 legs 2-3 on ador-ip-test (leg 1's extraction+metadata state
  persists, no need to re-run) once GAP-1 lands.
- Part 8 boundary unchanged (both fixes are LOCAL graph-read/derivation logic, zero egress).
- Reuse-before-build: GAP-2 is a pure additive constant extension; GAP-1 must not invent a
  second critic path - it resolves the ALREADY-SHIPPED Phase 212 critic asynchronously.

## Open items

- [x] GAP-1 fix lands and is verified live (commits 3c6bafe7 + 26c50566; ador-ip-test:
      25/25 verdicts resolved, 25 opportunity nodes + 50 evidence edges banked under
      predicate `all`, room.db verified)
- [ ] 219-06 re-run confirms >=1 banked opportunity, >=1 harvest candidate, reaches the
      navigator quality checkpoint (the 25 banked nodes are LEFT IN the room on purpose -
      they are the harvest lane's input for that re-run)
- [ ] On full resolve: move this file to `.planning/debug/resolved/` + summary block in
      `.planning/debug/knowledge-base.md`
