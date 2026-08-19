# Environment Variable Tuning for MindrianOS

These Claude Code environment variables optimize MindrianOS session behavior. Set them in your shell profile or per-session.

## AUTOCOMPACT_PCT_OVERRIDE

**What:** Controls when autocompact triggers (percentage of context window used).
**Default:** ~93% (187K of 200K tokens)
**MindrianOS recommendation:** 85% for rooms with large STATE.md, 90% for typical rooms.
**Why:** Lower threshold gives PreCompact hook more time to save room context before compression. Rooms with 8 populated sections and meeting archives have larger session-start context.

```bash
export AUTOCOMPACT_PCT_OVERRIDE=85
```

## MAX_THINKING_TOKENS

**What:** Maximum thinking budget per response.
**Default:** Model-dependent
**MindrianOS recommendation:** Increase for /mos:grade and /mos:act sessions.
**Why:** Grading against 100+ real projects requires nuanced reasoning. Methodology sessions (especially JTBD, Six Hats, Scenario Planning) benefit from deeper thinking to push past surface-level answers.

```bash
export MAX_THINKING_TOKENS=32768
```

## CLAUDE_CODE_MAX_CONTEXT_TOKENS

**What:** Override context window size.
**Default:** 200K (or 1M with [1m] suffix)
**MindrianOS recommendation:** Use 1M for deep multi-hour methodology sessions. Standard 200K for routine work.
**Why:** Deep methodology chains (thesis pipeline, discovery pipeline) accumulate significant context across 5+ stages. 1M context prevents mid-pipeline compression.

Note: 1M context is available for Opus 4.6 and Sonnet 4.6 via the [1m] model suffix. It uses beta header context-1m-2025-08-07.

## Eureka Embedding Spine (local, no Python, no Brain)

The eureka tri-modal index embeds room text LOCALLY with transformers.js. The
only network touch is the one-time model-weight download (by model id only; no
room bytes egress, Canon Part 8). These tune the model, its output dimension,
and where weights cache.

### MINDRIAN_EMBED_MODEL

