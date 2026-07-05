# Phase 211: Eureka Generator MVP - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Locked from SEED-049 + SEED-050's already-validated research (2026-07-02 + 2026-07-04 WebSearch passes), navigator-directed skip of a redundant research/discuss cycle given the decisions below are already resolved and cited.

<domain>
## Phase Boundary

Build the Eureka Generator MVP: the vertical slice that makes the RS differential MEASURED
(not model-judgment) via a tri-modal room.db (FTS5 lexical + sqlite-vec dense + RRF fusion),
run on a REAL room.db, de-risking small-embedding quality and fire-rate. This phase also
front-loads SEED-050's critic gold-set: 6 case cards + a hand-scored COMPRESSION baseline,
so Phase 212's Grounding Guard has calibration data on day one instead of starting cold.

This phase does NOT wire the eureka-reach/sensor into the live conversation (that is Phase
213, currently blocked pending the curing-sequence debug track's verdict on Phases 190/202/205).
This phase does NOT build the substrate/whitespace detection (Phase 212) or the critic's judges
(Phase 212/213). It produces the measured differential engine + the gold-set data, nothing more.

</domain>

<decisions>
## Implementation Decisions (LOCKED - from SEED-049's validated research, do not re-derive)

### D1 - Vector leg: sqlite-vec as PRIMARY (not opt-in)
sqlite-vec confirmed production-safe: pure C, zero deps, ACID-correct (hooks into SQLite's
xBegin/xSync/xRollback/xCommit). Scale data: 100K vectors @384-dim run under 100ms; a
MindrianOS room (hundreds to low-thousands of nodes) is nowhere near that ceiling. Use as
PRIMARY, with plain CJS-cosine as the zero-dependency fallback when the extension can't load
on a given platform (verify via `SELECT vec_version();` at runtime).

### D2 - LSA retirement
No counter-evidence found; the Python-bound LSA (lib/core/rs_math.py, rs_hybrid.py,
scripts/compute-hsi.py, detect-reverse-salients.py) is retired in favor of the measured
semantic leg below. rs-differential-scorer.cjs:107 is the existing CJS port precedent to
follow for style.

### D3 - Embeddings: transformers.js, Xenova/all-MiniLM-L6-v2 default
`@huggingface/transformers` v4 confirmed production-ready in plain Node (no GPU), 53%
smaller bundles, ~200ms builds. Model short-list in order of fit:
- `Xenova/all-MiniLM-L6-v2` (384-dim) - the DEFAULT workhorse.
- `Xenova/bge-small-en-v1.5` (384-dim) - stronger retrieval-tuned alternative if quality
  benchmarks show it's needed.
- `nomic-ai/nomic-embed-text-v1.5` (768-dim) - only if room-scale ever needs the extra signal.
Use `dtype: q8` or `q4` for CPU inference speed/memory. This is a NEW Node/lab dependency
(not yet in package.json) - add it.

### D4 - Rerank: FlashRank as local default
FlashRank: CPU-only, no Torch/Transformers dependency, ~4MB, one of the smallest reranking
models available. Ship it locally (this REVERSES the original seed's "defer rerank to
Brain-side" lean - ship it, it's cheap now). Upgrade path if English-only MiniLM-class quality
proves insufficient: BGE-Reranker-v2-m3 (Apache-2.0, 100+ languages).

### D5 - Fusion: RRF with room-scale-tuned k
RRF k=60 is the textbook default but is scale-aware in practice: small corpora tune k down
(~20-30), large corpora push k up. A room-scale corpus (small candidate lists) wants LESS
top-rank dampening. Seed `RRF_K` at 20-30 for room.db queries (not the generic 60), exposed
as an env-tunable (matches this repo's `RS_SEMANTIC_FLOOR` precedent from Phase 200). RRF only
earns its keep when the fused rankers are genuinely different signals - FTS5/BM25 + dense
vectors is exactly the diverse pair; do not fuse near-duplicate rankers.

### D6 - agno / LSA / Model2Vec disposition
agno (FTS5, no Python) is reference-only precedent, not a dependency to add. Model2Vec (the
seed's original D3 lean) is real but far less discussed in current sources than MiniLM/BGE -
default to `all-MiniLM-L6-v2` per D3 above unless a room-scale benchmark later shows
Model2Vec winning on speed with acceptable quality loss (not this phase's job to benchmark).

### D7 - Gate criteria (from SEED-049's graduation plan, Phase 211 entry)
Gate: `run-all-211` (new aggregator, follow the `run-all-200.sh`/`run-all-210.sh` pattern) +
a real-room eureka spot-check + the deployed Cross-Topic Connection judge (Plurai, reuse-first
per Part 7 - `search_evaluators` already lists 5 Larry-family classifiers deployed, check for
an existing Cross-Topic Connection judge before building a new one).

### D8 - SEED-050 gold-set front-load (this phase's second deliverable)
Write the 6 case cards, each with a human-validated destination + `human_baseline_effort`:
- `archimedes-uq` (positive case)
- `archimedes-sterling` (Lean-checkable control, `critic_available: lean_checkable`)
- `archimedes-darkmatter` (Type-3 find-analogies GOLD - dark-matter <-> ppb-simulation
  pattern-transfer; seed on a PART of the challenge, the abstracted "rare-signal-in-vast-
  background" pattern, not the whole doc)
- `davinci-salient` (transfer case, no objective critic, `critic_available: none`)
- niche-foods NULL-CONTROL (`posture: solve` - arrival WITHOUT compression, so the judge
  cannot conflate "confirmed what they knew" with "compressed their thinking")
- 1 math case (Lean-checkable)
Then run Larry manually on all 6, hand-score with the COMPRESSION formula
(`Score = CompressionDelta(hypothesis_in -> destination) x GuardGate x StatusQuoGate`, per
SEED-050) as the first gold baseline. This is DATA/fixture work, not a judge implementation -
Phase 212 builds the actual Grounding Guard judge that consumes this gold-set.

### Claude's Discretion
- Exact file layout for the new tri-modal room.db module (follow existing lib/core/
  conventions; rs-differential-scorer.cjs and the Phase 200 RS engine files are the closest
  analogs - the pattern mapper should confirm the best home).
- Whether sqlite-vec loads as a Node native extension or via WASM fallback - runtime-detect,
  do not hardcode a single loading strategy.
- Exact schema for the 6 case-card fixture files (JSON vs Markdown+frontmatter) - follow
  whatever this repo's existing eval-fixture convention is (check evals/plurai/ for the
  house pattern before inventing one).

</decisions>

<specifics>
## Specific Ideas

None beyond the locked decisions above - SEED-049's research is unusually concrete for a
seed-stage document (specific package names, specific model identifiers, specific env-var
names already matching house convention).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Seeds (the primary source of truth for this phase's scope)
- `.planning/seeds/SEED-049-mindrian-insight-engine-tri-modal-tri-source-hybrid-retrieval.md` - full technical research (D1-D5 above), the graduation plan (Phase 211 = seed's original "Phase 206"), the three eureka MODES section, provenance.
- `.planning/seeds/SEED-050-eureka-eval-salient-verifier-judge-synthetic-trust.md` - the 6 case-card spec (section "The smallest experiment (this week)", steps 1-3 are THIS phase's D8 scope; steps 4-5 are Phase 212's).
- `.planning/research/2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md` - backs both seeds; the real-user evaluation corpus behind the case-card personas (ARCHIMEDES, DA VINCI).

### Existing code to reuse/extend (Part 7)
- `rs-differential-scorer.cjs` (mentioned at line ~107 in SEED-049) - the existing CJS
  differential scorer to upgrade from model-judgment to measured.
- `scripts/rs-discovery-engine.cjs` - Phase 89.2/89.5/200 RS engine, the closest existing analog.
- Phase 200 ROADMAP entry (`rs-engine-spine-corpus`) - the RS Engine Spine this phase depends on.
- `evals/plurai/` directory - house convention for eval fixtures/harness; check before inventing
  a new case-card format for D8.

### ROADMAP
- `.planning/ROADMAP.md` Phase 211 entry (this phase's registered goal + dependencies) and
  Phase 200 entry (the hard dependency).

</canonical_refs>

<deferred>
## Deferred Ideas

- The Grounding Guard judge itself, IntellAgent synthetic harness, Arrival/status-quo/question-type
  judges, the deterministic COMPRESSION meter implementation - all Phase 212/213 scope (SEED-050
  steps 4-5), not this phase.
- The eureka-reach/SENS-13 sensor wiring, Shape-F offer, LarryReacts integration - Phase 213
  scope, explicitly BLOCKED pending the curing-sequence debug track's verdict.
- Portfolio-scale batch scoring (SEED-048) - Phase 215 scope.

</deferred>

---

*Phase: 211-eureka-generator-mvp-tri-modal-room-db-sqlite-vec-xenova-all*
*Context gathered: 2026-07-05 via navigator-directed seed-lock (research already validated in SEED-049/050, redundant re-research skipped)*
