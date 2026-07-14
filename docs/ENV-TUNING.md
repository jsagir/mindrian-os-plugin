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
