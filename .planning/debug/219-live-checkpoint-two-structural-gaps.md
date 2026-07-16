---
kind: rca
slug: 219-live-checkpoint-two-structural-gaps
status: upstream-metadata-fixed-live-verified; 219-06-quality-checkpoint-open
opened: 2026-07-13
routed_to: Phase 219 direct fix (GAP-2, landed) + Phase 219 GAP-1 fix (landed, live-verified) + UPSTREAM-METADATA fix (Seam 2, landed + live-verified 2026-07-17, commits 4f1cd3ba RED + c74953f1 fix); 219-06 navigator quality checkpoint still open (not trivially reachable; see Open items)
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

## Second live proof case (aion-eureka-synergy) - 2026-07-16

Independent corroboration of the upstream statement-metadata gap this file already named at
lines 113-118 (the "unknown x unknown approach" / "TBD x BSL-1.1" honesty observation). A live
`/mos:eureka run` on a DIFFERENT real room (`~/MindrianRooms/aion-eureka-synergy`, live
embedding mode, MongoDB/mdbr-leaf-ir encoder, NOT offline/stub) reproduced the identical
signature. Logged here as a second proving case per the SEED-034 convention (corroborating
evidence, not a new defect class); no fresh slug opened.

Observed (traced, not guessed):

- 2783 pairs scored, top 25 ranked, `critic_resolution: 25 resolved (0 passing) / 0 pending`.
  The GAP-1 fix IS working here too - verdicts resolve, none stay stuck pending.
- All 25 statements carry the same critic tag: `entity_nonspecific`, route `general_shallow`,
  `entity_count: 0`.
- All 25 rendered statement texts contain the literal substring
  "a unknown x unknown approach to a unknown x unknown cross-domain bridge" - byte-identical
  to the ador-ip-test "unknown x unknown approach" already logged above.
- Directly traced upstream cause on THIS room: the top 25 pairs are dominated by
  near-duplicate self-referential entity nodes for one real-world entity under different
  extraction runs - "AION" (`entity:entity-extract:1ea807`), "AION Labs"
  (`entity:manual-smoke-test-2026-07-13:1ea3391f`), "Aion Research Gen"
  (`entity:entity-extract:de7656a4`) - cross-multiplied against single-common-English-noun
  pseudo-entities from a `manual-smoke-test-2026-07-13` batch ("Advantage", "Identification",
  "Drug", "Solutions", "Developing", "Virtual", "Current", all ids prefixed
  `manual-smoke-test-2026-07-13:*`). These generic-noun and near-duplicate-AION nodes starve
  the statement template of real "section"/"problem" content to substitute, producing the
  literal "unknown x unknown" text.