**What:** The transformers.js feature-extraction model id used for local embeddings.
**Default:** `MongoDB/mdbr-leaf-ir` (the quick(260706-13z) D3 spike winner: Apache 2.0, 23M params, #1 on MTEB BEIR/RTEB <=100M params, measured 384-dim in transformers.js v4).
**Alternatives:** `Xenova/bge-small-en-v1.5` (384-dim, the diligence's named fallback), `Xenova/all-MiniLM-L6-v2` (384-dim, the pre-13z default, kept for rollback).
**Why:** A model swap is a config change plus a re-embed, never a schema edit. Set this, then reindex; the vec table rebuilds at the new model's dim automatically.

```bash
export MINDRIAN_EMBED_MODEL=Xenova/bge-small-en-v1.5
```

### MINDRIAN_EMBED_DIM

**What:** Override the embedding output dimension (positive integer).
**Default:** Resolved automatically: the model's known dim (from the built-in map) else the default model's dim. Not normally set.
**Why:** Only needed when running an env-selected model whose dim is not in the built-in map. embedTexts always stamps the TRUE dim from the vector length, so a wrong hint is caught at index time rather than silently corrupting the store.

```bash
export MINDRIAN_EMBED_DIM=768
```

### MINDRIAN_MODEL_CACHE

**What:** Directory where transformers.js caches downloaded model weights.
**Default:** transformers.js `env.cacheDir` (the package's own cache under node_modules).
**Why:** Point weight storage at a caller-chosen path (a shared cache, a larger disk). Set before the first embedding call; the one-time download honors it.

```bash
export MINDRIAN_MODEL_CACHE=/opt/mindrian/model-cache
```

### MINDRIAN_EUREKA_SMOKE_TIMEOUT_MS

**What:** Per-layer timebox (ms) for the `doctor --eureka-smoke` model probe (L3).
**Default:** 20000 (20s).
**Why:** L3 only embeds a real string when the model is already cached. The timebox is the safety net that turns a would-be silent hang into a reported FAIL, so the probe stays bounded inside a release gate.

```bash
export MINDRIAN_EUREKA_SMOKE_TIMEOUT_MS=30000
```

### MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD

**What:** Let `doctor --eureka-smoke` L3 trigger the real model download on a cache miss.
**Default:** unset (a cache miss is a graceful PASS; the probe NEVER downloads).
**Why:** By default the smoke probe refuses to fetch weights (safe on airgapped CI and release gates). Set to `1` only when you deliberately want to warm the cache and confirm a live download.

```bash
export MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD=1
```

### MINDRIAN_WHATWHY_MARGIN

**What:** The confidence-margin threshold for the tier-2a local embedding WHAT-vs-WHY classifier (`lib/core/eureka/embedding-classifier.cjs`). Each candidate is scored by nearest-neighbor cosine similarity against a curated WHAT set and a curated WHY set; the absolute gap between the two is the margin. A candidate whose margin is at or above this threshold is resolved locally for free; a candidate below it escalates to the tier-2b LLM classifier for that name only.
**Default:** `0.10` (a positive float). This value is measurement-calibrated in quick-task 260714-k44 against the real local encoder (`MongoDB/mdbr-leaf-ir`). That encoder is a retrieval model, not a classifier, so its WHAT-vs-WHY separation on venture vocabulary is weak and it leans WHY; at 0.10 every calibration holdout is confident-and-correct while every misclassification-prone term escalates, so a confident local verdict is trustworthy.
**When to change it:** Raise it (for example `0.15`) to escalate more candidates to the LLM tier when you want higher precision and are willing to spend more API calls. Lower it (for example `0.05`) to resolve more candidates locally for free, accepting that real companies may be confidently mislabeled WHY and suppressed. Any malformed value (`0`, a negative, or non-numeric) falls back to the calibrated default, so an operator env can never zero out or invert routing.

```bash
export MINDRIAN_WHATWHY_MARGIN=0.15
```

## Reach Hedge Ranker (Phase 222, room-local, zero egress)

When more than one reach candidate fires on a turn, `suggest_next`,
`reach_candidates`, and the per-turn auto-fire decision all resolve to one shared
scored pick, and a hand-rolled multiplicative-weights (Hedge) layer adjusts that
score from the room's own Phase 159 outcome log. Both tunables below are read
defensively with a numeric fallback in `lib/workflow/reach-hedge-ranker.cjs`, so a
malformed value can never zero out or invert ranking. Both are room-local ranking
tunables with zero egress (Canon Part 8): weight state never leaves room.db and
never enters a Brain Context Packet.

### MINDRIAN_HEDGE_UPDATE_N

**What:** The Hedge weight-update debounce window, in qualifying
`f_selector_decision` outcome events. The weights refit at most once per N events,
never per-event.
**Default:** `50` (a positive integer). This is SEED-009's own precedent number,
matching Phase 158's existing debounce discipline, not a freshly-invented one.
**Why:** Per-event updates thrash the weights (a single noisy outcome swinging them,
then correcting, then swinging again) with no accuracy benefit at this data scale.
The bound is TUNABLE-LATER from telemetry once the outcome-edge corpus grows. Any
non-integer or non-positive value falls back to the default.

```bash
export MINDRIAN_HEDGE_UPDATE_N=50
```

### MINDRIAN_HEDGE_ETA

**What:** The Hedge / multiplicative-weights (MWU) learning rate. It bounds how far
a single fold can swing the expert weights.
**Default:** `0.3` (a positive float). At 0.3 a single fold's multiplicative swing is
bounded to about exp(0.3) ~ 1.35, conservative for a two-expert Hedge (Arora-Hazan-Kale
2012).
**Why:** The horizon-optimal learning rate is T-dependent and is deliberately NOT
computed at this data scale (it would overfit at under 100 outcome edges). A fixed,
conservative rate is the honest choice until the corpus is large enough to calibrate;
TUNABLE-LATER. Any non-finite or non-positive value falls back to the default.

```bash
export MINDRIAN_HEDGE_ETA=0.3
```

## Semantic Trigger Tier (Phase 244, room-local, zero egress)

Phase 244 gives `trigger_tier` a fourth member, `content`: lexical relevance to
the room's own curated material (bm25 over the `eureka_fts` FTS5 index),
sitting between `context` and `keyword` in the frozen R3 precedence. Fusing
that signal against the D4 command-registry ranking and keeping near-duplicate
candidates from crowding out a genuinely different one needed two small,
already-shipped primitives wired together, not new ones: Reciprocal Rank
Fusion (`hybrid-retrieve.cjs::rrfFuse`) and Maximal Marginal Relevance
diversity (`lexical-overlap.cjs::lexicalOverlap` as the similarity term). Both
tunables below live in `lib/workflow/f-selector-ranker.cjs`, resolved once at
module load with a numeric fallback, so a malformed operator env can never
zero out or invert ranking. All four numeric variables are room-local ranking
tunables with zero egress (Canon Part 8): the fused/diversified lists never
leave the local process, and the similarity projection reads only LOCAL
command handles (`command`, `jtbd_label`, `framework`), never prose.

### TRIG_RRF_K

**What:** The rank-fusion `k` in `1/(k+rank)` for the cross-family fusion pass
(`_applyTierFusion`) that merges the D4 command-registry ranking against
caller-supplied tier-tagged candidate lists before the `MAX_K=3` cut.
**Default:** `25` (a positive finite number). Invalid values (non-numeric,
zero, negative) clamp back to `25`.
**Why not the textbook 60:** this repo's own 2026-07-04 small-corpus
validation (`hybrid-retrieve.cjs:8-13`) prescribed `k` in 20-30, not the
Cormack/Clarke/Buttcher SIGIR 2009 textbook default of 60: small corpora want
LESS top-rank dampening. With `MAX_K=3`, the dial's candidate list is only 3
to 6 items, which is exactly the small-corpus case that validation covers.
**Honest limitation:** at `k=25` the rank-1-versus-rank-2 RRF gap is about 3.8
percent, small relative to the frozen 0.15 `BEHAVIORAL_CHANNEL_MARGIN` detent
threshold, so RRF ordering alone rarely flips that detent on its own. The
diversity term (`TRIG_MMR_LAMBDA` below) is what actually changes outcomes;
this fusion pass earns its keep mainly when a cross-family candidate is
buried multiple ranks deep by the D4 score. `TRIG_RRF_K` is a DEDICATED
variable, never overloading the eureka subsystem's own room-scale fusion-k
dial: the two consumers have different corpus sizes, so sharing one dial
would couple two unrelated tuning knobs.

```bash
export TRIG_RRF_K=25
```

### TRIG_MMR_LAMBDA

**What:** `MMR_LAMBDA_RELEVANCE`, the relevance-vs-diversity weight for the
greedy Maximal Marginal Relevance pass (`_applyMmrDiversity`) that runs after
fusion and before the `MAX_K=3` slice, so three near-duplicate same-family
candidates cannot occupy every top slot when a genuinely different candidate
is available.
**Default:** `0.7`, clamped to the closed interval `[0, 1]`. Any non-finite or
out-of-range value falls back to `0.7`.
**Orientation, stated in the user's terms:** this is the RELEVANCE weight, not
a diversity weight. `1.0` means pure relevance (the diversity term is zeroed
out, output equals plain relevance order); `0.0` means pure diversity (the
relevance term is zeroed out, the greedy loop picks purely to minimize
similarity to what is already selected). At the shipped default of `0.7`,
relevance dominates but a sufficiently similar top candidate can still be
displaced by a more diverse runner-up.
**The ROADMAP inversion, named so it is not repeated as a bug report:**
ROADMAP SC3 states the MMR formula as
`(1-lambda)*relevance - lambda*max_similarity_to_selected`. That form is
algebraically equivalent to the canonical Carbonell and Goldstein (SIGIR
1998) orientation under `lambda' = 1 - lambda`, but the SEMANTICS OF THE KNOB
ARE FLIPPED: writing `lambda=0.7` under the ROADMAP's form intending "mostly
relevance" would actually produce "mostly diversity". This implementation
follows the CANONICAL orientation (`lambda * Rel - (1-lambda) * maxSim`), and
the constant is named `MMR_LAMBDA_RELEVANCE` so the name itself carries the
correct semantics. SC3's one-line formula needs a navigator amendment to
match; see `.planning/phases/244-semantic-trigger-tier/244-RESIDUALS.md`
Section 2 for the exact wording change.

```bash
export TRIG_MMR_LAMBDA=0.7
```

### TRIG_CONTENT_MIN_HITS

**What:** The floor on `hit_count`, the plain number of `eureka_fts` bm25
matches, below which the `content` trigger tier's sensor (`SENS-16`,
`sensor-content-relevance.cjs`) does not fire.
**Default:** `2` (a non-negative number, read from source at doc time). Any
non-numeric or negative value falls back to `2`.
**Why it moves what the user sees:** raising it (for example `3`) makes the
content tier fire only on turns with stronger corpus-relative evidence,
reducing false positives on a thin match; lowering it (for example `1`) makes
the tier fire more readily, at the cost of surfacing weaker single-word
coincidences.

```bash
export TRIG_CONTENT_MIN_HITS=2
```

### TRIG_CONTENT_MIN_COVERAGE

**What:** The floor on `coverage`, the fraction of sanitized query tokens
present in the top hit's indexed text, below which the `content` trigger
tier's sensor does not fire.
**Default:** `0.34` (a float in `[0, 1]`, read from source at doc time). Any
non-numeric or out-of-range value falls back to `0.34`.
**Why coverage, not an absolute bm25 threshold:** bm25 is NOT comparable
across queries, because it varies with query term count and corpus
statistics, so a fixed bm25 cutoff would mean different things on different
turns. Coverage is comparable across turns. The measured separation on the
live `rethinking-mindrianos` room (244-RESEARCH.md Pitfall 3) supports the
default: relevant turns landed at 40 and 100 percent coverage, one weak
spurious match landed at 17 percent. **Research assumption A5, carried as
STILL OPEN in the residual register:** this was measured on ONE room only; a
second room should validate the floor before it is treated as settled.
**Why it moves what the user sees:** raising it (for example `0.5`) requires
a tighter lexical match before the content tier fires, reducing spurious
single-token coincidences; lowering it (for example `0.2`) makes the tier
more permissive, closer to the 17 percent spurious-match floor the research
measured.

```bash
export TRIG_CONTENT_MIN_COVERAGE=0.34
```

### MOS_NO_DETACHED_FTS_BUILD

**What:** A TEST SEAM, not a user knob (matching how this file treats other
seams, for example `MINDRIAN_EUREKA_SMOKE_ALLOW_DOWNLOAD` above). Setting it
to `1` suppresses the detached `scripts/fts-index-drain.cjs` spawn that
`spawnFtsBuildDrain` would otherwise fire when the content tier's sensor
enqueues a lazy index build on first miss, so a test can own the timing of
that build itself instead of racing a background process.
**Default:** unset (the detached spawn fires normally).
**Why:** without this seam, a hermetic test that forces an absent or stale
`eureka_fts` index would non-deterministically race a real detached child
process. This is not something a user should ever need to set in normal
operation; it exists for `tests/test-244-fts-index-lifecycle.cjs` and its
siblings.

```bash
export MOS_NO_DETACHED_FTS_BUILD=1
```

## Graph Derivation Floors (Phase 224, room-local, zero egress)

When a room artifact is written, Phase 224 scores it against the room's other
artifacts with the LOCAL encoder and proposes typed CASCADE edges for the pairs
that clear a similarity floor. The score is a topical cosine (symmetric), so the
score-only layer claims CONVERGES and INFORMS ONLY (D-01): a high band maps to
CONVERGES, a moderate band maps to INFORMS with the direction older-artifact
-INFORMS-newer. Stance edges (CONTRADICTS / INVALIDATES / REFINES / ROOT_CAUSES)
are structurally excluded here because a false stance edge is the noisiest
possible proposal to a navigator; those are reserved for a future
LLM-critiqued pass, never this score-only layer.

Both floors are read at CALL time by `lib/core/graph-derive-classifier.cjs` with
a guarded fallback: a non-numeric value, `0`, a negative value, or a value above
`1` falls back to the calibrated default for that floor, and a pair where
`DERIVE_CONVERGES_FLOOR` sits below `DERIVE_INFORMS_FLOOR` (band inversion)
falls back to BOTH calibrated defaults. So a malformed operator env can never
zero out or invert derivation. Both are room-local ranking tunables with zero egress (Canon Part
8): scoring runs on LOCAL bytes and the derived edges never enter a Brain
Context Packet.

The defaults are FIXTURE-CALIBRATED, not intuition constants. Measured
2026-07-15 with the real local encoder (MongoDB/mdbr-leaf-ir, q8, 384-dim) over
the b2-journey fixture (`tests/helpers/fixture-room-224.cjs`), via the
`--calibrate` leg of `tests/test-224-classifier.cjs`: the one RELATED pair
scored 0.6095 while the highest observed NON-related (noise) pair scored 0.3683
(noise mean ~0.10 across 190 pairs). The floors sit above that noise ceiling
with a clear margin, biased UPWARD (precision over recall). The evidence table
lives in the `graph-derive-classifier.cjs` module header; the entries below
document THOSE numbers, never re-derived ones.

### DERIVE_CONVERGES_FLOOR

**What:** The semantic-similarity floor (a 0..1 float) at or above which a scored
artifact pair is proposed as a CONVERGES edge (the high band).
**Default:** `0.55`. Calibrated below the 0.6095 related pair (so it fires
CONVERGES on real related prose) and ~0.18 above the 0.3683 noise ceiling (so
cross-domain noise never fires).
**Why:** Raising it (for example `0.6`) silences the graph -- fewer proposals,
higher precision. Lowering it risks the false-proposal flood CONTEXT.md was
designed against: a navigator drowning in wrong CONVERGES proposals stops
trusting all of them. Precision over recall, always: these edges land as
proposals a human ratifies, so a wrong one costs trust, a missed one costs only
a later re-derive.

```bash
export DERIVE_CONVERGES_FLOOR=0.55
```

### DERIVE_INFORMS_FLOOR

**What:** The semantic-similarity floor (a 0..1 float) at or above which a scored
artifact pair is proposed as an INFORMS edge (the moderate band, directed
older-artifact-INFORMS-newer). A pair at or above DERIVE_CONVERGES_FLOOR becomes
CONVERGES instead; a pair below DERIVE_INFORMS_FLOOR derives nothing.
**Default:** `0.45`. A moderate band strictly between the 0.3683 noise ceiling
and the 0.55 CONVERGES floor (~0.08 margin above noise).
**Why:** The same precision-over-recall bias as the CONVERGES floor. Lowering it
toward the noise ceiling starts proposing INFORMS edges on topic coincidence;
raising it collapses the moderate band toward CONVERGES-only.

```bash
export DERIVE_INFORMS_FLOOR=0.45
```

**D-04 (no floor makes the system guess).** Neither floor is a fallback path:
when the local encoder is unavailable, the derivation layer scores nothing,
writes a single scalar-only `derivation_skipped` disclosure marker, and moves
on. There is NO lexical-only degrade -- a symmetric keyword score cannot
honestly type an edge, so unavailability is a DISCLOSED skip, never a silent
lexical guess. The floors only ever gate a real encoder score.

## Zero-Score No-Match Gate Floor (Phase 225, room-local, zero egress)

When a user message fingerprint-matches NO known room (every room scores zero)
AND the session has a real bound primary, the intent-classifier tripwire fires a
distinct F.8 "no room matched" Decision Gate (continue-in-primary / new-project /
no-room) instead of silently landing the write in the old bound primary
(SEED-039 proving_case_2, the line-509 gap closed this phase). This floor is the
anti-overfire guard that keeps trivial acknowledgements silent while a
substantive conversational reframe still clears it. The value is read defensively
in `scripts/intent-classifier.cjs` with a numeric fallback, so a malformed
operator env can never zero out or invert the gate. The gate carries room slugs
only, never prompt content, to the LOCAL renderer (Canon Part 8: zero Brain egress).

### MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS

**What:** The minimum count of DISTINCT surviving message tokens (post-stopword,
each of length >= 2, deduplicated) a zero-score message must carry before it can
fire the no-match F.8 gate. Distinct, not raw: a repetitive message ("ok ok ok ok
ok ok ok ok") carries many raw tokens but few distinct ones and must not clear
the floor. A message with fewer surviving distinct tokens preserves the legacy
silence.
**Default:** `8` (a positive integer). Paired with PD-1's once-per-session-per-room
trace suppression so the gate fires at most once per room per session even under
sticky.
**Why (PD-3, anti-overfire):** This is the explicit guard against the Phase-210
over-enforcement mistake. A trivial acknowledgement ("ok", "thanks", "sounds
good") must NOT fire the gate and must preserve the legacy zero-score silence,
while a substantive conversational reframe (SEED-039 proving_case_2, the Gaurav
student-reframe incident) clears the floor and gets the gate. Raise it (for
example `12`) if the gate fires on routine short prompts; lower it (for example
`5`) only if a genuine reframe was missed. Any non-integer or non-positive value
falls back to the calibrated default.

```bash
export MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS=8
```

## Eureka Reasoning-Mode Pair Cap (Phase 226, room-local, zero egress)

When the local embedding encoder is unavailable (a cold machine, no cached model)
or a room's typed-edge graph is too thin, `/mos:eureka` degrades to the
encoder-free REASONING-mode fallback (SEED-058): it reads raw room markdown,
pre-filters candidate pairs with the free Jaccard lexical anchor, and runs the SAME
Grounding Guard two-pass rubric at full rigor. The paid rubric pass is the cost, so
the fan-out into it must be bounded by a cap, never by room size. This floor is that
cap. It carries no user content anywhere; the whole path is LOCAL raw-markdown +
in-session judge, zero Brain egress (Canon Part 8).

### MINDRIAN_EUREKA_REASONING_MAX_PAIRS

**What:** The maximum number of candidate pairs the free Jaccard pre-filter selects
and sends to the (paid) reasoning rubric per run. A room with 200 entries has on the
order of 20,000 raw cross-section pairs; the pre-filter keeps only the cap-many
lowest-lexical-overlap pairs (the eureka band: shared meaning the vocabulary hides),
so the rubric cost is bounded by the cap, never by room size. The value is read at
call time in `lib/core/eureka/reasoning-mode.cjs` (`reasoningMaxPairs()`), so an
override in a child process env is honored immediately.
**Default:** `25` (a positive integer). Chosen to match the embedded path's own
`--top 25` ranked-list length, so the reasoning fallback surfaces a working
diagnosis of the same shape and size the full embedded run would. Byte-matches the
`reasoning-mode.cjs` source constant (`envInt('MINDRIAN_EUREKA_REASONING_MAX_PAIRS', 25)`).
**Why (D8 bounded fan-out):** The reasoning path deliberately runs no AHP composite
(a blended quality score would fuse trust-in-evidence with pair plausibility, the
explicit Bad case), so this cap is the ONLY cost control on the fallback and there is
no new AHP floor to tune alongside it. Raise it (for example `40`) only if a large
room's genuine cross-domain pairs are being pre-filtered out before the rubric sees
them; lower it (for example `10`) to keep a self-judging session short. Any
non-integer or non-positive value falls back to the calibrated default.

```bash
export MINDRIAN_EUREKA_REASONING_MAX_PAIRS=25
```

## Verb/Reach Affinity Margin (Phase 245, build-time only, zero egress)

Requirement 1's Brain-verb fusion term needs the INVERSE of
`reachIdToSkillFamily`: given a canonical verb, which of the frozen six reaches
does it key onto. That inverse is not a bijection (`'Run Methodology'` inverts to
BOTH `context_block` and `brain_consult`, and 5 of the 10 frozen
`CANONICAL_VERBS` have no reach preimage at all), so the affinity is derived
semantically at BUILD time by `scripts/derive-verb-reach-affinity.cjs` using the
already-shipped local encoder, then committed as the frozen
`VERB_REACH_AFFINITY` table in `lib/core/verb-reach-affinity.cjs`. The runtime
lookup is a plain frozen-object read: zero cost, zero I/O, zero network. The
variable below tunes the DERIVATION, not the runtime.

### MINDRIAN_AFFINITY_MARGIN

**What:** The top1-minus-top2 cosine margin that decides, per canonical verb,
whether one reach wins outright or several are tied. A verb whose margin is at or
above this value maps to `{ winner: 1 }`. A verb whose margin falls below it maps
to an even split across every reach within the margin of the top score (this is
what gives `'Run Methodology'`'s genuine two-way ambiguity a principled
resolution instead of an arbitrary pick). A verb whose best similarity is below
this value in ABSOLUTE terms maps to `null`, the documented no-op for a verb with
no reach preimage. Resolved at module load in
`lib/core/verb-reach-affinity.cjs` (`resolveAffinityMargin()`) and read by
`scripts/derive-verb-reach-affinity.cjs`.
**Default:** `0.05`, accepted range `(0, 1)` exclusive. Any non-numeric,
non-finite, non-positive, or out-of-range value silently falls back to `0.05`
(the same garbage-falls-back-never-warns discipline as `BRAIN_STALE_AGE_DAYS`).
**Why 0.05 and why TUNABLE-LATER:** it is a low-data starting point carried over
from the sibling `embedding-classifier.cjs` margin discipline, not a value
calibrated against a verb/reach outcome corpus, because no such corpus exists
yet. Raise it (for example `0.10`) to make the derivation more conservative,
producing more ties and more `null`s rather than confident single winners; lower
it (for example `0.02`) to force more outright winners. Revisit once the 245-07
fusion term has produced enough outcome edges to measure whether the split verbs
actually behave as ties in practice.
**Scope note:** changing this variable changes nothing at runtime on its own. It
only affects a fresh `node scripts/derive-verb-reach-affinity.cjs` run, and that
script gates NO build and NO release by design (an encoder failure must never
block a cut).

```bash
export MINDRIAN_AFFINITY_MARGIN=0.05
```

### MINDRIAN_AFFINITY_FLOOR

**What:** The ABSOLUTE cosine below which a verb is recorded as having no reach
affinity at all (`null`). This is a different question from
`MINDRIAN_AFFINITY_MARGIN` above, which is a RELATIVE top1-minus-top2 spread, and
the two need numbers on completely different scales.
**Default:** `0.70`, accepted range `(0, 1)` exclusive, same
garbage-falls-back-never-warns parse as the margin.
**Why a separate constant exists:** a sentence encoder's cosine is not a
zero-based scale. The shipped default model (`MongoDB/mdbr-leaf-ir`) returns
roughly `0.40` to `0.55` for two ARBITRARY UNRELATED English phrases, so a
margin-sized `0.05` absolute floor is structurally unreachable: the `null` branch
becomes dead code and every verb gets force-fitted onto some reach. The first
live derivation run demonstrated exactly that, emitting a 5-way `0.2` split for
`'Synthesize'` and a 3-way split for `'Bank Opportunity'`.
**Calibration, stated honestly rather than presented as derived:** `0.70` sits
inside a `0.069`-wide empty band in that first live cosine matrix, separating
every forward-map-confirmed verb (top1 in `0.7615` .. `0.8626`) from every verb
with no reach preimage (top1 in `0.5229` .. `0.6929`). It also coincides with the
already-frozen Canon Part 3 `RECOMMEND_FLOOR` of `0.70`, the value this codebase
already treats as "confident enough to recommend". It is TUNABLE-LATER and is NOT
calibrated against an outcome corpus, because none exists yet. Raise it to record
more verbs as `null`; lower it to let weaker semantic affinities through.
**Scope note:** like the margin, this changes nothing at runtime on its own. It
affects only a fresh `node scripts/derive-verb-reach-affinity.cjs` run, and that
script gates no build and no release by design.

```bash
export MINDRIAN_AFFINITY_FLOOR=0.70
```

## Reach Signal Fusion (Phase 245, room-local, zero egress)

`buildSignalNudges` in `lib/workflow/reach-hedge-ranker.cjs` blends three inputs
into a `reach_id`-keyed score map that 245-08 merges at the dial render callsite:
the TOP-ranked fired sensor reach, every OTHER distinct fired reach, and Brain's
suggested canonical verb routed through `verbReachAffinity`. Everything it reads
is a `reach_id` enum, a `CANONICAL_VERBS` enum member, or a number. No prose, no
db, no fs, no network, no Brain call.

The one thing to understand before touching either variable: these are FRACTIONS
OF HEADROOM, never additive scores. The fusion computes
`base + fraction * (FUSION_CEILING - base)` with `FUSION_CEILING = 0.69`, which
sits deliberately below the frozen Canon Part 3 `RECOMMEND_FLOOR` of `0.70`. That
shape is what makes the bound STRUCTURAL: because the summed fraction is capped
at `NUDGE_FRACTION_CAP = 0.95`, strictly below 1, the fused score is strictly
below `0.69` for every base, no matter how the two variables below are set. The
fusion changes WHICH reach ranks first; it can never promote a reach to
RECOMMENDED. Setting either variable to a hostile value cannot break that
invariant, which is why both accept a plain fallback rather than a warning.

### MINDRIAN_SENSOR_TOP_FRACTION

**What:** The share of the remaining distance to `FUSION_CEILING` granted to the
`reach_id` of the TOP-ranked fired sensor reach, i.e. index 0 of the array
`rankFiredCandidates` returned, with the Phase 245-07 `SENS_PRIORITY` tie-break
already applied.
**Default:** `0.60`, accepted range `(0, 1]`. Anything unset, empty,
non-numeric, non-finite, zero, negative, or greater than 1 silently falls back.
**Why:** at the default, a fired reach with no supplied base score fuses to
`0.5 + 0.60 * (0.69 - 0.5) = 0.614`, which strictly exceeds the orchestrator's
`0.5` registry default for `cross_room`. That headroom is what makes a reorder
achievable at all: a smaller fraction leaves a fired reach unable to out-rank an
unfired registry-only one, and Requirement 1's "the dial's top item changes when
the signal changes" acceptance criterion quietly stops being satisfiable. Raise
it to make a fired sensor dominate the ranking harder; lower it to make the
supplied base scores matter more. TUNABLE-LATER from dial-outcome telemetry.
**Scope note:** room-local and per-turn. It affects ranking ORDER only, never
marker state, and never leaves the machine.

```bash
export MINDRIAN_SENSOR_TOP_FRACTION=0.60
```

### MINDRIAN_BRAIN_VERB_FRACTION

**What:** The share of the remaining headroom granted to the `reach_id`s that
`verbReachAffinity(brainVerb)` names, multiplied by that entry's per-reach
weight.
**Default:** `0.35`, accepted range `(0, 1]`, same silent-fallback parse.
**Why:** it sits below the sensor top fraction on purpose, because a fired sensor
is a this-turn observation while the Brain verb is a session-derived suggestion.
The per-reach multiply is load-bearing rather than decorative: `'Run Methodology'`
is by far the most common verb in the vocabulary and returns a TWO-entry
`0.5 / 0.5` split across `context_block` and `brain_consult`, so an ambiguous verb
SPLITS its fraction instead of landing at full strength on both reaches. Note
also that 5 of the 10 canonical verbs have no reach preimage and return `null`,
which means "contribute no verb term this turn", not "contribute zero to every
reach", so on those turns this variable has no effect at all.
**Scope note:** applies ONLY in `mode_a`. Canon Part 3 makes `mode_b` local-only
and `tier_0` the Brain-absent fallback, so a Brain-derived nudge has no standing
in either and this variable is inert there. The sensor terms are unaffected by
tier.

```bash
export MINDRIAN_BRAIN_VERB_FRACTION=0.35
```

## MINDRIAN_MCP_FIRST (MCP daemon lifecycle, no longer a room-resolution gate)

**Not documented here before Phase 248** -- this entry closes that gap, and states the flag's
CURRENT meaning explicitly so a silent semantic drift never goes unrecorded again (research
Open Question 2 / D-07 amendment: "a flag whose documented meaning silently changed is this
repo's known bug class").

**What it used to gate (pre-Phase 248, now REPEALED):** every one of the nine MCP room
resolvers only consulted a session's `room_bind` write inside `if (isMcpFirst(surface))`, and
`MINDRIAN_MCP_FIRST` is unset on every install by default (D-07) -- so a bound session's write
was, in practice, never read. Phase 248 collapsed all nine copies into
`lib/mcp/session-room.cjs`, whose read path calls the core session-aware resolver
UNCONDITIONALLY. **Room RESOLUTION no longer consults this flag at all**, for any surface, in
any state.

**Its remaining LIVE consumers** (re-grepped at execution time via
`grep -rn "isMcpFirst(" lib/ bin/ --include=*.cjs`; comments excluded, executable call sites
only):

| File | What it gates now |
|------|--------------------|
| `lib/mcp/mcp-first-flag.cjs` (the definition itself, plus `isWritePathEnabled`'s internal call) | The WRITE-PATH PERMISSION gate for foreign MCP hosts (`graph_write`/`memory_event`/`artifact_file`), a Phase 234-05 concern entirely orthogonal to room resolution -- "may this call write", never "which room does this call read". 2026-08-19: since quick task 260819-bql, the default-on population also includes Claude Code itself; the flag's remaining override value is for an unidentified client or the tier1 hosts (Grok Build, OpenCode) that keep their own hook channel. |
| `bin/mindrian-mcp-server.cjs` (`isMcpFirst(surface.surface)`, the daemon's HTTP branch) | DAEMON LIFECYCLE: whether the Streamable HTTP transport wires a per-session transport map (`sessionIdGenerator: randomUUID`, real per-connection `extra.sessionId`, the pidfile/port-discovery/SSE-event-bus machinery) or the byte-identical-legacy single shared stateless transport (`sessionIdGenerator: undefined`, no per-connection session id at all). |

**Why the daemon-lifecycle consumer still matters even though resolution is unconditional:**
on the Streamable HTTP transport, `extra.sessionId` is populated PER CONNECTION only when the
per-session transport map is active. With the flag unset, every HTTP connection shares ONE
stateless transport and gets no per-connection session id, so `session.primary` binding
(now honored unconditionally on the read side) has no per-connection identity to attach to in
the first place. This is why `tests/test-248-surface-probes.cjs`'s Cowork-equivalent leg sets
`MINDRIAN_MCP_FIRST=cowork` in its own child spawn -- a daemon-lifecycle prerequisite for
observing the isolation proof, not a room-resolution dependency.

```bash
export MINDRIAN_MCP_FIRST=cowork   # or 'all', or a comma-separated surface list
```

## Usage in settings.json

These can be documented in settings.json for team awareness:

```json
{
  "env_recommendations": {
    "AUTOCOMPACT_PCT_OVERRIDE": {
      "value": "85",
      "rationale": "Room-aware threshold - gives PreCompact hook time to save context"
    },
    "MAX_THINKING_TOKENS": {
      "value": "32768",
      "rationale": "Deeper reasoning for grading and methodology sessions"
    },
    "CLAUDE_CODE_MAX_CONTEXT_TOKENS": {
      "value": "1000000",
      "rationale": "1M context for deep pipeline sessions"
    }
  }
}
```

## Source

Identified via ccleaks.com Claude Code capability audit (2026-03-31). See docs/research/RESEARCH_11_POWERHOUSE_SESSION.md for full analysis.
