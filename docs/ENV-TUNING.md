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