- Same class as the residual case tracked in
  `feedback_eureka_engine_internal_reframe_priority.md` ("a second, partially-fixed
  entity-extraction-noise bug ... one residual room-specific case open, not blocking") - now
  with a second room independently confirming it.
- Tail-quadrant honesty check: this room's tail carries `tail_suspect_noise: true`, all 24
  tail items at an IDENTICAL `attention=0.137 / growth=0.5` - a degenerate cohort, consistent
  with the same upstream metadata-thinness problem rather than 24 independent weak signals.

Raw report: `~/MindrianRooms/aion-eureka-synergy/.mindrian/eureka/portfolio-report.json`
(and `.md` alongside). Real private user data - read locally only, zero egress (Canon Part 8).

**Open RCA question this second case sharpens:** is the defect in the entity extractor
(`entity-extract.cjs` / the manual-smoke-test path) admitting single-common-noun and
near-duplicate entities it should filter or dedupe, OR in the statement-metadata slice
(`opportunity-statement.cjs`, wherever it pulls "section"/"problem" content) failing to attach
real content even when the underlying entities are meaningful? Trace it; a scoped fix (if
reachable per Reuse-Before-Build and Part 8) goes through the checkpoint flow before applying.

## UPSTREAM-METADATA RCA - TRACED (2026-07-16, fresh RCA pass; Seam 2 is PRIMARY)

The open question at lines 174-179 ("entity extractor admitting bad nodes" vs "statement-metadata
slice failing to attach content") is answered by reading the code + the two live rooms. It is
BOTH, but the literal "unknown x unknown" TEXT originates in Seam 2 (the statement-metadata slice).
Seam 1 (extraction junk + near-dup AION) is a real but SEPARATE compounding defect that governs
which pairs surface, not the origin of the 'unknown' text.

### The text-assembly chain (traced, not guessed)

`scripts/eureka-portfolio-report.cjs` builds a candidate per ranked pair, then
`lib/core/eureka/opportunity-statement.cjs` `deriveFields` L195 assembles:
`novel_application = a.section + ' x ' + b.section + ' approach to ' + firstShared`.
The literal string requires: `a.section='unknown'`, `b.section='unknown'`, and
`shared_problems[0]='a unknown x unknown cross-domain bridge'`.

That `shared_problems[0]` comes from `deriveSharedProblems` (report L282-290): when the pair's
problem-list intersection is empty AND both `primary_problem`s are empty, it falls to
`'a ' + (a.section||'unknown') + ' x ' + (b.section||'unknown') + ' cross-domain bridge'`.

### Why every entity node forces 'unknown' (the node-class defect)

Entity nodes (`lib/core/navigation/typed-entity.cjs`, company/technology/market) carry props
`{name, entityType, evidenceTier}` ONLY, and `source_path = 'entity:'+sid+':'+name` which ALWAYS
contains ':'. The substrate's `sectionFor` (`room-native-substrate.cjs` L119-129):
1. `props.section` -> absent on every entity node.
2. `source_path` first folder segment, ONLY when source_path has NO ':' -> every entity's
   source_path HAS ':' -> branch skipped.
3. -> literal `'unknown'`.
And `primary_problem` -> '' (no prop), `problems` -> [] (no prop). Entity relation edges
(COMPETES_WITH/USES_COMPONENT/SUPPLIES_TO) carry `{relation, entity_node}` props, no
`shared_problems`. So a pure entity-entity pair ALWAYS yields
`'unknown x unknown approach to a unknown x unknown cross-domain bridge'`.

### Live discriminating proof (aion-eureka-synergy room.db + portfolio-report.json)

- Ranked 25: 22 entity-entity, 3 entity-memory_artifact, 0 other-other. 22/25 statement texts
  contain "unknown x unknown" - EXACTLY the 22 entity-entity pairs.
- The 3 entity-artifact pairs (ranks 2, 8, 9) do NOT contain "unknown x unknown", because the
  memory_artifact endpoint carries `props.section` (a real domain), so `sectionFor` branch 1
  succeeds for that side. This isolates the cause to the ENTITY-NODE field gap, not to pair
  selection or extraction quality: a clean entity ("AION Labs") yields section='unknown' for the
  SAME node-class reason a junk entity ("Advantage") does. Fixing extraction alone would leave
  clean entity-entity pairs still emitting "unknown x unknown".
- 46 company entity nodes inspected: all carry ONLY name/entityType/evidenceTier, all source_path
  with ':'. Universal, schema-level.

### Root cause (one sentence)

Phase 218 HALF-WIRED entity nodes into the 215 opportunity-statement pipeline: it patched exactly
ONE of the five statement slots for the entity node class (the `title` slot, `room-native-substrate.cjs`
L169-190 props.name fallback) and left the other four (section, primary_problem, problems,
shared_problems) falling through to their content-node defaults, which for an entity node (no
props.section, colon-bearing source_path, no primary_problem/problems, relation edges without
shared_problems) collapse to the literal 'unknown'. The title fix already in the file is the proof
this class of fix was known and applied to one field only.

### Reuse-Before-Build fix direction (Part 7 / Part 8) - AWAITING APPROVAL, not applied

Reuse the ALREADY-SHIPPED DESCRIBES linkage (55/56 entities have a DESCRIBES edge to their source
memory_artifact) and the substrate chokepoint; do NOT invent a parallel path:
- PRIMARY: in `room-native-substrate.cjs`, teach the entity-node branch to inherit `section` (and
  any present `primary_problem`/`problems`) from the entity's DESCRIBES source artifact (which
  carries props.section). Sibling of the existing L169-190 title fix. Kills the "unknown x unknown"
  text with pure composition over an edge that already exists.
- FALLBACK for the 1/56 entity with no DESCRIBES source: derive `section` from `entityType`
  (company/technology/market is a real, present label) instead of 'unknown'.
- OPTIONAL: `deriveSharedProblems` derives an entity-entity bridge label from the relation edge type
  (COMPETES_WITH etc.) rather than the generic 'cross-domain bridge'.
- Seam 1 (dedup near-identical entity names + drop single-common-noun admissions in the extractor /
  manual-smoke-test path) is a SEPARATE scoped item - flag, do not fold into this patch. Already
  tracked in `feedback_eureka_engine_internal_reframe_priority.md` as the residual noise bug.

## Upstream-metadata RCA (2026-07-16): root cause traced, fix NOT applied (awaiting checkpoint)

**Root cause (Seam 2, statement-metadata slice - confirmed with a discriminating live test):**
the "unknown x unknown" text is NOT caused by bad entity *names*. It is caused by the statement
pipeline treating an **entity node** (company/technology/market node that only knows its own
name) as if it were a **content node** (an artifact carrying a domain/problem/section). Entity
nodes structurally have none of the four content fields the opportunity-statement template
needs, so every field collapses to the honest placeholder `unknown`. Seam 1 (extraction
admitting single-common-noun junk + near-duplicate AION nodes) is a real but SEPARATE defect
that only decides WHICH empty pairs float to the top - it is not the origin of the text.

**Mechanism, traced through code (not guessed):**
- `opportunity-statement.cjs` L195 assembles `novel_application = a.section + ' x ' + b.section
  + ' approach to ' + firstShared`.
- The literal string requires `a.section='unknown'`, `b.section='unknown'`, and
  `shared_problems[0]='a unknown x unknown cross-domain bridge'` (the fallback in
  `eureka-portfolio-report.cjs` `deriveSharedProblems` L282-290, reached when both sides have
  empty problem lists and empty `primary_problem`).
- All values are `unknown`/empty because entity nodes (`navigation/typed-entity.cjs`) carry
  only `{name, entityType, evidenceTier}` and a `source_path` of `entity:<sid>:<name>` (always
  contains a colon). The substrate's `sectionFor` (`room-native-substrate.cjs` L119-129) finds
  no `props.section`, skips the source_path branch because of the colon, and returns literal
  `'unknown'`.

**Discriminating live proof (aion-eureka-synergy):** 22/25 ranked pairs are entity-entity and
EXACTLY those 22 statements contain "unknown x unknown"; the 3 pairs with a `memory_artifact`
endpoint (ranks 2, 8, 9) do NOT - because the artifact carries `props.section`. 46 company
nodes inspected: all carry only `name/entityType/evidenceTier`, all have a colon in
`source_path`. A pristine "AION Labs" yields `section='unknown'` for the same reason junk
"Advantage" does -> confirms name quality is not the cause.

**This is a Phase 218 half-wiring:** Phase 218 wired entity nodes into the substrate and patched
exactly ONE of the five statement slots for the entity-node class - the `title` slot
(`room-native-substrate.cjs` L169-190, `props.name` fallback) - and left the other four
(`section`, `primary_problem`, `problems`, `shared_problems`) falling through to content-node
defaults. The existing title fix is proof this exact class of fix was known and applied to one
field only. 55/56 entity nodes have a `DESCRIBES` edge to their source `memory_artifact` (the
reuse path for the fix already exists in the graph).

**Files (primary fix site starred):**
- `lib/core/eureka/room-native-substrate.cjs` (`sectionFor` L119-129; entity-node field
  derivation L192-204) - *primary fix site*
- `scripts/eureka-portfolio-report.cjs` (`deriveSharedProblems` L282-290; candidate build
  L1105-1122) - renders the literal fallback
- `lib/core/navigation/typed-entity.cjs` - entity node schema carrying no content fields (root
  of the class gap)
- `lib/core/eureka/opportunity-statement.cjs` L195 - surfaces the placeholders (correct as-is,
  do not touch)

**Proposed fix direction (Reuse Before Build / Part 8 - NOT applied, awaiting user decision):**
1. Primary: in `room-native-substrate.cjs`, teach the entity-node branch to inherit `section`
   (and any present `primary_problem`/`problems`) from the entity's `DESCRIBES` source artifact
   (55/56 entities already have that edge; artifact carries `props.section`). Pure composition
   over an existing edge - direct sibling of the title fix already in the file.
2. Fallback for the 1/56 entity with no `DESCRIBES` source: derive `section` from `entityType`
   (`company`/`technology`/`market`) instead of `'unknown'`.
3. Optional: `deriveSharedProblems` derives an entity-entity bridge label from the relation
   edge type (`COMPETES_WITH`/`USES_COMPONENT`/`SUPPLIES_TO`) rather than the generic
   "cross-domain bridge".
4. Seam 1 stays SEPARATE: dedup near-identical entity names (AION / AION Labs / Aion Research
   Gen) + drop single-common-noun admissions in the extractor / `manual-smoke-test` path -
   distinct scoped item, already tracked in `feedback_eureka_engine_internal_reframe_priority.md`.
   Do NOT fold into this patch.

**Decision needed before applying:** approve (1)+(2) alone (minimal, kills the literal text) or
(1)+(2)+(3) (also upgrades the bridge label); confirm Seam 1 handled as a separate item.

## UPSTREAM-METADATA fix APPLIED (2026-07-17) - direction 1+2+3, live-verified

**Approved + landed:** fix direction (1)+(2)+(3) together; Seam 1 confirmed SEPARATE (still
tracked in `feedback_eureka_engine_internal_reframe_priority.md`), not folded in. Commits
`4f1cd3ba` (RED test) + `c74953f1` (fix), matching the GAP-1 RED-then-fix convention.

**Mechanism of each sub-fix (pure composition over already-shipped edges; zero new engine,
zero egress - Canon Part 7/8):**

1. `lib/core/eureka/room-native-substrate.cjs` (primary): after the techMap is built, a fixup
   pass over every entity node (detected via `props.entityType` in {company,technology,market},
   never row.type - the sectionFor hard rule) reads the entity's `DESCRIBES` source
   memory_artifact (entity=source, artifact=target - confirmed against the real room: 56
   DESCRIBES edges, 55 source-is-entity, 0 target-is-entity) and INHERITS the artifact's
   techMap `section` (+ any present `primary_problem`/`problems`). The artifact carries
   `props.section`, so its section is real. Direct sibling of the existing props.name title fix.
2. Same file: when an entity has no usable `DESCRIBES` source (missing edge, or the source
   artifact's own section is still 'unknown'), section falls back to the entity's `entityType`
   (a real present label) instead of 'unknown'. (In aion-eureka-synergy all 46 entities had a
   usable DESCRIBES source, so branch 1 covered them; branch 2 is unit-tested via behavior 13.)
3. `scripts/eureka-portfolio-report.cjs` `deriveSharedProblems`: the entity-entity bridge label
   is derived from the forming relation edge type (`COMPETES_WITH`->competes-with,
   `USES_COMPONENT`->uses-component, `SUPPLIES_TO`->supplies-to) instead of the generic
   "cross-domain bridge". The edge type is carried from the substrate's convergesPairs
   (`edge_type`) through pairsToScore -> scored -> the candidate build. Scalar enum only (Part 8).

**Test:** `tests/test-216-room-substrate.cjs` behaviors 13 (inheritance + entityType fallback +
edge-type carry) and 14 (entityTypeOf reads props.entityType only). RED without the fix (all 7
behavior-13 assertions fail on section='unknown'), GREEN with it. 47/47.

**LIVE PROOF (aion-eureka-synergy, `--pairs room` live encoder, 2783 pairs scored, top 25):**
- BEFORE: 22/25 statements contained the literal "unknown x unknown". AFTER: 0/25. Zero
  statements retain the word "unknown" in `novel_application`.
- BEFORE: all 46 entity nodes section='unknown'. AFTER: 46/46 REAL (0 unknown) - inherited
  domains competitive-analysis / explainability / financial-model / market-analysis /
  problem-definition / research / opportunity-bank / solution-design, plus the research-entry
  memory slug for the 27 entities describing that artifact.
- Bridge label: the room's single COMPETES_WITH edge now renders "... competes-with bridge"
  at rank 7 (fix 3), where before it was the generic "cross-domain bridge".
- Part 8: all reads/derivations LOCAL; verification outputs written to scratch, never egressed;
  no room-specific content in any commit message.

## Open items

- [x] GAP-1 fix lands and is verified live (commits 3c6bafe7 + 26c50566; ador-ip-test:
      25/25 verdicts resolved, 25 opportunity nodes + 50 evidence edges banked under
      predicate `all`, room.db verified)
- [ ] 219-06 re-run confirms >=1 banked opportunity, >=1 harvest candidate, reaches the
      navigator quality checkpoint (the 25 banked nodes are LEFT IN the room on purpose -
      they are the harvest lane's input for that re-run)
- [x] UPSTREAM-METADATA RCA (opened by second proof case, aion-eureka-synergy 2026-07-16):
      TRACED (see "UPSTREAM-METADATA RCA - TRACED" section above). Answer: BOTH seams real;
      the literal "unknown x unknown" TEXT originates in Seam 2 (statement-metadata slice not
      reading the entity node class - Phase 218 half-wiring, only `title` slot patched). Seam 1
      (extraction junk + near-dup AION) is a separate compounding defect. Discriminating proof:
      the 3 ranked entity-artifact pairs escape the text because the artifact supplies props.section.
- [x] APPLY the approved fix direction (1+2+3) - LANDED + LIVE-VERIFIED 2026-07-17.
      Commits `4f1cd3ba` (RED test) + `c74953f1` (fix). See the "UPSTREAM-METADATA fix
      APPLIED" section below. Live proof on aion-eureka-synergy: "unknown x unknown" 22/25
      -> 0/25; all 46 entity nodes now carry a REAL inherited/entityType section (0 unknown);
      the room's single COMPETES_WITH edge now renders a "competes-with bridge" label
      (rank 7). Suites: 216 substrate 47/47, 216-05 field-contract 11/11, 219-02 metadata
      slice PASS, 215 aggregator 8/0. Zero regression (baseline == post-fix failing-leg set,
      verified via git stash; all remaining reds are pre-existing environmental: `edges`
      table missing `review_status` column, offline encoder, repo-wide governance lint).
- [ ] 219-06 navigator quality checkpoint remains OPEN (NOT trivially reachable). The
      upstream-metadata blocker is removed - the critic now receives REAL sections instead
      of "unknown x unknown", so the strict `critic` predicate is UNBLOCKED on the metadata
      dimension (per lines 113-118). But a full pass-through still needs: (a) Seam 1 dedup of
      near-duplicate entities (27/46 sections collapse to the SAME research-entry slug, so
      real-but-duplicated sections still do not yet yield a PASSING entity-specificity
      verdict) - a SEPARATE tracked item; (b) a resolved PASSING critic verdict; (c) the
      banking WRITE path in a clean-schema room (the test env's `edges` table lacks
      `review_status`, which reds 219-01 banking independently). Left open per the fix
      objective (do not block this fix on the full quality checkpoint).
- [ ] On full resolve (once 219-06 closes): move this file to `.planning/debug/resolved/` +
      summary block in `.planning/debug/knowledge-base.md`. NOT done now: 219-06 still open,
      so the file stays in place with the upstream item checked (per the closeout rule).
