# Phase 244: Semantic Trigger Tier - Residual Register

Written at phase close (244-08), after all seven build plans (244-01 through 244-07) landed.
This is the one place a future reader finds what shipped, what did not, what is still owed,
and whether the phase gate was actually run.

---

## Section 1: What Shipped

| Requirement | Plans | Artifacts |
|---|---|---|
| TRIG-01 (content-tier sensor, real not decorative) | 244-01, 244-02, 244-03, 244-05, 244-06 | `TRIGGER_TIERS` grown to 4 (`signal`, `context`, `content`, `keyword`) + `isFallbackTier` allowlist (`lib/core/sensors/sensor-types.cjs`); `tableExists` promoted to a public export of `tri-modal-index.cjs`; `lib/core/eureka/fts-index-lifecycle.cjs` (`ftsIndexState`/`requestFtsBuild`/`spawnFtsBuildDrain`) + `scripts/fts-index-drain.cjs` (lazy build-on-first-miss, closing RESEARCH BLOCKER B-2); the guarded `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` reconcile inside `rebuildGraph`'s and `build-ecosystem-graph.cjs`'s existing transactions (closing Pitfall 4, the ghost-trigger resurrection hazard); `lib/core/sensors/sensor-content-relevance.cjs` (SENS-16, the 3-layer split, rides `context_block`, closed-scalar evidence only); `lib/core/doctor/eureka-fts-health-module.cjs` + the `eureka-fts-index-visible` `--acceptance` point |
| TRIG-02 (cross-family rank fusion) | 244-04 | `rankForSelector`'s optional `o.tierCandidates` seam (absent/empty = byte-identical no-op) + `_applyTierFusion` (the layered fusion pass, calls the already-shipped `rrfFuse`) + dedicated `TRIG_RRF_K` (default 25) in `lib/workflow/f-selector-ranker.cjs`; `buildTierCandidates` in `lib/core/orchestration-candidate-lift.cjs`, the LIVE production supplier wired into the `liftFiringCandidate` call site |
| TRIG-03 (MMR diversity pass) | 244-07 | `_applyMmrDiversity` in `lib/workflow/f-selector-ranker.cjs`, layered between `_applyTierFusion` and the `MAX_K=3` cut; `MMR_LAMBDA_RELEVANCE` (default 0.7, env-tunable via `TRIG_MMR_LAMBDA`), canonical Carbonell and Goldstein (SIGIR 1998) orientation, reusing the already-shipped `lexicalOverlap` Jaccard primitive as the sole similarity term |

All three requirements are verifiable from the seven SUMMARY files; no claim here goes beyond
what those files document.

---

## Section 2: Navigator Asks

Both items below were RESOLVED at planning or build time, not left open. Recorded here per the
plan's instruction, with the resolution confirmed rather than assumed.

**1. ROADMAP SC3's inverted MMR formula.** ROADMAP SC3 originally stated the formula as
`(1-lambda)*relevance - lambda*max_similarity_to_selected`, algebraically equivalent to the
canonical Carbonell form under `lambda' = 1 - lambda` but with the knob's semantics flipped
(writing `lambda=0.7` intending "mostly relevance" would actually mean "mostly diversity" under
that wording). **Status: ALREADY AMENDED.** `.planning/ROADMAP.md` line 327 (the live SC3 text)
already carries the corrected canonical orientation
(`lambda*relevance - (1-lambda)*max_similarity_to_selected`) and the `MMR_LAMBDA_RELEVANCE`
name, annotated "CORRECTED 2026-07-30 per 244-01/07-PLAN.md." A planner's note directly below SC3
(ROADMAP.md line 340) confirms this was resolved same day at planning time, not left for 244-07
to discover, and that 244-07-PLAN.md implemented against the corrected wording and confirmed code
and document agree (21/21 tests, both a bidirectional lambda fence and the crowding-out
regression). Re-confirmed at 244-08 execution time by reading the live ROADMAP.md text directly:
the corrected wording is present, matches the shipped `MMR_LAMBDA_RELEVANCE` constant in
`lib/workflow/f-selector-ranker.cjs`, and no plan text anywhere in this phase restates the
inverted form as current. No further amendment needed.

**2. 244-RESEARCH.md Finding F-10 (the exclusion list's stated rationale was factually wrong).**
The original ROADMAP wording justified excluding a vector/embedding leg from the trigger path on
the grounds that it "would introduce server infrastructure this repo does not run" and that
"Canon Part 8 blocks sending raw user turn text to any remote service" -- both false as applied to
a LOCAL vector index, since `sqlite-vec` and `@huggingface/transformers` are already pinned
dependencies and `vector-store.cjs` already runs a local embedding store. **Status: ALREADY
APPLIED.** `.planning/ROADMAP.md` line 314 carries the corrected text: the original wording is
preserved struck-through for traceability, followed by "both premises are false as applied to a
LOCAL vector index" and the corrected rationale ("the real, correct reason to exclude a
vector/embedding leg from this specific trigger path is latency budget, not architecture").
Re-confirmed at 244-08 execution time: the applied text is present and consistent with what
shipped. No plan text in this phase (244-01 through 244-08) reintroduces the falsified
architecture rationale; `lib/workflow/f-selector-ranker.cjs`'s own MMR-pass header comment
(244-07) states the latency-budget reason explicitly and cites Finding F-10 by name, never
repeating the false server-infrastructure claim.

---

## Section 3: Assumptions Carried Forward (A1-A8)

| # | Claim | Disposition | Reason |
|---|---|---|---|
| A1 | `content` belongs between `context` and `keyword` in `TRIGGER_TIERS` | CONFIRMED | Shipped in 244-01, NAVIGATOR-CONFIRMED per 244-01-SUMMARY.md ("This was NAVIGATOR-CONFIRMED research, not an executor call"). `isContextTier('content') === false` and `isFallbackTier('content') === true` are both pinned by mutation-proven tests. |
| A2 | `SENS-16` is the next free sensor id | CONFIRMED | Re-verified LIVE at 244-05 execution time (2026-07-30) against the real `SENSOR_REGISTRY`: 17 entries, canonical order ending at `sensorUrlIngest` (SENS-15, Phase 220). SENS-16 was free; no parallel session had claimed it. |
| A3 | `k=25` (this repo's small-corpus value) beats `k=60` for the dial's 3-6 item list | CONFIRMED (design decision, no correctness impact either way) | Implemented as `TRIG_RRF_K` default 25 in 244-04, citing the repo's own 2026-07-04 small-corpus validation. As the research itself noted, this affects fusion ORDERING quality only; there is no correctness regression from either value. |
| A4 | Reusing `eureka_fts` is preferable to a dedicated trigger corpus | CONFIRMED, with a materialized risk documented in Section 6 | Implemented: no second FTS5 table was created (244-01/02/03 all reuse the existing `eureka_fts`). 244-06's live doctor run found this single-index design DOES create real cross-consumer staleness exposure when the pre-existing Phase 219/226 eureka feature and this phase's TRIG-01 sensor share one index and only one of the two producers (this phase's rebuild reconcile) defends against staleness going forward. See Section 6. |
| A5 | Coverage-based relevance floor beats an absolute bm25 threshold | STILL OPEN | Implemented as `TRIG_CONTENT_MIN_COVERAGE` (default 0.34) in 244-05, per the research's own explicit instruction. Measured on ONE room only (`rethinking-mindrianos`). A second room should validate the floor before it is treated as settled. Documented in `docs/ENV-TUNING.md`'s new Semantic Trigger Tier section with this exact caveat. |
| A6 | The exclusion list's real justification is latency, not architecture | CONFIRMED | Section 2 above confirms the ROADMAP's applied correction (F-10) is present and consistent with what shipped; `f-selector-ranker.cjs`'s MMR-pass header states the latency-budget reason explicitly, never the falsified architecture rationale. |
| A7 | Option A (reconcile DELETE) is safer than Option B (external-content rebuild) | CONFIRMED, with a materialized instance of the named risk | 244-03 implemented Option A: the guarded reconcile rides `rebuildGraph`'s and `build-ecosystem-graph.cjs`'s existing transactions at both of `clearIndexerOwnedRows`'s two known call sites. The research's own stated risk -- "Option A leaves a window where the index is stale between rebuilds if the reconcile is missed at a third call site" -- generalizes to "or if a room predates the reconcile landing, or has not been rebuilt since," and 244-06's live doctor run found exactly this: two real rooms (`jonathan-contractor-motj`, `aion-eureka-synergy`) carry orphan `eureka_fts` rows from before the reconcile shipped. The reconcile design itself is sound (verified by 5 mutation proofs in 244-03); the residual is retroactive cleanup of pre-existing data, not a design flaw. See Section 6. |
| A8 | A langtalks-graph-expert pass would not overturn the RRF/MMR design | STILL OPEN | The mandated source remained UNREACHABLE this session too: `mcp__langtalks-graph-expert__*` tools were not present in this executing agent's available toolset (checked directly at 244-08 execution time, the same MCP-stripping condition 244-RESEARCH.md documented at research time). The RRF/MMR findings remain cross-verified only against this repo's own shipped `rrfFuse`/`lexicalOverlap`, which independently match the literature (Cormack/Clarke/Buttcher 2009, Carbonell and Goldstein 1998). See Section 4. |

---

## Section 4: The Declared Grounding Gap

244-RESEARCH.md's own Grounding Consultation Record states plainly that both
`langtalks-graph-expert` and Context7 MCP tools were stripped from the researching agent this
phase, that the Context7 gap was compensated with something stronger (the official SQLite FTS5
specification plus live execution against the repo's own runtime), and that the langtalks gap is
a REAL, OPEN gap: "do not treat the langtalks gap as closed. It is an open item, not a
non-finding." A consult on content-tier trigger design, and on when lexical-only retrieval
suffices versus hybrid, is still owed.

**Re-checked at 244-08 execution time, per this plan's own instruction to run the consult now if
the tools are available.** They were not: `mcp__langtalks-graph-expert__*` tools do not appear in
this executing agent's available function list. This is the identical MCP-stripping condition
244-RESEARCH.md documented at research time (upstream `anthropics/claude-code#13898`), now
confirmed a second time at execution time rather than assumed to have resolved itself.

**Disposition: STILL OPEN, carried forward verbatim in substance.** The langtalks consult on
"content-tier trigger design" and "when lexical-only retrieval suffices versus hybrid" has still
not run. This is not papered over: the RRF and MMR implementations are grounded in primary
literature (Cormack/Clarke/Buttcher SIGIR 2009; Carbonell and Goldstein SIGIR 1998) and
cross-verified against this repo's own already-shipped `rrfFuse`/`lexicalOverlap`, which
independently arrived at the same formulas -- a real, if partial, substitute grounding -- but the
langtalks-specific leg of the mandatory grounding-sources rule (CLAUDE.md, "Consult ALL Relevant
Grounding Sources During Dev Work") remains unfulfilled. **Recommended next step:** run the
consult the next time `mcp__langtalks-graph-expert__*` tools are reachable from a session working
in this area, before treating the content-tier design as fully grounded.

---

## Section 5: Deliberate Non-Goals

**1. `fragments` is never indexed.** Measured (244-RESEARCH.md Pitfall 3, live against the real
`rethinking-mindrianos` room.db): with `fragments` in the corpus, "what is the weather in paris
today" produced 3 confident hits (spurious), and two other genuinely irrelevant turns produced
hits too, while relevant turns scored no better. With `fragments` excluded (claims + Artifact
bodies only), relevant turns scored 40-100 percent coverage while three genuinely irrelevant
turns ("what is the weather in paris today", "my cat needs a vet appointment tomorrow", "order
pizza for dinner tonight") produced zero hits, with no threshold tuning. `indexNodes`'s existing
`SELECT id, type, properties FROM nodes` already excludes `fragments` by construction, so the
correct behavior needed zero code (244-02-SUMMARY.md: "a NON-GOAL, not a bug to fix"). 244-05's
own corpus-scoping mutation proof (MUTATION PROOF 6) confirmed live that widening the corpus to
include `fragments` breaks the FIRE/ANTI-FIRE separation.

**2. No vector or embedding leg on the trigger path.** The reason is LATENCY BUDGET, not
architecture (244-RESEARCH.md Finding F-10, applied to ROADMAP line 314 -- see Section 2 above).
`sqlite-vec` and `@huggingface/transformers` are already pinned dependencies and
`vector-store.cjs` already runs a local embedding store, so an architecture-based rationale would
be falsifiable against this repo's own `package.json`. The real reason: loading a transformer
model per turn blows the 1200ms NAV budget (`navigation-engine.cjs:820`), and the lexical leg
alone already separates relevant from irrelevant turns cleanly (Pitfall 3 measurements above).

**3. No new FTS table, no second RRF implementation, no new npm dependency, no KuzuDB, Memgraph
or Neo4j.** `eureka_fts` (Phase 211-02) and `rrfFuse`/`hybrid-retrieve.cjs` (Phase 211-02/219-02)
were reused, never rebuilt (Canon Part 7). KuzuDB stays retired (Phase 242 MOAT-02); Memgraph was
never part of this stack; Neo4j Aura is Brain's remote store, off-limits to local trigger logic
(Canon Part 8/9).

**4. `classifyTriggerTier` was deliberately not made to return `'content'`.** The `content` tier
reaches evidence through the SENS-16 sensor's own evidence bag (`trigger_tier: 'content'` stamped
directly in `sensor-content-relevance.cjs`'s `makeReach` call), not through the general-purpose
turn classifier. `classifyTriggerTier`'s existing precedence (signal, context, keyword-fallback)
is untouched; `content` sits in the `TRIGGER_TIERS` vocabulary array and the `isFallbackTier`
allowlist, but is never a `classifyTriggerTier` return value.

**5. `eureka_fts` was NOT converted to an external-content table.** 244-RESEARCH.md Q2 Option B
(external-content over a VIEW) was rejected as the primary recommendation for three stated
reasons, all honored in what shipped: it would change a shipped Phase 211/219 surface with its
own test suite (`tests/test-219-fts5-degrade.cjs`); it would lose the artifact-path-body text (a
VIEW cannot read the filesystem, and `nodeText`'s disk-body fallback is what makes the corpus
substantive per the research's own room.db table); and `'rebuild'` is O(corpus) on what could
become a hot path. Option A (own-content, with a guarded reconcile DELETE riding the existing
transaction) shipped instead in 244-03.

---

## Section 6: Known Residual Risks

**1. The `clearIndexerOwnedRows` call-site risk (research assumption A7), with a materialized
finding, not just a hypothetical.** 244-03 closed the two KNOWN call sites
(`lib/core/lazygraph-ops.cjs::rebuildGraph` and `scripts/build-ecosystem-graph.cjs::main`) with
an identical guarded reconcile, proven atomic by 5 live mutation proofs including a
sentinel-pre-existing-orphan-row atomicity test. If a THIRD call site to `clearIndexerOwnedRows`
is ever added without the same reconcile, it reintroduces the staleness hazard at that new site.
Separately, and this is the materialized part: 244-06's `eureka-fts-index-visible` doctor module,
run live against this dev machine's real `~/MindrianRooms` registry (45 rooms, 6 of them already
carrying a built `eureka_fts` index from the pre-existing Phase 219/226 semantic-search eureka
feature), found 2 genuinely stale rooms with orphan rows PREDATING the 244-03 reconcile:
`jonathan-contractor-motj` (611 fts_rows, 690 node_rows, 451 orphan_rows) and
`aion-eureka-synergy` (393 fts_rows, 694 node_rows, 308 orphan_rows). The reconcile prevents NEW
staleness on the NEXT rebuild of any room; it does not retroactively clean rooms that went stale
before it shipped or that have not been rebuilt since. **Confirmed independently at 244-08
execution time** via a live `node scripts/doctor.cjs --acceptance` run on the merged main branch
immediately before this plan's dispatch: `eureka-fts-index-visible` FAILED, citing
`jonathan-contractor-motj` (451 orphan rows) in the single-line acceptance summary. The second
room, `aion-eureka-synergy` (308 orphan rows), is confirmed via 244-06-SUMMARY.md's own
room-by-room census table (the acceptance summary's single-line format surfaces only the first
failing room by design; the doctor module's full per-room census, which 244-06-SUMMARY.md
transcribes, is where the second room is visible). **This is the doctor module working exactly as
designed** (244-06's SC1 must_have: "A stale index carrying rows for deleted nodes is reported as
a defect, not as healthy"); it is a genuine navigator action item, not a Phase 244 code defect.
**Recommended next step:** run a graph rebuild against both named rooms (the existing,
already-shipped rebuild mechanism) so 244-03's reconcile clears the orphan rows on the next
rebuild pass, then re-run `node scripts/doctor.cjs --acceptance` to confirm the point passes. A
one-release `DOCTOR_SKIP_EUREKA_FTS_HEALTH=1` bypass is available if the rebuild cannot happen
before the next release cut, per 244-06-SUMMARY.md's own documented operational consequence.

**2. The cold-turn cost of lazy build-on-first-miss.** 244-02's chosen lifecycle option (Pitfall
2 Option 1, the cheapest of three costed options) means the FIRST turn in any room whose
`eureka_fts` index is absent pays only an enqueue-plus-detached-spawn cost on that turn (the
query itself soft-fails to zero hits immediately, never blocking); the actual index build runs
asynchronously in a detached, unref'd child process (`scripts/fts-index-drain.cjs`) and completes
in the background. This is a deliberate, costed tradeoff (244-RESEARCH.md Pitfall 2), not an
oversight: the more expensive alternatives (a session-start build, or migration-chain creation)
were explicitly rejected for larger blast radius or blocking-turn risk.

**3. `rankForSelector` has exactly one live production caller supplying tier candidates.**
`orchestration-candidate-lift.cjs::buildTierCandidates`, wired into the `liftFiringCandidate`
confidenceJoin call site (244-04), is the ONLY production supplier of the optional
`o.tierCandidates` argument today. The optional-signal seam design (absent/empty = byte-identical
no-op, following the `sens10`/`role_level` idiom) means a second consumer CAN be added without
touching `rankForSelector` itself, but nothing currently forces or discovers a second wiring; a
future caller that wants tier-family fusion must build its own `tierCandidates`-shaped supplier
following the `buildTierCandidates` pattern.

---

## Section 7: The Phase Gate Result

Filled in after Task 3 ran. See `244-08-SUMMARY.md` for the full verbatim transcription of every
gate command's output, the cross-phase baseline comparisons (219, 236, 205), and the confirmation
method used for any pre-existing unrelated failure.
